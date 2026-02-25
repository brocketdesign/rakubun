import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';
import { enforceResearchAccess, FeatureGateError } from './lib/subscription.js';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface FirecrawlSearchResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    publishedTime?: string;
    ogImage?: string;
    siteName?: string;
    [key: string]: unknown;
  };
}

interface SearchResultItem {
  id: string;
  title: string;
  source: string;
  url: string;
  summary: string;
  date: string;
  relevance: number;
  provider: 'openai' | 'firecrawl';
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function extractSummary(result: FirecrawlSearchResult): string {
  if (result.description) return result.description;
  if (result.metadata?.description) return result.metadata.description;
  if (result.markdown) return result.markdown.slice(0, 280).replace(/\n/g, ' ').trim() + '…';
  return '';
}

function extractSource(result: FirecrawlSearchResult): string {
  if (result.metadata?.siteName) return result.metadata.siteName;
  try {
    return new URL(result.url).hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

function extractSourceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

function extractDate(result: FirecrawlSearchResult): string {
  if (result.metadata?.publishedTime) {
    return formatRelativeDate(result.metadata.publishedTime);
  }
  return 'Recent';
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recent';
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString();
}

function deduplicateResults(results: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    // Normalise URL to avoid near-duplicates
    const key = r.url.replace(/\/+$/, '').replace(/^https?:\/\//, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';

  if (action === 'search') return handleSearch(req, res);
  if (action === 'deep-research') return handleDeepResearch(req, res);

  return res.status(404).json({ error: 'Not found' });
}

// ─── Search action (combines OpenAI web search + Firecrawl) ─────────────────

async function handleSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    await enforceResearchAccess(userId);

    const { query, siteId } = req.body || {};
    if (!query && !siteId) {
      return res.status(400).json({ error: 'query or siteId is required' });
    }

    let searchQuery = query || '';
    let siteUrl = '';
    let siteName = '';

    // Resolve site details if siteId provided
    if (siteId) {
      const db = await getDb();
      const { ObjectId } = await import('mongodb');
      const site = await db.collection('sites').findOne({
        _id: new ObjectId(siteId),
        userId,
      });

      if (!site) {
        return res.status(404).json({ error: 'Site not found' });
      }

      siteUrl = site.url as string;
      siteName = (site.name as string) || '';

      if (!searchQuery) {
        searchQuery = `trending content ideas for ${siteName || siteUrl}`;
      } else {
        searchQuery = `${searchQuery} related to ${siteName || siteUrl}`;
      }
    }

    // Scrape site context via Firecrawl (non-blocking best-effort)
    let siteContext = '';
    if (siteUrl) {
      siteContext = await scrapeSiteContext(siteUrl);
    }

    // Run both providers in parallel
    const [openaiResults, firecrawlResults] = await Promise.all([
      searchWithOpenAI(searchQuery, siteContext, siteName),
      searchWithFirecrawl(searchQuery, siteContext),
    ]);

    // Merge & deduplicate: OpenAI results first, then Firecrawl
    const merged = deduplicateResults([...openaiResults, ...firecrawlResults]);

    return res.status(200).json({
      results: merged,
      query: searchQuery,
      total: merged.length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err instanceof FeatureGateError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('Research search error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Deep Research action (OpenAI long-form analysis) ───────────────────────

async function handleDeepResearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    await enforceResearchAccess(userId);

    const { query, siteId } = req.body || {};
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    let siteContext = '';
    let siteName = '';
    if (siteId) {
      const db = await getDb();
      const { ObjectId } = await import('mongodb');
      const site = await db.collection('sites').findOne({
        _id: new ObjectId(siteId),
        userId,
      });
      if (site) {
        siteName = (site.name as string) || '';
        siteContext = await scrapeSiteContext(site.url as string);
      }
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const siteInstruction = siteContext
      ? `\nThe user runs a blog called "${siteName}" with the following focus:\n${siteContext.slice(0, 300)}\nTailor the research to be relevant for this blog's audience.`
      : '';

    // @ts-ignore - responses API
    const response = await openai.responses.create({
      model: 'gpt-5.2',
      tools: [{ type: 'web_search' }],
      input: `You are a content research expert. The user wants an in-depth analysis about: "${query}".${siteInstruction}

Search the web for the latest information, trends, data, and expert opinions on this topic.

Return a well-structured Markdown report with:
- **Executive Summary** (2-3 sentences)
- **Key Findings** (5-8 bullet points with concrete data/facts, each citing a source URL)
- **Trending Angles** (3-5 unique content ideas/angles a blogger could write about)
- **Competitive Landscape** (who is writing about this and what angles are they taking)
- **Recommended Next Steps** (actionable suggestions)

Be specific, cite real sources with URLs, and include recent data. Do not fabricate sources.`,
    });

    // @ts-ignore
    const report: string = response.output_text || '';

    return res.status(200).json({
      report,
      query,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err instanceof FeatureGateError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('Deep research error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Provider: OpenAI Web Search ────────────────────────────────────────────

async function searchWithOpenAI(
  query: string,
  siteContext: string,
  siteName: string,
): Promise<SearchResultItem[]> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return [];

    const openai = new OpenAI({ apiKey });

    const contextHint = siteContext
      ? `\nContext: this research is for a blog called "${siteName}" about: ${siteContext.slice(0, 200)}`
      : '';

    // @ts-ignore - responses API
    const response = await openai.responses.create({
      model: 'gpt-5.2',
      tools: [{ type: 'web_search' }],
      input: `Search the web for trending and recent content related to: "${query}".${contextHint}

Find 10 highly relevant, recent articles, blog posts, or news pieces.

Return ONLY a valid JSON array (no markdown fences, no explanation). Each element:
{
  "title": "Article title",
  "url": "https://...",
  "source": "Site name or domain",
  "summary": "2-3 sentence summary of the article",
  "date": "ISO date string or approximate like 2025-02-20",
  "relevance": 95
}

Rules:
- Only include real, existing URLs you found via web search
- relevance should be 50-100 based on how relevant the content is to the query
- Sort by relevance (highest first)
- Include diverse sources, not all from the same domain`,
    });

    // @ts-ignore
    const rawText: string = response.output_text || '';

    // Parse JSON from response (may have markdown fences)
    const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();

    // Try to find a JSON array in the text
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return [];

    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((r: Record<string, unknown>) => r.url && r.title)
      .map((r: Record<string, unknown>, i: number) => ({
        id: `oai-${Date.now()}-${i}`,
        title: String(r.title || ''),
        source: String(r.source || extractSourceFromUrl(String(r.url))),
        url: String(r.url),
        summary: String(r.summary || ''),
        date: r.date ? formatRelativeDate(String(r.date)) : 'Recent',
        relevance: Math.min(100, Math.max(50, Number(r.relevance) || 80)),
        provider: 'openai' as const,
      }));
  } catch (err) {
    console.error('OpenAI web search failed:', err);
    return [];
  }
}

// ─── Provider: Firecrawl Search ─────────────────────────────────────────────

async function searchWithFirecrawl(
  query: string,
  siteContext: string,
): Promise<SearchResultItem[]> {
  try {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return [];

    const finalQuery = siteContext
      ? `${query}. Context: this is for a blog about: ${siteContext.slice(0, 200)}`
      : query;

    const searchRes = await fetch(`${FIRECRAWL_API}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: finalQuery,
        limit: 10,
        lang: 'en',
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        },
      }),
    });

    if (!searchRes.ok) {
      console.error('Firecrawl search error:', await searchRes.text());
      return [];
    }

    const searchData = (await searchRes.json()) as { data?: FirecrawlSearchResult[] };
    const rawResults: FirecrawlSearchResult[] = searchData?.data || [];

    return rawResults.map((r, i) => ({
      id: `fc-${Date.now()}-${i}`,
      title: r.title || r.metadata?.title || r.url,
      source: extractSource(r),
      url: r.url,
      summary: extractSummary(r),
      date: extractDate(r),
      relevance: Math.max(50, 95 - i * 5),
      provider: 'firecrawl' as const,
    }));
  } catch (err) {
    console.error('Firecrawl search failed:', err);
    return [];
  }
}

// ─── Scrape site context via Firecrawl ──────────────────────────────────────

async function scrapeSiteContext(siteUrl: string): Promise<string> {
  try {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return '';

    const scrapeRes = await fetch(`${FIRECRAWL_API}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 15000,
      }),
    });

    if (scrapeRes.ok) {
      const scrapeData = (await scrapeRes.json()) as { data?: { markdown?: string } };
      const md = scrapeData?.data?.markdown || '';
      return md.slice(0, 500).replace(/\n/g, ' ').trim();
    }
  } catch {
    // Non-critical – site context is best-effort
  }
  return '';
}
