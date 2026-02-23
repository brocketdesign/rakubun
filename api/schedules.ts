import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';

  switch (action) {
    case '':
      return handleSchedulesIndex(req, res);
    default:
      // Treat as schedule ID
      return handleScheduleById(req, res, action);
  }
}

// ─── schedules index (list / create) ────────────────────────────────────────

async function handleSchedulesIndex(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    const collection = db.collection('schedules');

    if (req.method === 'GET') {
      const { status } = req.query;
      const filter: Record<string, unknown> = { userId };
      if (status && typeof status === 'string') {
        filter.status = status;
      }

      const schedules = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();

      const mapped = schedules.map((s) => ({
        id: s._id.toString(),
        siteId: s.siteId,
        topics: s.topics || [],
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

      return res.status(200).json({ schedules: mapped });
    }

    if (req.method === 'POST') {
      const { siteId, topics } = req.body || {};

      if (!siteId || !Array.isArray(topics) || topics.length === 0) {
        return res.status(400).json({ error: 'siteId and topics array are required' });
      }

      const now = new Date().toISOString();
      const doc = {
        userId,
        siteId,
        topics: topics.map((t: any) => ({
          title: t.title || '',
          description: t.description || '',
          date: t.date || t.suggestedDate || '',
          time: t.time || '09:00',
        })),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      const result = await collection.insertOne(doc);

      return res.status(201).json({
        id: result.insertedId.toString(),
        siteId: doc.siteId,
        topics: doc.topics,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
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

// ─── schedule by ID (update / delete) ───────────────────────────────────────

async function handleScheduleById(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    const userId = await authenticateRequest(req);

    if (!ObjectId.isValid(id)) {
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
