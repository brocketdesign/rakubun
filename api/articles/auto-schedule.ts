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

    // Parse the JSON from the response
    let topics: Array<{ title: string; description: string; day: string; time: string; suggestedDate: string }>;
    try {
      // Strip markdown code fences if present
      const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      // Compute suggestedDate for each topic (next occurrence of the given weekday)
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
