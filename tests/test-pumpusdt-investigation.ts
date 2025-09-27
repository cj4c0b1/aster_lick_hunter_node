#!/usr/bin/env tsx

import { loadConfig } from '../src/lib/bot/config';
import { getPositionRisk, getOpenOrders, getAccountInfo } from '../src/lib/api/market';
import { PositionManager } from '../src/lib/bot/positionManager';
import axios from 'axios';
import { getSignedParams, paramsToQuery } from '../src/lib/api/auth';

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

async function investigatePumpUsdt() {
  logSection('PUMPUSDT INVESTIGATION TEST');

  try {
    // Load config
    const config = await loadConfig();
    log('✅ Config loaded successfully', colors.green);

    // Check if PUMPUSDT is in config
    logSubSection('Configuration Check');
    if (config.symbols.PUMPUSDT) {
      log('✅ PUMPUSDT found in config:', colors.green);
      console.log(JSON.stringify(config.symbols.PUMPUSDT, null, 2));
    } else {
      log('❌ PUMPUSDT NOT found in config!', colors.red);
      log('Available symbols: ' + Object.keys(config.symbols).join(', '), colors.yellow);
    }

    // Get all positions from exchange
    logSubSection('Current Positions from Exchange');
    const positions = await getPositionRisk(undefined, config.api);
    log(`Total positions from exchange: ${positions.length}`, colors.blue);

    // Find PUMPUSDT position
    const pumpPositions = positions.filter(p => p.symbol === 'PUMPUSDT' && parseFloat(p.positionAmt) !== 0);

    if (pumpPositions.length > 0) {
      log(`✅ Found ${pumpPositions.length} PUMPUSDT position(s):`, colors.green);
      pumpPositions.forEach((pos, idx) => {
        console.log(`\nPosition ${idx + 1}:`);
        console.log(`  Symbol: ${pos.symbol}`);
        console.log(`  Position Amount: ${pos.positionAmt}`);
        console.log(`  Position Side: ${pos.positionSide}`);
        console.log(`  Entry Price: ${pos.entryPrice}`);
        console.log(`  Mark Price: ${pos.markPrice}`);
        console.log(`  Unrealized PNL: ${pos.unRealizedProfit}`);
        console.log(`  Leverage: ${pos.leverage}`);

        // Generate position key like PositionManager does
        const posAmt = parseFloat(pos.positionAmt);
        let positionKey: string;
        if (pos.positionSide === 'BOTH') {
          const direction = posAmt > 0 ? 'LONG' : 'SHORT';
          positionKey = `${pos.symbol}_${direction}`;
        } else {
          positionKey = `${pos.symbol}_${pos.positionSide}_HEDGE`;
        }
        log(`  Generated Position Key: ${positionKey}`, colors.magenta);
      });
    } else {
      log('❌ No PUMPUSDT positions found', colors.yellow);
    }

    // Get all open orders
    logSubSection('Open Orders from Exchange');
    const openOrders = await getOpenOrders(undefined, config.api);
    log(`Total open orders: ${openOrders.length}`, colors.blue);

    // Find PUMPUSDT orders
    const pumpOrders = openOrders.filter(o => o.symbol === 'PUMPUSDT');

    if (pumpOrders.length > 0) {
      log(`✅ Found ${pumpOrders.length} PUMPUSDT order(s):`, colors.green);
      pumpOrders.forEach((order, idx) => {
        console.log(`\nOrder ${idx + 1}:`);
        console.log(`  Order ID: ${order.orderId}`);
        console.log(`  Type: ${order.type}`);
        console.log(`  Side: ${order.side}`);
        console.log(`  Price: ${order.price}`);
        console.log(`  Stop Price: ${order.stopPrice}`);
        console.log(`  Quantity: ${order.origQty}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Reduce Only: ${order.reduceOnly}`);
        console.log(`  Position Side: ${order.positionSide}`);
      });

      // Check for SL/TP orders
      const slOrders = pumpOrders.filter(o => o.type === 'STOP_MARKET' || o.type === 'STOP');
      const tpOrders = pumpOrders.filter(o => o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT' || (o.type === 'LIMIT' && o.reduceOnly));

      log(`\n📊 Protection Order Summary:`, colors.cyan);
      log(`  Stop Loss Orders: ${slOrders.length}`, slOrders.length > 0 ? colors.green : colors.red);
      log(`  Take Profit Orders: ${tpOrders.length}`, tpOrders.length > 0 ? colors.green : colors.red);

      if (slOrders.length === 0 && tpOrders.length === 0) {
        log(`\n⚠️ WARNING: PUMPUSDT has NO protection orders!`, colors.red + colors.bright);
      }
    } else {
      log('❌ No PUMPUSDT orders found', colors.yellow);
    }

    // Test PositionManager with PUMPUSDT
    logSubSection('Testing PositionManager Logic');

    // Create a test PositionManager instance
    const isHedgeMode = config.global.positionMode === 'HEDGE';
    log(`Position Mode: ${config.global.positionMode} (Hedge Mode: ${isHedgeMode})`, colors.blue);

    const pm = new PositionManager(config, isHedgeMode);

    // Test position key generation for each PUMPUSDT position
    if (pumpPositions.length > 0) {
      log('\n🔑 Testing Position Key Generation:', colors.cyan);
      pumpPositions.forEach((pos, idx) => {
        const posAmt = parseFloat(pos.positionAmt);
        // Simulate getPositionKey method
        let key: string;
        if (pos.positionSide === 'BOTH') {
          const direction = posAmt > 0 ? 'LONG' : 'SHORT';
          key = `${pos.symbol}_${direction}`;
        } else {
          key = `${pos.symbol}_${pos.positionSide}_HEDGE`;
        }
        log(`  Position ${idx + 1} Key: ${key}`, colors.magenta);

        // Check if this position would need protection
        const needsProtection = Math.abs(posAmt) > 0;
        log(`  Needs Protection: ${needsProtection}`, needsProtection ? colors.green : colors.gray);

        // Check if symbol config exists
        const hasConfig = !!config.symbols[pos.symbol];
        log(`  Has Symbol Config: ${hasConfig}`, hasConfig ? colors.green : colors.red);

        if (hasConfig) {
          const symbolConfig = config.symbols[pos.symbol];
          log(`  TP Percent: ${symbolConfig.tpPercent}%`, colors.blue);
          log(`  SL Percent: ${symbolConfig.slPercent}%`, colors.blue);
        }
      });
    }

    // Check all positions for protection status
    logSubSection('Protection Status for All Positions');

    const allActivePositions = positions.filter(p => parseFloat(p.positionAmt) !== 0);
    log(`Active positions: ${allActivePositions.length}`, colors.blue);

    for (const pos of allActivePositions) {
      const posAmt = parseFloat(pos.positionAmt);
      console.log(`\n${pos.symbol}:`);
      console.log(`  Amount: ${pos.positionAmt}`);
      console.log(`  Side: ${pos.positionSide}`);

      // Find orders for this position
      const symbolOrders = openOrders.filter(o => o.symbol === pos.symbol);
      const slOrders = symbolOrders.filter(o =>
        (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
        o.reduceOnly &&
        ((posAmt > 0 && o.side === 'SELL') || (posAmt < 0 && o.side === 'BUY'))
      );
      const tpOrders = symbolOrders.filter(o =>
        (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT' || (o.type === 'LIMIT' && o.reduceOnly)) &&
        ((posAmt > 0 && o.side === 'SELL') || (posAmt < 0 && o.side === 'BUY'))
      );

      const hasProtection = slOrders.length > 0 && tpOrders.length > 0;
      const status = hasProtection ? '✅ Protected' : '❌ NOT Protected';
      const statusColor = hasProtection ? colors.green : colors.red;

      log(`  Protection: ${status} (SL: ${slOrders.length}, TP: ${tpOrders.length})`, statusColor);

      // Check config
      const hasConfig = !!config.symbols[pos.symbol];
      if (!hasConfig) {
        log(`  ⚠️ No config for ${pos.symbol}`, colors.yellow);
      }
    }

    // Summary
    logSection('INVESTIGATION SUMMARY');

    const pumpHasPosition = pumpPositions.length > 0;
    const pumpHasConfig = !!config.symbols.PUMPUSDT;
    const pumpHasOrders = pumpOrders.length > 0;
    const pumpHasProtection = pumpOrders.some(o => o.type === 'STOP_MARKET' || o.type === 'STOP') &&
                              pumpOrders.some(o => o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT' || (o.type === 'LIMIT' && o.reduceOnly));

    console.log('Status:');
    log(`  Has Position: ${pumpHasPosition}`, pumpHasPosition ? colors.green : colors.yellow);
    log(`  Has Config: ${pumpHasConfig}`, pumpHasConfig ? colors.green : colors.red);
    log(`  Has Orders: ${pumpHasOrders}`, pumpHasOrders ? colors.green : colors.yellow);
    log(`  Has Protection: ${pumpHasProtection}`, pumpHasProtection ? colors.green : colors.red);

    if (pumpHasPosition && !pumpHasProtection) {
      log('\n⚠️ ISSUE CONFIRMED: PUMPUSDT has an open position but NO protection orders!', colors.red + colors.bright);
      log('This position is at risk and needs immediate SL/TP orders.', colors.red);

      if (!pumpHasConfig) {
        log('\n🔴 ROOT CAUSE: PUMPUSDT is missing from config!', colors.red + colors.bright);
      } else {
        log('\n🟡 Config exists but protection orders are missing. Possible causes:', colors.yellow);
        log('  - Orders failed to place initially', colors.yellow);
        log('  - Orders were cancelled but not replaced', colors.yellow);
        log('  - Position was opened outside of the bot', colors.yellow);
        log('  - Race condition in order placement logic', colors.yellow);
      }
    }

  } catch (error: any) {
    log(`\n❌ Error during investigation: ${error?.message}`, colors.red);
    if (error?.response?.data) {
      console.error('API Error:', error.response.data);
    }
    console.error(error);
  }
}

// Run the investigation
investigatePumpUsdt().catch(console.error);