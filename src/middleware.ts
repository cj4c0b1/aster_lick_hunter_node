import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(_req) {
    // This function is only called if the user is authenticated
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: async ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Allow public paths
        const PUBLIC_PATHS = ['/login', '/api/auth', '/api/health'];
        if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
          return true;
        }

        // For /api/config, allow public GET and POST requests (needed for onboarding)
        if (pathname.startsWith('/api/config')) {
          return true; // Allow all config operations without authentication
        }

        // For all other protected routes, require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};