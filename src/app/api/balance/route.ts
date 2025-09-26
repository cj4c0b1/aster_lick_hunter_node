import { NextRequest, NextResponse } from 'next/server';
import { getBalance, getAccountInfo } from '@/lib/api/market';
import { loadConfig } from '@/lib/bot/config';
import { getBalanceService } from '@/lib/services/balanceService';

// Simple in-memory cache
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 5000; // 5 seconds

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const cacheKey = 'balance';

  // Check if force refresh is requested
  const searchParams = request.nextUrl.searchParams;
  const forceRefresh = searchParams.get('force') === 'true';

  // Check cache first (skip if force refresh)
  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[Balance API] Returning cached data');
      return NextResponse.json({
        ...cached.data,
        cached: true,
        responseTime: Date.now() - startTime,
      });
    }
  }

  try {
    const config = await loadConfig();
    console.log('[Balance API] Loading config completed');

    // If no API key is configured, return mock data
    if (!config.api.apiKey || !config.api.secretKey) {
      console.log('[Balance API] No API credentials, returning mock data');
      return NextResponse.json({
        totalBalance: 10000,
        availableBalance: 8500,
        totalPositionValue: 1500,
        totalPnL: 60,
        source: 'mock',
        timestamp: Date.now(),
      });
    }

    // Try to use WebSocket balance service first (real-time data)
    const balanceService = getBalanceService();

    if (balanceService) {
      const status = balanceService.getConnectionStatus();
      console.log('[Balance API] Balance service status:', {
        initialized: balanceService.isInitialized(),
        connected: status.connected,
        error: status.error,
        lastUpdate: status.lastUpdate ? new Date(status.lastUpdate).toISOString() : 'never'
      });

      if (balanceService.isInitialized()) {
        const balanceData = balanceService.getCurrentBalance();

        // Check if data is stale (more than 5 minutes old)
        const isStale = balanceData.lastUpdate && (Date.now() - balanceData.lastUpdate) > 5 * 60 * 1000;

        if (!isStale && (balanceData.totalBalance > 0 || balanceData.availableBalance > 0)) {
          console.log('[Balance API] Returning WebSocket balance data:', balanceData);
          const response = {
            totalBalance: balanceData.totalBalance,
            availableBalance: balanceData.availableBalance,
            totalPositionValue: balanceData.totalPositionValue,
            totalPnL: balanceData.totalPnL,
            source: 'websocket',
            timestamp: balanceData.lastUpdate,
          };

          // Cache the WebSocket data
          cache.set(cacheKey, {
            data: response,
            timestamp: Date.now(),
          });

          return NextResponse.json({
            ...response,
            responseTime: Date.now() - startTime,
          });
        } else {
          console.log('[Balance API] WebSocket data is stale or empty, falling back to REST');
        }
      }
    } else {
      console.log('[Balance API] Balance service not available');
    }

    // Fallback to REST API if WebSocket service is not available or data is stale
    console.log('[Balance API] Attempting REST API fallback - getAccountInfo');
    try {
      const accountData = await getAccountInfo(config.api);

      if (accountData) {
        // Use pre-calculated USDT-equivalent totals from account endpoint
        const availableBalance = parseFloat(accountData.availableBalance || '0');
        const totalPnL = parseFloat(accountData.totalUnrealizedProfit || '0');
        const totalPositionMargin = parseFloat(accountData.totalPositionInitialMargin || '0');

        // Total balance = margin used in positions + available balance
        // This represents your total trading equity/buying power
        const totalBalance = totalPositionMargin + availableBalance;

        console.log('[Balance API] Successfully fetched from account API:', {
          totalBalance,
          availableBalance,
          totalPositionValue: totalPositionMargin,
          totalPnL
        });

        const response = {
          totalBalance,
          availableBalance,
          totalPositionValue: totalPositionMargin,
          totalPnL,
          source: 'rest-account',
          timestamp: Date.now(),
        };

        // Cache the successful response
        cache.set(cacheKey, {
          data: response,
          timestamp: Date.now(),
        });

        return NextResponse.json({
          ...response,
          responseTime: Date.now() - startTime,
        });
      }
    } catch (accountError) {
      console.error('[Balance API] Account API failed:', accountError instanceof Error ? accountError.message : accountError);
    }

    // Final fallback to balance API
    console.log('[Balance API] Attempting final fallback - getBalance');
    const balanceData = await getBalance(config.api);

    let totalBalance = 0;
    let availableBalance = 0;
    let totalPositionValue = 0;
    let totalPnL = 0;

    if (balanceData && Array.isArray(balanceData)) {
      const usdtAsset = balanceData.find((a: any) => a.asset === 'USDT');
      if (usdtAsset) {
        // balance is the wallet balance
        totalBalance = parseFloat(usdtAsset.balance || '0');
        // availableBalance is free balance for trading
        availableBalance = parseFloat(usdtAsset.availableBalance || '0');
        // crossUnPnl is unrealized PnL
        totalPnL = parseFloat(usdtAsset.crossUnPnl || '0');
        // Position value should be the margin used (total - available)
        totalPositionValue = Math.max(0, totalBalance - availableBalance);

        console.log('[Balance API] Successfully fetched from balance API:', {
          totalBalance,
          availableBalance,
          totalPositionValue,
          totalPnL
        });
      } else {
        console.log('[Balance API] No USDT asset found in balance data');
      }
    } else {
      console.log('[Balance API] Invalid balance data format:', balanceData);
    }

    const response = {
      totalBalance,
      availableBalance,
      totalPositionValue,
      totalPnL,
      source: 'rest-balance',
      timestamp: Date.now(),
    };

    // Cache the successful response
    cache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      ...response,
      responseTime: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('[Balance API] Critical error:', error instanceof Error ? error.message : error);
    console.error('[Balance API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Return error response with details
    return NextResponse.json({
      totalBalance: 0,
      availableBalance: 0,
      totalPositionValue: 0,
      totalPnL: 0,
      source: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
      responseTime: Date.now() - startTime,
    }, { status: 500 });
  }
}