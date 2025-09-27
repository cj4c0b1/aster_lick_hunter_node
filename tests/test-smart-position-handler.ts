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

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.cyan + colors.bright);
  console.log('='.repeat(80));
}

async function smartPositionHandler() {
  logSection('SMART POSITION HANDLER');

  try {
    const config = await loadConfig();

    // Get exchange info for precision
    const exchangeInfo = await getExchangeInfo();
    symbolPrecision.parseExchangeInfo(exchangeInfo);

    // Get all positions
    const positions = await getPositionRisk(undefined, config.api);
    const activePositions = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0);

    log(`Found ${activePositions.length} active positions\n`, colors.blue);

    for (const position of activePositions) {
      const symbol = position.symbol;
      const posAmt = parseFloat(position.positionAmt);
      const entryPrice = parseFloat(position.entryPrice);
      const isLong = posAmt > 0;
      const quantity = Math.abs(posAmt);

      // Skip if no config
      const symbolConfig = config.symbols[symbol];
      if (!symbolConfig) {
        log(`⚠️ Skipping ${symbol} - no config`, colors.yellow);
        continue;
      }

      log(`\n${symbol}:`, colors.cyan);
      console.log(`  Position: ${isLong ? 'LONG' : 'SHORT'} ${quantity} units`);
      console.log(`  Entry: ${entryPrice.toFixed(8)}`);

      // Get current price
      const markPriceData = await getMarkPrice(symbol);
      const currentPrice = parseFloat(markPriceData.markPrice);
      console.log(`  Current: ${currentPrice.toFixed(8)}`);

      // Calculate PNL percentage
      const pnlPercent = isLong
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100;

      console.log(`  PNL: ${pnlPercent.toFixed(2)}%`);

      // Check existing orders
      const orders = await getOpenOrders(symbol, config.api);
      const hasTP = orders.some((o: any) =>
        o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT'
      );
      const hasSL = orders.some((o: any) =>
        o.type === 'STOP_MARKET' || o.type === 'STOP'
      );

      if (hasTP && hasSL) {
        log(`  ✅ Already protected`, colors.green);
        continue;
      }

      // Calculate TP based on config
      const tpPercent = symbolConfig.tpPercent || 0.1;
      const slPercent = symbolConfig.slPercent || 2;

      // Calculate target TP price
      const targetTP = isLong
        ? entryPrice * (1 + tpPercent / 100)
        : entryPrice * (1 - tpPercent / 100);

      // Check if we're already past TP target
      const pastTP = isLong
        ? currentPrice >= targetTP
        : currentPrice <= targetTP;

      if (pastTP) {
        log(`  🎯 Already past TP target (${tpPercent}% profit)!`, colors.green + colors.bright);

        // Check if PNL is positive
        if (pnlPercent > 0) {
          log(`  💰 Position is profitable at ${pnlPercent.toFixed(2)}%`, colors.green);
          log(`  🔄 CLOSING POSITION AT MARKET PRICE`, colors.yellow + colors.bright);

          try {
            // Close position with market order
            const side = isLong ? 'SELL' : 'BUY';
            const formattedQty = symbolPrecision.formatQuantity(symbol, quantity);

            const closeOrder = await placeOrder({
              symbol: symbol,
              side: side as 'BUY' | 'SELL',
              type: 'MARKET',
              quantity: formattedQty,
              positionSide: position.positionSide as 'BOTH' | 'LONG' | 'SHORT',
              reduceOnly: position.positionSide === 'BOTH' ? true : undefined
            }, config.api);

            log(`  ✅ Position closed! Order ID: ${closeOrder.orderId}`, colors.green + colors.bright);
            log(`  Realized PNL: ~${(pnlPercent * quantity * currentPrice / 100).toFixed(2)} USDT`, colors.green);

          } catch (error: any) {
            log(`  ❌ Failed to close: ${error?.response?.data?.msg || error?.message}`, colors.red);
          }

        } else {
          log(`  ⚠️ Past TP but currently at loss (${pnlPercent.toFixed(2)}%)`, colors.yellow);

          // Try to place protection at better levels
          const adjustedTP = isLong
            ? currentPrice * 1.002  // 0.2% above current
            : currentPrice * 0.998; // 0.2% below current

          log(`  Attempting to place adjusted TP at ${adjustedTP.toFixed(8)}`, colors.blue);

          // Place the adjusted TP
          await placeProtectionOrders(position, symbolConfig, currentPrice, !hasSL, !hasTP, adjustedTP);
        }

      } else {
        // Normal protection placement
        log(`  📊 TP target not reached yet (need ${Math.abs(((targetTP - currentPrice) / currentPrice) * 100).toFixed(2)}% move)`, colors.blue);

        if (!hasTP || !hasSL) {
          log(`  🛡️ Placing missing protection orders...`, colors.cyan);
          await placeProtectionOrders(position, symbolConfig, currentPrice, !hasSL, !hasTP);
        }
      }
    }

    logSection('SUMMARY');
    log('Position handling complete!', colors.green);

  } catch (error: any) {
    log(`\n❌ Error: ${error?.message}`, colors.red);
    console.error(error);
  }
}

