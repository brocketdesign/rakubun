import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';
import { getWordPressPostStatus, type WordPressSite } from '../lib/wordpress.js';

/**
 * POST /api/articles/sync-status
 *
 * For every article that has a wpPostId, fetches the current status from
 * WordPress and updates the local database accordingly.
 *
 * Returns: { updated: { id, status, wpUrl }[], unchanged: number, errors: number }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    const articlesCol = db.collection('articles');
    const sitesCol = db.collection('sites');

    // Fetch all articles that have a WordPress post ID
    const articles = await articlesCol
      .find({ userId, wpPostId: { $exists: true, $ne: null } })
      .toArray();

    if (articles.length === 0) {
      return res.status(200).json({ updated: [], unchanged: 0, errors: 0 });
    }

    // Cache site credentials so we don't re-fetch per article
    const siteCache = new Map<string, WordPressSite | null>();

    async function getSiteCredentials(siteId: string): Promise<WordPressSite | null> {
      if (siteCache.has(siteId)) return siteCache.get(siteId)!;
      if (!ObjectId.isValid(siteId)) {
        siteCache.set(siteId, null);
        return null;
      }
      const siteDoc = await sitesCol.findOne({ _id: new ObjectId(siteId), userId });
      if (!siteDoc) {
        siteCache.set(siteId, null);
        return null;
      }
      const creds: WordPressSite = {
        url: siteDoc.url,
        username: siteDoc.username,
        applicationPassword: siteDoc.applicationPassword,
      };
      siteCache.set(siteId, creds);
      return creds;
    }

    // Map WordPress status to our internal status
    function mapWpStatus(wpStatus: string): string {
      switch (wpStatus) {
        case 'publish':
        case 'private':
          return 'published';
        case 'future':
          return 'scheduled';
        case 'draft':
        case 'pending':
          return 'draft';
        default:
          return 'draft';
      }
    }

    const updated: { id: string; status: string; wpUrl: string }[] = [];
    let unchanged = 0;
    let errors = 0;

    // Process articles (could be parallelized but sequential is safer for rate limits)
    for (const article of articles) {
      const siteId = article.site as string;
      if (!siteId) {
        errors++;
        continue;
      }

      const site = await getSiteCredentials(siteId);
      if (!site) {
        errors++;
        continue;
      }

      const wpResult = await getWordPressPostStatus(site, article.wpPostId as number);
      if (!wpResult) {
        errors++;
        continue;
      }

      const newStatus = mapWpStatus(wpResult.status);

      if (article.status !== newStatus || article.wpUrl !== wpResult.link) {
        const updateFields: Record<string, unknown> = {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };
        if (wpResult.link) {
          updateFields.wpUrl = wpResult.link;
        }
        if (newStatus === 'published' && !article.publishedAt) {
          updateFields.publishedAt = new Date().toISOString();
        }

        await articlesCol.updateOne(
          { _id: article._id },
          { $set: updateFields },
        );

        updated.push({
          id: article._id.toString(),
          status: newStatus,
          wpUrl: wpResult.link,
        });
      } else {
        unchanged++;
      }
    }

    return res.status(200).json({ updated, unchanged, errors });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[sync-status]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
