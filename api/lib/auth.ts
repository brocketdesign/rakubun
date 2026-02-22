import { verifyToken } from '@clerk/backend';
import type { VercelRequest } from '@vercel/node';

export async function authenticateRequest(req: VercelRequest): Promise<string> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AuthError(401, 'Missing or invalid Authorization header');
  }

  const token = header.slice(7);
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    if (!payload.sub) throw new Error('No subject in token');
    return payload.sub;
  } catch {
    throw new AuthError(401, 'Invalid or expired token');
  }
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
