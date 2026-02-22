import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) {
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
