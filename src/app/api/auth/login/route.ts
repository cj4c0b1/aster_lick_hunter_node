import { NextRequest, NextResponse } from 'next/server';
import { configLoader } from '@/lib/config/configLoader';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    // Load config to check password
    const config = await configLoader.loadConfig();
    const dashboardPassword = config.global?.server?.dashboardPassword;

    // If no password is set, reject login attempts
    if (!dashboardPassword) {
      return NextResponse.json(
        { success: false, error: 'No password configured' },
        { status: 403 }
      );
    }

    // Verify password
    if (password !== dashboardPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Create auth token (simple implementation, use JWT in production)
    const token = Buffer.from(`authenticated:${dashboardPassword}`).toString('base64');

    // Create response with auth cookie
    const response = NextResponse.json({ success: true });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}