import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb.js';
import {
  publishToWordPress,
  uploadImageToWordPress,
} from './lib/wordpress.js';

export const config = {
  maxDuration: 300, // 5 minute max for cron
};

// ─── Day helpers ────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Vercel cron handler — called every hour to process due scheduled articles.
 *
 * Flow:
 * 1. Verify the request came from Vercel Cron (CRON_SECRET).
 * 2. Find all active cron jobs whose schedule includes today's day.
 * 3. For each matching schedule slot whose time is within the current hour:
 *    a. Skip if we already generated an article for this slot today.
 *    b. Generate an article via OpenAI (with web search).
 *    c. Generate images with Grok.
 *    d. Publish to WordPress.
 *    e. Record the article in the articles collection.
 *    f. Send an email notification if configured.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Auth: only allow Vercel Cron or matching secret ────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await getDb();
    const cronJobsCol = db.collection('cronJobs');
    const articlesCol = db.collection('articles');
    const sitesCol = db.collection('sites');

    const now = new Date();
    const currentDay = DAY_NAMES[now.getUTCDay()];
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    console.log(`[Cron] Running at ${now.toISOString()} — day=${currentDay}, hour=${currentHour}:${String(currentMinute).padStart(2, '0')} UTC`);

    // Find all active cron jobs
    const activeCronJobs = await cronJobsCol
      .find({ status: 'active' })
      .toArray();

    if (activeCronJobs.length === 0) {
      console.log('[Cron] No active cron jobs found.');
      return res.status(200).json({ message: 'No active cron jobs', processed: 0 });
    }

    console.log(`[Cron] Found ${activeCronJobs.length} active cron job(s)`);

    const results: Array<{ cronJobId: string; topic: string; status: string; articleId?: string; error?: string }> = [];

    for (const cronJob of activeCronJobs) {
      const schedule: Array<{ day: string; time: string; articleType: string; enabled: boolean }> = cronJob.schedule || [];

      // Find slots that match today's day
      const todaySlots = schedule.filter(
        (slot) => slot.enabled !== false && slot.day.toLowerCase() === currentDay.toLowerCase(),
      );

      if (todaySlots.length === 0) continue;

      for (const slot of todaySlots) {
        // Parse the slot's scheduled time
        const [slotHour, slotMinute] = (slot.time || '09:00').split(':').map(Number);

        // Only process if we are within the same hour as the scheduled time
        // This gives a 59-minute window so the hourly cron won't miss it
        if (currentHour !== slotHour) continue;

        // Check if we already processed this slot today (dedup)
        const todayStart = new Date(now);
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setUTCHours(23, 59, 59, 999);

        const existing = await articlesCol.findOne({
          cronJobId: cronJob._id.toHexString(),
          cronSlotDay: slot.day,
          createdAt: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() },
        });

        if (existing) {
          console.log(`[Cron] Already processed slot ${slot.day} ${slot.time} for cron job ${cronJob._id}`);
          results.push({ cronJobId: cronJob._id.toHexString(), topic: slot.articleType, status: 'skipped-duplicate' });
          continue;
        }

        // Load the site credentials
        let siteDoc;
        try {
          siteDoc = await sitesCol.findOne({ _id: new ObjectId(cronJob.siteId) });
        } catch {
          console.error(`[Cron] Invalid siteId ${cronJob.siteId}`);
          results.push({ cronJobId: cronJob._id.toHexString(), topic: slot.articleType, status: 'error', error: 'Invalid site ID' });
          continue;
        }

        if (!siteDoc) {
          console.error(`[Cron] Site not found: ${cronJob.siteId}`);
          results.push({ cronJobId: cronJob._id.toHexString(), topic: slot.articleType, status: 'error', error: 'Site not found' });
          continue;
        }

        try {
          // ── Step 1: Generate article content via OpenAI ───────────────
          const articleResult = await generateArticle({
            articleType: slot.articleType,
            siteUrl: cronJob.siteUrl || siteDoc.url,
            siteName: cronJob.siteName || siteDoc.name,
            language: cronJob.language || 'ja',
            wordCountMin: cronJob.wordCountMin || 1000,
            wordCountMax: cronJob.wordCountMax || 1500,
            style: cronJob.style || '',
          });

          // ── Step 2: Generate images via Grok ─────────────────────────
          const imageUrls: string[] = [];
          const imgCount = Math.min(cronJob.imagesPerArticle || 4, 4);
          let thumbnailUrl = '';

          if (imgCount > 0 && process.env.GROK_API_KEY) {
            try {
              const grokClient = new OpenAI({
                apiKey: process.env.GROK_API_KEY,
                baseURL: 'https://api.x.ai/v1',
              });

              // Generate thumbnail
              try {
                const thumbRes = await grokClient.images.generate({
                  model: 'grok-imagine-image',
                  prompt: `A professional blog post thumbnail image for: ${articleResult.title}`,
                });
                if (thumbRes.data?.[0]?.url) {
                  let finalThumbUrl = thumbRes.data[0].url;
                  if (siteDoc.username && siteDoc.applicationPassword) {
                    const wpMedia = await uploadImageToWordPress(
                      { url: siteDoc.url, username: siteDoc.username, applicationPassword: siteDoc.applicationPassword },
                      finalThumbUrl,
                    );
                    if (wpMedia) finalThumbUrl = wpMedia.sourceUrl;
                  }
                  thumbnailUrl = finalThumbUrl;
                }
              } catch (thumbErr) {
                console.error('[Cron] Thumbnail generation error:', thumbErr);
              }

              // Generate in-article images
              const inArticleCount = Math.max(imgCount - 1, 0);
              if (inArticleCount > 0) {
                const imagePromises = Array.from({ length: inArticleCount }).map((_, i) =>
                  grokClient.images.generate({
                    model: 'grok-imagine-image',
                    prompt: `Professional illustration for an article about: ${articleResult.title}, part ${i + 1}`,
                  }),
                );
                const imageResponses = await Promise.all(imagePromises);
                for (const imgRes of imageResponses) {
                  if (imgRes.data?.[0]?.url) {
                    let finalUrl = imgRes.data[0].url;
                    if (siteDoc.username && siteDoc.applicationPassword) {
                      const wpMedia = await uploadImageToWordPress(
                        { url: siteDoc.url, username: siteDoc.username, applicationPassword: siteDoc.applicationPassword },
                        finalUrl,
                      );
                      if (wpMedia) finalUrl = wpMedia.sourceUrl;
                    }
                    imageUrls.push(finalUrl);
                  }
                }
              }

              // Insert images into content
              if (imageUrls.length > 0) {
                const sections = articleResult.content.split(/\n(?=## )/);
                const interval = Math.max(1, Math.floor(sections.length / (imageUrls.length + 1)));
                let imgIdx = 0;
                const newSections: string[] = [];
                for (let i = 0; i < sections.length; i++) {
                  newSections.push(sections[i]);
                  if (imgIdx < imageUrls.length && (i + 1) % interval === 0) {
                    newSections.push(`\n![Illustration](${imageUrls[imgIdx]})\n`);
                    imgIdx++;
                  }
                }
                while (imgIdx < imageUrls.length) {
                  newSections.push(`\n![Illustration](${imageUrls[imgIdx]})\n`);
                  imgIdx++;
                }
                articleResult.content = newSections.join('\n');
              }
            } catch (imgError) {
              console.error('[Cron] Image generation error:', imgError);
            }
          }

          // ── Step 3: Publish to WordPress ─────────────────────────────
          let wpPostId: number | undefined;
          let wpUrl: string | undefined;

          if (siteDoc.username && siteDoc.applicationPassword) {
            const wpResult = await publishToWordPress(
              {
                url: siteDoc.url,
                username: siteDoc.username,
                applicationPassword: siteDoc.applicationPassword,
              },
              {
                title: articleResult.title,
                content: articleResult.content,
                excerpt: articleResult.excerpt,
                status: 'publish',
                date: now.toISOString(),
                thumbnailUrl: thumbnailUrl || undefined,
              },
            );
            if (wpResult) {
              wpPostId = wpResult.wpPostId;
              wpUrl = wpResult.url;
              console.log(`[Cron] Published to WP: ${wpUrl}`);
            } else {
              console.error('[Cron] Failed to publish to WordPress');
            }
          }

          // ── Step 4: Save article to DB ───────────────────────────────
          const wordCount = articleResult.content
            .replace(/[#*_~`>\-|]/g, '')
            .split(/\s+/)
            .filter((w: string) => w.length > 0).length;

          const articleDoc = {
            userId: cronJob.userId,
            title: articleResult.title,
            excerpt: articleResult.excerpt,
            content: articleResult.content,
            site: cronJob.siteId,
            category: slot.articleType,
            status: wpPostId ? 'published' : 'draft',
            wordCount,
            seoScore: calculateSeoScore(articleResult.title, articleResult.content, articleResult.excerpt),
            views: 0,
            thumbnailUrl,
            imageUrls,
            scheduledAt: null,
            publishedAt: wpPostId ? now.toISOString() : null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            wpPostId: wpPostId || null,
            wpUrl: wpUrl || null,
            // Dedup tracking metadata
            cronJobId: cronJob._id.toHexString(),
            cronSlotDay: slot.day,
            cronGenerated: true,
          };

          const insertResult = await articlesCol.insertOne(articleDoc);
          const articleId = insertResult.insertedId.toString();

          // Increment site article counter
          try {
            await sitesCol.updateOne(
              { _id: new ObjectId(cronJob.siteId) },
              { $inc: { articlesGenerated: 1 } },
            );
          } catch (e) {
            console.error('[Cron] Failed to increment articlesGenerated:', e);
          }

          console.log(`[Cron] Article saved: ${articleId} — "${articleResult.title}"`);

          // ── Step 5: Send email notification ─────────────────────────
          if (cronJob.emailNotification) {
            await sendNotificationEmail(
              cronJob.emailNotification,
              articleResult.title,
              wpUrl || '',
              cronJob.siteName || siteDoc.name || '',
            );
          }

          results.push({
            cronJobId: cronJob._id.toHexString(),
            topic: slot.articleType,
            status: 'success',
            articleId,
          });
        } catch (slotError) {
          console.error(`[Cron] Error processing slot ${slot.day} ${slot.time}:`, slotError);
          results.push({
            cronJobId: cronJob._id.toHexString(),
            topic: slot.articleType,
            status: 'error',
            error: slotError instanceof Error ? slotError.message : 'Unknown error',
          });
        }
      }
    }

    const succeeded = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'error').length;
    const skipped = results.filter((r) => r.status === 'skipped-duplicate').length;

    console.log(`[Cron] Done. Succeeded: ${succeeded}, Failed: ${failed}, Skipped: ${skipped}`);

    return res.status(200).json({
      message: 'Cron execution complete',
      processed: results.length,
      succeeded,
      failed,
      skipped,
      results,
    });
  } catch (err) {
    console.error('[Cron] Fatal error:', err);
    return res.status(500).json({ error: 'Cron execution failed' });
  }
}

