import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateAgentRequest, AgentAuthError } from '../lib/agent-auth.js';
import {
  publishToWordPress,
  uploadImageToWordPress,
  uploadBase64ImageToWordPress,
} from '../lib/wordpress.js';

export const config = {
  maxDuration: 60,
};

interface AgentImage {
  url?: string;
  base64?: string;
  altText?: string;
  filename?: string;
}

/**
 * POST /api/agent/publish
 *
 * Create an article in the dashboard and optionally publish it to WordPress.
 *
 * Headers:
 *   X-API-Key: <your-api-key>
 *
 * Body (JSON):
 *   title        (required) - Article title
 *   content      (required) - Article content (markdown or HTML)
 *   excerpt      (optional) - Article excerpt (auto-generated from content if omitted)
 *   siteId       (required) - MongoDB ID of the site to associate / publish to
 *   category     (optional) - Category name (default: "Uncategorized")
 *   categoryId   (optional) - WordPress category ID (number)
 *   tags         (optional) - Array of tag names
 *   status       (optional) - "draft" | "publish" | "schedule" (default: "draft")
 *   scheduledAt  (optional) - ISO 8601 date string for scheduling (required when status="schedule")
 *   publishToBlog(optional) - Whether to publish to WordPress (default: true)
 *   thumbnailUrl (optional) - URL of thumbnail image (will be uploaded to WP)
 *   thumbnailBase64 (optional) - Base64 encoded thumbnail image
 *   images       (optional) - Array of image objects to upload to WP and embed in content:
 *                              { url?: string, base64?: string, altText?: string, filename?: string }
 *   insertImagesInContent (optional) - Whether to insert uploaded images into content at section breaks (default: true)
 *
 * Returns: The created article object with WordPress post ID and URL if published.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const userId = await authenticateAgentRequest(req);

    const {
      title,
      content,
      excerpt,
      siteId,
      category,
      categoryId,
      tags,
      status = 'draft',
      scheduledAt,
      publishToBlog = true,
      thumbnailUrl,
      thumbnailBase64,
      images,
      insertImagesInContent = true,
    } = req.body || {};

    // Validate required fields
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required and must be a string' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required and must be a string' });
    }
    if (!siteId || typeof siteId !== 'string') {
      return res.status(400).json({ error: 'siteId is required and must be a string' });
    }
    if (!ObjectId.isValid(siteId)) {
      return res.status(400).json({ error: 'siteId is not a valid ID' });
    }
    if (status === 'schedule' && !scheduledAt) {
      return res.status(400).json({ error: 'scheduledAt is required when status is "schedule"' });
    }
    if (!['draft', 'publish', 'schedule'].includes(status)) {
      return res.status(400).json({ error: 'status must be "draft", "publish", or "schedule"' });
    }

    const db = await getDb();
    const sitesCollection = db.collection('sites');
    const articlesCollection = db.collection('articles');

    // Verify site belongs to user
    const siteDoc = await sitesCollection.findOne({ _id: new ObjectId(siteId), userId });
    if (!siteDoc) {
      return res.status(404).json({ error: 'Site not found or does not belong to you' });
    }

    const wpSite = {
      url: siteDoc.url,
      username: siteDoc.username,
      applicationPassword: siteDoc.applicationPassword,
    };

    // --- Upload images ---
    const uploadedImages: { id: number; sourceUrl: string; altText?: string }[] = [];

    if (images && Array.isArray(images)) {
      for (const img of images as AgentImage[]) {
        let result: { id: number; sourceUrl: string } | null = null;

        if (img.base64) {
          result = await uploadBase64ImageToWordPress(wpSite, img.base64, img.filename, img.altText);
        } else if (img.url) {
          result = await uploadImageToWordPress(wpSite, img.url);
        }

        if (result) {
          uploadedImages.push({ ...result, altText: img.altText });
        }
      }
    }

    // --- Upload thumbnail ---
    let finalThumbnailUrl = thumbnailUrl || '';
    let thumbnailMediaId: number | undefined;

    if (thumbnailBase64) {
      const thumbResult = await uploadBase64ImageToWordPress(
        wpSite,
        thumbnailBase64,
        'thumbnail-' + Date.now() + '.jpg',
        title,
      );
      if (thumbResult) {
        finalThumbnailUrl = thumbResult.sourceUrl;
        thumbnailMediaId = thumbResult.id;
      }
    } else if (thumbnailUrl) {
      const thumbResult = await uploadImageToWordPress(wpSite, thumbnailUrl);
      if (thumbResult) {
        finalThumbnailUrl = thumbResult.sourceUrl;
        thumbnailMediaId = thumbResult.id;
      }
    }

    // --- Insert images into content at section breaks ---
    let finalContent = content;
    if (insertImagesInContent && uploadedImages.length > 0) {
      const sections = finalContent.split(/\n(?=## )/);
      const interval = Math.max(1, Math.floor(sections.length / (uploadedImages.length + 1)));
      let imgIdx = 0;
      const newSections: string[] = [];

      for (let i = 0; i < sections.length; i++) {
        newSections.push(sections[i]);
        if (imgIdx < uploadedImages.length && (i + 1) % interval === 0) {
          const alt = uploadedImages[imgIdx].altText || 'Article image';
          newSections.push(`\n![${alt}](${uploadedImages[imgIdx].sourceUrl})\n`);
          imgIdx++;
        }
      }
      while (imgIdx < uploadedImages.length) {
        const alt = uploadedImages[imgIdx].altText || 'Article image';
        newSections.push(`\n![${alt}](${uploadedImages[imgIdx].sourceUrl})\n`);
        imgIdx++;
      }
      finalContent = newSections.join('\n');
    }

    // --- Compute metadata ---
    const wordCount = finalContent
      .replace(/[#*_~`>\-|]/g, '')
      .split(/\s+/)
      .filter((w: string) => w.length > 0).length;

    const computedExcerpt = excerpt || finalContent
      .replace(/^#.*\n?/m, '')
      .replace(/[#*_~`>\-|![\]()]/g, '')
      .trim()
      .substring(0, 160);

    const seoScore = calculateSeoScore(title, finalContent, computedExcerpt);

    // --- Determine internal status ---
    const now = new Date();
    let internalStatus: string;
    if (status === 'schedule') {
      internalStatus = 'scheduled';
    } else if (status === 'publish') {
      internalStatus = 'published';
    } else {
      internalStatus = 'draft';
    }

    // --- Build article document ---
    const doc: Record<string, unknown> = {
      userId,
      title,
      excerpt: computedExcerpt,
      content: finalContent,
      site: siteId,
      category: category || 'Uncategorized',
      status: internalStatus,
      wordCount,
      seoScore,
      views: 0,
      thumbnailUrl: finalThumbnailUrl,
      imageUrls: uploadedImages.map((img) => img.sourceUrl),
      scheduledAt: scheduledAt || null,
      publishedAt: internalStatus === 'published' ? now.toISOString() : null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      source: 'agent',
    };

    // --- Publish to WordPress ---
    if (publishToBlog) {
      let wpStatus: 'publish' | 'draft' | 'future';
      let wpDate: string | undefined;

      if (status === 'schedule' && scheduledAt) {
        const scheduledDate = new Date(scheduledAt);
        wpStatus = 'future';
        wpDate = scheduledDate.toISOString();
      } else if (status === 'publish') {
        wpStatus = 'publish';
        wpDate = now.toISOString();
      } else {
        wpStatus = 'draft';
      }

      // Build WordPress post body
      const wpArticle: {
        title: string;
        content: string;
        excerpt?: string;
        status: 'publish' | 'draft' | 'future';
        date?: string;
        thumbnailUrl?: string;
      } = {
        title,
        content: finalContent,
        excerpt: computedExcerpt,
        status: wpStatus,
        date: wpDate,
      };

      // If we already uploaded thumbnail and have its media ID, we'll set it directly
      // Otherwise pass the thumbnail URL for publishToWordPress to handle
      if (thumbnailMediaId) {
        // We'll handle featured_media ourselves in a custom call
        wpArticle.thumbnailUrl = undefined;
      } else if (finalThumbnailUrl) {
        wpArticle.thumbnailUrl = finalThumbnailUrl;
      }

      const wpResult = await publishToWordPress(wpSite, wpArticle);

      if (wpResult) {
        doc.wpPostId = wpResult.wpPostId;
        doc.wpUrl = wpResult.url;

        // If we have a pre-uploaded thumbnail, set it as featured media now
        if (thumbnailMediaId) {
          try {
            const baseUrl = wpSite.url.startsWith('http') ? wpSite.url : `https://${wpSite.url}`;
            const authHeader = 'Basic ' + Buffer.from(`${wpSite.username}:${wpSite.applicationPassword}`).toString('base64');
            await fetch(`${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts/${wpResult.wpPostId}`, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                featured_media: thumbnailMediaId,
                ...(categoryId ? { categories: [categoryId] } : {}),
                ...(tags && tags.length > 0 ? { tags: tags } : {}),
              }),
            });
          } catch (e) {
            console.error('[Agent] Failed to set featured media / categories:', e);
          }
        }

        console.log('[Agent] Published to WordPress, post ID:', wpResult.wpPostId);
      } else {
        console.error('[Agent] Failed to publish to WordPress');
        // Article is still saved to dashboard even if WP publish fails
        doc.wpPublishError = 'Failed to publish to WordPress. Article saved to dashboard only.';
      }
    }

    // --- Save to database ---
    const insertResult = await articlesCollection.insertOne(doc);

    // Increment articles counter on site
    try {
      await sitesCollection.updateOne(
        { _id: new ObjectId(siteId), userId },
        { $inc: { articlesGenerated: 1 } },
      );
    } catch (e) {
      console.error('[Agent] Failed to increment articlesGenerated:', e);
    }

    // --- Return response ---
    return res.status(201).json({
      success: true,
      article: {
        id: insertResult.insertedId.toString(),
        title: doc.title,
        excerpt: doc.excerpt,
        content: doc.content,
        site: doc.site,
        category: doc.category,
        status: doc.status,
        wordCount: doc.wordCount,
        seoScore: doc.seoScore,
        thumbnailUrl: doc.thumbnailUrl,
        imageUrls: doc.imageUrls,
        scheduledAt: doc.scheduledAt,
        publishedAt: doc.publishedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        wpPostId: doc.wpPostId || null,
        wpUrl: doc.wpUrl || null,
        source: 'agent',
      },
      wordpress: doc.wpPostId
        ? { postId: doc.wpPostId, url: doc.wpUrl, status: status }
        : null,
      uploadedImages: uploadedImages.map((img) => ({
        wpMediaId: img.id,
        url: img.sourceUrl,
      })),
    });
  } catch (err) {
    if (err instanceof AgentAuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Agent] Publish error:', err);
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
