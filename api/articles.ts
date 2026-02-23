import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';
import { publishToWordPress, uploadImageToWordPress, getWordPressPostStatus, type WordPressSite } from './lib/wordpress.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';

  // Known named actions
  switch (action) {
    case '':
      return handleArticlesIndex(req, res);
    case 'generate':
      return handleGenerate(req, res);
    case 'generate-image':
      return handleGenerateImage(req, res);
    case 'auto-schedule':
      return handleAutoSchedule(req, res);
    case 'sync-status':
      return handleSyncStatus(req, res);
    default:
      // Treat as article ID
      return handleArticleById(req, res, action);
  }
}

// ─── articles index (list / create) ─────────────────────────────────────────

async function handleArticlesIndex(req: VercelRequest, res: VercelResponse) {
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
          let wpStatus: 'publish' | 'draft' | 'future' = blogStatus === 'draft' ? 'draft' : 'publish';
          let wpDate: string | undefined = undefined;

          if (scheduledAt) {
            const scheduledDate = new Date(scheduledAt);
            wpDate = scheduledDate.toISOString();
            if (wpStatus === 'publish' && scheduledDate > now) {
              wpStatus = 'future';
            }
          } else {
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
          }
        }
      }

      const result = await collection.insertOne(doc);

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

// ─── article by ID (get / update / delete) ──────────────────────────────────

