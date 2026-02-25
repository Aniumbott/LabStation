import { NextRequest, NextResponse } from 'next/server';
import { getJwtPayloadFromToken, COOKIE_NAME } from '@/lib/auth-edge';

const PUBLIC_ROUTES = ['/login', '/signup'];
// Auth API routes that never require a token
const PUBLIC_API_ROUTES = ['/api/auth/login', '/api/auth/signup', '/api/auth/me', '/api/auth/logout'];
const ADMIN_ONLY_ROUTES = ['/admin/users', '/admin/booking-requests', '/admin/lab-operations', '/admin/audit-log'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Always allow public auth API routes
  if (PUBLIC_API_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  // Public pages: allow through, but redirect authenticated users to dashboard
  if (PUBLIC_ROUTES.includes(pathname)) {
    if (token) {
      const payload = await getJwtPayloadFromToken(token);
      if (payload) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    return NextResponse.next();
  }

  // All other routes require authentication
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await getJwtPayloadFromToken(token);

  if (!payload) {
    // Invalid or expired token — clear cookie
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
      return response;
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return response;
  }

  // Admin-only route protection
  const isAdminRoute = ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route));
  if (isAdminRoute && payload.role !== 'Admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
