import { NextRequest, NextResponse } from 'next/server';
import { errorLogsDb } from '@/lib/db/errorLogsDb';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const type = searchParams.get('type') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const component = searchParams.get('component') || undefined;
    const symbol = searchParams.get('symbol') || undefined;
    const sessionId = searchParams.get('sessionId') || undefined;
    const startTime = searchParams.get('startTime') || undefined;
    const endTime = searchParams.get('endTime') || undefined;
    const resolved = searchParams.get('resolved') === 'true' ? true :
                     searchParams.get('resolved') === 'false' ? false : undefined;

    const errors = await errorLogsDb.getErrors(limit, offset, {
      type,
      severity,
      component,
      symbol,
      sessionId,
      startTime,
      endTime,
      resolved
    });

    return NextResponse.json({ errors });
  } catch (error) {
    console.error('Failed to get errors:', error);
    return NextResponse.json(
      { error: 'Failed to get errors' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysToKeep = parseInt(searchParams.get('daysToKeep') || '30', 10);
    const clearAll = searchParams.get('clearAll') === 'true';

    let deletedCount = 0;

    if (clearAll && daysToKeep === 0) {
      // Clear ALL errors regardless of resolved status
      deletedCount = await errorLogsDb.clearAllErrors();

      return NextResponse.json({
        message: `Deleted all ${deletedCount} error logs`,
        deletedCount
      });
    } else {
      // Normal clear old errors
      deletedCount = await errorLogsDb.clearOldErrors(daysToKeep);

      return NextResponse.json({
        message: `Deleted ${deletedCount} resolved errors older than ${daysToKeep} days`,
        deletedCount
      });
    }
  } catch (error) {
    console.error('Failed to clear errors:', error);
    return NextResponse.json(
      { error: 'Failed to clear errors' },
      { status: 500 }
    );
  }
}