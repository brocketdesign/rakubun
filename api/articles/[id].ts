import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';
import { publishToWordPress } from '../lib/wordpress.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid article ID' });
    }

    const db = await getDb();
    const collection = db.collection('articles');
    const filter = { _id: new ObjectId(id), userId };

    if (req.method === 'GET') {
      const article = await collection.findOne(filter);
      if (!article) return res.status(404).json({ error: 'Article not found' });
      return res.status(200).json({
        id: article._id.toString(),
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        site: article.site,
        category: article.category,
        status: article.status,
        wordCount: article.wordCount,
        seoScore: article.seoScore,
        views: article.views,
        thumbnailUrl: article.thumbnailUrl,
        imageUrls: article.imageUrls || [],
        scheduledAt: article.scheduledAt,
        publishedAt: article.publishedAt,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        wpPostId: article.wpPostId,
        wpUrl: article.wpUrl,
      });
    }

    if (req.method === 'PUT') {
      const {
        title,
        excerpt,
        content,
        site,
        category,
        status,
        thumbnailUrl,
        imageUrls,
        scheduledAt,
        publishToBlog,
        blogStatus,
      } = req.body || {};

      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (content !== undefined) {
        updates.content = content;
        updates.wordCount = content
          .replace(/[#*_~`>\-|]/g, '')
          .split(/\s+/)
          .filter((w: string) => w.length > 0).length;
        if (!excerpt) {
          updates.excerpt = content.substring(0, 160).replace(/[#*_~`]/g, '');
        }
        updates.seoScore = calculateSeoScore(
          title || undefined,
          content,
          excerpt || undefined,
        );
      }
      if (excerpt !== undefined) updates.excerpt = excerpt;
      if (site !== undefined) updates.site = site;
      if (category !== undefined) updates.category = category;
      if (status !== undefined) {
        updates.status = status;
        if (status === 'published') updates.publishedAt = new Date().toISOString();
      }
      if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl;
      if (imageUrls !== undefined) updates.imageUrls = imageUrls;
      if (scheduledAt !== undefined) updates.scheduledAt = scheduledAt;

      let result = await collection.findOneAndUpdate(
        filter,
        { $set: updates },
        { returnDocument: 'after' },
      );

      if (!result) return res.status(404).json({ error: 'Article not found' });

      if (publishToBlog && result.site && ObjectId.isValid(result.site)) {
        const sitesCollection = db.collection('sites');
        const siteDoc = await sitesCollection.findOne({ _id: new ObjectId(result.site), userId });
        if (siteDoc) {
          console.log('[WP] Site doc from DB:', {
            url: siteDoc.url,
            username: siteDoc.username,
            hasApplicationPassword: !!siteDoc.applicationPassword,
            passwordLength: siteDoc.applicationPassword?.length,
            docKeys: Object.keys(siteDoc),
          });
          console.log('Publishing to WordPress:', siteDoc.url, 'status:', blogStatus);
          // Determine WordPress status and date for scheduling
          const now = new Date();
          let wpStatus: 'publish' | 'draft' | 'future' = blogStatus === 'draft' ? 'draft' : 'publish';
          let wpDate: string | undefined = undefined;
          const effectiveScheduledAt = scheduledAt !== undefined ? scheduledAt : result.scheduledAt;

          if (effectiveScheduledAt) {
            const scheduledDate = new Date(effectiveScheduledAt);
            wpDate = scheduledDate.toISOString();
            // If the scheduled date is in the future and publishing, use 'future' status
            if (wpStatus === 'publish' && scheduledDate > now) {
              wpStatus = 'future';
            }
          } else {
            // Default to current time
            wpDate = now.toISOString();
          }

          const wpResult = await publishToWordPress(
            {
              url: siteDoc.url,
              username: siteDoc.username,
              applicationPassword: siteDoc.applicationPassword,
            },
            {
              title: result.title,
              content: result.content,
              excerpt: result.excerpt,
              status: wpStatus,
              wpPostId: result.wpPostId,
              date: wpDate,
              thumbnailUrl: result.thumbnailUrl || undefined,
            }
          );
          if (wpResult) {
            result = await collection.findOneAndUpdate(
              filter,
              { $set: { wpPostId: wpResult.wpPostId, wpUrl: wpResult.url } },
              { returnDocument: 'after' }
            );
            console.log('Published to WordPress successfully, post ID:', wpResult.wpPostId);
          } else {
            console.error('publishToWordPress returned null - check WordPress credentials and URL');
          }
        } else {
          console.error('Site not found for ID:', result.site);
        }
      }

      return res.status(200).json({
        id: result!._id.toString(),
        title: result!.title,
        excerpt: result!.excerpt,
        content: result!.content,
        site: result!.site,
        category: result!.category,
        status: result!.status,
        wordCount: result!.wordCount,
        seoScore: result!.seoScore,
        views: result!.views,
        thumbnailUrl: result!.thumbnailUrl,
        imageUrls: result!.imageUrls || [],
        scheduledAt: result!.scheduledAt,
        publishedAt: result!.publishedAt,
        createdAt: result!.createdAt,
        updatedAt: result!.updatedAt,
        wpPostId: result!.wpPostId,
        wpUrl: result!.wpUrl,
      });
    }

    if (req.method === 'DELETE') {
      const result = await collection.deleteOne(filter);
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Article not found' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

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
