import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const userId = await authenticateRequest(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    const db = await getDb();
    const collection = db.collection('sites');
    const now = Date.now();

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), userId },
      {
        $set: {
          status: 'connected',
          lastSync: new Date(now).toISOString(),
          lastSyncTimestamp: now,
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
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
