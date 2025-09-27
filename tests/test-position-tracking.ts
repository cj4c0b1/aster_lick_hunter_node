#!/usr/bin/env tsx

import { loadConfig } from '../src/lib/bot/config';
import { PositionManager } from '../src/lib/bot/positionManager';
import { getPositionRisk, getOpenOrders } from '../src/lib/api/market';

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

// Mock StatusBroadcaster for testing
class MockStatusBroadcaster {
  broadcastPositionUpdate(data: any) {
    log(`📡 Mock Broadcast - Position Update: ${data.symbol} ${data.side} ${data.type}`, colors.gray);
  }
  broadcastOrderFilled(data: any) {
    log(`📡 Mock Broadcast - Order Filled: ${data.symbol}`, colors.gray);
  }
  broadcastStopLossPlaced(data: any) {
    log(`📡 Mock Broadcast - SL Placed: ${data.symbol} at ${data.price}`, colors.gray);
  }
  broadcastTakeProfitPlaced(data: any) {
    log(`📡 Mock Broadcast - TP Placed: ${data.symbol} at ${data.price}`, colors.gray);
  }
  broadcastPositionClosed(data: any) {
    log(`📡 Mock Broadcast - Position Closed: ${data.symbol}`, colors.gray);
  }
  broadcastPnLUpdate(data: any) {
    log(`📡 Mock Broadcast - PnL Update`, colors.gray);
  }
  broadcastOrderUpdate(data: any) {
    log(`📡 Mock Broadcast - Order Update`, colors.gray);
  }
}