async function handleArticleById(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    const userId = await authenticateRequest(req);

    if (!ObjectId.isValid(id)) {
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
          const now = new Date();
          let wpStatus: 'publish' | 'draft' | 'future' = blogStatus === 'draft' ? 'draft' : 'publish';
          let wpDate: string | undefined = undefined;
          const effectiveScheduledAt = scheduledAt !== undefined ? scheduledAt : result.scheduledAt;

          if (effectiveScheduledAt) {
            const scheduledDate = new Date(effectiveScheduledAt);
            wpDate = scheduledDate.toISOString();
            if (wpStatus === 'publish' && scheduledDate > now) {
              wpStatus = 'future';
            }
          } else {
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
          }
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

// ─── generate ───────────────────────────────────────────────────────────────

async function handleGenerate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    const { prompt, useWebSearch, imageCount, generateThumbnail, site, category } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const db = await getDb();
    const collection = db.collection('articles');
    const sitesCollection = db.collection('sites');

    let siteDoc = null;
    if (site) {
      try {
        siteDoc = await sitesCollection.findOne({ _id: new ObjectId(site), userId });
      } catch (e) {
        console.error('Invalid site ID:', site);
      }
    }

    const now = new Date();
    const placeholderDoc = {
      userId,
      title: prompt.substring(0, 80),
      excerpt: '',
      content: '',
      site: site || '',
      category: category || 'Uncategorized',
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
    };

    const insertResult = await collection.insertOne(placeholderDoc);
    const articleId = insertResult.insertedId;

    const placeholderResponse = {
      id: articleId.toString(),
      ...placeholderDoc,
      _id: undefined,
      userId: undefined,
    };

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // @ts-ignore - responses API
      const response = await client.responses.create({
        model: 'gpt-5.2',
        tools: useWebSearch ? [{ type: 'web_search' }] : undefined,
        input: `Write a comprehensive, well-structured article about: ${prompt}.
Format it in Markdown with:
- A clear # title
- Multiple ## sections with detailed content
- **Bold** key terms
- Bullet points where appropriate
- A brief conclusion
Make it at least 800 words.`,
      });

      // @ts-ignore
      let content: string = response.output_text || '';

      const imageUrls: string[] = [];
      const imgCount = Math.min(imageCount || 0, 4);
      if (imgCount > 0) {
        try {
          const grokClient = new OpenAI({
            apiKey: process.env.GROK_API_KEY,
            baseURL: 'https://api.x.ai/v1',
          });

          const imagePromises = Array.from({ length: imgCount }).map((_, i) =>
            grokClient.images.generate({
              model: 'grok-imagine-image',
              prompt: `Professional illustration for an article about: ${prompt}, part ${i + 1}`,
            }),
          );

          const imageResponses = await Promise.all(imagePromises);
          for (const imgRes of imageResponses) {
            if (imgRes.data?.[0]?.url) {
              let finalUrl = imgRes.data[0].url;
              if (siteDoc) {
                const wpMedia = await uploadImageToWordPress(
                  { url: siteDoc.url, username: siteDoc.username, applicationPassword: siteDoc.applicationPassword },
                  finalUrl,
                );
                if (wpMedia) {
                  finalUrl = wpMedia.sourceUrl;
                }
              }
              imageUrls.push(finalUrl);
            }
          }

          if (imageUrls.length > 0) {
            const sections = content.split(/\n(?=## )/);
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
            content = newSections.join('\n');
          }
        } catch (imgError) {
          console.error('Error generating images:', imgError);
        }
      }

      let thumbnailUrl = '';
      if (generateThumbnail) {
        try {
          const grokClient = new OpenAI({
            apiKey: process.env.GROK_API_KEY,
            baseURL: 'https://api.x.ai/v1',
          });
          const thumbRes = await grokClient.images.generate({
            model: 'grok-imagine-image',
            prompt: `A professional blog post thumbnail image for: ${prompt}`,
          });
          if (thumbRes.data?.[0]?.url) {
            let finalThumbUrl = thumbRes.data[0].url;
            if (siteDoc) {
              const wpMedia = await uploadImageToWordPress(
                { url: siteDoc.url, username: siteDoc.username, applicationPassword: siteDoc.applicationPassword },
                finalThumbUrl,
              );
              if (wpMedia) {
                finalThumbUrl = wpMedia.sourceUrl;
              }
            }
            thumbnailUrl = finalThumbUrl;
          }
        } catch (thumbError) {
          console.error('Error generating thumbnail:', thumbError);
        }
      }

      const titleMatch = content.match(/^#\s+(.*)/m);
      const title = titleMatch ? titleMatch[1] : prompt;
      const excerpt = content
        .replace(/^#.*\n?/m, '')
        .replace(/[#*_~`>\-|![\]()]/g, '')
        .trim()
        .substring(0, 160);

      const wordCount = content
        .replace(/[#*_~`>\-|]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      const seoScore = calculateSeoScore(title, content, excerpt);

      await collection.updateOne(
        { _id: articleId },
        {
          $set: {
            title,
            excerpt,
            content,
            status: 'draft',
            wordCount,
            seoScore,
            thumbnailUrl,
            imageUrls,
            updatedAt: new Date().toISOString(),
          },
        },
      );

      if (site) {
        try {
          await sitesCollection.updateOne(
            { _id: new ObjectId(site), userId },
            { $inc: { articlesGenerated: 1 } },
          );
        } catch (e) {
          console.error('Failed to increment articlesGenerated:', e);
        }
      }

      return res.status(200).json({
        id: articleId.toString(),
        title,
        excerpt,
        content,
        site: site || '',
        category: category || 'Uncategorized',
        status: 'draft',
        wordCount,
        seoScore,
        views: 0,
        thumbnailUrl,
        imageUrls,
        scheduledAt: null,
        publishedAt: null,
        createdAt: placeholderDoc.createdAt,
        updatedAt: new Date().toISOString(),
      });
    } catch (genError) {
      console.error('Error during generation:', genError);
      await collection.updateOne(
        { _id: articleId },
        {
          $set: {
            title: `Failed: ${prompt.substring(0, 60)}`,
            status: 'draft',
            excerpt: 'Article generation failed. Please try again.',
            updatedAt: new Date().toISOString(),
          },
        },
      );
      return res.status(500).json({
        ...placeholderResponse,
        title: `Failed: ${prompt.substring(0, 60)}`,
        status: 'draft',
        excerpt: 'Article generation failed. Please try again.',
      });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── generate-image ─────────────────────────────────────────────────────────

async function handleGenerateImage(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const client = new OpenAI({
      apiKey: process.env.GROK_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    });

    const response = await client.images.generate({
      model: 'grok-imagine-image',
      prompt: prompt,
    });

    const url = response.data?.[0]?.url;

    return res.status(200).json({ url });
  } catch (error) {
    console.error('Error generating image:', error);
    return res.status(500).json({ error: 'Failed to generate image' });
  }
}

// ─── auto-schedule ──────────────────────────────────────────────────────────

async function handleAutoSchedule(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    const { siteId, articlesPerWeek } = req.body || {};

    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required' });
    }

    const count = Math.min(Math.max(Number(articlesPerWeek) || 3, 1), 7);

    const db = await getDb();
    const sitesCollection = db.collection('sites');

    let siteDoc;
    try {
      siteDoc = await sitesCollection.findOne({ _id: new ObjectId(siteId), userId });
    } catch {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    if (!siteDoc) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const siteUrl = siteDoc.url;
    const siteName = siteDoc.name || new URL(siteUrl).hostname;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const spreadDays = dayNames.slice(0, Math.min(count, 7));
    const dayList = spreadDays.map((d, i) => `Topic ${i + 1}: ${d}`).join(', ');

    // @ts-ignore - responses API
    const response = await client.responses.create({
      model: 'gpt-5.2',
      tools: [{ type: 'web_search' }],
      input: `Analyze the website "${siteUrl}" (${siteName}).

Use web search to visit and understand this website's niche, topics, audience, and content style.

Based on your analysis, suggest exactly ${count} article topics that would perform well on this site.
Spread them across different days of the week: ${dayList}.

For each topic, suggest an optimal publishing time (e.g., "09:00", "14:00", "17:00") based on when the target audience is most likely to engage.

Return ONLY a valid JSON array with no markdown formatting, no code fences, no explanation. Each element must have exactly these fields:
- "title": string (compelling article title)
- "description": string (2-3 sentence description of what the article should cover)
- "day": string (day of the week, e.g., "Monday")
- "time": string (24h format, e.g., "09:00")

Example format:
[{"title":"...","description":"...","day":"Monday","time":"09:00"}]`,
    });

    // @ts-ignore
    const rawText: string = response.output_text || '';

    let topics: Array<{ title: string; description: string; day: string; time: string; suggestedDate: string }>;
    try {
      const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };

      const today = new Date();
      topics = parsed.map((item: any) => {
        const dayIndex = dayMap[(item.day || '').toLowerCase()] ?? 1;
        const currentDay = today.getDay();
        let daysUntil = dayIndex - currentDay;
        if (daysUntil <= 0) daysUntil += 7;

        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntil);
        const suggestedDate = targetDate.toISOString().split('T')[0];

        return {
          title: item.title || 'Untitled Topic',
          description: item.description || '',
          day: item.day || 'Monday',
          time: item.time || '09:00',
          suggestedDate,
        };
      });
    } catch (parseErr) {
      console.error('Failed to parse AI response:', parseErr, 'Raw:', rawText);
      return res.status(500).json({ error: 'Failed to parse AI analysis results' });
    }

    return res.status(200).json({ topics });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── sync-status ────────────────────────────────────────────────────────────

async function handleSyncStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    const db = await getDb();
    const articlesCol = db.collection('articles');
    const sitesCol = db.collection('sites');

    const articles = await articlesCol
      .find({ userId, wpPostId: { $exists: true, $ne: null } })
      .toArray();

    if (articles.length === 0) {
      return res.status(200).json({ updated: [], unchanged: 0, errors: 0 });
    }

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
