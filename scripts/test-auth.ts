/**
 * Auth diagnostic test suite.
 * Run with: npx tsx scripts/test-auth.ts
 * Requires: dev server running on port 9002 (npm run dev)
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

// ─── Colours ──────────────────────────────────────────────────────────────────
const OK   = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

const PORT = 9002;
const BASE  = `http://localhost:${PORT}`;

// ─── 1. Database file exists ──────────────────────────────────────────────────
test('1. Database file is reachable from project root', () => {
  const dbUrl = process.env.DATABASE_URL ?? '';
  console.log(`  ${INFO} DATABASE_URL = ${dbUrl}`);

  // Strip the "file:" prefix and resolve from project root
  const relativePath = dbUrl.replace(/^file:/, '');
  const absoluteFromRoot = path.resolve(__dirname, '..', relativePath);

  // Also check from prisma/ directory (Prisma CLI convention)
  const absoluteFromPrisma = path.resolve(__dirname, '..', 'prisma', relativePath);

  const existsFromRoot   = fs.existsSync(absoluteFromRoot);
  const existsFromPrisma = fs.existsSync(absoluteFromPrisma);

  console.log(`  ${existsFromRoot   ? OK : FAIL} Resolved from project root : ${absoluteFromRoot} → ${existsFromRoot ? 'EXISTS' : 'MISSING'}`);
  console.log(`  ${existsFromPrisma ? OK : FAIL} Resolved from prisma/      : ${absoluteFromPrisma} → ${existsFromPrisma ? 'EXISTS' : 'MISSING'}`);

  if (!existsFromRoot && existsFromPrisma) {
    console.log(`\n  ⚠️  DATABASE_URL mismatch! Server uses "${absoluteFromRoot}" (doesn't exist).`);
    console.log(`     The DB was created at "${absoluteFromPrisma}" by the Prisma CLI.`);
    console.log(`     Fix: change DATABASE_URL to "file:./prisma/dev.db" → "file:../dev.db"`);
    console.log(`     or move the DB file to the project-root level.\n`);
  }

  assert.ok(existsFromRoot || existsFromPrisma, 'DB file not found at either expected path');
});

// ─── 2. Prisma can connect and users exist ────────────────────────────────────
test('2. Prisma connects and finds migrated users', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const count = await prisma.user.count();
    console.log(`  ${INFO} User count in DB: ${count}`);
    assert.ok(count > 0, `No users found – did the migration script run? (count = ${count})`);

    const users = await prisma.user.findMany({ select: { email: true, status: true, role: true, mustChangePassword: true } });
    users.forEach(u => {
      console.log(`  ${OK} User: ${u.email}  role=${u.role}  status=${u.status}  mustChangePwd=${u.mustChangePassword}`);
    });
  } finally {
    await prisma.$disconnect();
  }
});

// ─── 3. JWT sign / verify ─────────────────────────────────────────────────────
test('3. JWT sign and verify work correctly', async () => {
  const jwt = await import('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  const payload = { userId: 'test-id', role: 'Admin', email: 'test@test.com' };

  const token = jwt.default.sign(payload, secret, { expiresIn: '1h' });
  const decoded = jwt.default.verify(token, secret) as any;

  assert.equal(decoded.userId, payload.userId, 'userId mismatch');
  assert.equal(decoded.role,   payload.role,   'role mismatch');
  assert.equal(decoded.email,  payload.email,  'email mismatch');
  console.log(`  ${OK} JWT round-trip OK`);
  console.log(`  ${INFO} JWT_SECRET length: ${secret.length} chars`);
});

// ─── 4. bcrypt password check ─────────────────────────────────────────────────
test('4. bcrypt verify works (temp password = email)', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const bcrypt = await import('bcryptjs');
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst();
    if (!user) { console.log(`  ${INFO} No users – skipping`); return; }

    // Temporary password is the user's email (set during migration)
    const tempPassword = user.email;
    const valid = await bcrypt.default.compare(tempPassword, user.passwordHash);
    console.log(`  ${INFO} Testing password = email for: ${user.email}`);
    console.log(`  ${valid ? OK : FAIL} bcrypt.compare(email, hash) = ${valid}`);
    assert.ok(valid, `Password verification failed for ${user.email}. Hash may be for a different password.`);
  } finally {
    await prisma.$disconnect();
  }
});

// ─── 5. Dev server reachable ──────────────────────────────────────────────────
test('5. Dev server is reachable', async () => {
  try {
    const res = await fetch(`${BASE}/api/auth/me`);
    console.log(`  ${OK} Server is running on port ${PORT}  (status: ${res.status})`);
    assert.ok(res.status === 200 || res.status === 401, `Unexpected status ${res.status}`);
  } catch (e: any) {
    assert.fail(`Cannot reach ${BASE} – is "npm run dev" running? Error: ${e.message}`);
  }
});

// ─── 6. Login endpoint sets cookie ───────────────────────────────────────────
test('6. POST /api/auth/login returns JWT cookie on success', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  let email = '';
  try {
    const user = await prisma.user.findFirst({ where: { status: 'active' } });
    if (!user) { console.log(`  ${INFO} No active user – skipping`); return; }
    email = user.email;
  } finally {
    await prisma.$disconnect();
  }

  console.log(`  ${INFO} Attempting login as: ${email}  (password = email)`);

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: email }),
    redirect: 'manual',
  });

  console.log(`  ${INFO} Login response status: ${res.status}`);
  const body = await res.json().catch(() => null);
  console.log(`  ${INFO} Login response body:`, JSON.stringify(body));

  const setCookieHeader = res.headers.get('set-cookie');
  console.log(`  ${setCookieHeader ? OK : FAIL} Set-Cookie header: ${setCookieHeader ?? 'MISSING'}`);

  assert.equal(res.status, 200, `Expected 200, got ${res.status}. Body: ${JSON.stringify(body)}`);
  assert.ok(body?.success, `Login not successful: ${body?.message}`);
  assert.ok(setCookieHeader?.includes('labstation_token'), `labstation_token cookie not in Set-Cookie header`);
});

// ─── 7. Authenticated request reaches /dashboard ──────────────────────────────
test('7. Authenticated request is allowed through to /dashboard', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  let email = '';
  try {
    const user = await prisma.user.findFirst({ where: { status: 'active' } });
    if (!user) { console.log(`  ${INFO} No active user – skipping`); return; }
    email = user.email;
  } finally {
    await prisma.$disconnect();
  }

  // Step 1: login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: email }),
    redirect: 'manual',
  });

  const cookie = loginRes.headers.get('set-cookie');
  assert.ok(cookie, 'No cookie from login – cannot test dashboard access');

  // Extract just the token value to pass as Cookie header
  const tokenMatch = cookie.match(/labstation_token=([^;]+)/);
  assert.ok(tokenMatch, 'Could not parse labstation_token from Set-Cookie');
  const cookieHeader = `labstation_token=${tokenMatch![1]}`;

  // Step 2: request /dashboard with cookie
  const dashRes = await fetch(`${BASE}/dashboard`, {
    headers: { Cookie: cookieHeader },
    redirect: 'manual', // don't follow redirects so we can see the status
  });

  console.log(`  ${INFO} GET /dashboard with cookie → status: ${dashRes.status}  location: ${dashRes.headers.get('location') ?? 'none'}`);

  // 200 = page loaded; 307/308 = redirect (to login = bad, to dashboard itself = fine)
  const location = dashRes.headers.get('location') ?? '';
  const redirectedToLogin = location.includes('/login');
  assert.ok(!redirectedToLogin, `Middleware redirected to /login even with a valid cookie. Cookie sent: ${cookieHeader}`);
  assert.ok([200, 307, 308].includes(dashRes.status), `Unexpected status ${dashRes.status}`);
  console.log(`  ${OK} /dashboard accessible with valid token`);
});
