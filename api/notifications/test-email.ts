import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { authenticateRequest, AuthError } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
