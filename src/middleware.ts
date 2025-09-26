import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/health'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for authentication cookie
  const authCookie = request.cookies.get('auth-token');

  // Check if this looks like a valid auth token (basic validation)
  // Real validation happens in the API routes
  if (authCookie && authCookie.value && authCookie.value.startsWith('YXV0aGVudGljYXRlZDo')) {
    return NextResponse.next();
  }

  // Check if we're in development mode (no auth required)
  if (process.env.NODE_ENV === 'development' && !authCookie) {
    // In development, only redirect if there's evidence a password was set
    // This is determined by the presence of a redirect parameter from a previous attempt
    const hasRedirect = request.nextUrl.searchParams.get('redirect');
    if (!hasRedirect) {
      return NextResponse.next();
    }
  }

  // Redirect to login page
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
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