import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    const { siteId, articlesPerWeek: rawCount } = req.body || {};
    const articlesPerWeek = Math.min(Math.max(Number(rawCount) || 7, 1), 7);

    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required' });
    }

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

    // Fetch categories from WordPress if possible
    let categoriesInfo = '';
    if (siteDoc.username && siteDoc.applicationPassword) {
      try {
        const baseUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
        const authHeader =
          'Basic ' +
          Buffer.from(`${siteDoc.username}:${siteDoc.applicationPassword}`).toString('base64');
        const catResponse = await fetch(
          `${baseUrl}/wp-json/wp/v2/categories?per_page=100`,
          { headers: { Authorization: authHeader } },
        );
        if (catResponse.ok) {
          const cats = (await catResponse.json()) as { name: string; count: number; slug: string }[];
          const filtered = cats
            .filter((c) => c.count > 0 && c.slug !== 'uncategorized')
            .sort((a, b) => b.count - a.count);
          if (filtered.length > 0) {
            categoriesInfo = `\n\nThe site has these WordPress categories (sorted by article count):\n${filtered.map((c) => `- ${c.name} (${c.count} articles)`).join('\n')}`;
          }
        }
      } catch {
        // Ignore category fetch errors
      }
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // @ts-ignore - responses API
    const response = await client.responses.create({
      model: 'gpt-5.2',
      tools: [{ type: 'web_search' }],
      input: `Analyze the website "${siteUrl}" (${siteName}).${categoriesInfo}

Use web search to visit and understand this website's niche, topics, audience, content style, and language.

Based on your analysis, create a weekly publishing schedule with exactly ${articlesPerWeek} article TYPES spread across the week (pick the best ${articlesPerWeek} days out of Monday-Sunday).

IMPORTANT: Return article TYPES/CATEGORIES, NOT specific article titles. Each type should represent a category or genre of content that fits this site.

For each day, provide the article type in BOTH English and the site's primary language, separated by " / ".
For example: "Drama/Movie News / ドラマ・映画" or "Celebrity Profiles / 芸能人"

Also determine:
- The site's primary language (e.g., "Japanese", "English")
- A short style description that captures the site's tone/voice
- A suggested default publishing time in 24h format

Return ONLY a valid JSON object with no markdown formatting, no code fences, no explanation.
The "schedule" array must contain exactly ${articlesPerWeek} items:
{
  "language": "Japanese",
  "style": "Short description of the site style/tone",
  "defaultTime": "11:00",
  "schedule": [
    {"day": "Monday", "articleType": "Type in English / ローカル言語"}
  ]
}`,
    });

    // @ts-ignore
    const rawText: string = response.output_text || '';

    try {
      const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const schedule = (parsed.schedule || []).map((item: any) => ({
        day: item.day || 'Monday',
        time: parsed.defaultTime || '11:00',
        articleType: item.articleType || 'General',
        enabled: true,
      }));

      return res.status(200).json({
        schedule,
        style: parsed.style || '',
        language: parsed.language || 'Japanese',
      });
    } catch (parseErr) {
      console.error('Failed to parse AI response:', parseErr, 'Raw:', rawText);
      return res.status(500).json({ error: 'Failed to parse AI analysis results' });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
