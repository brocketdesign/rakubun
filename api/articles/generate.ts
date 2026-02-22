import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';
import { uploadImageToWordPress } from '../lib/wordpress.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    // Create placeholder article marked as "generating"
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

    // Return the placeholder immediately so the UI can track it
    const placeholderResponse = {
      id: articleId.toString(),
      ...placeholderDoc,
      _id: undefined,
      userId: undefined,
    };

    // Now generate content (still within the request — Vercel serverless handles this)
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

      // Generate images with Grok
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

          // Insert images into content at section breaks
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

      // Generate thumbnail if requested
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

      // Extract title and excerpt
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

      // Update the article from "generating" → "draft"
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

      // Increment the articlesGenerated counter on the associated site
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

      // Return the completed article
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

function calculateSeoScore(title: string, content: string, excerpt: string): number {
  let score = 0;
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
