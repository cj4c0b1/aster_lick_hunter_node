import { NextRequest, NextResponse } from 'next/server';
import { placeOrder } from '@/lib/api/orders';
import { getPositions } from '@/lib/api/orders';
import { loadConfig } from '@/lib/bot/config';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string; side: string }> }
) {
  try {
    const { symbol, side } = await params;

    // Validate side parameter
    if (side !== 'LONG' && side !== 'SHORT') {
      return NextResponse.json(
        { error: 'Invalid side parameter. Must be LONG or SHORT', success: false },
        { status: 400 }
      );
    }

    const config = await loadConfig();

    // If no API key is configured, return simulation mode
    if (!config.api.apiKey || !config.api.secretKey) {
      return NextResponse.json({
        success: true,
        message: `Simulated closing ${symbol} ${side} position`,
        simulated: true
      });
    }

    // Get current positions to find the specific position
    const positions = await getPositions(config.api);

    // Find the target position
    const targetPosition = positions.find(pos => {
      const positionAmt = parseFloat(pos.positionAmt || '0');
      const posSymbol = pos.symbol;

      if (posSymbol !== symbol || positionAmt === 0) {
        return false;
      }

      const currentSide = positionAmt > 0 ? 'LONG' : 'SHORT';
      return currentSide === side;
    });

    if (!targetPosition) {
      return NextResponse.json(
        { error: `No open position found for ${symbol} ${side}`, success: false },
        { status: 404 }
      );
    }

    const positionAmt = parseFloat(targetPosition.positionAmt || '0');
    const quantity = Math.abs(positionAmt);

    if (quantity === 0) {
      return NextResponse.json(
        { error: `No position size for ${symbol} ${side}`, success: false },
        { status: 400 }
      );
    }

    // Determine the order side (opposite of position)
    const orderSide: 'SELL' | 'BUY' = side === 'LONG' ? 'SELL' : 'BUY';

    // Check if we're in paper mode (simulation)
    if (config.global.paperMode) {
      console.log(`PAPER MODE: Would close position for ${symbol} ${side} with quantity ${quantity}`);
      return NextResponse.json({
        success: true,
        message: `Paper mode: Simulated closing ${symbol} ${side} position of ${quantity} units`,
        simulated: true,
        order_side: orderSide,
        quantity: quantity
      });
    }

    // Prepare market order to close the position
    const orderParams: any = {
      symbol,
      side: orderSide,
      type: 'MARKET' as const,
      quantity,
      positionSide: targetPosition.positionSide || 'BOTH'
    };

    // Only add reduceOnly in One-way mode, not in Hedge mode
    if (config.global.positionMode === 'ONE_WAY') {
      orderParams.reduceOnly = true;
    }

    // Place the market order to close the position
    const orderResult = await placeOrder(orderParams, config.api);

    console.log(`Successfully closed position ${symbol} ${side}:`, orderResult);

    return NextResponse.json({
      success: true,
      message: `Successfully closed ${symbol} ${side} position`,
      order_id: orderResult.orderId,
      order_side: orderSide,
      quantity: quantity,
      order_details: orderResult
    });

  } catch (error: any) {
    console.error(`Error closing position:`, error);

    // Handle specific API errors
    if (error.response?.data) {
      return NextResponse.json(
        {
          error: `Failed to close position: ${error.response.data.msg || error.response.data.message || 'Unknown API error'}`,
          success: false,
          details: error.response.data
        },
        { status: error.response.status || 500 }
      );
    }

    return NextResponse.json(
      {
        error: `Internal error: ${error.message || 'Unknown error'}`,
        success: false
      },
      { status: 500 }
    );
  }
}
