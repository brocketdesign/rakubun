import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateAgentRequest, AgentAuthError } from '../lib/agent-auth.js';

/**
 * GET /api/agent/articles
 *   List articles. Supports query params: status, siteId, limit (default 20)
 *
 * GET /api/agent/articles?id=<articleId>
 *   Fetch a single article by ID
 *
 * Headers:
 *   X-API-Key: <your-api-key>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const userId = await authenticateAgentRequest(req);
    const db = await getDb();
    const collection = db.collection('articles');

    const { id, status, siteId, limit } = req.query;

    // Single article by ID
    if (id && typeof id === 'string' && ObjectId.isValid(id)) {
      const article = await collection.findOne({ _id: new ObjectId(id), userId });
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      return res.status(200).json({
        article: {
          id: article._id.toString(),
          title: article.title,
          excerpt: article.excerpt,
          content: article.content,
          site: article.site,
          category: article.category,
          status: article.status,
          wordCount: article.wordCount,
          seoScore: article.seoScore,
          thumbnailUrl: article.thumbnailUrl,
          imageUrls: article.imageUrls || [],
          scheduledAt: article.scheduledAt,
          publishedAt: article.publishedAt,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
          wpPostId: article.wpPostId || null,
          wpUrl: article.wpUrl || null,
          source: article.source || null,
        },
      });
    }

    // List articles with filters
    const filter: Record<string, unknown> = { userId };
    if (status && typeof status === 'string' && status !== 'all') {
      filter.status = status;
    }
    if (siteId && typeof siteId === 'string' && ObjectId.isValid(siteId)) {
      filter.site = siteId;
    }

    const maxResults = Math.min(parseInt(limit as string) || 20, 100);

    const articles = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(maxResults)
      .toArray();

    const mapped = articles.map((a) => ({
      id: a._id.toString(),
      title: a.title,
      excerpt: a.excerpt,
      site: a.site,
      category: a.category,
      status: a.status,
      wordCount: a.wordCount,
      seoScore: a.seoScore,
      thumbnailUrl: a.thumbnailUrl,
      scheduledAt: a.scheduledAt,
      publishedAt: a.publishedAt,
      createdAt: a.createdAt,
      wpPostId: a.wpPostId || null,
      wpUrl: a.wpUrl || null,
      source: a.source || null,
    }));

    return res.status(200).json({ articles: mapped, total: mapped.length });
  } catch (err) {
    if (err instanceof AgentAuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Agent] Articles list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
