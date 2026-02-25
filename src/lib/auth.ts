import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import type { RoleName } from '@/types';
import { COOKIE_NAME, getJwtPayloadFromToken, signJwtEdge } from '@/lib/auth-edge';
export type { JwtPayload } from '@/lib/auth-edge';

// --- Password Utilities ---

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// --- JWT Utilities (delegated to jose via auth-edge) ---

export async function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  return signJwtEdge(payload);
}

// --- Cookie Utilities ---

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

// --- Auth User Extraction ---

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  status: string;
  avatarUrl: string | null;
  mustChangePassword: boolean;
}

/**
 * Get the authenticated user from the JWT cookie.
 * Returns null if not authenticated or token is invalid.
 * Reads the full user from the database to ensure fresh data.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const token = await getAuthCookie();
  if (!token) return null;

  const payload = await getJwtPayloadFromToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      mustChangePassword: true,
    },
  });

  if (!user || user.status !== 'active') return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as RoleName,
    status: user.status,
    avatarUrl: user.avatarUrl,
    mustChangePassword: user.mustChangePassword,
  };
}

export { COOKIE_NAME };
