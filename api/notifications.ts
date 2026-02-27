import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type NotificationType = 'article' | 'ai' | 'site' | 'system' | 'schedule';

export interface InAppNotification {
  _id?: ObjectId;
  userId: string;
  type: NotificationType;
  title: { en: string; ja: string };
  message: { en: string; ja: string };
  read: boolean;
  actionUrl?: string;
  createdAt: number;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  primaryEmail: string; // Clerk user's email
  additionalEmail: string; // Optional additional email for notifications
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
  primaryEmail: '',
  additionalEmail: '',
  preferences: {
    articlePublished: { email: true, inApp: true },
    aiGenerationComplete: { email: false, inApp: true },
    siteConnectionIssues: { email: true, inApp: true },
    scheduledReminders: { email: true, inApp: true },
    weeklyAnalytics: { email: true, inApp: false },
    systemUpdates: { email: false, inApp: true },
  },
};

const RESEND_FROM = 'RakuBun <notifications@rakubun.com>';

// ─── Email templates ────────────────────────────────────────────────────────────

function buildEmailHtml(title: string, body: string, actionUrl?: string): string {
  const actionButton = actionUrl
    ? `<a href="${actionUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View in Dashboard</a>`
    : '';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;margin:0;">RakuBun</h1>
      </div>
      <div style="background:#f8fafc;border-radius:16px;padding:32px;">
        <h2 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:0 0 12px;">${title}</h2>
        <p style="font-size:14px;color:#475569;margin:0;line-height:1.7;">${body}</p>
        <div style="text-align:center;">${actionButton}</div>
      </div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:24px;">
        You're receiving this because you enabled email notifications on RakuBun. <a href="https://rakubun.com/dashboard/settings" style="color:#6366f1;">Manage preferences</a>
      </p>
    </div>
  `;
}

// Map notification type → settings preference key
const TYPE_TO_PREF: Record<NotificationType, keyof NotificationSettings['preferences']> = {
  article: 'articlePublished',
  ai: 'aiGenerationComplete',
  site: 'siteConnectionIssues',
  schedule: 'scheduledReminders',
  system: 'systemUpdates',
};

// ─── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';

  switch (action) {
    case 'settings':
      return handleSettings(req, res);
    case 'test-email':
      return handleTestEmail(req, res);
    case 'list':
      return handleList(req, res);
    case 'read':
      return handleMarkRead(req, res);
    case 'read-all':
      return handleMarkAllRead(req, res);
    case 'delete':
      return handleDelete(req, res);
    case 'unread-count':
      return handleUnreadCount(req, res);
    case 'send':
      return handleSendNotification(req, res);
    default:
      return res.status(404).json({ error: 'Not found' });
  }
}

// ─── list ───────────────────────────────────────────────────────────────────────

async function handleList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    const col = db.collection('notifications');

    const filter = req.query.filter as string | undefined;
    const query: Record<string, unknown> = { userId };
    if (filter === 'unread') query.read = false;
    else if (filter && filter !== 'all') query.type = filter;

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const skip = Number(req.query.skip) || 0;

    const [docs, total, unreadCount] = await Promise.all([
      col.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(query),
      col.countDocuments({ userId, read: false }),
    ]);

    const notifications = docs.map((d) => ({
      id: d._id.toString(),
      type: d.type,
      title: d.title,
      message: d.message,
      read: d.read,
      actionUrl: d.actionUrl,
      createdAt: d.createdAt,
    }));

    return res.status(200).json({ notifications, total, unreadCount });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error('List notifications error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── unread-count ───────────────────────────────────────────────────────────────

async function handleUnreadCount(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    const count = await db.collection('notifications').countDocuments({ userId, read: false });
    return res.status(200).json({ unreadCount: count });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error('Unread count error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── read (mark single) ────────────────────────────────────────────────────────

async function handleMarkRead(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = await authenticateRequest(req);
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });

    const db = await getDb();
    await db.collection('notifications').updateOne(
      { _id: new ObjectId(id), userId },
      { $set: { read: true } },
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── read-all ───────────────────────────────────────────────────────────────────

async function handleMarkAllRead(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    await db.collection('notifications').updateMany(
      { userId, read: false },
      { $set: { read: true } },
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error('Mark all read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── delete ─────────────────────────────────────────────────────────────────────

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = await authenticateRequest(req);
    const id = (req.query.id as string) || req.body?.id;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const db = await getDb();
    await db.collection('notifications').deleteOne({ _id: new ObjectId(id), userId });
    return res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error('Delete notification error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── send (create + optional email) ─────────────────────────────────────────────

async function handleSendNotification(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = await authenticateRequest(req);
    const { type, title, message, actionUrl, recipientEmail } = req.body || {};

    if (!type || !title || !message) {
      return res.status(400).json({ error: 'type, title, and message are required' });
    }

    const db = await getDb();

    // Load user settings
    const settingsDoc = await db.collection('notification_settings').findOne({ userId });
    const settings: NotificationSettings = settingsDoc
      ? { 
          emailEnabled: settingsDoc.emailEnabled ?? DEFAULT_SETTINGS.emailEnabled,
          primaryEmail: settingsDoc.primaryEmail || '',
          additionalEmail: settingsDoc.additionalEmail || '',
          preferences: { ...DEFAULT_SETTINGS.preferences, ...settingsDoc.preferences },
        }
      : DEFAULT_SETTINGS;

    const prefKey = TYPE_TO_PREF[type as NotificationType] || 'systemUpdates';
    const pref = settings.preferences[prefKey];

    // Create in-app notification if enabled
    if (pref.inApp) {
      const doc: InAppNotification = {
        userId,
        type,
        title: typeof title === 'string' ? { en: title, ja: title } : title,
        message: typeof message === 'string' ? { en: message, ja: message } : message,
        read: false,
        actionUrl,
        createdAt: Date.now(),
      };
      await db.collection('notifications').insertOne(doc);
    }

    // Send email if enabled and address provided
    if (settings.emailEnabled && pref.email && recipientEmail) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const emailTitle = typeof title === 'string' ? title : title.en;
        const emailBody = typeof message === 'string' ? message : message.en;
        await resend.emails.send({
          from: RESEND_FROM,
          to: recipientEmail,
          subject: `RakuBun — ${emailTitle}`,
          html: buildEmailHtml(emailTitle, emailBody, actionUrl ? `https://rakubun.com${actionUrl}` : undefined),
        });
      } catch (emailErr) {
        console.error('Failed to send notification email:', emailErr);
        // Don't fail the whole request if email fails
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error('Send notification error:', err);
    return res.status(500).json({ error: 'Internal server error' });
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
      let settings: NotificationSettings;
      if (doc) {
        settings = {
          emailEnabled: doc.emailEnabled ?? DEFAULT_SETTINGS.emailEnabled,
          primaryEmail: doc.primaryEmail || '',
          additionalEmail: doc.additionalEmail || '',
          preferences: { ...DEFAULT_SETTINGS.preferences, ...doc.preferences },
        };
      } else {
        // No settings yet - try to get primary email from Clerk
        settings = { ...DEFAULT_SETTINGS };
      }
      return res.status(200).json({ settings });
    }

    if (req.method === 'PUT') {
      const { emailEnabled, primaryEmail, additionalEmail, preferences } = req.body || {};

      const update: Record<string, unknown> = { userId, updatedAt: Date.now() };
      if (typeof emailEnabled === 'boolean') update.emailEnabled = emailEnabled;
      if (typeof primaryEmail === 'string') update.primaryEmail = primaryEmail;
      if (typeof additionalEmail === 'string') update.additionalEmail = additionalEmail;
      if (preferences && typeof preferences === 'object') update.preferences = preferences;

      await collection.updateOne(
        { userId },
        { $set: update },
        { upsert: true },
      );

      const doc = await collection.findOne({ userId });
      const settings: NotificationSettings = {
        emailEnabled: doc?.emailEnabled ?? DEFAULT_SETTINGS.emailEnabled,
        primaryEmail: doc?.primaryEmail || '',
        additionalEmail: doc?.additionalEmail || '',
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
      from: RESEND_FROM,
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

// ─── Helper: send email to multiple recipients ──────────────────────────────

async function sendEmailToRecipients(
  emails: string[],
  title: string,
  message: string,
  actionUrl?: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping email notification');
    return;
  }

  const validEmails = emails.filter(e => e && e.includes('@'));
  if (validEmails.length === 0) return;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: RESEND_FROM,
      to: validEmails,
      subject: `RakuBun — ${title}`,
      html: buildEmailHtml(title, message, actionUrl ? `https://rakubun.com${actionUrl}` : undefined),
    });
  } catch (emailErr) {
    console.error('Failed to send notification email:', emailErr);
  }
}

