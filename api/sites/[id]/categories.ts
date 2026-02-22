import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const userId = await authenticateRequest(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    const db = await getDb();
    const site = await db.collection('sites').findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (!site.url || !site.username || !site.applicationPassword) {
      return res.status(400).json({ error: 'Site credentials not configured' });
    }

    // Fetch categories from the WordPress REST API
    const baseUrl = site.url.startsWith('http') ? site.url : `https://${site.url}`;
    const authHeader =
      'Basic ' +
      Buffer.from(`${site.username}:${site.applicationPassword}`).toString('base64');

    const categories: { id: number; name: string; slug: string; count: number; parent: number }[] = [];
    let page = 1;
    const perPage = 100;

    // Paginate through all categories (WordPress defaults to max 100 per page)
    while (true) {
      const response = await fetch(
        `${baseUrl}/wp-json/wp/v2/categories?per_page=${perPage}&page=${page}`,
        {
          headers: {
            Authorization: authHeader,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Categories] WordPress API error:', response.status, errorText);
        return res.status(502).json({ error: 'Failed to fetch categories from WordPress' });
      }

      const data = (await response.json()) as {
        id: number;
        name: string;
        slug: string;
        count: number;
        parent: number;
      }[];

      categories.push(
        ...data.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          count: c.count,
          parent: c.parent,
        })),
      );

      // Check if there are more pages
      const totalPages = parseInt(response.headers.get('x-wp-totalpages') || '1', 10);
      if (page >= totalPages) break;
      page++;
    }

    return res.status(200).json({ categories });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Categories]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
