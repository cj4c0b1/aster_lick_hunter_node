import axios from 'axios';
import { buildSignedQuery } from './auth';
import { ApiCredentials } from '../types';

const BASE_URL = 'https://fapi.asterdex.com';

// Simple cache to prevent duplicate API calls
const incomeCache = new Map<string, { data: IncomeRecord[]; timestamp: number }>();

// Different cache TTL based on range - shorter ranges need fresher data
const getCacheTTL = (range: string): number => {
  switch (range) {
    case '24h':
      return 1 * 60 * 1000; // 1 minute for 24h
    case '7d':
      return 2 * 60 * 1000; // 2 minutes for 7d
    case '30d':
      return 5 * 60 * 1000; // 5 minutes for 30d
    default:
      return 10 * 60 * 1000; // 10 minutes for longer ranges
  }
};

// Function to invalidate cache when new trading activity occurs
export function invalidateIncomeCache(): void {
  console.log('[Income Cache] Invalidating all cache due to new trading activity');
  incomeCache.clear();
}

// Temporary function to clear cache for debugging
export function clearIncomeCache(): void {
  console.log('[Income Cache] Clearing all cache for debugging');
  incomeCache.clear();
}

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
  const todayString = new Date().toISOString().split('T')[0];

  records.forEach((record, index) => {
    const date = new Date(record.time).toISOString().split('T')[0];
    const amount = parseFloat(record.income);

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

    // Log records for today for debugging
    if (date === todayString) {
      console.log(`[aggregateDailyPnL] Today's record ${index}: ${record.incomeType} = ${amount} (${new Date(record.time).toISOString()})`);
    }

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
  dailyMap.forEach((daily, date) => {
    daily.netPnl = daily.realizedPnl + daily.commission + daily.fundingFee;

    // Log today's aggregated data
    if (date === todayString) {
      console.log(`[aggregateDailyPnL] Today's aggregated data:`, {
        date,
        realizedPnl: daily.realizedPnl,
        commission: daily.commission,
        fundingFee: daily.fundingFee,
        netPnl: daily.netPnl,
        tradeCount: daily.tradeCount
      });
    }
  });

  const result = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  console.log(`[aggregateDailyPnL] Generated ${result.length} daily entries`);
  if (result.length > 0) {
    const lastEntry = result[result.length - 1];
    console.log(`[aggregateDailyPnL] Last entry:`, lastEntry);
  }

  return result;
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

// Helper function to get income for a specific time range with proper API limits and caching
export async function getTimeRangeIncome(
  credentials: ApiCredentials,
  range: '24h' | '7d' | '30d' | '90d' | '1y' | 'all'
): Promise<IncomeRecord[]> {
  // Check cache first with range-specific TTL
  const cacheKey = `${range}_${credentials.apiKey.slice(-8)}`;
  const cached = incomeCache.get(cacheKey);
  const cacheTTL = getCacheTTL(range);
  const cacheAge = cached ? Date.now() - cached.timestamp : 0;

  if (cached && cacheAge < cacheTTL) {
    console.log(`[getTimeRangeIncome] Using cached data for ${range} (${cached.data.length} records, age: ${Math.floor(cacheAge / 1000)}s)`);
    return cached.data;
  } else if (cached) {
    console.log(`[getTimeRangeIncome] Cache expired for ${range} (age: ${Math.floor(cacheAge / 1000)}s > ${Math.floor(cacheTTL / 1000)}s)`);
  }

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
      // For 'all', limit to last 2 years to prevent excessive data
      startTime = now - 2 * 365 * 24 * 60 * 60 * 1000;
      break;
  }

  console.log(`[getTimeRangeIncome] Range: ${range}`);
  console.log(`[getTimeRangeIncome] Start time: ${startTime ? new Date(startTime).toISOString() : 'none'}`);
  console.log(`[getTimeRangeIncome] End time: ${new Date(now).toISOString()}`);

  // Use the API's startTime parameter for efficiency
  // The issue: 7d range has too much data and 1000 limit cuts off recent data
  // Solution: For 7d, fetch in reverse chronological order or use pagination
  const params: IncomeHistoryParams = {
    startTime: startTime,
    endTime: now,
    limit: 1000,
  };

  try {
    console.log(`[getTimeRangeIncome] Making API call for ${range} with limit ${params.limit}`);
    let records = await getIncomeHistory(credentials, params);
    console.log(`[getTimeRangeIncome] Retrieved ${records.length} records for ${range}`);

    // CRITICAL FIX: If we hit the limit and might be missing recent data, fetch more recent data
    if (records.length >= 1000 && ['7d', '30d', '90d', '1y', 'all'].includes(range)) {
      console.log(`[getTimeRangeIncome] Hit API limit for ${range}, checking if we have today's data`);

      const today = new Date().toISOString().split('T')[0];
      const hasToday = records.some(r => new Date(r.time).toISOString().split('T')[0] === today);

      if (!hasToday) {
        console.log(`[getTimeRangeIncome] Missing today's data for ${range}, fetching recent data`);

        // Fetch most recent 500 records to ensure we get today
        const recentParams: IncomeHistoryParams = {
          endTime: now,
          limit: 500,
        };

        const recentRecords = await getIncomeHistory(credentials, recentParams);
        console.log(`[getTimeRangeIncome] Retrieved ${recentRecords.length} recent records`);

        // Check if recent records have today's data
        const recentHasToday = recentRecords.some(r => new Date(r.time).toISOString().split('T')[0] === today);

        if (recentHasToday) {
          // Merge recent records with historical, removing duplicates based on time
          const timeSet = new Set(records.map(r => r.time));
          const newRecords = recentRecords.filter(r => !timeSet.has(r.time));
          records = [...records, ...newRecords];
          console.log(`[getTimeRangeIncome] Merged ${newRecords.length} new records, total: ${records.length}`);
        }
      }
    }

    // Detailed logging for debugging
    if (records.length > 0) {
      const dates = records.map(r => new Date(r.time).toISOString().split('T')[0]);
      const uniqueDates = [...new Set(dates)];
      console.log(`[getTimeRangeIncome] Date range: ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]} (${uniqueDates.length} days)`);

      // Log recent records for debugging
      const recent = records.slice(-5);
      console.log(`[getTimeRangeIncome] Last 5 records for ${range}:`, recent.map(r => ({
        date: new Date(r.time).toISOString(),
        type: r.incomeType,
        amount: parseFloat(r.income),
        symbol: r.symbol
      })));

      // Debug today's records specifically
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = records.filter(r => new Date(r.time).toISOString().split('T')[0] === today);
      console.log(`[getTimeRangeIncome] Today (${today}) records in ${range}: ${todayRecords.length}`);
      if (todayRecords.length > 0) {
        console.log(`[getTimeRangeIncome] Today's ${range} records:`, todayRecords.map(r => ({
          date: new Date(r.time).toISOString(),
          type: r.incomeType,
          amount: parseFloat(r.income),
          symbol: r.symbol
        })));
      }

      // Log totals by type
      const totals = records.reduce((acc, r) => {
        acc[r.incomeType] = (acc[r.incomeType] || 0) + parseFloat(r.income);
        return acc;
      }, {} as Record<string, number>);
      console.log(`[getTimeRangeIncome] Totals by type for ${range}:`, totals);
    }

    // Cache the result
    incomeCache.set(cacheKey, { data: records, timestamp: now });

    // Clean up old cache entries
    for (const [key, value] of incomeCache.entries()) {
      const keyRange = key.split('_')[0];
      const keyTTL = getCacheTTL(keyRange);
      if (now - value.timestamp > keyTTL) {
        incomeCache.delete(key);
      }
    }

    return records;
  } catch (error) {
    console.error(`[getTimeRangeIncome] API call failed for ${range}:`, error);
    return [];
  }
}