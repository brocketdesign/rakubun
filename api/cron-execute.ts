import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb.js';
import {
  publishToWordPress,
  uploadImageToWordPress,
} from './lib/wordpress.js';
import { createNotification } from './notifications.js';

export const config = {
  maxDuration: 300, // waitUntil background tasks need time to complete (AI + images + WP)
};

// ─── Day helpers ────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get the current day name and hour in a given IANA timezone.
 * Falls back to UTC if the timezone is invalid.
 */
function getNowInTimezone(now: Date, timezone: string): { day: string; hour: number; minute: number } {
  try {
    const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' });
    const hourFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
    const minuteFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, minute: 'numeric' });

    const day = dayFormatter.format(now); // e.g. "Wednesday"
    const hourStr = hourFormatter.format(now); // e.g. "14" or "24" (midnight as 24 in some locales)
    let hour = parseInt(hourStr, 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(minuteFormatter.format(now), 10) || 0;

    return { day, hour, minute };
  } catch {
    // Invalid timezone — fall back to UTC
    return { day: DAY_NAMES[now.getUTCDay()], hour: now.getUTCHours(), minute: now.getUTCMinutes() };
  }
}

/**
 * Convert a local date + time string to a UTC Date, given an IANA timezone.
 * E.g. localToUtc('2026-02-28', '15:00', 'Asia/Tokyo') → Date at 06:00 UTC.
 */
function localToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  // Build a reference date in UTC and use Intl to find the offset
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = (timeStr || '09:00').split(':').map(Number);

  // Start with a rough UTC guess
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  try {
    // Get the local time at our guess in the target timezone
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(guess);

    const p: Record<string, number> = {};
    for (const { type, value } of parts) {
      if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(type)) {
        p[type] = parseInt(value, 10);
      }
    }

    // Offset = (what we wanted in local) - (what the guess produced in local)
    const wantedLocalMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const guessLocalMs = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
    const offsetMs = wantedLocalMs - guessLocalMs;

    return new Date(guess.getTime() + offsetMs);
  } catch {
    // If timezone is invalid, treat as UTC
    return guess;
  }
}

/**
 * Get the UTC start and end of a "local day" in the given timezone.
 * E.g. for 2026-02-28 in Asia/Tokyo: start = 2026-02-27T15:00:00Z, end = 2026-02-28T14:59:59.999Z
 */
function getLocalDayBoundsUtc(now: Date, timezone: string): { start: Date; end: Date } {
  const localDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now); // YYYY-MM-DD

  const start = localToUtc(localDateStr, '00:00', timezone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1); // 23:59:59.999 local
  return { start, end };
}

/**
 * Resolve timezone for a schedule plan using the associated site.
 * Falls back to inferring from site language or defaults to UTC.
 */
