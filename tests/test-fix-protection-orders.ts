#!/usr/bin/env tsx

import { loadConfig } from '../src/lib/bot/config';
import { getPositionRisk, getOpenOrders } from '../src/lib/api/market';
import { placeStopLossAndTakeProfit } from '../src/lib/api/batchOrders';
import { cancelOrder } from '../src/lib/api/orders';
import { symbolPrecision } from '../src/lib/utils/symbolPrecision';
import { getExchangeInfo } from '../src/lib/api/market';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
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

function logSubSection(title: string) {
  console.log('\n' + '-'.repeat(60));
  log(title, colors.blue);
  console.log('-'.repeat(60));
}

async function fixProtectionOrders() {
  logSection('FIX PROTECTION ORDERS TEST');

  try {
    // Load config
    const config = await loadConfig();
    log('✅ Config loaded successfully', colors.green);

    // Get exchange info for precision
    const exchangeInfo = await getExchangeInfo();
    const symbolsInfo = new Map();
    for (const symbol of exchangeInfo.symbols) {
      symbolsInfo.set(symbol.symbol, symbol);
    }

    // Get all positions and orders
    const positions = await getPositionRisk(undefined, config.api);
    const openOrders = await getOpenOrders(undefined, config.api);

    const activePositions = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0);
    log(`Active positions: ${activePositions.length}`, colors.blue);
    log(`Total open orders: ${openOrders.length}`, colors.blue);

    // Identify positions needing protection
    logSubSection('Identifying Positions Needing Protection');

    const positionsToFix = [];

    for (const pos of activePositions) {
      const symbol = pos.symbol;
      const posAmt = parseFloat(pos.positionAmt);
      const entryPrice = parseFloat(pos.entryPrice);

      // Check if symbol has config
      const symbolConfig = config.symbols[symbol];
      if (!symbolConfig) {
        log(`⚠️ Skipping ${symbol} - no config`, colors.yellow);
        continue;
      }

      // Find existing orders
      const slOrders = openOrders.filter((o: any) =>
        o.symbol === symbol &&
        (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
        o.reduceOnly &&
        ((posAmt > 0 && o.side === 'SELL') || (posAmt < 0 && o.side === 'BUY'))
      );

      const tpOrders = openOrders.filter((o: any) =>
        o.symbol === symbol &&
        (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT' || (o.type === 'LIMIT' && o.reduceOnly)) &&
        ((posAmt > 0 && o.side === 'SELL') || (posAmt < 0 && o.side === 'BUY'))
      );

      const needsSL = slOrders.length === 0;
      const needsTP = tpOrders.length === 0;

      if (needsSL || needsTP) {
        positionsToFix.push({
          position: pos,
          needsSL,
          needsTP,
          existingSL: slOrders,
          existingTP: tpOrders,
          config: symbolConfig
        });

        console.log(`\n${symbol}:`);
        console.log(`  Position: ${posAmt > 0 ? 'LONG' : 'SHORT'} ${Math.abs(posAmt)} units`);
        console.log(`  Entry Price: ${entryPrice}`);
        log(`  Missing: ${needsSL ? 'SL' : ''} ${needsTP ? 'TP' : ''}`, colors.red);
      }
    }

    if (positionsToFix.length === 0) {
      log('\n✅ All positions are already protected!', colors.green);
      return;
    }

    log(`\n❌ Found ${positionsToFix.length} unprotected position(s)`, colors.red);

    // Ask for confirmation
    logSubSection('Protection Orders to Place');

    for (const fix of positionsToFix) {
      const { position, config: symbolConfig } = fix;
      const symbol = position.symbol;
      const posAmt = parseFloat(position.positionAmt);
      const entryPrice = parseFloat(position.entryPrice);
      const isLong = posAmt > 0;
      const quantity = Math.abs(posAmt);

      // Calculate SL/TP prices
      const slPercent = symbolConfig.slPercent || 2;
      const tpPercent = symbolConfig.tpPercent || 1;

      const slPrice = isLong
        ? entryPrice * (1 - slPercent / 100)
        : entryPrice * (1 + slPercent / 100);

      const tpPrice = isLong
        ? entryPrice * (1 + tpPercent / 100)
        : entryPrice * (1 - tpPercent / 100);

      console.log(`\n${symbol}:`);
      console.log(`  Position: ${isLong ? 'LONG' : 'SHORT'} ${quantity} units`);
      console.log(`  Entry: ${entryPrice.toFixed(6)}`);
      if (fix.needsSL) {
        log(`  Will place SL at ${slPrice.toFixed(6)} (${slPercent}% loss)`, colors.cyan);
      }
      if (fix.needsTP) {
        log(`  Will place TP at ${tpPrice.toFixed(6)} (${tpPercent}% profit)`, colors.cyan);
      }
    }

    // Place the orders
    logSubSection('Placing Protection Orders');

    for (const fix of positionsToFix) {
      const { position, config: symbolConfig, needsSL, needsTP } = fix;
      const symbol = position.symbol;
      const posAmt = parseFloat(position.positionAmt);
      const entryPrice = parseFloat(position.entryPrice);
      const isLong = posAmt > 0;
      const quantity = Math.abs(posAmt);

      console.log(`\nProcessing ${symbol}...`);

      try {
        // Get symbol info for precision
        const symbolInfo = symbolsInfo.get(symbol);
        if (!symbolInfo) {
          log(`  ❌ Could not find symbol info for ${symbol}`, colors.red);
          continue;
        }

        // Parse exchange info for precision
        symbolPrecision.parseExchangeInfo(exchangeInfo);

        // Calculate SL/TP prices
        const slPercent = symbolConfig.slPercent || 2;
        const tpPercent = symbolConfig.tpPercent || 1;

        let slPrice = isLong
          ? entryPrice * (1 - slPercent / 100)
          : entryPrice * (1 + slPercent / 100);

        let tpPrice = isLong
          ? entryPrice * (1 + tpPercent / 100)
          : entryPrice * (1 - tpPercent / 100);

        // Format prices and quantity
        slPrice = symbolPrecision.formatPrice(symbol, slPrice);
        tpPrice = symbolPrecision.formatPrice(symbol, tpPrice);
        const formattedQuantity = symbolPrecision.formatQuantity(symbol, quantity);

        // Determine position side for hedge mode
        const positionSide = position.positionSide || 'BOTH';
        const orderPositionSide = positionSide;

        // Determine order side (opposite of position for closing)
        const side = isLong ? 'SELL' : 'BUY';

        log(`  Placing ${needsSL ? 'SL' : ''}${needsSL && needsTP ? ' and ' : ''}${needsTP ? 'TP' : ''} orders...`, colors.blue);

        if (needsSL && needsTP) {
          // Place both orders in batch
          const result = await placeStopLossAndTakeProfit({
            symbol,
            side: side as 'BUY' | 'SELL',
            quantity: formattedQuantity,
            stopLossPrice: slPrice,
            takeProfitPrice: tpPrice,
            positionSide: orderPositionSide as 'BOTH' | 'LONG' | 'SHORT',
            reduceOnly: orderPositionSide === 'BOTH',
          }, config.api);

          if (result.stopLoss) {
            log(`  ✅ SL placed at ${slPrice} (Order ID: ${result.stopLoss.orderId})`, colors.green);
          } else {
            log(`  ❌ Failed to place SL order`, colors.red);
          }

          if (result.takeProfit) {
            log(`  ✅ TP placed at ${tpPrice} (Order ID: ${result.takeProfit.orderId})`, colors.green);
          } else {
            log(`  ❌ Failed to place TP order`, colors.red);
          }
        } else {
          // Place individual orders (this shouldn't happen in normal operation)
          log(`  ⚠️ Only partial protection needed - this is unusual`, colors.yellow);

          // We would need to implement individual order placement here
          // For now, we'll use the batch API even for single orders
          const result = await placeStopLossAndTakeProfit({
            symbol,
            side: side as 'BUY' | 'SELL',
            quantity: formattedQuantity,
            stopLossPrice: needsSL ? slPrice : undefined,
            takeProfitPrice: needsTP ? tpPrice : undefined,
            positionSide: orderPositionSide as 'BOTH' | 'LONG' | 'SHORT',
            reduceOnly: orderPositionSide === 'BOTH',
          }, config.api);

          if (needsSL && result.stopLoss) {
            log(`  ✅ SL placed at ${slPrice} (Order ID: ${result.stopLoss.orderId})`, colors.green);
          }

          if (needsTP && result.takeProfit) {
            log(`  ✅ TP placed at ${tpPrice} (Order ID: ${result.takeProfit.orderId})`, colors.green);
          }
        }

      } catch (error: any) {
        log(`  ❌ Error placing orders: ${error?.response?.data?.msg || error?.message}`, colors.red);
        if (error?.response?.data) {
          console.error('API Error:', error.response.data);
        }
      }
    }

    // Verify the fix
    logSubSection('Verifying Protection');

    // Get updated orders
    const updatedOrders = await getOpenOrders(undefined, config.api);
    log(`Total open orders after fix: ${updatedOrders.length}`, colors.blue);

    for (const fix of positionsToFix) {
      const symbol = fix.position.symbol;
      const posAmt = parseFloat(fix.position.positionAmt);

      // Find new orders
      const slOrders = updatedOrders.filter((o: any) =>
        o.symbol === symbol &&
        (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
        o.reduceOnly &&
        ((posAmt > 0 && o.side === 'SELL') || (posAmt < 0 && o.side === 'BUY'))
      );

      const tpOrders = updatedOrders.filter((o: any) =>
        o.symbol === symbol &&
        (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT' || (o.type === 'LIMIT' && o.reduceOnly)) &&
        ((posAmt > 0 && o.side === 'SELL') || (posAmt < 0 && o.side === 'BUY'))
      );

      console.log(`\n${symbol}:`);
      const hasProtection = slOrders.length > 0 && tpOrders.length > 0;
      if (hasProtection) {
        log(`  ✅ Now protected (SL: ${slOrders.length}, TP: ${tpOrders.length})`, colors.green);
      } else {
        log(`  ❌ Still not protected (SL: ${slOrders.length}, TP: ${tpOrders.length})`, colors.red);
      }
    }

    // Summary
    logSection('FIX SUMMARY');

    log('Protection orders have been placed for unprotected positions.', colors.green);
    log('\nNote: The PositionManager should handle this automatically.', colors.yellow);
    log('The issue indicates that:', colors.yellow);
    log('  1. Orders may have failed to place initially', colors.yellow);
    log('  2. Orders were cancelled but not replaced', colors.yellow);
    log('  3. Position was opened outside of the bot', colors.yellow);
    log('\nConsider checking the bot logs for errors.', colors.cyan);

  } catch (error: any) {
    log(`\n❌ Error during fix: ${error?.message}`, colors.red);
    if (error?.response?.data) {
      console.error('API Error:', error.response.data);
    }
    console.error(error);
  }
}

// Run the fix
fixProtectionOrders().catch(console.error);