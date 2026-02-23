import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';
import { authenticateAgentRequest, AgentAuthError, generateApiKey } from './lib/agent-auth.js';
import {
  publishToWordPress,
  uploadImageToWordPress,
  uploadBase64ImageToWordPress,
  fetchWithRetry,
} from './lib/wordpress.js';

export const config = {
  maxDuration: 60,
};

interface AgentImage {
  url?: string;
  base64?: string;
  altText?: string;
  filename?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';

  switch (action) {
    case 'api-keys':
      return handleApiKeys(req, res);
    case 'articles':
      return handleAgentArticles(req, res);
    case 'publish':
      return handlePublish(req, res);
    case 'sites':
      return handleAgentSites(req, res);
    case 'upload-image':
      return handleUploadImage(req, res);
    default:
      return res.status(404).json({ error: 'Not found' });
  }
}

// ─── api-keys ───────────────────────────────────────────────────────────────

async function handleApiKeys(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    const collection = db.collection('api_keys');

    if (req.method === 'GET') {
      const keys = await collection.find({ userId, revoked: { $ne: true } }).toArray();
      const mapped = keys.map((k) => ({
        id: k._id.toString(),
        name: k.name,
        keyPrefix: k.key.substring(0, 12) + '...',
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt || null,
      }));
      return res.status(200).json({ apiKeys: mapped });
    }

    if (req.method === 'POST') {
      const { name } = req.body || {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'name is required (a label for this API key)' });
      }

      const key = generateApiKey();
      const now = new Date().toISOString();

      const doc = {
        userId,
        name: name.substring(0, 100),
        key,
        revoked: false,
        createdAt: now,
        lastUsedAt: null,
      };

      const result = await collection.insertOne(doc);

      return res.status(201).json({
        id: result.insertedId.toString(),
        name: doc.name,
        key,
        createdAt: now,
        message: 'Store this API key securely. It will not be shown again.',
      });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Valid key id is required as query param' });
      }

      const result = await collection.updateOne(
        { _id: new ObjectId(id), userId },
        { $set: { revoked: true } },
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }

      return res.status(200).json({ success: true, message: 'API key revoked' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Agent] API keys error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── agent articles ─────────────────────────────────────────────────────────

async function handleAgentArticles(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const userId = await authenticateAgentRequest(req);
    const db = await getDb();
    const collection = db.collection('articles');

    const { id, status, siteId, limit } = req.query;

    if (id && typeof id === 'string' && ObjectId.isValid(id)) {
      const article = await collection.findOne({ _id: new ObjectId(id), userId });
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      return res.status(200).json({
        article: {
          id: article._id.toString(),
          title: article.title,
          excerpt: article.excerpt,
          content: article.content,
          site: article.site,
          category: article.category,
          status: article.status,
          wordCount: article.wordCount,
          seoScore: article.seoScore,
          thumbnailUrl: article.thumbnailUrl,
          imageUrls: article.imageUrls || [],
          scheduledAt: article.scheduledAt,
          publishedAt: article.publishedAt,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
          wpPostId: article.wpPostId || null,
          wpUrl: article.wpUrl || null,
          source: article.source || null,
        },
      });
    }

    const filter: Record<string, unknown> = { userId };
    if (status && typeof status === 'string' && status !== 'all') {
      filter.status = status;
    }
    if (siteId && typeof siteId === 'string' && ObjectId.isValid(siteId)) {
      filter.site = siteId;
    }

    const maxResults = Math.min(parseInt(limit as string) || 20, 100);

    const articles = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(maxResults)
      .toArray();

    const mapped = articles.map((a) => ({
      id: a._id.toString(),
      title: a.title,
      excerpt: a.excerpt,
      site: a.site,
      category: a.category,
      status: a.status,
      wordCount: a.wordCount,
      seoScore: a.seoScore,
      thumbnailUrl: a.thumbnailUrl,
      scheduledAt: a.scheduledAt,
      publishedAt: a.publishedAt,
      createdAt: a.createdAt,
      wpPostId: a.wpPostId || null,
      wpUrl: a.wpUrl || null,
      source: a.source || null,
    }));

    return res.status(200).json({ articles: mapped, total: mapped.length });
  } catch (err) {
    if (err instanceof AgentAuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Agent] Articles list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── publish ────────────────────────────────────────────────────────────────

async function handlePublish(req: VercelRequest, res: VercelResponse) {
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

    const siteDoc = await sitesCollection.findOne({ _id: new ObjectId(siteId), userId });
    if (!siteDoc) {
      return res.status(404).json({ error: 'Site not found or does not belong to you' });
    }

    const wpSite = {
      url: siteDoc.url,
      username: siteDoc.username,
      applicationPassword: siteDoc.applicationPassword,
    };

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

    const now = new Date();
    let internalStatus: string;
    if (status === 'schedule') {
      internalStatus = 'scheduled';
    } else if (status === 'publish') {
      internalStatus = 'published';
    } else {
      internalStatus = 'draft';
    }

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

      if (thumbnailMediaId) {
        wpArticle.thumbnailUrl = undefined;
      } else if (finalThumbnailUrl) {
        wpArticle.thumbnailUrl = finalThumbnailUrl;
      }

      const wpResult = await publishToWordPress(wpSite, wpArticle);

      if (wpResult) {
        doc.wpPostId = wpResult.wpPostId;
        doc.wpUrl = wpResult.url;

        if (thumbnailMediaId) {
          try {
            const baseUrl = wpSite.url.startsWith('http') ? wpSite.url : `https://${wpSite.url}`;
            const authHeader = 'Basic ' + Buffer.from(`${wpSite.username}:${wpSite.applicationPassword}`).toString('base64');
            await fetchWithRetry(`${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts/${wpResult.wpPostId}`, {
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
            }, { timeoutMs: 20000, maxRetries: 1, label: 'setFeaturedMedia' });
          } catch (e) {
            console.error('[Agent] Failed to set featured media / categories:', e instanceof Error ? e.message : e);
          }
        }

        console.log('[Agent] Published to WordPress, post ID:', wpResult.wpPostId);
      } else {
        console.error('[Agent] Failed to publish to WordPress');
        doc.wpPublishError = 'Failed to publish to WordPress. Article saved to dashboard only.';
      }
    }

    const insertResult = await articlesCollection.insertOne(doc);

    try {
      await sitesCollection.updateOne(
        { _id: new ObjectId(siteId), userId },
        { $inc: { articlesGenerated: 1 } },
      );
    } catch (e) {
      console.error('[Agent] Failed to increment articlesGenerated:', e);
    }

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

// ─── agent sites ────────────────────────────────────────────────────────────

async function handleAgentSites(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const userId = await authenticateAgentRequest(req);
    const db = await getDb();
    const collection = db.collection('sites');

    const { id } = req.query;

    if (id && typeof id === 'string' && ObjectId.isValid(id)) {
      const siteDoc = await collection.findOne({ _id: new ObjectId(id), userId });
      if (!siteDoc) {
        return res.status(404).json({ error: 'Site not found' });
      }

      let categories: { id: number; name: string; slug: string; count: number }[] = [];
      try {
        const baseUrl = siteDoc.url.startsWith('http') ? siteDoc.url : `https://${siteDoc.url}`;
        const authHeader = 'Basic ' + Buffer.from(`${siteDoc.username}:${siteDoc.applicationPassword}`).toString('base64');

        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const catRes = await fetchWithRetry(
            `${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/categories?per_page=100&page=${page}`,
            { headers: { Authorization: authHeader } },
            { timeoutMs: 15000, maxRetries: 1, label: `agentFetchCategories(page=${page})` },
          );
          if (!catRes.ok) break;
          const batch = (await catRes.json()) as any[];
          categories.push(
            ...batch.map((c: any) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              count: c.count,
            })),
          );
          hasMore = batch.length === 100;
          page++;
        }
      } catch {
        // Non-critical
      }

      return res.status(200).json({
        site: {
          id: siteDoc._id.toString(),
          name: siteDoc.name,
          url: siteDoc.url,
          status: siteDoc.status,
          articlesGenerated: siteDoc.articlesGenerated,
          settings: siteDoc.settings,
          categories,
        },
      });
    }

    const sites = await collection.find({ userId }).toArray();
    const mapped = sites.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      url: s.url,
      status: s.status,
      articlesGenerated: s.articlesGenerated,
      settings: s.settings,
    }));

    return res.status(200).json({ sites: mapped, total: mapped.length });
  } catch (err) {
    if (err instanceof AgentAuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Agent] Sites error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── upload-image ───────────────────────────────────────────────────────────

async function handleUploadImage(req: VercelRequest, res: VercelResponse) {
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

    const { siteId, imageUrl, base64, filename, altText } = req.body || {};

    if (!siteId || typeof siteId !== 'string' || !ObjectId.isValid(siteId)) {
      return res.status(400).json({ error: 'siteId is required and must be a valid ID' });
    }

    if (!imageUrl && !base64) {
      return res.status(400).json({ error: 'Either imageUrl or base64 must be provided' });
    }

    const db = await getDb();
    const sitesCollection = db.collection('sites');
    const siteDoc = await sitesCollection.findOne({ _id: new ObjectId(siteId), userId });

    if (!siteDoc) {
      return res.status(404).json({ error: 'Site not found or does not belong to you' });
    }

    const wpSite = {
      url: siteDoc.url,
      username: siteDoc.username,
      applicationPassword: siteDoc.applicationPassword,
    };

    let result: { id: number; sourceUrl: string } | null = null;

    if (base64) {
      result = await uploadBase64ImageToWordPress(wpSite, base64, filename, altText);
    } else if (imageUrl) {
      result = await uploadImageToWordPress(wpSite, imageUrl);
    }

    if (!result) {
      return res.status(500).json({ error: 'Failed to upload image to WordPress' });
    }

    return res.status(200).json({
      success: true,
      media: {
        wpMediaId: result.id,
        url: result.sourceUrl,
        filename: filename || null,
      },
    });
  } catch (err) {
    if (err instanceof AgentAuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Agent] Upload image error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── shared helpers ─────────────────────────────────────────────────────────

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
