import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb.js';
import { authenticateRequest, AuthError } from '../lib/auth.js';
import { generateApiKey } from '../lib/agent-auth.js';

/**
 * API Key Management — authenticated via Clerk (dashboard user)
 *
 * GET  /api/agent/api-keys  — List all API keys for the current user
 * POST /api/agent/api-keys  — Create a new API key
 *   Body: { name: string }  — A label for this key (e.g. "My GPT Agent")
 *
 * Returns the key ONLY on creation. It cannot be retrieved again.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
        key, // Full key shown only at creation time
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
