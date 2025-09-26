import axios from 'axios';
import { buildSignedQuery } from './auth';
import { ApiCredentials } from '../types';

const BASE_URL = 'https://fapi.asterdex.com';

export type IncomeType =
  | 'TRANSFER'
  | 'WELCOME_BONUS'
  | 'REALIZED_PNL'
  | 'FUNDING_FEE'
  | 'COMMISSION'
  | 'INSURANCE_CLEAR'
  | 'MARKET_MERCHANT_RETURN_REWARD';

export interface IncomeRecord {
  symbol: string;
  incomeType: IncomeType;
  income: string;
  asset: string;
  info: string;
  time: number;
  tranId: string;
  tradeId: string;
}

export interface IncomeHistoryParams {
  symbol?: string;
  incomeType?: IncomeType;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export async function getIncomeHistory(
  credentials: ApiCredentials,
  params: IncomeHistoryParams = {}
): Promise<IncomeRecord[]> {
  const query = buildSignedQuery(params, credentials);

  const response = await axios.get<IncomeRecord[]>(
    `${BASE_URL}/fapi/v1/income?${query}`,
    {
      headers: {
        'X-MBX-APIKEY': credentials.apiKey,
      },
    }
  );

  return response.data;
}

export interface DailyPnL {
  date: string;
  realizedPnl: number;
  commission: number;
  fundingFee: number;
  netPnl: number;
  tradeCount: number;
}

export function aggregateDailyPnL(records: IncomeRecord[]): DailyPnL[] {
  const dailyMap = new Map<string, DailyPnL>();

  records.forEach(record => {
    const date = new Date(record.time).toISOString().split('T')[0];

    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        realizedPnl: 0,
        commission: 0,
        fundingFee: 0,
        netPnl: 0,
        tradeCount: 0,
      });
    }

    const daily = dailyMap.get(date)!;
    const amount = parseFloat(record.income);

    switch (record.incomeType) {
      case 'REALIZED_PNL':
        daily.realizedPnl += amount;
        daily.tradeCount++;
        break;
      case 'COMMISSION':
        daily.commission += amount;
        break;
      case 'FUNDING_FEE':
        daily.fundingFee += amount;
        break;
    }
  });

  // Calculate net PnL for each day
  dailyMap.forEach(daily => {
    daily.netPnl = daily.realizedPnl + daily.commission + daily.fundingFee;
  });

  // Sort by date ascending
  return Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export interface PerformanceMetrics {
  totalPnl: number;
  totalRealizedPnl: number;
  totalCommission: number;
  totalFundingFee: number;
  winRate: number;
  profitableDays: number;
  lossDays: number;
  bestDay: DailyPnL | null;
  worstDay: DailyPnL | null;
  avgDailyPnl: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
}

export function calculatePerformanceMetrics(dailyPnL: DailyPnL[]): PerformanceMetrics {
  if (dailyPnL.length === 0) {
    return {
      totalPnl: 0,
      totalRealizedPnl: 0,
      totalCommission: 0,
      totalFundingFee: 0,
      winRate: 0,
      profitableDays: 0,
      lossDays: 0,
      bestDay: null,
      worstDay: null,
      avgDailyPnl: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      sharpeRatio: 0,
    };
  }

  let totalPnl = 0;
  let totalRealizedPnl = 0;
  let totalCommission = 0;
  let totalFundingFee = 0;
  let profitableDays = 0;
  let lossDays = 0;
  let bestDay = dailyPnL[0];
  let worstDay = dailyPnL[0];
  let totalProfit = 0;
  let totalLoss = 0;

  // Calculate cumulative metrics
  let cumulativePnl = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const dailyReturns: number[] = [];

  dailyPnL.forEach(day => {
    totalPnl += day.netPnl;
    totalRealizedPnl += day.realizedPnl;
    totalCommission += day.commission;
    totalFundingFee += day.fundingFee;

    if (day.netPnl > 0) {
      profitableDays++;
      totalProfit += day.netPnl;
    } else if (day.netPnl < 0) {
      lossDays++;
      totalLoss += Math.abs(day.netPnl);
    }

    if (day.netPnl > bestDay.netPnl) {
      bestDay = day;
    }
    if (day.netPnl < worstDay.netPnl) {
      worstDay = day;
    }

    // Track drawdown
    cumulativePnl += day.netPnl;
    if (cumulativePnl > peak) {
      peak = cumulativePnl;
    }
    const drawdown = peak - cumulativePnl;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    dailyReturns.push(day.netPnl);
  });

  const totalDays = dailyPnL.length;
  const winRate = totalDays > 0 ? (profitableDays / totalDays) * 100 : 0;
  const avgDailyPnl = totalDays > 0 ? totalPnl / totalDays : 0;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  // Calculate Sharpe Ratio (simplified - assuming risk-free rate of 0)
  let sharpeRatio = 0;
  if (dailyReturns.length > 1) {
    const mean = avgDailyPnl;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      // Annualized Sharpe ratio (assuming 365 trading days)
      sharpeRatio = (mean / stdDev) * Math.sqrt(365);
    }
  }

  return {
    totalPnl,
    totalRealizedPnl,
    totalCommission,
    totalFundingFee,
    winRate,
    profitableDays,
    lossDays,
    bestDay,
    worstDay,
    avgDailyPnl,
    maxDrawdown,
    profitFactor,
    sharpeRatio,
  };
}

