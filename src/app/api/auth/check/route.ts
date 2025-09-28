import { NextResponse } from 'next/server';
import { configLoader } from '@/lib/config/configLoader';

export async function GET() {
  try {
    // Load config to check if password is set
    const config = await configLoader.loadConfig();
    const dashboardPassword = config.global?.server?.dashboardPassword;

    return NextResponse.json({
      passwordRequired: !!dashboardPassword && dashboardPassword.length > 0,
    });
  } catch (error) {
    console.error('Failed to check auth status:', error);
    return NextResponse.json({ passwordRequired: false });
  }
}