import { NextResponse } from 'next/server';
import { getTimeRangeIncome, aggregateDailyPnL, calculatePerformanceMetrics } from '@/lib/api/income';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') as '24h' | '7d' | '30d' | '90d' | '1y' | 'all' || '7d';

    // Load config to get API credentials
    const configPath = path.join(process.cwd(), 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    if (!config.api || !config.api.apiKey || !config.api.secretKey) {
      return NextResponse.json(
        { error: 'API credentials not configured' },
        { status: 500 }
      );
    }

    // Fetch income history (API will include today's trades if any)
    const records = await getTimeRangeIncome(
      {
        apiKey: config.api.apiKey,
        secretKey: config.api.secretKey,
      },
      range
    );

    console.log(`[Income API] Range: ${range}, Records fetched: ${records.length}`);

    // Log the date range of records
    if (records.length > 0) {
      const dates = records.map(r => new Date(r.time).toISOString().split('T')[0]);
      const uniqueDates = [...new Set(dates)];
      console.log(`[Income API] Unique dates: ${uniqueDates.length}`);
      console.log(`[Income API] Date range: ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`);

      // Count records by type
      const byType = records.reduce((acc, r) => {
        acc[r.incomeType] = (acc[r.incomeType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[Income API] Records by type:`, byType);
    }

    // Aggregate by day
    const dailyPnL = aggregateDailyPnL(records);
    console.log(`[Income API] Daily PnL entries: ${dailyPnL.length}`);

    // Debug today's data availability
    const today = new Date().toISOString().split('T')[0];
    const hasToday = dailyPnL.some(d => d.date === today);
    console.log(`[Income API] Today (${today}) in data: ${hasToday}`);

    if (hasToday) {
      const todayData = dailyPnL.find(d => d.date === today);
      console.log(`[Income API] Today's data from ${range}:`, todayData);
    } else {
      console.log(`[Income API] No today data found in ${range} - API returned ${records.length} records`);

      // Check if any records are from today
      const todayRecords = records.filter(r => new Date(r.time).toISOString().split('T')[0] === today);
      console.log(`[Income API] Today's raw records in ${range}: ${todayRecords.length}`);
      if (todayRecords.length > 0) {
        console.log(`[Income API] Today's raw record sample:`, todayRecords.slice(0, 3));
      }
    }

    // CRITICAL FIX: Don't artificially add today's zeros - this causes inconsistency
    // Let the data be what the exchange API actually returns
    // If today has no trades, then today shouldn't appear in historical data

    // Calculate performance metrics
    const metrics = calculatePerformanceMetrics(dailyPnL);

    return NextResponse.json({
      dailyPnL,
      metrics,
      range,
      recordCount: records.length,
    });
  } catch (error) {
    console.error('Error fetching income history:', error);

    // Return empty data with proper structure on error
    const { searchParams } = new URL(request.url);
    return NextResponse.json({
      dailyPnL: [],
      metrics: calculatePerformanceMetrics([]),
      range: searchParams.get('range') || '7d',
      recordCount: 0,
      error: 'Failed to fetch income history'
    });
  }
}