// Helper function to get income for a specific time range
export async function getTimeRangeIncome(
  credentials: ApiCredentials,
  range: '24h' | '7d' | '30d' | '90d' | '1y' | 'all'
): Promise<IncomeRecord[]> {
  const now = Date.now();
  let startTime: number | undefined;

  switch (range) {
    case '24h':
      startTime = now - 24 * 60 * 60 * 1000;
      break;
    case '7d':
      startTime = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
      startTime = now - 30 * 24 * 60 * 60 * 1000;
      break;
    case '90d':
      startTime = now - 90 * 24 * 60 * 60 * 1000;
      break;
    case '1y':
      startTime = now - 365 * 24 * 60 * 60 * 1000;
      break;
    case 'all':
      // No start time - get all available data
      break;
  }

  console.log(`[getTimeRangeIncome] Range: ${range}`);
  console.log(`[getTimeRangeIncome] Start time: ${startTime ? new Date(startTime).toISOString() : 'none'}`);
  console.log(`[getTimeRangeIncome] End time: ${new Date(now).toISOString()}`)

  const allRecords: IncomeRecord[] = [];
  let currentEndTime = now;
  let batchNumber = 0;

  // Fetch in reverse chronological order (newest to oldest)
  // Don't set startTime in params - we'll filter locally instead
  while (true) {
    batchNumber++;
    const params: IncomeHistoryParams = {
      endTime: currentEndTime,
      limit: 1000,
    };

    console.log(`[getTimeRangeIncome] Batch ${batchNumber}: fetching up to ${new Date(currentEndTime).toISOString()}`);

    const records = await getIncomeHistory(credentials, params);
    console.log(`[getTimeRangeIncome] Batch ${batchNumber}: returned ${records.length} records`);

    if (records.length === 0) {
      break;
    }

    // If we have a start time, filter out records that are too old
    if (startTime) {
      const filteredRecords = records.filter(r => r.time >= startTime);
      allRecords.push(...filteredRecords);

      // If we got some records that are older than startTime, we're done
      if (filteredRecords.length < records.length) {
        console.log(`[getTimeRangeIncome] Batch ${batchNumber}: reached start time boundary, keeping ${filteredRecords.length}/${records.length} records`);
        break;
      }
    } else {
      allRecords.push(...records);
    }

    // If we got less than limit, we've reached the end
    if (records.length < 1000) {
      console.log(`[getTimeRangeIncome] Batch ${batchNumber}: reached end of available data`);
      break;
    }

    // Get the oldest record from this batch
    const oldestTime = records[records.length - 1].time;

    // Check if we've gone past our start time
    if (startTime && oldestTime <= startTime) {
      console.log(`[getTimeRangeIncome] Batch ${batchNumber}: oldest record is at or before start time`);
      break;
    }

    // Continue fetching older records
    currentEndTime = oldestTime - 1;

    // Safety limit for 'all' range
    if (range === 'all' && allRecords.length >= 10000) {
      console.log('[getTimeRangeIncome] Reached maximum record limit for "all" range');
      break;
    }
  }

  console.log(`[getTimeRangeIncome] Total records fetched: ${allRecords.length}`);

  // Log date summary
  if (allRecords.length > 0) {
    const dates = allRecords.map(r => new Date(r.time).toISOString().split('T')[0]);
    const uniqueDates = [...new Set(dates)];
    console.log(`[getTimeRangeIncome] Dates included: ${uniqueDates.sort().join(', ')}`);
  }

  return allRecords;
}