// ─── Article generation ─────────────────────────────────────────────────────

async function generateArticle(opts: {
  articleType: string;
  siteUrl: string;
  siteName: string;
  language: string;
  wordCountMin: number;
  wordCountMax: number;
  style: string;
}): Promise<{ title: string; content: string; excerpt: string }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const languageInstruction = opts.language.toLowerCase().includes('ja') || opts.language.toLowerCase() === 'japanese'
    ? 'Write the entire article in Japanese (日本語).'
    : opts.language.toLowerCase().includes('en') || opts.language.toLowerCase() === 'english'
    ? 'Write the entire article in English.'
    : `Write the entire article in ${opts.language}.`;

  const styleInstruction = opts.style
    ? `Writing style/tone: ${opts.style}.`
    : '';

  // @ts-ignore - responses API
  const response = await client.responses.create({
    model: 'gpt-5.2',
    tools: [{ type: 'web_search' }],
    input: `You are an expert content writer for the website "${opts.siteUrl}" (${opts.siteName}).

${languageInstruction}
${styleInstruction}

Use web search to find the latest trending news and developments related to "${opts.articleType}".

Write a comprehensive, well-structured, SEO-optimized article about a specific trending topic within the "${opts.articleType}" category.

Requirements:
- Article must be between ${opts.wordCountMin} and ${opts.wordCountMax} words
- Use Markdown formatting
- Start with a compelling # title
- Include multiple ## sections with detailed content
- Use **bold** for key terms
- Include bullet points and numbered lists where appropriate
- Write a natural, engaging conclusion
- Make the content timely and relevant (reference recent events/trends)

Return ONLY the article content in Markdown format.`,
  });

  // @ts-ignore
  const content: string = response.output_text || '';

  const titleMatch = content.match(/^#\s+(.*)/m);
  const title = titleMatch ? titleMatch[1].trim() : opts.articleType;

  const excerpt = content
    .replace(/^#.*\n?/m, '')
    .replace(/[#*_~`>\-|![\]()]/g, '')
    .trim()
    .substring(0, 160);

  return { title, content, excerpt };
}

// ─── Email notification ─────────────────────────────────────────────────────

async function sendNotificationEmail(
  email: string,
  articleTitle: string,
  wpUrl: string,
  siteName: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Cron] RESEND_API_KEY not set, skipping email notification');
    return;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'RakuBun <onboarding@resend.dev>',
      to: email,
      subject: `✅ New article published: ${articleTitle}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0;">RakuBun</h1>
          </div>
          <div style="background: #f8fafc; border-radius: 16px; padding: 32px;">
            <h2 style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin: 0 0 12px;">Article Published</h2>
            <p style="font-size: 14px; color: #334155; margin: 0 0 8px; line-height: 1.6;">
              <strong>${articleTitle}</strong>
            </p>
            <p style="font-size: 14px; color: #64748b; margin: 0 0 16px; line-height: 1.6;">
              Published to <strong>${siteName}</strong> via your scheduled cron job.
            </p>
            ${wpUrl ? `<a href="${wpUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;">View Article →</a>` : ''}
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
            This is an automated notification from RakuBun scheduled publishing.
          </p>
        </div>
      `,
    });

    console.log(`[Cron] Notification email sent to ${email}`);
  } catch (emailErr) {
    console.error('[Cron] Failed to send notification email:', emailErr);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calculateSeoScore(
  title: string | undefined,
  content: string | undefined,
  excerpt: string | undefined,
): number {
  let score = 0;
  if (!title && !content) return 0;

  if (title) {
    score += 10;
    if (title.length >= 30 && title.length <= 60) score += 10;
    if (title.length > 10) score += 5;
  }

  if (content) {
    const words = content.split(/\s+/).length;
    if (words >= 300) score += 10;
    if (words >= 800) score += 10;
    if (words >= 1500) score += 5;
    if (/^##?\s/m.test(content)) score += 10;
    if (/!\[.*?\]\(.*?\)/.test(content)) score += 5;
    if (/\[.*?\]\(.*?\)/.test(content)) score += 5;
  }

  if (excerpt) {
    score += 5;
    if (excerpt.length >= 120 && excerpt.length <= 160) score += 10;
    else if (excerpt.length > 50) score += 5;
  }

  if (content) {
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
    if (paragraphs.length >= 3) score += 5;
    if (/^[-*]\s/m.test(content) || /^\d+\.\s/m.test(content)) score += 5;
    if (/\*\*.*?\*\*/.test(content) || /__.*?__/.test(content)) score += 5;
  }

  return Math.min(100, score);
}
