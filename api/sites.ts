import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';
import { fetchWithRetry } from './lib/wordpress.js';

// ─── Favicon fetching ────────────────────────────────────────────────────────

async function fetchFavicon(siteUrl: string): Promise<string> {
  const baseUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  // 1. Try WordPress REST API root (includes site_icon_url in WP 5.4+)
  try {
    const resp = await fetchWithRetry(
      `${baseUrl}/wp-json/`,
      {},
      { timeoutMs: 8000, maxRetries: 1, label: 'fetchFavicon' },
    );
    if (resp.ok) {
      const data = (await resp.json()) as { site_icon_url?: string };
      if (data.site_icon_url) return data.site_icon_url;
    }
  } catch (e) {
    console.warn('[Sites] Favicon WP-JSON lookup failed:', e instanceof Error ? e.message : e);
  }

  // 2. Fallback: use Google's favicon service
  const domain = baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

const DEFAULT_SETTINGS = {
  autoSync: true,
  syncInterval: 30,
  defaultCategory: 'Uncategorized',
  defaultStatus: 'draft',
  autoImages: true,
  seoOptimization: true,
  language: 'en',
  timezone: 'UTC',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';
  const id = (req.query._id as string) || '';
  const subaction = (req.query._subaction as string) || '';

  // If we have an ID and a subaction, route to sub-handlers
  if (id && subaction) {
    switch (subaction) {
      case 'categories':
        return handleCategories(req, res, id);
      case 'settings':
        return handleSiteSettings(req, res, id);
      case 'sync':
        return handleSync(req, res, id);
      default:
        return res.status(404).json({ error: 'Not found' });
    }
  }

  // If we have an ID but no subaction, it's site by ID
  if (id) {
    return handleSiteById(req, res, id);
  }

  // If action is set (from single-segment rewrite), check if it's a known action or an ID
  if (action) {
    // No known named actions for sites at single-segment level, so treat as ID
    return handleSiteById(req, res, action);
  }

  // No action, no ID — list/create
  return handleSitesIndex(req, res);
}

// ─── sites index (list / create) ────────────────────────────────────────────

async function handleSitesIndex(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    const collection = db.collection('sites');

    if (req.method === 'GET') {
      const sites = await collection.find({ userId }).toArray();
      const mapped = sites.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        url: s.url,
        username: s.username,
        status: s.status,
        articlesGenerated: s.articlesGenerated,
        lastSync: s.lastSync,
        lastSyncTimestamp: s.lastSyncTimestamp,
        wpVersion: s.wpVersion,
        favicon: s.favicon,
        settings: s.settings,
      }));
      return res.status(200).json({ sites: mapped, total: mapped.length });
    }

    if (req.method === 'POST') {
      const { name, url, username, applicationPassword } = req.body || {};
      if (!name || !url || !username || !applicationPassword) {
        return res.status(400).json({ error: 'name, url, username, and applicationPassword are required' });
      }

      const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const now = Date.now();

      // Fetch real favicon from the WordPress site
      let favicon: string;
      try {
        favicon = await fetchFavicon(cleanUrl);
      } catch {
        favicon = '🌐';
      }

      const doc = {
        userId,
        name,
        url: cleanUrl,
        username,
        applicationPassword,
        status: 'connected',
        articlesGenerated: 0,
        lastSync: new Date(now).toISOString(),
        lastSyncTimestamp: now,
        wpVersion: '6.7',
        favicon,
        settings: { ...DEFAULT_SETTINGS },
        createdAt: new Date(now),
      };

      const result = await collection.insertOne(doc);
      return res.status(201).json({
        id: result.insertedId.toString(),
        ...doc,
        _id: undefined,
        userId: undefined,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── site by ID (get / update / delete) ─────────────────────────────────────

async function handleSiteById(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    const userId = await authenticateRequest(req);

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    const db = await getDb();
    const collection = db.collection('sites');
    const filter = { _id: new ObjectId(id), userId };

    if (req.method === 'GET') {
      const site = await collection.findOne(filter);
      if (!site) return res.status(404).json({ error: 'Site not found' });
      return res.status(200).json({
        id: site._id.toString(),
        name: site.name,
        url: site.url,
        username: site.username,
        hasApplicationPassword: !!site.applicationPassword,
        status: site.status,
        articlesGenerated: site.articlesGenerated,
        lastSync: site.lastSync,
        lastSyncTimestamp: site.lastSyncTimestamp,
        wpVersion: site.wpVersion,
        favicon: site.favicon,
        settings: site.settings,
      });
    }

    if (req.method === 'PUT') {
      const { username, applicationPassword } = req.body || {};

      const updates: Record<string, unknown> = {};
      if (username !== undefined) updates.username = username;
      if (applicationPassword !== undefined) updates.applicationPassword = applicationPassword;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const result = await collection.findOneAndUpdate(
        filter,
        { $set: updates },
        { returnDocument: 'after' },
      );

      if (!result) return res.status(404).json({ error: 'Site not found' });

      return res.status(200).json({
        id: result._id.toString(),
        name: result.name,
        url: result.url,
        username: result.username,
        hasApplicationPassword: !!result.applicationPassword,
        status: result.status,
        success: true,
      });
    }

    if (req.method === 'DELETE') {
      const result = await collection.deleteOne(filter);
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Site not found' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── categories ─────────────────────────────────────────────────────────────

async function handleCategories(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const userId = await authenticateRequest(req);

    if (!ObjectId.isValid(id)) {
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

    const baseUrl = site.url.startsWith('http') ? site.url : `https://${site.url}`;
    const authHeader =
      'Basic ' +
      Buffer.from(`${site.username}:${site.applicationPassword}`).toString('base64');

    const categories: { id: number; name: string; slug: string; count: number; parent: number }[] = [];
    let page = 1;
    const perPage = 100;
    const maxPages = 10; // safety limit to avoid infinite loops

    while (page <= maxPages) {
      const response = await fetchWithRetry(
        `${baseUrl}/wp-json/wp/v2/categories?per_page=${perPage}&page=${page}`,
        {
          headers: {
            Authorization: authHeader,
          },
        },
        { timeoutMs: 15000, maxRetries: 1, label: `fetchCategories(page=${page})` },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Categories] WordPress API error:', response.status, errorText);
        return res.status(502).json({ error: `Failed to fetch categories from WordPress (HTTP ${response.status})` });
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

// ─── site settings ──────────────────────────────────────────────────────────

async function handleSiteSettings(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    if (req.method !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const userId = await authenticateRequest(req);

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object required in body' });
    }

    const db = await getDb();
    const collection = db.collection('sites');

    const setObj: Record<string, unknown> = {};
    const allowedKeys = [
      'autoSync', 'syncInterval', 'defaultCategory', 'defaultStatus',
      'autoImages', 'seoOptimization', 'language', 'timezone',
    ];
    for (const key of allowedKeys) {
      if (key in settings) {
        setObj[`settings.${key}`] = settings[key];
      }
    }

    if (Object.keys(setObj).length === 0) {
      return res.status(400).json({ error: 'No valid settings fields provided' });
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), userId },
      { $set: setObj },
      { returnDocument: 'after' },
    );

    if (!result) {
      return res.status(404).json({ error: 'Site not found' });
    }

    return res.status(200).json({
      id: result._id.toString(),
      name: result.name,
      settings: result.settings,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── sync ───────────────────────────────────────────────────────────────────

async function handleSync(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const userId = await authenticateRequest(req);

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    const db = await getDb();
    const collection = db.collection('sites');
    const now = Date.now();

    // Look up the site first to get its URL for favicon fetching
    const site = await collection.findOne({ _id: new ObjectId(id), userId });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Fetch latest favicon
    let favicon: string;
    try {
      favicon = await fetchFavicon(site.url);
    } catch {
      favicon = site.favicon || '\uD83C\uDF10';
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), userId },
      {
        $set: {
          status: 'connected',
          lastSync: new Date(now).toISOString(),
          lastSyncTimestamp: now,
          favicon,
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) {
      return res.status(404).json({ error: 'Site not found' });
    }

    return res.status(200).json({
      id: result._id.toString(),
      name: result.name,
      url: result.url,
      status: result.status,
      lastSync: result.lastSync,
      lastSyncTimestamp: result.lastSyncTimestamp,
      favicon: result.favicon,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
