import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';
import { enforceResearchAccess, FeatureGateError } from './lib/subscription.js';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';

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
}

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

function extractDate(result: FirecrawlSearchResult): string {
  if (result.metadata?.publishedTime) {
    const d = new Date(result.metadata.publishedTime);
    if (!isNaN(d.getTime())) {
      const diff = Date.now() - d.getTime();
      const hours = Math.floor(diff / 3_600_000);
      if (hours < 1) return 'Just now';
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString();
    }
  }
  return 'Recent';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';

  if (action === 'search') {
    return handleSearch(req, res);
  }

  return res.status(404).json({ error: 'Not found' });
}

async function handleSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);

    // Research is a premium-only feature
    await enforceResearchAccess(userId);

    const { query, siteId } = req.body || {};
    if (!query && !siteId) {
      return res.status(400).json({ error: 'query or siteId is required' });
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'FIRECRAWL_API_KEY is not configured' });
    }

    let searchQuery = query || '';
    let siteUrl = '';

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

      if (!searchQuery) {
        searchQuery = `trending content ideas for ${site.name || siteUrl}`;
      } else {
        searchQuery = `${searchQuery} related to ${site.name || siteUrl}`;
      }
    }

    let siteContext = '';
    if (siteUrl) {
      try {
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
          siteContext = md.slice(0, 500).replace(/\n/g, ' ').trim();
        }
      } catch {
        // Non-critical
      }
    }

    const finalQuery = siteContext
      ? `${searchQuery}. Context: this is for a blog about: ${siteContext.slice(0, 200)}`
      : searchQuery;

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
      const errText = await searchRes.text();
      console.error('Firecrawl search error:', errText);
      return res.status(502).json({ error: 'Failed to search via Firecrawl', details: errText });
    }

    const searchData = (await searchRes.json()) as { data?: FirecrawlSearchResult[] };
    const rawResults: FirecrawlSearchResult[] = searchData?.data || [];

    const results: SearchResultItem[] = rawResults.map((r, i) => ({
      id: `fc-${Date.now()}-${i}`,
      title: r.title || r.metadata?.title || r.url,
      source: extractSource(r),
      url: r.url,
      summary: extractSummary(r),
      date: extractDate(r),
      relevance: Math.max(50, 100 - i * 5),
    }));

    return res.status(200).json({
      results,
      query: searchQuery,
      total: results.length,
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
