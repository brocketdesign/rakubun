import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateAgentRequest, AgentAuthError } from '../lib/agent-auth.js';

/**
 * GET /api/agent/sites
 *
 * List all WordPress sites available to the authenticated agent.
 *
 * Headers:
 *   X-API-Key: <your-api-key>
 *
 * Returns:
 *   { sites: [{ id, name, url, status, articlesGenerated, settings }] }
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
    const collection = db.collection('sites');

    const { id } = req.query;

    // If an ID is provided, return single site with categories
    if (id && typeof id === 'string' && ObjectId.isValid(id)) {
      const siteDoc = await collection.findOne({ _id: new ObjectId(id), userId });
      if (!siteDoc) {
        return res.status(404).json({ error: 'Site not found' });
      }

      // Fetch categories from WordPress
      let categories: { id: number; name: string; slug: string; count: number }[] = [];
      try {
        const baseUrl = siteDoc.url.startsWith('http') ? siteDoc.url : `https://${siteDoc.url}`;
        const authHeader = 'Basic ' + Buffer.from(`${siteDoc.username}:${siteDoc.applicationPassword}`).toString('base64');

        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const catRes = await fetch(
            `${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/categories?per_page=100&page=${page}`,
            { headers: { Authorization: authHeader } },
          );
          if (!catRes.ok) break;
          const batch = (await catRes.json()) as any[];
          categories.push(
            ...batch.map((c: any) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              count: c.count,
            })),
          );
          hasMore = batch.length === 100;
          page++;
        }
      } catch {
        // Non-critical — return site without categories
      }

      return res.status(200).json({
        site: {
          id: siteDoc._id.toString(),
          name: siteDoc.name,
          url: siteDoc.url,
          status: siteDoc.status,
          articlesGenerated: siteDoc.articlesGenerated,
          settings: siteDoc.settings,
          categories,
        },
      });
    }

    // List all sites
    const sites = await collection.find({ userId }).toArray();
    const mapped = sites.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      url: s.url,
      status: s.status,
      articlesGenerated: s.articlesGenerated,
      settings: s.settings,
    }));

    return res.status(200).json({ sites: mapped, total: mapped.length });
  } catch (err) {
    if (err instanceof AgentAuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Agent] Sites error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
