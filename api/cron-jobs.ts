import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';
import { fetchWithRetry } from './lib/wordpress.js';
import { randomUUID } from 'crypto';
import { enforceCronJobAccess, FeatureGateError } from './lib/subscription.js';

/** Snap a time string (HH:MM) to the nearest 30-minute mark */
function snapTimeTo30Min(time: string): string {
  const [h, m] = (time || '09:00').split(':').map(Number);
  const snapped = m < 15 ? '00' : m < 45 ? '30' : '00';
  const snappedH = m >= 45 ? (h + 1) % 24 : h;
  return `${String(snappedH).padStart(2, '0')}:${snapped}`;
}

/** Validate and snap all schedule slot times to 30-minute intervals */
function sanitizeScheduleSlots(schedule: any[]): any[] {
  if (!Array.isArray(schedule)) return [];
  return schedule.map(slot => ({
    ...slot,
    time: snapTimeTo30Min(slot.time),
  }));
}

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';

  switch (action) {
    case '':
      return handleCronJobsIndex(req, res);
    case 'generate-schedule':
      return handleGenerateSchedule(req, res);
    case 'logs':
      return handleCronLogs(req, res);
    default:
      // Treat as cron job ID
      return handleCronJobById(req, res, action);
  }
}

// ─── cron-jobs index (list / create) ────────────────────────────────────────

async function handleCronJobsIndex(req: VercelRequest, res: VercelResponse) {
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
      // Cron jobs require Basic plan or higher
      await enforceCronJobAccess(userId);

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
        schedule: sanitizeScheduleSlots(schedule || []),
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
    if (err instanceof FeatureGateError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('[CronJobs]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── cron job by ID (update / delete) ───────────────────────────────────────

async function handleCronJobById(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    const userId = await authenticateRequest(req);

    if (!ObjectId.isValid(id)) {
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
          $set[field] = field === 'schedule' ? sanitizeScheduleSlots(updates[field]) : updates[field];
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

// ─── generate-schedule ──────────────────────────────────────────────────────

async function handleGenerateSchedule(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    const { siteId, articlesPerWeek: rawCount } = req.body || {};
    const articlesPerWeek = Math.min(Math.max(Number(rawCount) || 7, 1), 7);

    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required' });
    }

    const db = await getDb();
    const sitesCollection = db.collection('sites');

    let siteDoc;
    try {
      siteDoc = await sitesCollection.findOne({ _id: new ObjectId(siteId), userId });
    } catch {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    if (!siteDoc) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const siteUrl = siteDoc.url;
    const siteName = siteDoc.name || new URL(siteUrl).hostname;

    let categoriesInfo = '';
    if (siteDoc.username && siteDoc.applicationPassword) {
      try {
        const baseUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
        const authHeader =
          'Basic ' +
          Buffer.from(`${siteDoc.username}:${siteDoc.applicationPassword}`).toString('base64');
        const catResponse = await fetchWithRetry(
          `${baseUrl}/wp-json/wp/v2/categories?per_page=100`,
          { headers: { Authorization: authHeader } },
          { timeoutMs: 15000, maxRetries: 1, label: 'cronJobFetchCategories' },
        );
        if (catResponse.ok) {
          const cats = (await catResponse.json()) as { name: string; count: number; slug: string }[];
          const filtered = cats
            .filter((c) => c.count > 0 && c.slug !== 'uncategorized')
            .sort((a, b) => b.count - a.count);
          if (filtered.length > 0) {
            categoriesInfo = `\n\nThe site has these WordPress categories (sorted by article count):\n${filtered.map((c) => `- ${c.name} (${c.count} articles)`).join('\n')}`;
          }
        }
      } catch {
        // Ignore category fetch errors
      }
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // @ts-ignore - responses API
    const response = await client.responses.create({
      model: 'gpt-5.2',
      tools: [{ type: 'web_search' }],
      input: `Analyze the website "${siteUrl}" (${siteName}).${categoriesInfo}

Use web search to visit and understand this website's niche, topics, audience, content style, and language.

Based on your analysis, create a weekly publishing schedule with exactly ${articlesPerWeek} article TYPES spread across the week (pick the best ${articlesPerWeek} days out of Monday-Sunday).

IMPORTANT: Return article TYPES/CATEGORIES, NOT specific article titles. Each type should represent a category or genre of content that fits this site.

For each day, provide the article type in BOTH English and the site's primary language, separated by " / ".
For example: "Drama/Movie News / ドラマ・映画" or "Celebrity Profiles / 芸能人"

Also determine:
- The site's primary language (e.g., "Japanese", "English")
- A short style description that captures the site's tone/voice
- A suggested default publishing time in 24h format

Return ONLY a valid JSON object with no markdown formatting, no code fences, no explanation.
The "schedule" array must contain exactly ${articlesPerWeek} items:
{
  "language": "Japanese",
  "style": "Short description of the site style/tone",
  "defaultTime": "11:00",
  "schedule": [
    {"day": "Monday", "articleType": "Type in English / ローカル言語"}
  ]
}`,
    });

    // @ts-ignore
    const rawText: string = response.output_text || '';

    try {
      const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const schedule = (parsed.schedule || []).map((item: any) => ({
        day: item.day || 'Monday',
        time: parsed.defaultTime || '11:00',
        articleType: item.articleType || 'General',
        enabled: true,
      }));

      return res.status(200).json({
        schedule,
        style: parsed.style || '',
        language: parsed.language || 'Japanese',
      });
    } catch (parseErr) {
      console.error('Failed to parse AI response:', parseErr, 'Raw:', rawText);
      return res.status(500).json({ error: 'Failed to parse AI analysis results' });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── cron execution logs ────────────────────────────────────────────────────

async function handleCronLogs(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticateRequest(req);
    const db = await getDb();
    const cronLogsCol = db.collection('cronLogs');

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const logs = await cronLogsCol
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const mapped = logs.map((l) => ({
      id: l._id.toString(),
      executedAt: l.executedAt,
      durationMs: l.durationMs,
      processed: l.processed,
      succeeded: l.succeeded,
      failed: l.failed,
      skipped: l.skipped,
      results: l.results || [],
      logs: l.logs || [],
      fatalError: l.fatalError || null,
      createdAt: l.createdAt,
    }));

    return res.status(200).json({ logs: mapped });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[CronLogs]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
