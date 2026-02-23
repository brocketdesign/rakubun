import type { VercelRequest } from '@vercel/node';
import { getDb } from './mongodb.js';
import crypto from 'crypto';

/**
 * Authenticate an agent request via API key.
 * Checks the `X-API-Key` header against the `api_keys` collection in MongoDB.
 * Returns the userId associated with the API key.
 */
export async function authenticateAgentRequest(req: VercelRequest): Promise<string> {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    throw new AgentAuthError(401, 'Missing X-API-Key header');
  }

  const db = await getDb();
  const keyDoc = await db.collection('api_keys').findOne({ key: apiKey, revoked: { $ne: true } });

  if (!keyDoc) {
    throw new AgentAuthError(401, 'Invalid or revoked API key');
  }

  // Update last used timestamp
  await db.collection('api_keys').updateOne(
    { _id: keyDoc._id },
    { $set: { lastUsedAt: new Date().toISOString() } },
  );

  return keyDoc.userId;
}

/**
 * Generate a secure random API key with a recognizable prefix.
 */
export function generateApiKey(): string {
  return `rkb_${crypto.randomBytes(32).toString('hex')}`;
}

export class AgentAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
