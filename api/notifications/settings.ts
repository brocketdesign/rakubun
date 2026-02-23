import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';

export interface NotificationSettings {
  emailEnabled: boolean;
  preferences: {
    articlePublished: { email: boolean; inApp: boolean };
    aiGenerationComplete: { email: boolean; inApp: boolean };
    siteConnectionIssues: { email: boolean; inApp: boolean };
    scheduledReminders: { email: boolean; inApp: boolean };
    weeklyAnalytics: { email: boolean; inApp: boolean };
    systemUpdates: { email: boolean; inApp: boolean };
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  preferences: {
    articlePublished: { email: true, inApp: true },
    aiGenerationComplete: { email: false, inApp: true },
    siteConnectionIssues: { email: true, inApp: true },
    scheduledReminders: { email: true, inApp: true },
    weeklyAnalytics: { email: true, inApp: false },
    systemUpdates: { email: false, inApp: true },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    const collection = db.collection('notification_settings');

    if (req.method === 'GET') {
      const doc = await collection.findOne({ userId });
      const settings: NotificationSettings = doc
        ? {
            emailEnabled: doc.emailEnabled ?? DEFAULT_SETTINGS.emailEnabled,
            preferences: { ...DEFAULT_SETTINGS.preferences, ...doc.preferences },
          }
        : DEFAULT_SETTINGS;
      return res.status(200).json({ settings });
    }

    if (req.method === 'PUT') {
      const { emailEnabled, preferences } = req.body || {};

      const update: Record<string, unknown> = { userId, updatedAt: Date.now() };
      if (typeof emailEnabled === 'boolean') update.emailEnabled = emailEnabled;
      if (preferences && typeof preferences === 'object') update.preferences = preferences;

      await collection.updateOne(
        { userId },
        { $set: update },
        { upsert: true },
      );

      const doc = await collection.findOne({ userId });
      const settings: NotificationSettings = {
        emailEnabled: doc?.emailEnabled ?? DEFAULT_SETTINGS.emailEnabled,
        preferences: { ...DEFAULT_SETTINGS.preferences, ...doc?.preferences },
      };
      return res.status(200).json({ settings });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Notification settings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
