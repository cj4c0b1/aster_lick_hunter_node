#!/usr/bin/env tsx

import { loadConfig } from '../src/lib/bot/config';
import { getPositionRisk, getOpenOrders, getMarkPrice } from '../src/lib/api/market';
import { placeOrder } from '../src/lib/api/orders';
import { getExchangeInfo } from '../src/lib/api/market';
import { symbolPrecision } from '../src/lib/utils/symbolPrecision';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bright: '\x1b[1m'
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function placeTakeProfitOnly() {
  log('\n=== PLACING TAKE PROFIT ORDER FOR PUMPUSDT ===\n', colors.cyan + colors.bright);

  try {
    // Load config
    const config = await loadConfig();

    // Get exchange info for precision
    const exchangeInfo = await getExchangeInfo();
    symbolPrecision.parseExchangeInfo(exchangeInfo);

    // Get PUMPUSDT position
    const positions = await getPositionRisk('PUMPUSDT', config.api);
    const pumpPosition = positions.find((p: any) => p.symbol === 'PUMPUSDT' && parseFloat(p.positionAmt) !== 0);

    if (!pumpPosition) {
      log('❌ No PUMPUSDT position found', colors.red);
      return;
    }

    const posAmt = parseFloat(pumpPosition.positionAmt);
    const entryPrice = parseFloat(pumpPosition.entryPrice);
    const isLong = posAmt > 0;
    const quantity = Math.abs(posAmt);

    // Get current mark price
    const markPriceData = await getMarkPrice('PUMPUSDT');
    const currentPrice = parseFloat(markPriceData.markPrice);

    log('Position Info:', colors.blue);
    console.log(`  Type: ${isLong ? 'LONG' : 'SHORT'}`);
    console.log(`  Quantity: ${quantity}`);
    console.log(`  Entry Price: ${entryPrice.toFixed(8)}`);
    console.log(`  Current Price: ${currentPrice.toFixed(8)}`);
    console.log(`  Unrealized PNL: ${((currentPrice - entryPrice) * quantity).toFixed(4)} USDT`);

    // Calculate TP based on current price to ensure it won't trigger immediately
    // For LONG position, TP must be above current price
    // Use the higher of: entry + 0.1% or current + 0.5%

    const entryBasedTP = entryPrice * 1.001; // Entry + 0.1%
    const currentBasedTP = currentPrice * 1.005; // Current + 0.5%

    let tpPrice = Math.max(entryBasedTP, currentBasedTP);

    // Format the price
    tpPrice = symbolPrecision.formatPrice('PUMPUSDT', tpPrice);
    const formattedQty = symbolPrecision.formatQuantity('PUMPUSDT', quantity);

    log('\nTP Calculation:', colors.blue);
    console.log(`  Entry-based TP (entry + 0.1%): ${entryBasedTP.toFixed(8)}`);
    console.log(`  Current-based TP (current + 0.5%): ${currentBasedTP.toFixed(8)}`);
    console.log(`  Final TP (using higher): ${tpPrice}`);
    console.log(`  Expected profit at TP: ${((tpPrice - entryPrice) * quantity).toFixed(4)} USDT`);

    // Check existing orders
    const existingOrders = await getOpenOrders('PUMPUSDT', config.api);
    const existingTP = existingOrders.filter((o: any) =>
      o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT'
    );

    if (existingTP.length > 0) {
      log('\n⚠️ Existing TP orders found:', colors.yellow);
      existingTP.forEach((o: any) => {
        console.log(`  Order ${o.orderId}: Stop Price = ${o.stopPrice}`);
      });
      log('Continuing anyway...', colors.yellow);
    }

    // Place the TP order
    const side = isLong ? 'SELL' : 'BUY';
    const positionSide = pumpPosition.positionSide || 'BOTH';

    log('\nPlacing Take Profit Order...', colors.cyan);
    console.log(`  Symbol: PUMPUSDT`);
    console.log(`  Side: ${side}`);
    console.log(`  Type: TAKE_PROFIT_MARKET`);
    console.log(`  Quantity: ${formattedQty}`);
    console.log(`  Stop Price: ${tpPrice}`);
    console.log(`  Position Side: ${positionSide}`);

    try {
      const tpOrder = await placeOrder({
        symbol: 'PUMPUSDT',
        side: side as 'BUY' | 'SELL',
        type: 'TAKE_PROFIT_MARKET',
        quantity: formattedQty,
        stopPrice: tpPrice,
        positionSide: positionSide as 'BOTH' | 'LONG' | 'SHORT',
        workingType: 'MARK_PRICE',
        priceProtect: true
      }, config.api);

      log(`\n✅ Take Profit order placed successfully!`, colors.green + colors.bright);
      console.log(`  Order ID: ${tpOrder.orderId}`);
      console.log(`  Stop Price: ${tpPrice}`);
      console.log(`  Will trigger when mark price reaches ${tpPrice}`);

    } catch (error: any) {
      log(`\n❌ Failed to place TP order: ${error?.response?.data?.msg || error?.message}`, colors.red);

      if (error?.response?.data?.msg?.includes('would trigger immediately')) {
        log('\nThe TP price would trigger immediately. Adjusting to safer distance...', colors.yellow);

        // Try with 1% above current price
        const saferTP = symbolPrecision.formatPrice('PUMPUSDT', currentPrice * 1.01);
        log(`Retrying with TP at ${saferTP} (1% above current)`, colors.cyan);

        try {
          const tpOrder = await placeOrder({
            symbol: 'PUMPUSDT',
            side: side as 'BUY' | 'SELL',
            type: 'TAKE_PROFIT_MARKET',
            quantity: formattedQty,
            stopPrice: saferTP,
            positionSide: positionSide as 'BOTH' | 'LONG' | 'SHORT',
            workingType: 'MARK_PRICE',
            priceProtect: true
          }, config.api);

          log(`\n✅ Take Profit order placed with adjusted price!`, colors.green + colors.bright);
          console.log(`  Order ID: ${tpOrder.orderId}`);
          console.log(`  Stop Price: ${saferTP}`);

        } catch (retryError: any) {
          log(`\n❌ Still failed: ${retryError?.response?.data?.msg || retryError?.message}`, colors.red);
        }
      }
    }

    // Final verification
    log('\n=== FINAL STATUS ===', colors.cyan);

    const finalOrders = await getOpenOrders('PUMPUSDT', config.api);
    const slOrders = finalOrders.filter((o: any) => o.type === 'STOP_MARKET' || o.type === 'STOP');
    const tpOrders = finalOrders.filter((o: any) => o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT');

    log('PUMPUSDT Protection Orders:', colors.blue);
    log(`  Stop Loss: ${slOrders.length} order(s)`, slOrders.length > 0 ? colors.green : colors.red);
    slOrders.forEach((o: any) => {
      console.log(`    - Order ${o.orderId}: Stop at ${o.stopPrice}`);
    });

    log(`  Take Profit: ${tpOrders.length} order(s)`, tpOrders.length > 0 ? colors.green : colors.red);
    tpOrders.forEach((o: any) => {
      console.log(`    - Order ${o.orderId}: Stop at ${o.stopPrice}`);
    });

    if (slOrders.length > 0 && tpOrders.length > 0) {
      log('\n✅ PUMPUSDT is now FULLY PROTECTED! 🎉', colors.green + colors.bright);
    } else {
      log('\n⚠️ Protection incomplete', colors.yellow);
    }

  } catch (error: any) {
    log(`\n❌ Error: ${error?.message}`, colors.red);
    console.error(error);
  }
}

// Run
placeTakeProfitOnly().catch(console.error);