async function placeProtectionOrders(
  position: any,
  symbolConfig: any,
  currentPrice: number,
  needSL: boolean,
  needTP: boolean,
  overrideTP?: number
) {
  const symbol = position.symbol;
  const posAmt = parseFloat(position.positionAmt);
  const entryPrice = parseFloat(position.entryPrice);
  const isLong = posAmt > 0;
  const quantity = Math.abs(posAmt);
  const side = isLong ? 'SELL' : 'BUY';
  const positionSide = position.positionSide || 'BOTH';

  const formattedQty = symbolPrecision.formatQuantity(symbol, quantity);

  // Place SL if needed
  if (needSL) {
    const slPercent = symbolConfig.slPercent || 2;
    const slPrice = isLong
      ? symbolPrecision.formatPrice(symbol, entryPrice * (1 - slPercent / 100))
      : symbolPrecision.formatPrice(symbol, entryPrice * (1 + slPercent / 100));

    try {
      const slOrder = await placeOrder({
        symbol: symbol,
        side: side as 'BUY' | 'SELL',
        type: 'STOP_MARKET',
        quantity: formattedQty,
        stopPrice: slPrice,
        positionSide: positionSide as 'BOTH' | 'LONG' | 'SHORT',
        workingType: 'MARK_PRICE',
        priceProtect: true
      }, config.api);

      log(`    ✅ SL placed at ${slPrice} (Order: ${slOrder.orderId})`, colors.green);
    } catch (error: any) {
      log(`    ❌ SL failed: ${error?.response?.data?.msg || error?.message}`, colors.red);
    }
  }

  // Place TP if needed
  if (needTP) {
    const tpPercent = symbolConfig.tpPercent || 1;

    let tpPrice;
    if (overrideTP) {
      tpPrice = symbolPrecision.formatPrice(symbol, overrideTP);
    } else {
      // Calculate TP ensuring it's beyond current price
      const entryBasedTP = isLong
        ? entryPrice * (1 + tpPercent / 100)
        : entryPrice * (1 - tpPercent / 100);

      const currentBasedTP = isLong
        ? currentPrice * 1.003  // 0.3% above current
        : currentPrice * 0.997; // 0.3% below current

      tpPrice = isLong
        ? symbolPrecision.formatPrice(symbol, Math.max(entryBasedTP, currentBasedTP))
        : symbolPrecision.formatPrice(symbol, Math.min(entryBasedTP, currentBasedTP));
    }

    try {
      const tpOrder = await placeOrder({
        symbol: symbol,
        side: side as 'BUY' | 'SELL',
        type: 'TAKE_PROFIT_MARKET',
        quantity: formattedQty,
        stopPrice: tpPrice,
        positionSide: positionSide as 'BOTH' | 'LONG' | 'SHORT',
        workingType: 'MARK_PRICE',
        priceProtect: true
      }, config.api);

      log(`    ✅ TP placed at ${tpPrice} (Order: ${tpOrder.orderId})`, colors.green);
    } catch (error: any) {
      if (error?.response?.data?.msg?.includes('would trigger immediately')) {
        log(`    ⚠️ TP would trigger immediately - position is too profitable!`, colors.yellow);
        log(`    💡 Consider closing at market for immediate profit`, colors.cyan);
      } else {
        log(`    ❌ TP failed: ${error?.response?.data?.msg || error?.message}`, colors.red);
      }
    }
  }
}

// Run the handler
smartPositionHandler().catch(console.error);