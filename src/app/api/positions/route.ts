import { NextRequest, NextResponse } from 'next/server';
import { getPositions } from '@/lib/api/orders';
import { loadConfig } from '@/lib/bot/config';

export async function GET(request: NextRequest) {
  try {
    const config = await loadConfig();

    // If no API key is configured, return empty positions
    if (!config.api.apiKey || !config.api.secretKey) {
      return NextResponse.json([]);
    }

    // Get positions from exchange
    const positions = await getPositions(config.api);

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

        return {
          symbol: pos.symbol,
          side: positionAmt > 0 ? 'LONG' : 'SHORT',
          quantity,
          entryPrice,
          markPrice,
          pnl: unRealizedProfit,
          pnlPercent: notionalValue > 0 ? (unRealizedProfit / notionalValue) * 100 : 0,
          margin: notionalValue / leverage,
          leverage,
          liquidationPrice: pos.liquidationPrice ? parseFloat(pos.liquidationPrice) : undefined,
        };
      });

    return NextResponse.json(activePositions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}