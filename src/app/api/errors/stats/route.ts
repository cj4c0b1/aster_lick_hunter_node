import { NextRequest, NextResponse } from 'next/server';
import { errorLogsDb } from '@/lib/db/errorLogsDb';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    const stats = await errorLogsDb.getErrorStats(hours);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Failed to get error stats:', error);
    return NextResponse.json(
      { error: 'Failed to get error stats' },
      { status: 500 }
    );
  }
}