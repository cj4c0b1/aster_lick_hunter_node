import { NextRequest, NextResponse } from 'next/server';
import { getPositions } from '@/lib/api/orders';
import { getOpenOrders } from '@/lib/api/market';
import { loadConfig } from '@/lib/bot/config';
import { withAuth } from '@/lib/auth/with-auth';

// Simple in-memory cache
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 5000; // 5 seconds

export const GET = withAuth(async (request: NextRequest, _user) => {
  const cacheKey = 'positions';

  // Check if force refresh is requested
  const searchParams = request.nextUrl.searchParams;
  const forceRefresh = searchParams.get('force') === 'true';

  // Check cache first (skip if force refresh)
  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[Positions API] Returning cached data');
      return NextResponse.json(cached.data);
    }
  }

  try {
    const config = await loadConfig();

    // Check if API keys are configured
    if (!config.api.apiKey || !config.api.secretKey) {
      console.error('[Positions API] Missing API keys in config');
      return NextResponse.json(
        { error: 'API keys not configured. Please update your config file with valid Binance API keys.' },
        { status: 400 }
      );
    }

    // Get positions and open orders from exchange
    const [positions, openOrders] = await Promise.all([
      getPositions(config.api),
      getOpenOrders(undefined, config.api)
    ]);

    // Filter out positions with zero amount and format for UI
    const activePositions = positions
      .filter(pos => Math.abs(parseFloat(pos.positionAmt || '0')) > 0)
      .map(pos => {
        const positionAmt = parseFloat(pos.positionAmt || '0');
        const entryPrice = parseFloat(pos.entryPrice || '0');
        const markPrice = parseFloat(pos.markPrice || '0');
        const unRealizedProfit = parseFloat(pos.unRealizedProfit || '0');
        const leverage = parseInt(pos.leverage || '1');
        const quantity = Math.abs(positionAmt);
        const notionalValue = quantity * entryPrice;
        const currentNotionalValue = quantity * markPrice;
        const side = positionAmt > 0 ? 'LONG' : 'SHORT';

        // Check for active SL/TP orders for this position
        const hasStopLoss = openOrders.some(order =>
          order.symbol === pos.symbol &&
          (order.type === 'STOP_MARKET' || order.type === 'STOP') &&
          order.reduceOnly === true &&
          ((side === 'LONG' && order.side === 'SELL') || (side === 'SHORT' && order.side === 'BUY'))
        );

        const hasTakeProfit = openOrders.some(order =>
          order.symbol === pos.symbol &&
          (order.type === 'TAKE_PROFIT_MARKET' || order.type === 'TAKE_PROFIT' ||
           (order.type === 'LIMIT' && order.reduceOnly === true)) &&
          ((side === 'LONG' && order.side === 'SELL') || (side === 'SHORT' && order.side === 'BUY'))
        );

        return {
          symbol: pos.symbol,
          side,
          quantity,
          entryPrice,
          markPrice,
          pnl: unRealizedProfit,
          pnlPercent: notionalValue > 0 ? (unRealizedProfit / notionalValue) * 100 : 0,
          margin: currentNotionalValue / leverage,
          leverage,
          liquidationPrice: pos.liquidationPrice ? parseFloat(pos.liquidationPrice) : undefined,
          hasStopLoss,
          hasTakeProfit,
        };
      });

    // Cache the successful response
    cache.set(cacheKey, {
      data: activePositions,
      timestamp: Date.now(),
    });

    return NextResponse.json(activePositions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch positions',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
});