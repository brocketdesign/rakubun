import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';

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
  const action = (req.query._action as string) || '';

  switch (action) {
    case 'settings':
      return handleSettings(req, res);
    case 'test-email':
      return handleTestEmail(req, res);
    default:
      return res.status(404).json({ error: 'Not found' });
  }
}

// ─── settings ───────────────────────────────────────────────────────────────

async function handleSettings(req: VercelRequest, res: VercelResponse) {
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

// ─── test-email ─────────────────────────────────────────────────────────────

async function handleTestEmail(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticateRequest(req);

    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'RakuBun <onboarding@resend.dev>',
      to: email,
      subject: '✅ RakuBun Test Email — Notifications are working!',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0;">RakuBun</h1>
          </div>
          <div style="background: #f8fafc; border-radius: 16px; padding: 32px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
            <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 8px;">Email Notifications Working!</h2>
            <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.6;">
              This is a test email from your RakuBun dashboard. If you received this, your email notifications are properly configured.
            </p>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
            You received this email because you triggered a test from the RakuBun Settings page.
          </p>
        </div>
      `,
    });

    return res.status(200).json({ success: true, message: 'Test email sent successfully' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Test email error:', err);
    return res.status(500).json({ error: 'Failed to send test email' });
  }
}
