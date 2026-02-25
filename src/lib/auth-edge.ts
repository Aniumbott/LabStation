/**
 * Edge-compatible auth utilities.
 * Uses `jose` (Web Crypto API) instead of `jsonwebtoken` (Node.js crypto).
 * This file MUST NOT import Prisma, bcrypt, or next/headers —
 * it runs in middleware which uses the Edge Runtime.
 */
import { jwtVerify, SignJWT } from 'jose';
import type { RoleName } from '@/types';

export const COOKIE_NAME = 'labstation_token';

const JWT_SECRET_RAW = process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production';

/** Encode the secret as a Uint8Array for jose (Web Crypto API). */
function getSecret(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET_RAW);
}

export interface JwtPayload {
  userId: string;
  role: RoleName;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify a JWT token using jose (Edge-compatible).
 * Returns the payload or null if invalid/expired.
 */
export async function getJwtPayloadFromToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Sign a JWT token using jose (Edge-compatible).
 * Used only from server-side code where jsonwebtoken is unavailable or for consistency.
 */
export async function signJwtEdge(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresIn = '24h'
): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}
