import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';
import { randomUUID } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    const collection = db.collection('cronJobs');

    if (req.method === 'GET') {
      const docs = await collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

      const cronJobs = docs.map((doc) => ({
        id: doc._id.toHexString(),
        siteId: doc.siteId,
        siteName: doc.siteName || '',
        siteUrl: doc.siteUrl || '',
        schedule: doc.schedule || [],
        language: doc.language || 'ja',
        wordCountMin: doc.wordCountMin || 1000,
        wordCountMax: doc.wordCountMax || 1500,
        imagesPerArticle: doc.imagesPerArticle || 4,
        articlesPerWeek: doc.articlesPerWeek || 7,
        style: doc.style || '',
        emailNotification: doc.emailNotification || '',
        cronJobId: doc.cronJobId || '',
        status: doc.status || 'active',
        createdAt: doc.createdAt || new Date().toISOString(),
        updatedAt: doc.updatedAt || new Date().toISOString(),
      }));

      return res.status(200).json({ cronJobs });
    }

    if (req.method === 'POST') {
      const {
        siteId,
        siteName,
        siteUrl,
        schedule,
        language,
        wordCountMin,
        wordCountMax,
        imagesPerArticle,
        articlesPerWeek,
        style,
        emailNotification,
        status,
      } = req.body || {};

      if (!siteId) {
        return res.status(400).json({ error: 'siteId is required' });
      }

      const now = new Date().toISOString();
      const doc = {
        userId,
        siteId,
        siteName: siteName || '',
        siteUrl: siteUrl || '',
        schedule: schedule || [],
        language: language || 'ja',
        wordCountMin: wordCountMin || 1000,
        wordCountMax: wordCountMax || 1500,
        imagesPerArticle: imagesPerArticle || 4,
        articlesPerWeek: articlesPerWeek || 7,
        style: style || '',
        emailNotification: emailNotification || '',
        cronJobId: randomUUID(),
        status: status || 'active',
        createdAt: now,
        updatedAt: now,
      };

      const result = await collection.insertOne(doc);

      return res.status(201).json({
        id: result.insertedId.toHexString(),
        ...doc,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[CronJobs]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
