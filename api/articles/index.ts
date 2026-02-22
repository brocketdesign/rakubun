import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';
import { publishToWordPress } from '../lib/wordpress.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    const collection = db.collection('articles');

    if (req.method === 'GET') {
      const { status, sort, order, search } = req.query;
      const filter: Record<string, unknown> = { userId };
      if (status && status !== 'all') {
        filter.status = status;
      }
      if (search && typeof search === 'string' && search.trim()) {
        filter.$or = [
          { title: { $regex: search.trim(), $options: 'i' } },
          { excerpt: { $regex: search.trim(), $options: 'i' } },
        ];
      }

      const sortField = typeof sort === 'string' ? sort : 'createdAt';
      const sortOrder = order === 'asc' ? 1 : -1;

      const articles = await collection
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .toArray();

      const mapped = articles.map((a) => ({
        id: a._id.toString(),
        title: a.title,
        excerpt: a.excerpt,
        content: a.content,
        site: a.site,
        category: a.category,
        status: a.status,
        wordCount: a.wordCount,
        seoScore: a.seoScore,
        views: a.views,
        thumbnailUrl: a.thumbnailUrl,
        imageUrls: a.imageUrls || [],
        scheduledAt: a.scheduledAt,
        publishedAt: a.publishedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        wpPostId: a.wpPostId,
        wpUrl: a.wpUrl,
      }));

      return res.status(200).json({ articles: mapped, total: mapped.length });
    }

    if (req.method === 'POST') {
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

      const wordCount = content
        ? content
            .replace(/[#*_~`>\-|]/g, '')
            .split(/\s+/)
            .filter((w: string) => w.length > 0).length
        : 0;

      const seoScore = calculateSeoScore(title, content, excerpt);

      const now = new Date();
      const doc: any = {
        userId,
        title: title || 'Untitled Article',
        excerpt: excerpt || (content ? content.substring(0, 160).replace(/[#*_~`]/g, '') : ''),
        content: content || '',
        site: site || '',
        category: category || 'Uncategorized',
        status: status || 'draft',
        wordCount,
        seoScore,
        views: 0,
        thumbnailUrl: thumbnailUrl || '',
        imageUrls: imageUrls || [],
        scheduledAt: scheduledAt || null,
        publishedAt: status === 'published' ? now.toISOString() : null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      if (publishToBlog && site && ObjectId.isValid(site)) {
        const sitesCollection = db.collection('sites');
        const siteDoc = await sitesCollection.findOne({ _id: new ObjectId(site), userId });
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
          let wpStatus: 'publish' | 'draft' | 'future' = blogStatus === 'draft' ? 'draft' : 'publish';
          let wpDate: string | undefined = undefined;

          if (scheduledAt) {
            const scheduledDate = new Date(scheduledAt);
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
              title: doc.title,
              content: doc.content,
              excerpt: doc.excerpt,
              status: wpStatus,
              date: wpDate,
              thumbnailUrl: doc.thumbnailUrl || undefined,
            }
          );
          if (wpResult) {
            doc.wpPostId = wpResult.wpPostId;
            doc.wpUrl = wpResult.url;
            console.log('Published to WordPress successfully, post ID:', wpResult.wpPostId);
          } else {
            console.error('publishToWordPress returned null - check WordPress credentials and URL');
          }
        } else {
          console.error('Site not found for ID:', site);
        }
      }

      const result = await collection.insertOne(doc);

      // Increment the articlesGenerated counter on the associated site
      if (site && ObjectId.isValid(site)) {
        const sitesCollection = db.collection('sites');
        try {
          await sitesCollection.updateOne(
            { _id: new ObjectId(site), userId },
            { $inc: { articlesGenerated: 1 } },
          );
        } catch (e) {
          console.error('Failed to increment articlesGenerated:', e);
        }
      }

      return res.status(201).json({
        id: result.insertedId.toString(),
        ...doc,
        _id: undefined,
        userId: undefined,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
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

  // Title checks (max 25 pts)
  if (title) {
    score += 10;
    if (title.length >= 30 && title.length <= 60) score += 10;
    if (title.length > 10) score += 5;
  }

  // Content checks (max 45 pts)
  if (content) {
    const words = content.split(/\s+/).length;
    if (words >= 300) score += 10;
    if (words >= 800) score += 10;
    if (words >= 1500) score += 5;
    // Has headings
    if (/^##?\s/m.test(content)) score += 10;
    // Has images
    if (/!\[.*?\]\(.*?\)/.test(content)) score += 5;
    // Has links
    if (/\[.*?\]\(.*?\)/.test(content)) score += 5;
  }

  // Meta/excerpt (max 15 pts)
  if (excerpt) {
    score += 5;
    if (excerpt.length >= 120 && excerpt.length <= 160) score += 10;
    else if (excerpt.length > 50) score += 5;
  }

  // Readability bonus (max 15 pts)
  if (content) {
    // Paragraphs (short enough)
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
    if (paragraphs.length >= 3) score += 5;
    // Lists
    if (/^[-*]\s/m.test(content) || /^\d+\.\s/m.test(content)) score += 5;
    // Bold/emphasis
    if (/\*\*.*?\*\*/.test(content) || /__.*?__/.test(content)) score += 5;
  }

  return Math.min(100, score);
}
