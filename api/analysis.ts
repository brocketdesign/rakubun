import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';
import { enforceAnalysisAccess, FeatureGateError } from './lib/subscription.js';
import { fetchWithRetry } from './lib/wordpress.js';

export const config = {
  maxDuration: 60,
};

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AnalysisScores {
  seoScore: number;
  toneScore: number;
  structureScore: number;
  contentGaps: number;
}

interface AnalysisCategory {
  category: string;
  score: number;
  issues: string[];
  suggestions: string[];
}

interface AnalysisReport {
  _id?: ObjectId;
  userId: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number;
  scores: AnalysisScores | null;
  categories: AnalysisCategory[];
  summary: string | null;
  pagesAnalyzed: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';

  try {
    switch (action) {
      case 'list':
        return handleListReports(req, res);
      case 'run':
        return handleRunAnalysis(req, res);
      case 'detail':
        return handleGetReport(req, res);
      case 'delete':
        return handleDeleteReport(req, res);
      default:
        return res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err instanceof FeatureGateError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('[Analysis]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── List Reports ──────────────────────────────────────────────────────────────

async function handleListReports(req: VercelRequest, res: VercelResponse) {
  const userId = await authenticateRequest(req);
  const db = await getDb();
  const siteId = (req.query.siteId as string) || '';

  const filter: Record<string, unknown> = { userId };
  if (siteId) filter.siteId = siteId;

  const reports = await db
    .collection('analysis_reports')
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const mapped = reports.map((r) => ({
    id: r._id.toString(),
    siteId: r.siteId,
    siteName: r.siteName,
    siteUrl: r.siteUrl,
    status: r.status,
    progress: r.progress,
    scores: r.scores,
    categories: r.categories,
    summary: r.summary,
    pagesAnalyzed: r.pagesAnalyzed || 0,
    error: r.error,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
  }));

  return res.status(200).json({ reports: mapped });
}

// ─── Get Report Detail ─────────────────────────────────────────────────────────

async function handleGetReport(req: VercelRequest, res: VercelResponse) {
  const userId = await authenticateRequest(req);
  const db = await getDb();
  const reportId = req.query.reportId as string;

  if (!reportId || !ObjectId.isValid(reportId)) {
    return res.status(400).json({ error: 'Valid reportId is required' });
  }

  const report = await db.collection('analysis_reports').findOne({
    _id: new ObjectId(reportId),
    userId,
  });

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  return res.status(200).json({
    id: report._id.toString(),
    siteId: report.siteId,
    siteName: report.siteName,
    siteUrl: report.siteUrl,
    status: report.status,
    progress: report.progress,
    scores: report.scores,
    categories: report.categories,
    summary: report.summary,
    pagesAnalyzed: report.pagesAnalyzed || 0,
    error: report.error,
    createdAt: report.createdAt,
    completedAt: report.completedAt,
  });
}

// ─── Delete Report ──────────────────────────────────────────────────────────────

async function handleDeleteReport(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await authenticateRequest(req);
  const db = await getDb();
  const reportId = req.query.reportId as string;

  if (!reportId || !ObjectId.isValid(reportId)) {
    return res.status(400).json({ error: 'Valid reportId is required' });
  }

  await db.collection('analysis_reports').deleteOne({
    _id: new ObjectId(reportId),
    userId,
  });

  return res.status(200).json({ success: true });
}

// ─── Run Analysis ──────────────────────────────────────────────────────────────

async function handleRunAnalysis(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await authenticateRequest(req);
  await enforceAnalysisAccess(userId);

  const { siteId } = req.body || {};
  if (!siteId) {
    return res.status(400).json({ error: 'siteId is required' });
  }

  const db = await getDb();

  // Fetch site info
  const site = await db.collection('sites').findOne({
    _id: new ObjectId(siteId),
    userId,
  });

  if (!site) {
    return res.status(404).json({ error: 'Site not found' });
  }

  // Create report in pending state
  const now = new Date().toISOString();
  const report: Omit<AnalysisReport, '_id'> = {
    userId,
    siteId,
    siteName: site.name || site.url,
    siteUrl: site.url,
    status: 'in-progress',
    progress: 0,
    scores: null,
    categories: [],
    summary: null,
    pagesAnalyzed: 0,
    error: null,
    createdAt: now,
    completedAt: null,
  };

  const result = await db.collection('analysis_reports').insertOne(report);
  const reportId = result.insertedId.toString();

  // Start async analysis (non-blocking)
  runAnalysisAsync(db, reportId, userId, site).catch((err) => {
    console.error('[Analysis] Async analysis failed:', err);
  });

  return res.status(201).json({
    id: reportId,
    status: 'in-progress',
    message: 'Analysis started',
  });
}

// ─── Async Analysis Logic ──────────────────────────────────────────────────────

async function runAnalysisAsync(
  db: Awaited<ReturnType<typeof getDb>>,
  reportId: string,
  userId: string,
  site: Record<string, unknown>,
) {
  const collection = db.collection('analysis_reports');
  const oid = new ObjectId(reportId);

  try {
    // Step 1: Fetch recent posts from the WordPress site
    await collection.updateOne({ _id: oid }, { $set: { progress: 10 } });

    const siteUrl = (site.url as string).startsWith('http')
      ? site.url as string
      : `https://${site.url}`;

    const username = site.username as string;
    const appPassword = site.applicationPassword as string;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');

    // Fetch up to 10 recent posts
    let posts: Array<{ title: string; content: string; link: string }> = [];
    try {
      const postsResp = await fetchWithRetry(
        `${siteUrl}/wp-json/wp/v2/posts?per_page=10&status=publish&orderby=date&order=desc`,
        { headers: { Authorization: authHeader } },
        { timeoutMs: 15_000, maxRetries: 1, label: 'fetchPosts' },
      );

      if (postsResp.ok) {
        const rawPosts = (await postsResp.json()) as Array<{
          title: { rendered: string };
          content: { rendered: string };
          link: string;
        }>;
        posts = rawPosts.map((p) => ({
          title: p.title.rendered.replace(/<[^>]*>/g, ''),
          content: p.content.rendered.replace(/<[^>]*>/g, '').slice(0, 2000),
          link: p.link,
        }));
      }
    } catch (err) {
      console.warn('[Analysis] Failed to fetch posts:', err instanceof Error ? err.message : err);
    }

    if (posts.length === 0) {
      await collection.updateOne(
        { _id: oid },
        {
          $set: {
            status: 'failed',
            error: 'No published posts found on this site.',
            progress: 100,
          },
        },
      );
      return;
    }

    await collection.updateOne({ _id: oid }, { $set: { progress: 30, pagesAnalyzed: posts.length } });

    // Step 2: Use OpenAI to analyze the content
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const contentSample = posts
      .map((p, i) => `--- Post ${i + 1}: "${p.title}" ---\n${p.content}`)
      .join('\n\n');

    const systemPrompt = `You are an expert website content analyst. Analyze the provided blog posts and return a detailed JSON analysis report. The report must include:

1. "seoScore" (0-100): Overall SEO quality based on heading usage, keyword presence, meta-friendly content, internal link potential.
2. "toneScore" (0-100): Writing tone consistency and professionalism.
3. "structureScore" (0-100): Content structure quality including heading hierarchy, paragraph length, readability.
4. "contentGaps" (number): Number of identified content gaps or missing topics.
5. "summary" (string): A concise 2-3 sentence overall assessment.
6. "categories" (array): Detailed breakdown with exactly 4 objects:
   - { "category": "SEO Analysis", "score": <0-100>, "issues": [...], "suggestions": [...] }
   - { "category": "Tone & Voice", "score": <0-100>, "issues": [...], "suggestions": [...] }
   - { "category": "Content Structure", "score": <0-100>, "issues": [...], "suggestions": [...] }
   - { "category": "Gap Detection", "score": <0-100>, "issues": [...], "suggestions": [...] }

Each "issues" and "suggestions" array should have 2-4 items.

IMPORTANT: Return ONLY valid JSON, no markdown code fences or extra text.`;

    await collection.updateOne({ _id: oid }, { $set: { progress: 50 } });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyze these ${posts.length} blog posts from "${site.name || site.url}":\n\n${contentSample}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    await collection.updateOne({ _id: oid }, { $set: { progress: 80 } });

    const raw = completion.choices[0]?.message?.content || '{}';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Failed to parse AI analysis response');
    }

    const scores: AnalysisScores = {
      seoScore: clamp(Number(parsed.seoScore) || 70, 0, 100),
      toneScore: clamp(Number(parsed.toneScore) || 70, 0, 100),
      structureScore: clamp(Number(parsed.structureScore) || 70, 0, 100),
      contentGaps: Math.max(0, Number(parsed.contentGaps) || 0),
    };

    const categories = Array.isArray(parsed.categories)
      ? (parsed.categories as AnalysisCategory[]).map((c) => ({
          category: String(c.category || 'Unknown'),
          score: clamp(Number(c.score) || 70, 0, 100),
          issues: Array.isArray(c.issues) ? c.issues.map(String).slice(0, 5) : [],
          suggestions: Array.isArray(c.suggestions) ? c.suggestions.map(String).slice(0, 5) : [],
        }))
      : [];

    const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Analysis completed.';

    // Step 3: Save results
    await collection.updateOne(
      { _id: oid },
      {
        $set: {
          status: 'completed',
          progress: 100,
          scores,
          categories,
          summary,
          pagesAnalyzed: posts.length,
          completedAt: new Date().toISOString(),
        },
      },
    );
  } catch (err) {
    console.error('[Analysis] Analysis error:', err);
    await collection.updateOne(
      { _id: oid },
      {
        $set: {
          status: 'failed',
          progress: 100,
          error: err instanceof Error ? err.message : 'Analysis failed',
        },
      },
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
