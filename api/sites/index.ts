import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';

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
      const doc = {
        userId,
        name,
        url: cleanUrl,
        username,
        status: 'connected',
        articlesGenerated: 0,
        lastSync: new Date(now).toISOString(),
        lastSyncTimestamp: now,
        wpVersion: '6.7',
        favicon: '🌐',
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