// ─── Helper: create notification from other API endpoints ───────────────────

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: { en: string; ja: string },
  message: { en: string; ja: string },
  options?: { actionUrl?: string; recipientEmails?: string[] },
): Promise<void> {
  try {
    const db = await getDb();

    // Load user settings
    const settingsDoc = await db.collection('notification_settings').findOne({ userId });
    const settings: NotificationSettings = settingsDoc
      ? { 
          emailEnabled: settingsDoc.emailEnabled ?? DEFAULT_SETTINGS.emailEnabled,
          primaryEmail: settingsDoc.primaryEmail || '',
          additionalEmail: settingsDoc.additionalEmail || '',
          preferences: { ...DEFAULT_SETTINGS.preferences, ...settingsDoc.preferences },
        }
      : DEFAULT_SETTINGS;

    const prefKey = TYPE_TO_PREF[type] || 'systemUpdates';
    const pref = settings.preferences[prefKey];

    // Create in-app notification if enabled
    if (pref.inApp) {
      const doc: InAppNotification = {
        userId,
        type,
        title,
        message,
        read: false,
        actionUrl: options?.actionUrl,
        createdAt: Date.now(),
      };
      await db.collection('notifications').insertOne(doc);
    }

    // Send email if enabled
    if (settings.emailEnabled && pref.email) {
      // Collect emails: primary + additional + any override emails
      const emails: string[] = [];
      if (settings.primaryEmail) emails.push(settings.primaryEmail);
      if (settings.additionalEmail) emails.push(settings.additionalEmail);
      if (options?.recipientEmails) {
        for (const email of options.recipientEmails) {
          if (email && !emails.includes(email)) emails.push(email);
        }
      }

      if (emails.length > 0) {
        await sendEmailToRecipients(emails, title.en, message.en, options?.actionUrl);
      }
    }
  } catch (err) {
    console.error('createNotification error:', err);
  }
}
