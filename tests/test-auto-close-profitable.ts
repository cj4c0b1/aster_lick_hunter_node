#!/usr/bin/env tsx

import { loadConfig } from '../src/lib/bot/config';
import { getPositionRisk, getMarkPrice } from '../src/lib/api/market';
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
  bright: '\x1b[1m'
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function autoCloseProfitablePositions() {
  log('\n🤖 AUTO-CLOSE PROFITABLE POSITIONS\n', colors.cyan + colors.bright);

  try {
    const config = await loadConfig();

    // Get exchange info for precision
    const exchangeInfo = await getExchangeInfo();
    symbolPrecision.parseExchangeInfo(exchangeInfo);

    // Get positions
    const positions = await getPositionRisk(undefined, config.api);
    const activePositions = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0);

    let closedCount = 0;
    let skippedCount = 0;

    for (const position of activePositions) {
      const symbol = position.symbol;
      const posAmt = parseFloat(position.positionAmt);
      const entryPrice = parseFloat(position.entryPrice);
      const isLong = posAmt > 0;
      const quantity = Math.abs(posAmt);

      // Skip if no config
      const symbolConfig = config.symbols[symbol];
      if (!symbolConfig) {
        continue;
      }

      // Get current price
      const markPriceData = await getMarkPrice(symbol);
      const currentPrice = parseFloat(markPriceData.markPrice);

      // Calculate PNL
      const pnlPercent = isLong
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100;

      const pnlUSDT = isLong
        ? (currentPrice - entryPrice) * quantity
        : (entryPrice - currentPrice) * quantity;

      const tpPercent = symbolConfig.tpPercent || 0.5;

      log(`\n${symbol}:`, colors.cyan);
      console.log(`  Position: ${isLong ? 'LONG' : 'SHORT'} ${quantity} units`);
      console.log(`  Entry: $${entryPrice.toFixed(8)}`);
      console.log(`  Current: $${currentPrice.toFixed(8)}`);
      console.log(`  PNL: ${pnlPercent.toFixed(2)}% ($${pnlUSDT.toFixed(2)})`);
      console.log(`  Target TP: ${tpPercent}%`);

      // Auto-close logic
      if (pnlPercent > tpPercent && pnlPercent > 0) {
        log(`\n  🎯 Position exceeded TP target!`, colors.green + colors.bright);
        log(`  ${pnlPercent.toFixed(2)}% > ${tpPercent}% target`, colors.green);

        // Ask for confirmation (in real implementation, this would be automatic)
        log(`\n  🔄 AUTO-CLOSING POSITION...`, colors.yellow + colors.bright);

        try {
          const side = isLong ? 'SELL' : 'BUY';
          const formattedQty = symbolPrecision.formatQuantity(symbol, quantity);
          const positionSide = position.positionSide || 'BOTH';

          // Place market order to close
          const closeOrder = await placeOrder({
            symbol: symbol,
            side: side as 'BUY' | 'SELL',
            type: 'MARKET',
            quantity: formattedQty,
            positionSide: positionSide as 'BOTH' | 'LONG' | 'SHORT',
            reduceOnly: positionSide === 'BOTH' ? true : undefined
          }, config.api);

          log(`\n  ✅ POSITION CLOSED SUCCESSFULLY!`, colors.green + colors.bright);
          console.log(`    Order ID: ${closeOrder.orderId}`);
          console.log(`    Realized PNL: ~$${pnlUSDT.toFixed(2)}`);
          console.log(`    Return: ${pnlPercent.toFixed(2)}%`);

          closedCount++;

        } catch (error: any) {
          log(`\n  ❌ Failed to close: ${error?.response?.data?.msg || error?.message}`, colors.red);
          console.error('Error details:', error?.response?.data);
        }

      } else if (pnlPercent > 0) {
        log(`  ℹ️ Profitable but below TP target (${pnlPercent.toFixed(2)}% < ${tpPercent}%)`, colors.blue);
        skippedCount++;
      } else {
        log(`  ⚠️ Position at loss (${pnlPercent.toFixed(2)}%)`, colors.yellow);
        skippedCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    log('\n📊 SUMMARY', colors.cyan + colors.bright);
    log(`  Positions closed: ${closedCount}`, closedCount > 0 ? colors.green : colors.gray);
    log(`  Positions kept: ${skippedCount}`, colors.blue);

    if (closedCount > 0) {
      log('\n💰 Profits captured successfully!', colors.green + colors.bright);
    }

    // Recommendations
    log('\n💡 RECOMMENDATIONS FOR BOT IMPLEMENTATION:', colors.cyan);
    console.log('\n1. Add this logic to PositionManager:');
    console.log('   - Check positions every 30 seconds');
    console.log('   - If PNL% > TP% and TP order would fail');
    console.log('   - Auto-close at market price');

    console.log('\n2. Configuration improvements:');
    console.log('   - Add "autoCloseAtTP" boolean flag');
    console.log('   - Add "minTPDistance" to prevent immediate triggers');
    console.log('   - Consider dynamic TP based on volatility');

    console.log('\n3. Safety features:');
    console.log('   - Log all auto-closes for review');
    console.log('   - Add cooldown period after auto-close');
    console.log('   - Send notifications when auto-closing');

  } catch (error: any) {
    log(`\n❌ Error: ${error?.message}`, colors.red);
    console.error(error);
  }
}

// Safety check before running
console.log('⚠️  WARNING: This script will AUTO-CLOSE profitable positions!');
console.log('It will close any position that has exceeded its TP target.\n');

// Add 3 second delay for safety
console.log('Starting in 3 seconds... Press Ctrl+C to cancel\n');

setTimeout(() => {
  autoCloseProfitablePositions().catch(console.error);
}, 3000);