function resolveScheduleTimezone(siteDoc: Record<string, any> | null): string {
  if (!siteDoc) return 'UTC';

  // 1. Use site's timezone setting
  const siteTz = siteDoc.settings?.timezone;
  if (siteTz && siteTz !== 'UTC' && siteTz !== 'utc') {
    return siteTz;
  }

  // 2. Infer from site language
  const lang = (siteDoc.language || '').toLowerCase();
  if (lang.includes('ja') || lang === 'japanese') {
    return 'Asia/Tokyo';
  }

  return 'UTC';
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

  const executionStart = Date.now();
  const logEntries: string[] = [];

  function log(message: string) {
    console.log(message);
    logEntries.push(`${new Date().toISOString()} ${message}`);
  }

  function logError(message: string, err?: unknown) {
    const errStr = err instanceof Error ? `${err.message}\n${err.stack}` : String(err || '');
    const full = errStr ? `${message} ${errStr}` : message;
    console.error(full);
    logEntries.push(`${new Date().toISOString()} ERROR: ${full}`);
  }

  try {
    const db = await getDb();
    const cronJobsCol = db.collection('cronJobs');
    const articlesCol = db.collection('articles');
    const sitesCol = db.collection('sites');
    const schedulesCol = db.collection('schedules');
    const cronLogsCol = db.collection('cronLogs');

    const now = new Date();
    const currentDay = DAY_NAMES[now.getUTCDay()];
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    log(`[Cron] Running at ${now.toISOString()} — day=${currentDay}, hour=${currentHour}:${String(currentMinute).padStart(2, '0')} UTC`);

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

      log(`[Cron] Part 1: Found ${dueArticles.length} due scheduled article(s) to publish`);

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
            log(`[Cron] Marked article ${article._id} as published (already on WP as post ${article.wpPostId})`);
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
              log(`[Cron] Published scheduled article ${article._id} to WP: ${wpResult.url}`);
              results.push({ cronJobId: 'scheduled', topic: article.title, status: 'success', articleId: article._id.toHexString() });
            } else {
              logError(`[Cron] Failed to publish scheduled article ${article._id} to WordPress`);
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
            log(`[Cron] Marked article ${article._id} as published (no WP credentials)`);
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
              logError(`[Cron] Failed to send notification for scheduled article ${article._id}:`, notifErr);
            }
          }
        } catch (articleErr) {
          logError(`[Cron] Error publishing scheduled article ${article._id}:`, articleErr);
          results.push({
            cronJobId: 'scheduled',
            topic: article.title || 'Unknown',
            status: 'error',
            error: articleErr instanceof Error ? articleErr.message : 'Unknown error',
          });
        }
      }
    } catch (scheduledErr) {
      logError('[Cron] Error processing scheduled articles:', scheduledErr);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PART 2: Process due SCHEDULE PLAN topics (generate + publish)
    //   Heavy work (AI + images + WP) is dispatched via waitUntil so each
    //   article generates independently in its own background task.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    try {
      const activeSchedules = await schedulesCol
        .find({ status: 'active' })
        .toArray();

      log(`[Cron] Part 2: Found ${activeSchedules.length} active schedule plan(s)`);

      for (const schedule of activeSchedules) {
        const topics: Array<{ title: string; description: string; date: string; time: string; generated?: boolean }> = schedule.topics || [];
        let modified = false;

        // Resolve timezone for this schedule's site
        let scheduleSiteDoc: Record<string, any> | null = null;
        if (schedule.siteId && ObjectId.isValid(schedule.siteId)) {
          try {
            scheduleSiteDoc = await sitesCol.findOne({ _id: new ObjectId(schedule.siteId) });
          } catch {
            logError(`[Cron] Invalid siteId ${schedule.siteId} on schedule ${schedule._id}`);
          }
        }
        const scheduleTz = resolveScheduleTimezone(scheduleSiteDoc);
        log(`[Cron] Schedule ${schedule._id}: ${topics.length} topic(s), tz=${scheduleTz}, site=${scheduleSiteDoc?.name || 'unknown'}`);

        for (const topic of topics) {
          if (!topic.date || topic.generated) continue;

          // Build the topic's target datetime in the site's local timezone, converted to UTC
          const topicDateTime = localToUtc(topic.date, topic.time || '09:00', scheduleTz);
          if (isNaN(topicDateTime.getTime())) {
            log(`[Cron] Skipping topic "${topic.title}": invalid date/time ${topic.date} ${topic.time}`);
            continue;
          }

          // Only process if the topic's time is due (past or within current window)
          if (topicDateTime > now) {
            log(`[Cron] Topic "${topic.title}" not yet due: target=${topicDateTime.toISOString()} (${topic.date} ${topic.time} ${scheduleTz}), now=${now.toISOString()}`);
            continue;
          }

          log(`[Cron] Topic "${topic.title}" IS due: target=${topicDateTime.toISOString()} (${topic.date} ${topic.time} ${scheduleTz}), now=${now.toISOString()}`);

          // Check dedup: don't generate if an article with this exact plan title already exists
          const existing = await articlesCol.findOne({
            userId: schedule.userId,
            title: topic.title,
            schedulePlanGenerated: true,
          });
          if (existing) {
            topic.generated = true;
            modified = true;
            log(`[Cron] Plan topic "${topic.title}" already generated, skipping`);
            continue;
          }

          const siteDoc = scheduleSiteDoc;

          if (!siteDoc) {
            logError(`[Cron] Site not found for schedule ${schedule._id}, skipping topic "${topic.title}"`);            
            results.push({ cronJobId: `plan-${schedule._id}`, topic: topic.title, status: 'error', error: 'Site not found' });
            continue;
          }

          // Insert a "generating" placeholder article immediately (for dedup + UI)
          const placeholderDoc = {
            userId: schedule.userId,
            title: topic.title,
            excerpt: '',
            content: '',
            site: schedule.siteId,
            category: topic.title,
            status: 'generating',
            wordCount: 0,
            seoScore: 0,
            views: 0,
            thumbnailUrl: '',
            imageUrls: [] as string[],
            scheduledAt: null,
            publishedAt: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            schedulePlanGenerated: true,
          };
          const insertResult = await articlesCol.insertOne(placeholderDoc);
          const articleId = insertResult.insertedId;

          // Mark topic as generated so the schedule gets updated
          topic.generated = true;
          modified = true;

          log(`[Cron] Dispatching background generation for plan topic: "${topic.title}" (article ${articleId})`);
          results.push({ cronJobId: `plan-${schedule._id}`, topic: topic.title, status: 'dispatched', articleId: articleId.toString() });

          // Fire off the heavy work in the background
          waitUntil(
            processSchedulePlanArticle(articleId, schedule.userId, topic.title, siteDoc, now),
          );
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
          log(`[Cron] Schedule ${schedule._id} completed — all topics generated`);
        }
      }
    } catch (planErr) {
      logError('[Cron] Error processing schedule plans:', planErr);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PART 3: Process recurring CRON JOBS
    //   Heavy work (AI + images + WP) is dispatched via waitUntil so each
    //   article generates independently in its own background task.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Find all active cron jobs
    const activeCronJobs = await cronJobsCol
      .find({ status: 'active' })
      .toArray();

    if (activeCronJobs.length === 0) {
      log('[Cron] Part 3: No active cron jobs found.');
    } else {
      log(`[Cron] Part 3: Found ${activeCronJobs.length} active cron job(s)`);
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
      const { day: localDay, hour: localHour, minute: localMinute } = getNowInTimezone(now, tz);

      log(`[Cron] Job ${cronJob._id} (${cronJob.siteName}) — tz=${tz}, localDay=${localDay}, localTime=${localHour}:${String(localMinute).padStart(2, '0')}`);

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
        const { start: todayLocalStart, end: todayLocalEnd } = getLocalDayBoundsUtc(now, tz);

        const existing = await articlesCol.findOne({
          cronJobId: cronJob._id.toHexString(),
          cronSlotDay: slot.day,
          createdAt: { $gte: todayLocalStart.toISOString(), $lte: todayLocalEnd.toISOString() },
        });

        if (existing) {
          log(`[Cron] Already processed slot ${slot.day} ${slot.time} for cron job ${cronJob._id}`);
          results.push({ cronJobId: cronJob._id.toHexString(), topic: slot.articleType, status: 'skipped-duplicate' });
          continue;
        }

        const siteDoc = cronSiteDoc;

        if (!siteDoc) {
          logError(`[Cron] Site not found: ${cronJob.siteId}`);
          results.push({ cronJobId: cronJob._id.toHexString(), topic: slot.articleType, status: 'error', error: 'Site not found' });
          continue;
        }

        // Insert a "generating" placeholder article immediately (for dedup + UI visibility)
        const placeholderDoc = {
          userId: cronJob.userId,
          title: slot.articleType,
          excerpt: '',
          content: '',
          site: cronJob.siteId,
          category: slot.articleType,
          status: 'generating',
          wordCount: 0,
          seoScore: 0,
          views: 0,
          thumbnailUrl: '',
          imageUrls: [] as string[],
          scheduledAt: null,
          publishedAt: null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          // Dedup tracking metadata — written now so the next cron run won't re-dispatch
          cronJobId: cronJob._id.toHexString(),
          cronSlotDay: slot.day,
          cronGenerated: true,
        };

        const insertResult = await articlesCol.insertOne(placeholderDoc);
        const articleId = insertResult.insertedId;

        log(`[Cron] Dispatching background generation for slot ${slot.day} ${slot.time}: "${slot.articleType}" (article ${articleId})`);
        results.push({ cronJobId: cronJob._id.toHexString(), topic: slot.articleType, status: 'dispatched', articleId: articleId.toString() });

        // Fire off the heavy work in the background
        waitUntil(
          processCronJobArticle(
            articleId,
            cronJob,
            slot,
            siteDoc,
            now,
          ),
        );
      }
    }

    const succeeded = results.filter((r) => r.status === 'success' || r.status === 'dispatched').length;
    const failed = results.filter((r) => r.status === 'error').length;
    const skipped = results.filter((r) => r.status === 'skipped-duplicate').length;

    log(`[Cron] Done. Succeeded: ${succeeded}, Failed: ${failed}, Skipped: ${skipped}`);

    // Persist execution log to MongoDB for debugging
    const executionMs = Date.now() - executionStart;
    try {
      await cronLogsCol.insertOne({
        executedAt: now.toISOString(),
        durationMs: executionMs,
        processed: results.length,
        succeeded,
        failed,
        skipped,
        results,
        logs: logEntries,
        createdAt: new Date().toISOString(),
      });
      // Keep only the last 200 log entries to prevent unbounded growth
      const logCount = await cronLogsCol.countDocuments();
      if (logCount > 200) {
        const oldest = await cronLogsCol.find().sort({ createdAt: 1 }).limit(logCount - 200).toArray();
        if (oldest.length > 0) {
          await cronLogsCol.deleteMany({ _id: { $in: oldest.map(o => o._id) } });
        }
      }
    } catch (logErr) {
      console.error('[Cron] Failed to persist execution log:', logErr);
    }

    return res.status(200).json({
      message: 'Cron execution complete',
      processed: results.length,
      succeeded,
      failed,
      skipped,
      results,
    });
  } catch (err) {
    logError('[Cron] Fatal error:', err);

    // Try to persist error log even on fatal failure
    try {
      const db = await getDb();
      await db.collection('cronLogs').insertOne({
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - executionStart,
        processed: 0,
        succeeded: 0,
        failed: 1,
        skipped: 0,
        results: [],
        logs: logEntries,
        fatalError: err instanceof Error ? err.message : String(err),
        createdAt: new Date().toISOString(),
      });
    } catch { /* ignore */ }

    return res.status(500).json({ error: 'Cron execution failed' });
  }
}