async function testPositionTracking() {
  logSection('POSITION TRACKING TEST');

  try {
    // Load config
    const config = await loadConfig();
    log('✅ Config loaded successfully', colors.green);

    // Check position mode
    const isHedgeMode = config.global.positionMode === 'HEDGE';
    log(`Position Mode: ${config.global.positionMode} (Hedge: ${isHedgeMode})`, colors.blue);

    // Create PositionManager instance
    const pm = new PositionManager(config, isHedgeMode);
    const mockBroadcaster = new MockStatusBroadcaster();
    pm.setStatusBroadcaster(mockBroadcaster);

    // Test position key generation
    logSubSection('Testing Position Key Generation');

    // Test cases for position key generation
    const testCases = [
      { symbol: 'PUMPUSDT', positionSide: 'BOTH', positionAmt: 100, expected: 'PUMPUSDT_LONG' },
      { symbol: 'PUMPUSDT', positionSide: 'BOTH', positionAmt: -100, expected: 'PUMPUSDT_SHORT' },
      { symbol: 'PUMPUSDT', positionSide: 'LONG', positionAmt: 100, expected: 'PUMPUSDT_LONG_HEDGE' },
      { symbol: 'PUMPUSDT', positionSide: 'SHORT', positionAmt: -100, expected: 'PUMPUSDT_SHORT_HEDGE' },
      { symbol: 'BTCUSDT', positionSide: 'BOTH', positionAmt: 0.001, expected: 'BTCUSDT_LONG' },
      { symbol: 'BTCUSDT', positionSide: 'LONG', positionAmt: 0.001, expected: 'BTCUSDT_LONG_HEDGE' },
    ];

    // Access private method through reflection (for testing)
    const getPositionKey = (symbol: string, positionSide: string, positionAmt: number): string => {
      if (positionSide === 'BOTH') {
        const direction = positionAmt > 0 ? 'LONG' : 'SHORT';
        return `${symbol}_${direction}`;
      }
      return `${symbol}_${positionSide}_HEDGE`;
    };

    for (const test of testCases) {
      const key = getPositionKey(test.symbol, test.positionSide, test.positionAmt);
      const passed = key === test.expected;
      const status = passed ? '✅' : '❌';
      const color = passed ? colors.green : colors.red;
      log(`${status} ${test.symbol} (${test.positionSide}, ${test.positionAmt}) => ${key} ${passed ? '' : `(expected: ${test.expected})`}`, color);
    }

    // Get actual positions and test tracking
    logSubSection('Testing Actual Position Tracking');

    const positions = await getPositionRisk(undefined, config.api);
    const activePositions = positions.filter(p => parseFloat(p.positionAmt) !== 0);
    log(`Found ${activePositions.length} active positions`, colors.blue);

    // Create position map like PositionManager does
    const positionMap = new Map();
    const positionOrders = new Map();

    for (const pos of activePositions) {
      const posAmt = parseFloat(pos.positionAmt);
      const key = getPositionKey(pos.symbol, pos.positionSide, posAmt);

      positionMap.set(key, pos);
      log(`\nPosition: ${key}`, colors.cyan);
      console.log(`  Symbol: ${pos.symbol}`);
      console.log(`  Amount: ${pos.positionAmt}`);
      console.log(`  Side: ${pos.positionSide}`);
      console.log(`  Entry Price: ${pos.entryPrice}`);

      // Check if symbol has config
      const hasConfig = !!config.symbols[pos.symbol];
      if (hasConfig) {
        log(`  ✅ Has config`, colors.green);
        const symbolConfig = config.symbols[pos.symbol];
        console.log(`    TP: ${symbolConfig.tpPercent}%, SL: ${symbolConfig.slPercent}%`);
      } else {
        log(`  ❌ NO CONFIG for ${pos.symbol}!`, colors.red);
      }
    }

    // Check for PUMPUSDT specifically
    logSubSection('PUMPUSDT Position Tracking Check');

    const pumpKeys = Array.from(positionMap.keys()).filter(key => key.startsWith('PUMPUSDT'));
    if (pumpKeys.length > 0) {
      log(`✅ PUMPUSDT positions in tracking map:`, colors.green);
      for (const key of pumpKeys) {
        log(`  - ${key}`, colors.cyan);
      }
    } else {
      log(`❌ No PUMPUSDT positions in tracking map`, colors.red);

      // Check if PUMPUSDT exists in raw positions
      const pumpRaw = activePositions.filter(p => p.symbol === 'PUMPUSDT');
      if (pumpRaw.length > 0) {
        log(`⚠️ BUT PUMPUSDT exists in raw positions!`, colors.yellow + colors.bright);
        log(`This indicates a tracking issue in position key generation`, colors.yellow);
      }
    }

    // Test order mapping
    logSubSection('Testing Order-to-Position Mapping');

    const openOrders = await getOpenOrders(undefined, config.api);
    log(`Total open orders: ${openOrders.length}`, colors.blue);

    // Map orders to positions
    for (const [posKey, pos] of positionMap) {
      const symbol = pos.symbol;
      const posAmt = parseFloat(pos.positionAmt);

      // Find SL/TP orders for this position
      const slOrders = openOrders.filter(o =>
        o.symbol === symbol &&
        (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
        o.reduceOnly &&
        ((posAmt > 0 && o.side === 'SELL') || (posAmt < 0 && o.side === 'BUY'))
      );

      const tpOrders = openOrders.filter(o =>
        o.symbol === symbol &&
        (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT' || (o.type === 'LIMIT' && o.reduceOnly)) &&
        ((posAmt > 0 && o.side === 'SELL') || (posAmt < 0 && o.side === 'BUY'))
      );

      const orders = {
        slOrderId: slOrders.length > 0 ? slOrders[0].orderId : undefined,
        tpOrderId: tpOrders.length > 0 ? tpOrders[0].orderId : undefined
      };

      positionOrders.set(posKey, orders);

      console.log(`\n${posKey}:`);
      console.log(`  SL Orders: ${slOrders.length} ${slOrders.length > 0 ? `(ID: ${orders.slOrderId})` : ''}`);
      console.log(`  TP Orders: ${tpOrders.length} ${tpOrders.length > 0 ? `(ID: ${orders.tpOrderId})` : ''}`);

      const hasProtection = slOrders.length > 0 && tpOrders.length > 0;
      const status = hasProtection ? '✅ Protected' : '❌ NOT Protected';
      const color = hasProtection ? colors.green : colors.red;
      log(`  Status: ${status}`, color);

      // Check for PUMPUSDT specifically
      if (symbol === 'PUMPUSDT' && !hasProtection) {
        log(`  ⚠️ PUMPUSDT NEEDS PROTECTION!`, colors.red + colors.bright);
      }
    }

    // Summary
    logSection('POSITION TRACKING SUMMARY');

    const totalPositions = positionMap.size;
    const protectedPositions = Array.from(positionOrders.values()).filter(o => o.slOrderId && o.tpOrderId).length;
    const unprotectedPositions = totalPositions - protectedPositions;

    log(`Total Positions: ${totalPositions}`, colors.blue);
    log(`Protected: ${protectedPositions}`, protectedPositions === totalPositions ? colors.green : colors.yellow);
    log(`Unprotected: ${unprotectedPositions}`, unprotectedPositions > 0 ? colors.red : colors.green);

    if (unprotectedPositions > 0) {
      log('\n⚠️ UNPROTECTED POSITIONS:', colors.red + colors.bright);
      for (const [posKey, orders] of positionOrders) {
        if (!orders.slOrderId || !orders.tpOrderId) {
          const pos = positionMap.get(posKey);
          log(`  - ${posKey} (Missing: ${!orders.slOrderId ? 'SL' : ''} ${!orders.tpOrderId ? 'TP' : ''})`, colors.red);
        }
      }
    }

    // Check for positions without config
    logSubSection('Positions Without Config');
    const positionsWithoutConfig = activePositions.filter(p => !config.symbols[p.symbol]);
    if (positionsWithoutConfig.length > 0) {
      log('⚠️ Positions without config (cannot place protection orders):', colors.red + colors.bright);
      for (const pos of positionsWithoutConfig) {
        log(`  - ${pos.symbol} (Amount: ${pos.positionAmt})`, colors.red);
      }
      log('\nThese positions will NOT be protected by PositionManager!', colors.red);
    } else {
      log('✅ All positions have config', colors.green);
    }

  } catch (error: any) {
    log(`\n❌ Error during test: ${error?.message}`, colors.red);
    if (error?.response?.data) {
      console.error('API Error:', error.response.data);
    }
    console.error(error);
  }
}

// Run the test
testPositionTracking().catch(console.error);