import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/health', '/api/config'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for authentication cookie
  const authCookie = request.cookies.get('auth-token');
  const passwordSetCookie = request.cookies.get('password-required');

  // If we have a valid auth token, allow access
  if (authCookie && authCookie.value && authCookie.value.startsWith('YXV0aGVudGljYXRlZDo')) {
    return NextResponse.next();
  }

  // Check if password is required (based on cookie set by config check)
  if (passwordSetCookie && passwordSetCookie.value === 'true') {
    // Password is required but no valid auth token, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // No password required or not yet determined, allow access
  // The client will check and set the password-required cookie if needed
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/config (needed for checking password status)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/config).*)',
  ],
};