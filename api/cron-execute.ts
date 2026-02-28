import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb.js';
import {
  publishToWordPress,
  uploadImageToWordPress,
} from './lib/wordpress.js';
import { createNotification } from './notifications.js';

export const config = {
  maxDuration: 300, // 5 minute max for cron
};

// ─── Day helpers ────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get the current day name and hour in a given IANA timezone.
 * Falls back to UTC if the timezone is invalid.
 */
function getNowInTimezone(now: Date, timezone: string): { day: string; hour: number } {
  try {
    const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' });
    const hourFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });

    const day = dayFormatter.format(now); // e.g. "Wednesday"
    const hourStr = hourFormatter.format(now); // e.g. "14" or "24" (midnight as 24 in some locales)
    let hour = parseInt(hourStr, 10);
    if (hour === 24) hour = 0;

    return { day, hour };
  } catch {
    // Invalid timezone — fall back to UTC
    return { day: DAY_NAMES[now.getUTCDay()], hour: now.getUTCHours() };
  }
}

/**
 * Determine the IANA timezone for a cron job, using the site's timezone setting
 * or inferring from the cron job's language. Defaults to UTC.
 */
function resolveTimezone(cronJob: Record<string, any>, siteDoc: Record<string, any> | null): string {
  // 1. Use site's timezone if it's a valid non-UTC value
  const siteTz = siteDoc?.settings?.timezone;
  if (siteTz && siteTz !== 'UTC' && siteTz !== 'utc') {
    return siteTz;
  }

  // 2. Use cron job's timezone if stored
  if (cronJob.timezone && cronJob.timezone !== 'UTC') {
    return cronJob.timezone;
  }

  // 3. Infer from language — Japanese users almost certainly mean JST
  const lang = (cronJob.language || '').toLowerCase();
  if (lang.includes('ja') || lang === 'japanese') {
    return 'Asia/Tokyo';
  }

  return 'UTC';
}

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
    const schedulesCol = db.collection('schedules');

    const now = new Date();
    const currentDay = DAY_NAMES[now.getUTCDay()];
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    console.log(`[Cron] Running at ${now.toISOString()} — day=${currentDay}, hour=${currentHour}:${String(currentMinute).padStart(2, '0')} UTC`);

    const results: Array<{ cronJobId: string; topic: string; status: string; articleId?: string; error?: string }> = [];

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PART 1: Process due SCHEDULED articles (publish to WordPress)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    try {
      const dueArticles = await articlesCol
        .find({
          status: 'scheduled',
          scheduledAt: { $lte: now.toISOString() },
        })
        .toArray();

      if (dueArticles.length > 0) {
        console.log(`[Cron] Found ${dueArticles.length} due scheduled article(s) to publish`);
      }

      for (const article of dueArticles) {
        try {
          let siteDoc = null;
          if (article.site && ObjectId.isValid(article.site)) {
            siteDoc = await sitesCol.findOne({ _id: new ObjectId(article.site) });
          }

          // If we already have a wpPostId, the article is already on WordPress (possibly as 'future').
          // WordPress auto-publishes 'future' posts, so we just update our local status.
          if (article.wpPostId) {
            await articlesCol.updateOne(
              { _id: article._id },
              {
                $set: {
                  status: 'published',
                  publishedAt: now.toISOString(),
                  updatedAt: now.toISOString(),
                },
              },
            );
            console.log(`[Cron] Marked article ${article._id} as published (already on WP as post ${article.wpPostId})`);
            results.push({ cronJobId: 'scheduled', topic: article.title, status: 'success', articleId: article._id.toHexString() });
            continue;
          }

          // Article not yet on WordPress — publish it now
          if (siteDoc && siteDoc.username && siteDoc.applicationPassword) {
            const wpResult = await publishToWordPress(
              {
                url: siteDoc.url,
                username: siteDoc.username,
                applicationPassword: siteDoc.applicationPassword,
              },
              {
                title: article.title,
                content: article.content,
                excerpt: article.excerpt,
                status: 'publish',
                date: now.toISOString(),
                thumbnailUrl: article.thumbnailUrl || undefined,
              },
            );

            if (wpResult) {
              await articlesCol.updateOne(
                { _id: article._id },
                {
                  $set: {
                    status: 'published',
                    publishedAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    wpPostId: wpResult.wpPostId,
                    wpUrl: wpResult.url,
                  },
                },
              );
              console.log(`[Cron] Published scheduled article ${article._id} to WP: ${wpResult.url}`);
              results.push({ cronJobId: 'scheduled', topic: article.title, status: 'success', articleId: article._id.toHexString() });
            } else {
              console.error(`[Cron] Failed to publish scheduled article ${article._id} to WordPress`);
              results.push({ cronJobId: 'scheduled', topic: article.title, status: 'error', error: 'WordPress publish failed' });
            }
          } else {
            // No WP credentials — just mark as published locally
            await articlesCol.updateOne(
              { _id: article._id },
              {
                $set: {
                  status: 'published',
                  publishedAt: now.toISOString(),
                  updatedAt: now.toISOString(),
                },
              },
            );
            console.log(`[Cron] Marked article ${article._id} as published (no WP credentials)`);
            results.push({ cronJobId: 'scheduled', topic: article.title, status: 'success', articleId: article._id.toHexString() });
          }

          // Send notification for published scheduled article
          if (article.userId) {
            try {
              await createNotification(article.userId, 'article', {
                en: 'Scheduled Article Published',
                ja: 'スケジュール記事が公開されました',
              }, {
                en: `"${article.title}" has been published.`,
                ja: `「${article.title}」が公開されました。`,
              }, { actionUrl: '/dashboard/articles' });
            } catch (notifErr) {
              console.error(`[Cron] Failed to send notification for scheduled article ${article._id}:`, notifErr);
            }
          }
        } catch (articleErr) {
          console.error(`[Cron] Error publishing scheduled article ${article._id}:`, articleErr);
          results.push({
            cronJobId: 'scheduled',
            topic: article.title || 'Unknown',
            status: 'error',
            error: articleErr instanceof Error ? articleErr.message : 'Unknown error',
          });
        }
      }
    } catch (scheduledErr) {
      console.error('[Cron] Error processing scheduled articles:', scheduledErr);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PART 2: Process due SCHEDULE PLAN topics (generate + publish)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    try {
      const activeSchedules = await schedulesCol
        .find({ status: 'active' })
        .toArray();

      for (const schedule of activeSchedules) {
        const topics: Array<{ title: string; description: string; date: string; time: string; generated?: boolean }> = schedule.topics || [];
        let modified = false;

        for (const topic of topics) {
          if (!topic.date || topic.generated) continue;

          // Build the topic's target datetime
          const topicDateTime = new Date(`${topic.date}T${topic.time || '09:00'}:00Z`);
          if (isNaN(topicDateTime.getTime())) continue;

          // Only process if the topic's time is due (past or within current hour)
          if (topicDateTime > now) continue;

          // Check dedup: don't generate if an article with this exact plan title already exists
          const existing = await articlesCol.findOne({
            userId: schedule.userId,
            title: topic.title,
            schedulePlanGenerated: true,
          });
          if (existing) {
            topic.generated = true;
            modified = true;
            console.log(`[Cron] Plan topic "${topic.title}" already generated, skipping`);
            continue;
          }

          // Load the site
          let siteDoc = null;
          if (schedule.siteId && ObjectId.isValid(schedule.siteId)) {
            try {
              siteDoc = await sitesCol.findOne({ _id: new ObjectId(schedule.siteId) });
            } catch {
              console.error(`[Cron] Invalid siteId ${schedule.siteId} on schedule ${schedule._id}`);
            }
          }

          if (!siteDoc) {
            console.error(`[Cron] Site not found for schedule ${schedule._id}, skipping topic "${topic.title}"`);
            results.push({ cronJobId: `plan-${schedule._id}`, topic: topic.title, status: 'error', error: 'Site not found' });
            continue;
          }

          try {
            console.log(`[Cron] Generating article for plan topic: "${topic.title}"`);

            // Generate article
            const articleResult = await generateArticle({
              articleType: topic.title,
              siteUrl: siteDoc.url || '',
              siteName: siteDoc.name || '',
              language: siteDoc.language || 'ja',
              wordCountMin: 1000,
              wordCountMax: 1500,
              style: '',
            });

            // Generate images
            const imageUrls: string[] = [];
            let thumbnailUrl = '';
            if (process.env.GROK_API_KEY) {
              try {
                const grokClient = new OpenAI({
                  apiKey: process.env.GROK_API_KEY,
                  baseURL: 'https://api.x.ai/v1',
                });

                // Thumbnail
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
                  console.error('[Cron] Plan topic thumbnail error:', thumbErr);
                }
              } catch (imgError) {
                console.error('[Cron] Plan topic image generation error:', imgError);
              }
            }

            // Publish to WordPress
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
              }
            }

            // Save article to DB
            const wordCount = articleResult.content
              .replace(/[#*_~`>\-|]/g, '')
              .split(/\s+/)
              .filter((w: string) => w.length > 0).length;

            const articleDoc = {
              userId: schedule.userId,
              title: articleResult.title,
              excerpt: articleResult.excerpt,
              content: articleResult.content,
              site: schedule.siteId,
              category: topic.title,
              status: wpPostId ? 'published' : 'draft',
              wordCount,
              seoScore: 0,
              views: 0,
              thumbnailUrl,
              imageUrls,
              scheduledAt: null,
              publishedAt: wpPostId ? now.toISOString() : null,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
              wpPostId: wpPostId || null,
              wpUrl: wpUrl || null,
              schedulePlanGenerated: true,
            };

            const insertResult = await articlesCol.insertOne(articleDoc);
            topic.generated = true;
            modified = true;

            console.log(`[Cron] Plan topic article saved: ${insertResult.insertedId} — "${articleResult.title}"`);
            results.push({
              cronJobId: `plan-${schedule._id}`,
              topic: topic.title,
              status: 'success',
              articleId: insertResult.insertedId.toString(),
            });

            // Send notification for generated schedule plan article
            if (schedule.userId) {
              try {
                await createNotification(schedule.userId, 'article', {
                  en: 'Schedule: Article Published',
                  ja: 'スケジュール: 記事が公開されました',
                }, {
                  en: `"${articleResult.title}" was generated and published from your content schedule.`,
                  ja: `「${articleResult.title}」がコンテンツスケジュールから生成・公開されました。`,
                }, { actionUrl: '/dashboard/articles' });
              } catch (notifErr) {
                console.error(`[Cron] Failed to send notification for plan topic "${topic.title}":`, notifErr);
              }
            }
          } catch (topicErr) {
            console.error(`[Cron] Error generating plan topic "${topic.title}":`, topicErr);
            results.push({
              cronJobId: `plan-${schedule._id}`,
              topic: topic.title,
              status: 'error',
              error: topicErr instanceof Error ? topicErr.message : 'Unknown error',
            });
          }
        }

        // Persist the generated flag updates back to the schedule
        if (modified) {
          await schedulesCol.updateOne(
            { _id: schedule._id },
            { $set: { topics, updatedAt: now.toISOString() } },
          );
        }

        // If all topics are generated, mark the schedule as completed
        if (topics.length > 0 && topics.every(t => t.generated)) {
          await schedulesCol.updateOne(
            { _id: schedule._id },
            { $set: { status: 'completed', updatedAt: now.toISOString() } },
          );
          console.log(`[Cron] Schedule ${schedule._id} completed — all topics generated`);
        }
      }
    } catch (planErr) {
      console.error('[Cron] Error processing schedule plans:', planErr);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PART 3: Process recurring CRON JOBS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Find all active cron jobs
    const activeCronJobs = await cronJobsCol
      .find({ status: 'active' })
      .toArray();

    if (activeCronJobs.length === 0) {
      console.log('[Cron] No active cron jobs found.');
    } else {
      console.log(`[Cron] Found ${activeCronJobs.length} active cron job(s)`);
    }

    for (const cronJob of activeCronJobs) {
      const schedule: Array<{ day: string; time: string; articleType: string; enabled: boolean }> = cronJob.schedule || [];

      // Load the site credentials early so we can resolve timezone
      let cronSiteDoc: Record<string, any> | null = null;
      try {
        cronSiteDoc = await sitesCol.findOne({ _id: new ObjectId(cronJob.siteId) });
      } catch {
        // Will be handled below when siteDoc is needed
      }

      // Resolve the timezone for this cron job (e.g. Asia/Tokyo for Japanese sites)
      const tz = resolveTimezone(cronJob, cronSiteDoc);
      const { day: localDay, hour: localHour } = getNowInTimezone(now, tz);

      console.log(`[Cron] Job ${cronJob._id} (${cronJob.siteName}) — tz=${tz}, localDay=${localDay}, localHour=${localHour}`);

      // Find slots that match today's day in the LOCAL timezone
      const todaySlots = schedule.filter(
        (slot) => slot.enabled !== false && slot.day.toLowerCase() === localDay.toLowerCase(),
      );

      if (todaySlots.length === 0) continue;

      for (const slot of todaySlots) {
        // Parse the slot's scheduled time
        const [slotHour, slotMinute] = (slot.time || '09:00').split(':').map(Number);

        // Only process if we are within the same hour as the scheduled time (in LOCAL timezone)
        // This gives a 59-minute window so the hourly cron won't miss it
        if (localHour !== slotHour) continue;

        // Check if we already processed this slot today (dedup)
        // "Today" is based on the LOCAL timezone so we don't miss or double-process across date boundaries
        const localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); // YYYY-MM-DD
        const todayLocalStart = new Date(`${localDateStr}T00:00:00.000Z`);
        const todayLocalEnd = new Date(`${localDateStr}T23:59:59.999Z`);

        const existing = await articlesCol.findOne({
          cronJobId: cronJob._id.toHexString(),
          cronSlotDay: slot.day,
          createdAt: { $gte: todayLocalStart.toISOString(), $lte: todayLocalEnd.toISOString() },
        });

        if (existing) {
          console.log(`[Cron] Already processed slot ${slot.day} ${slot.time} for cron job ${cronJob._id}`);
          results.push({ cronJobId: cronJob._id.toHexString(), topic: slot.articleType, status: 'skipped-duplicate' });
          continue;
        }

        // Use the site doc we already loaded for timezone resolution
        const siteDoc = cronSiteDoc;

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

          // ── Step 5: Send notification (in-app + email) ─────────────
          {
            // Collect any explicit email recipients from cron job config
            const recipientEmails: string[] = [];
            if (cronJob.emailNotification) recipientEmails.push(cronJob.emailNotification);

            try {
              await createNotification(cronJob.userId, 'article', {
                en: 'Cron: Article Published',
                ja: 'Cron: 記事が公開されました',
              }, {
                en: `"${articleResult.title}" was automatically published to ${cronJob.siteName || siteDoc.name || 'your site'}.`,
                ja: `「${articleResult.title}」が${cronJob.siteName || siteDoc.name || 'サイト'}に自動公開されました。`,
              }, {
                actionUrl: '/dashboard/articles',
                recipientEmails: recipientEmails.length > 0 ? recipientEmails : undefined,
              });
            } catch (notifErr) {
              console.error(`[Cron] Failed to send notification for article "${articleResult.title}":`, notifErr);
            }
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
