import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const userId = await authenticateRequest(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object required in body' });
    }

    const db = await getDb();
    const collection = db.collection('sites');

    // Build $set with dotted paths so we only update provided fields
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
