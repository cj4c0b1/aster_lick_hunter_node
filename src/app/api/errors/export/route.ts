import { NextRequest, NextResponse } from 'next/server';
import { errorLogsDb } from '@/lib/db/errorLogsDb';
import { errorLogger } from '@/lib/services/errorLogger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const format = searchParams.get('format') || 'json';
    const sessionId = searchParams.get('sessionId') || undefined;

    if (format === 'markdown') {
      const report = await errorLogger.generateBugReport(hours);

      return new NextResponse(report, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="bug-report-${new Date().toISOString().split('T')[0]}.md"`
        }
      });
    }

    const { errors, stats } = await errorLogsDb.exportErrors(sessionId, hours);

    // Redact sensitive information
    const sanitizedErrors = errors.map(error => ({
      ...error,
      details: error.details ? JSON.parse(error.details) : undefined,
    }));

    const exportData = {
      generated: new Date().toISOString(),
      sessionId: sessionId || errorLogger.getSessionId(),
      systemInfo: errorLogger.getSystemInfo(),
      stats,
      errors: sanitizedErrors
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error('Failed to export errors:', error);
    return NextResponse.json(
      { error: 'Failed to export errors' },
      { status: 500 }
    );
  }
}