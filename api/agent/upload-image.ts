import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateAgentRequest, AgentAuthError } from '../lib/agent-auth.js';
import {
  uploadImageToWordPress,
  uploadBase64ImageToWordPress,
} from '../lib/wordpress.js';

/**
 * POST /api/agent/upload-image
 *
 * Upload an image to a WordPress site's media library.
 * Supports both URL-based and base64-encoded images.
 *
 * Headers:
 *   X-API-Key: <your-api-key>
 *
 * Body (JSON):
 *   siteId    (required) - MongoDB ID of the WordPress site
 *   imageUrl  (optional) - URL of the image to download and upload
 *   base64    (optional) - Base64 encoded image data (with or without data URI prefix)
 *   filename  (optional) - Desired filename for the uploaded image
 *   altText   (optional) - Alt text for the image
 *
 * At least one of imageUrl or base64 must be provided.
 *
 * Returns:
 *   { success: true, media: { wpMediaId, url, filename } }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
