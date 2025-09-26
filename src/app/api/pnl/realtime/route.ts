import { NextResponse } from 'next/server';
import pnlService from '@/lib/services/pnlService';

export async function GET() {
  try {
    const sessionPnL = pnlService.getSessionPnL();
    const metrics = pnlService.getSessionMetrics();
    const latestSnapshot = pnlService.getLatestSnapshot();

    // Get snapshots for the last 24 hours
    const snapshots = pnlService.getSnapshots(24 * 60);

    return NextResponse.json({
      session: sessionPnL,
      metrics,
      latestSnapshot,
      snapshots,
    });
  } catch (error) {
    console.error('Error fetching realtime PnL:', error);
    return NextResponse.json(
      { error: 'Failed to fetch realtime PnL data' },
      { status: 500 }
    );
  }
}