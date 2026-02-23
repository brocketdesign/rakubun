import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid schedule ID' });
    }

    const db = await getDb();
    const collection = db.collection('schedules');
    const objectId = new ObjectId(id);

    if (req.method === 'PUT') {
      const { status, topics } = req.body || {};
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (status) updates.status = status;
      if (topics) updates.topics = topics;

      const result = await collection.findOneAndUpdate(
        { _id: objectId, userId },
        { $set: updates },
        { returnDocument: 'after' },
      );

      if (!result) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      return res.status(200).json({
        id: result._id.toString(),
        siteId: result.siteId,
        topics: result.topics || [],
        status: result.status,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      });
    }

    if (req.method === 'DELETE') {
      const result = await collection.deleteOne({ _id: objectId, userId });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Schedule not found' });
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
