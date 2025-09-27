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

async function testPositionCloseLogic() {
  logSection('POSITION CLOSE DECISION LOGIC');

  try {
    const config = await loadConfig();

    // Get exchange info for precision
    const exchangeInfo = await getExchangeInfo();
    symbolPrecision.parseExchangeInfo(exchangeInfo);

    // Get positions
    const positions = await getPositionRisk(undefined, config.api);
    const activePositions = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0);

    log(`Analyzing ${activePositions.length} active positions...\n`, colors.blue);

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

      log(`\n${symbol} Position Analysis:`, colors.cyan + colors.bright);
      console.log('─'.repeat(40));

      // Get current price
      const markPriceData = await getMarkPrice(symbol);
      const currentPrice = parseFloat(markPriceData.markPrice);

      // Calculate metrics
      const pnlPercent = isLong
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100;

      const pnlUSDT = isLong
        ? (currentPrice - entryPrice) * quantity
        : (entryPrice - currentPrice) * quantity;

      console.log(`Type: ${isLong ? 'LONG' : 'SHORT'}`);
      console.log(`Quantity: ${quantity}`);
      console.log(`Entry: $${entryPrice.toFixed(8)}`);
      console.log(`Current: $${currentPrice.toFixed(8)}`);
      console.log(`PNL: ${pnlPercent.toFixed(2)}% ($${pnlUSDT.toFixed(2)})`);

      // Check TP scenarios
      const tpPercent = symbolConfig.tpPercent || 0.5;
      const targetTP = isLong
        ? entryPrice * (1 + tpPercent / 100)
        : entryPrice * (1 - tpPercent / 100);

      console.log(`\nTP Analysis:`);
      console.log(`  Config TP: ${tpPercent}%`);
      console.log(`  Target TP Price: $${targetTP.toFixed(8)}`);

      // Scenario 1: Check if we're past TP target
      const pastTP = isLong
        ? currentPrice >= targetTP
        : currentPrice <= targetTP;

      if (pastTP) {
        log(`  ✅ PAST TP TARGET!`, colors.green + colors.bright);
        console.log(`  Current price ${isLong ? 'above' : 'below'} target TP`);

        // Decision logic
        if (pnlPercent > tpPercent) {
          log(`\n  📈 RECOMMENDATION: CLOSE AT MARKET`, colors.yellow + colors.bright);
          log(`  Reason: Position exceeded TP target (${pnlPercent.toFixed(2)}% > ${tpPercent}%)`, colors.yellow);
          log(`  Action: Place market order to capture profits immediately`, colors.cyan);

          // Show what would happen
          console.log(`\n  If closed now:`);
          console.log(`    - Realized PNL: $${pnlUSDT.toFixed(2)}`);
          console.log(`    - Return: ${pnlPercent.toFixed(2)}%`);

        } else if (pnlPercent > 0) {
          log(`\n  ⚠️ RECOMMENDATION: TIGHT TP`, colors.yellow);
          log(`  Reason: Profitable but below target (${pnlPercent.toFixed(2)}%)`, colors.yellow);
          log(`  Action: Place TP just above current price`, colors.cyan);

          const tightTP = isLong
            ? currentPrice * 1.001
            : currentPrice * 0.999;

          console.log(`\n  Suggested TP: $${tightTP.toFixed(8)}`);
          console.log(`  This locks in current profit with minimal risk`);

        } else {
          log(`\n  🔴 WARNING: Past TP but at LOSS`, colors.red);
          log(`  Current PNL: ${pnlPercent.toFixed(2)}%`, colors.red);
          log(`  Action: Monitor closely, consider closing if loss worsens`, colors.yellow);
        }

      } else {
        // Not past TP yet
        const distanceToTP = ((targetTP - currentPrice) / currentPrice) * 100;
        console.log(`  ❌ Not at TP target yet`);
        console.log(`  Distance to TP: ${Math.abs(distanceToTP).toFixed(2)}%`);

        if (Math.abs(distanceToTP) < 0.1) {
          log(`\n  ⚡ VERY CLOSE TO TP!`, colors.yellow + colors.bright);
          log(`  Consider manual close if you're watching`, colors.yellow);
        }
      }

      // Scenario 2: Check if TP order would fail
      console.log(`\nTP Order Viability:`);

      const wouldTPTrigger = isLong
        ? targetTP <= currentPrice
        : targetTP >= currentPrice;

      if (wouldTPTrigger) {
        log(`  ❌ TP at ${tpPercent}% would trigger immediately!`, colors.red);
        log(`  RECOMMENDATION: Close at market or adjust TP%`, colors.yellow + colors.bright);
      } else {
        log(`  ✅ TP order would be valid`, colors.green);
      }

      // Risk assessment
      console.log(`\nRisk Assessment:`);
      const slPercent = symbolConfig.slPercent || 2;
      const riskRewardRatio = tpPercent / slPercent;

      console.log(`  Risk/Reward Ratio: 1:${riskRewardRatio.toFixed(2)}`);

      if (riskRewardRatio < 0.5) {
        log(`  ⚠️ Poor risk/reward ratio!`, colors.red);
        log(`  Consider adjusting TP or SL percentages`, colors.yellow);
      } else {
        log(`  ✅ Acceptable risk/reward`, colors.green);
      }
    }

    // Summary recommendations
    logSection('CONFIGURATION RECOMMENDATIONS');

    log('For positions that frequently hit "TP would trigger immediately":', colors.cyan);
    console.log('\n1. INCREASE TP PERCENTAGE:');
    console.log('   - Current: 0.1% → Recommended: 0.5-1%');
    console.log('   - This gives more room for price movement');

    console.log('\n2. IMPLEMENT AUTO-CLOSE LOGIC:');
    console.log('   - If TP order fails with "would trigger immediately"');
    console.log('   - AND position is profitable');
    console.log('   - → Automatically close at market price');

    console.log('\n3. DYNAMIC TP ADJUSTMENT:');
    console.log('   - Calculate TP based on volatility');
    console.log('   - Minimum: max(configTP, currentPrice + 0.3%)');

    console.log('\n4. POSITION MONITORING:');
    console.log('   - Check positions every minute');
    console.log('   - Auto-close if profit > TP% and no TP order exists');

  } catch (error: any) {
    log(`\n❌ Error: ${error?.message}`, colors.red);
    console.error(error);
  }
}

// Run the test
testPositionCloseLogic().catch(console.error);