// ─── Background worker: Schedule Plan article ───────────────────────────────

/**
 * Runs in the background via waitUntil(). Generates content, images, publishes
 * to WordPress, and updates the placeholder article in the DB.
 */
async function processSchedulePlanArticle(
  articleId: ObjectId,
  userId: string,
  topicTitle: string,
  siteDoc: Record<string, any>,
  now: Date,
) {
  try {
    const db = await getDb();
    const articlesCol = db.collection('articles');

    // Generate article content
    const articleResult = await generateArticle({
      articleType: topicTitle,
      siteUrl: siteDoc.url || '',
      siteName: siteDoc.name || '',
      language: siteDoc.language || 'ja',
      wordCountMin: 1000,
      wordCountMax: 1500,
      style: '',
    });

    // Generate thumbnail
    let thumbnailUrl = '';
    if (process.env.GROK_API_KEY) {
      try {
        const grokClient = new OpenAI({
          apiKey: process.env.GROK_API_KEY,
          baseURL: 'https://api.x.ai/v1',
        });
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
        console.error('[Cron BG] Plan topic thumbnail error:', thumbErr);
      }
    }

    // Publish to WordPress
    let wpPostId: number | undefined;
    let wpUrl: string | undefined;
    if (siteDoc.username && siteDoc.applicationPassword) {
      const wpResult = await publishToWordPress(
        { url: siteDoc.url, username: siteDoc.username, applicationPassword: siteDoc.applicationPassword },
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

    // Update the placeholder article with the generated content
    const wordCount = articleResult.content
      .replace(/[#*_~`>\-|]/g, '')
      .split(/\s+/)
      .filter((w: string) => w.length > 0).length;

    await articlesCol.updateOne(
      { _id: articleId },
      {
        $set: {
          title: articleResult.title,
          excerpt: articleResult.excerpt,
          content: articleResult.content,
          status: wpPostId ? 'published' : 'draft',
          wordCount,
          seoScore: 0,
          thumbnailUrl,
          publishedAt: wpPostId ? now.toISOString() : null,
          updatedAt: new Date().toISOString(),
          wpPostId: wpPostId || null,
          wpUrl: wpUrl || null,
        },
      },
    );

    // Notify
    createNotification(userId, 'article', {
      en: 'Schedule: Article Published',
      ja: 'スケジュール: 記事が公開されました',
    }, {
      en: `"${articleResult.title}" was generated and published from your content schedule.`,
      ja: `「${articleResult.title}」がコンテンツスケジュールから生成・公開されました。`,
    }, { actionUrl: '/dashboard/articles' }).catch(() => {});

    console.log(`[Cron BG] Plan topic article complete: ${articleId} — "${articleResult.title}"`);
  } catch (err) {
    console.error(`[Cron BG] Failed to generate plan topic article ${articleId}:`, err);
    // Mark the placeholder as failed so the UI can show it
    try {
      const db = await getDb();
      await db.collection('articles').updateOne(
        { _id: articleId },
        {
          $set: {
            title: `Failed: ${topicTitle.substring(0, 60)}`,
            status: 'failed',
            excerpt: 'Article generation failed. Please try again.',
            updatedAt: new Date().toISOString(),
          },
        },
      );
    } catch { /* ignore */ }

    createNotification(userId, 'ai', {
      en: 'Schedule: Generation Failed',
      ja: 'スケジュール: 生成失敗',
    }, {
      en: `Article generation for "${topicTitle.substring(0, 40)}" failed.`,
      ja: `「${topicTitle.substring(0, 40)}」の記事生成に失敗しました。`,
    }, { actionUrl: '/dashboard/articles' }).catch(() => {});
  }
}

// ─── Background worker: Cron Job article ────────────────────────────────────

/**
 * Runs in the background via waitUntil(). Generates content, images, publishes
 * to WordPress, and updates the placeholder article in the DB.
 */
async function processCronJobArticle(
  articleId: ObjectId,
  cronJob: Record<string, any>,
  slot: { day: string; time: string; articleType: string },
  siteDoc: Record<string, any>,
  now: Date,
) {
  try {
    const db = await getDb();
    const articlesCol = db.collection('articles');
    const sitesCol = db.collection('sites');

    // Step 1: Generate article content via OpenAI
    const articleResult = await generateArticle({
      articleType: slot.articleType,
      siteUrl: cronJob.siteUrl || siteDoc.url,
      siteName: cronJob.siteName || siteDoc.name,
      language: cronJob.language || 'ja',
      wordCountMin: cronJob.wordCountMin || 1000,
      wordCountMax: cronJob.wordCountMax || 1500,
      style: cronJob.style || '',
    });

    // Step 2: Generate images via Grok
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
          console.error('[Cron BG] Thumbnail generation error:', thumbErr);
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
        console.error('[Cron BG] Image generation error:', imgError);
      }
    }

    // Step 3: Publish to WordPress
    let wpPostId: number | undefined;
    let wpUrl: string | undefined;

    if (siteDoc.username && siteDoc.applicationPassword) {
      const wpResult = await publishToWordPress(
        { url: siteDoc.url, username: siteDoc.username, applicationPassword: siteDoc.applicationPassword },
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

    // Step 4: Update the placeholder article with generated content
    const wordCount = articleResult.content
      .replace(/[#*_~`>\-|]/g, '')
      .split(/\s+/)
      .filter((w: string) => w.length > 0).length;

    await articlesCol.updateOne(
      { _id: articleId },
      {
        $set: {
          title: articleResult.title,
          excerpt: articleResult.excerpt,
          content: articleResult.content,
          status: wpPostId ? 'published' : 'draft',
          wordCount,
          seoScore: calculateSeoScore(articleResult.title, articleResult.content, articleResult.excerpt),
          thumbnailUrl,
          imageUrls,
          publishedAt: wpPostId ? now.toISOString() : null,
          updatedAt: new Date().toISOString(),
          wpPostId: wpPostId || null,
          wpUrl: wpUrl || null,
        },
      },
    );

    // Increment site article counter
    try {
      await sitesCol.updateOne(
        { _id: new ObjectId(cronJob.siteId) },
        { $inc: { articlesGenerated: 1 } },
      );
    } catch { /* ignore */ }

    // Step 5: Send notification (in-app + email)
    const recipientEmails: string[] = [];
    if (cronJob.emailNotification) recipientEmails.push(cronJob.emailNotification);

    createNotification(cronJob.userId, 'article', {
      en: 'Cron: Article Published',
      ja: 'Cron: 記事が公開されました',
    }, {
      en: `"${articleResult.title}" was automatically published to ${cronJob.siteName || siteDoc.name || 'your site'}.`,
      ja: `「${articleResult.title}」が${cronJob.siteName || siteDoc.name || 'サイト'}に自動公開されました。`,
    }, {
      actionUrl: '/dashboard/articles',
      recipientEmails: recipientEmails.length > 0 ? recipientEmails : undefined,
    }).catch(() => {});

    console.log(`[Cron BG] Cron job article complete: ${articleId} — "${articleResult.title}"`);
  } catch (err) {
    console.error(`[Cron BG] Failed to generate cron job article ${articleId}:`, err);
    // Mark the placeholder as failed
    try {
      const db = await getDb();
      await db.collection('articles').updateOne(
        { _id: articleId },
        {
          $set: {
            title: `Failed: ${slot.articleType.substring(0, 60)}`,
            status: 'failed',
            excerpt: 'Article generation failed. Will be retried on next cron run.',
            updatedAt: new Date().toISOString(),
          },
        },
      );
    } catch { /* ignore */ }

    createNotification(cronJob.userId, 'ai', {
      en: 'Cron: Generation Failed',
      ja: 'Cron: 生成失敗',
    }, {
      en: `Article generation for "${slot.articleType.substring(0, 40)}" failed.`,
      ja: `「${slot.articleType.substring(0, 40)}」の記事生成に失敗しました。`,
    }, { actionUrl: '/dashboard/articles' }).catch(() => {});
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
