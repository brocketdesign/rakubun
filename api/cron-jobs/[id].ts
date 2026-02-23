import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid cron job ID' });
    }

    const db = await getDb();
    const collection = db.collection('cronJobs');
    const objectId = new ObjectId(id);

    if (req.method === 'PUT') {
      const updates = req.body || {};
      const allowedFields = [
        'schedule',
        'language',
        'wordCountMin',
        'wordCountMax',
        'imagesPerArticle',
        'articlesPerWeek',
        'style',
        'emailNotification',
        'status',
      ];

      const $set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          $set[field] = updates[field];
        }
      }

      const result = await collection.findOneAndUpdate(
        { _id: objectId, userId },
        { $set },
        { returnDocument: 'after' },
      );

      if (!result) {
        return res.status(404).json({ error: 'Cron job not found' });
      }

      return res.status(200).json({
        id: result._id.toHexString(),
        siteId: result.siteId,
        siteName: result.siteName || '',
        siteUrl: result.siteUrl || '',
        schedule: result.schedule || [],
        language: result.language || 'ja',
        wordCountMin: result.wordCountMin || 1000,
        wordCountMax: result.wordCountMax || 1500,
        imagesPerArticle: result.imagesPerArticle || 4,
        articlesPerWeek: result.articlesPerWeek || 7,
        style: result.style || '',
        emailNotification: result.emailNotification || '',
        cronJobId: result.cronJobId || '',
        status: result.status || 'active',
        createdAt: result.createdAt || new Date().toISOString(),
        updatedAt: result.updatedAt || new Date().toISOString(),
      });
    }

    if (req.method === 'DELETE') {
      const result = await collection.deleteOne({ _id: objectId, userId });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Cron job not found' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[CronJob]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
