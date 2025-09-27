#!/usr/bin/env tsx

import { loadConfig } from '../src/lib/bot/config';
import { getPositionRisk, getOpenOrders, getMarkPrice } from '../src/lib/api/market';
import { placeOrder } from '../src/lib/api/orders';
import { placeBatchOrders } from '../src/lib/api/batchOrders';
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

async function placeProtectionSimple() {
  logSection('SIMPLE PROTECTION ORDER PLACEMENT');

  try {
    // Load config
    const config = await loadConfig();
    log('✅ Config loaded', colors.green);

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

    log(`\nPUMPUSDT Position:`, colors.blue);
    console.log(`  Type: ${isLong ? 'LONG' : 'SHORT'}`);
    console.log(`  Quantity: ${quantity}`);
    console.log(`  Entry Price: ${entryPrice}`);
    console.log(`  Position Side: ${pumpPosition.positionSide}`);

    // Get current mark price
    const markPriceData = await getMarkPrice('PUMPUSDT');
    const currentPrice = parseFloat(markPriceData.markPrice);
    log(`  Current Mark Price: ${currentPrice}`, colors.cyan);

    // Calculate SL/TP with config
    const symbolConfig = config.symbols.PUMPUSDT;
    if (!symbolConfig) {
      log('❌ No config for PUMPUSDT', colors.red);
      return;
    }

    const slPercent = symbolConfig.slPercent || 20;
    const tpPercent = symbolConfig.tpPercent || 0.1;

    // Calculate prices
    let slPrice = isLong
      ? entryPrice * (1 - slPercent / 100)
      : entryPrice * (1 + slPercent / 100);

    let tpPrice = isLong
      ? entryPrice * (1 + tpPercent / 100)
      : entryPrice * (1 - tpPercent / 100);

    // Format prices
    slPrice = symbolPrecision.formatPrice('PUMPUSDT', slPrice);
    tpPrice = symbolPrecision.formatPrice('PUMPUSDT', tpPrice);
    const formattedQty = symbolPrecision.formatQuantity('PUMPUSDT', quantity);

    log(`\nCalculated Prices:`, colors.blue);
    console.log(`  SL: ${slPrice} (${slPercent}% from entry)`);
    console.log(`  TP: ${tpPrice} (${tpPercent}% from entry)`);

    // Check if TP is too close to current price
    const tpDistance = Math.abs((tpPrice - currentPrice) / currentPrice * 100);
    if (tpDistance < 0.05) {
      log(`\n⚠️ TP price is too close to current price (${tpDistance.toFixed(3)}%)`, colors.yellow);
      log(`Adjusting TP to minimum distance...`, colors.yellow);

      // Adjust TP to be at least 0.2% away from current price
      const minDistance = 0.002; // 0.2%
      tpPrice = isLong
        ? symbolPrecision.formatPrice('PUMPUSDT', currentPrice * (1 + minDistance))
        : symbolPrecision.formatPrice('PUMPUSDT', currentPrice * (1 - minDistance));

      log(`  New TP: ${tpPrice}`, colors.cyan);
    }

    // Prepare orders
    const side = isLong ? 'SELL' : 'BUY'; // Opposite side to close position
    const positionSide = pumpPosition.positionSide || 'BOTH';

    log(`\nOrder Parameters:`, colors.blue);
    console.log(`  Symbol: PUMPUSDT`);
    console.log(`  Side: ${side}`);
    console.log(`  Quantity: ${formattedQty}`);
    console.log(`  Position Side: ${positionSide}`);

    // Place orders individually for better error handling
    logSection('PLACING ORDERS');

    // Place Stop Loss
    try {
      log('\nPlacing Stop Loss...', colors.blue);
      const slOrder = await placeOrder({
        symbol: 'PUMPUSDT',
        side: side as 'BUY' | 'SELL',
        type: 'STOP_MARKET',
        quantity: formattedQty,
        stopPrice: slPrice,
        positionSide: positionSide as 'BOTH' | 'LONG' | 'SHORT',
        workingType: 'MARK_PRICE',
        priceProtect: true
      }, config.api);

      log(`✅ SL placed successfully! Order ID: ${slOrder.orderId}`, colors.green);
      console.log(`  Price: ${slPrice}`);
    } catch (error: any) {
      log(`❌ Failed to place SL: ${error?.response?.data?.msg || error?.message}`, colors.red);
      console.error('SL Error:', error?.response?.data);
    }

    // Place Take Profit
    try {
      log('\nPlacing Take Profit...', colors.blue);
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

      log(`✅ TP placed successfully! Order ID: ${tpOrder.orderId}`, colors.green);
      console.log(`  Price: ${tpPrice}`);
    } catch (error: any) {
      log(`❌ Failed to place TP: ${error?.response?.data?.msg || error?.message}`, colors.red);
      console.error('TP Error:', error?.response?.data);

      // If TP failed due to price, try with a different price
      if (error?.response?.data?.msg?.includes('would trigger immediately')) {
        log('\n⚠️ TP would trigger immediately, adjusting price...', colors.yellow);

        // Make TP further from current price
        const saferDistance = 0.005; // 0.5%
        const saferTpPrice = isLong
          ? symbolPrecision.formatPrice('PUMPUSDT', currentPrice * (1 + saferDistance))
          : symbolPrecision.formatPrice('PUMPUSDT', currentPrice * (1 - saferDistance));

        log(`  Trying with TP at ${saferTpPrice}`, colors.cyan);

        try {
          const tpOrder = await placeOrder({
            symbol: 'PUMPUSDT',
            side: side as 'BUY' | 'SELL',
            type: 'TAKE_PROFIT_MARKET',
            quantity: formattedQty,
            stopPrice: saferTpPrice,
            positionSide: positionSide as 'BOTH' | 'LONG' | 'SHORT',
            workingType: 'MARK_PRICE',
            priceProtect: true
          }, config.api);

          log(`✅ TP placed successfully with adjusted price! Order ID: ${tpOrder.orderId}`, colors.green);
          console.log(`  Price: ${saferTpPrice}`);
        } catch (retryError: any) {
          log(`❌ Failed to place TP even with adjusted price: ${retryError?.response?.data?.msg || retryError?.message}`, colors.red);
        }
      }
    }

    // Verify orders
    logSection('VERIFICATION');

    const openOrders = await getOpenOrders('PUMPUSDT', config.api);
    const slOrders = openOrders.filter((o: any) =>
      o.type === 'STOP_MARKET' || o.type === 'STOP'
    );
    const tpOrders = openOrders.filter((o: any) =>
      o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT'
    );

    log(`\nPUMPUSDT Orders:`, colors.blue);
    log(`  Stop Loss Orders: ${slOrders.length}`, slOrders.length > 0 ? colors.green : colors.red);
    log(`  Take Profit Orders: ${tpOrders.length}`, tpOrders.length > 0 ? colors.green : colors.red);

    if (slOrders.length > 0 && tpOrders.length > 0) {
      log(`\n✅ PUMPUSDT is now protected!`, colors.green + colors.bright);
    } else {
      log(`\n⚠️ PUMPUSDT protection incomplete`, colors.yellow);
      if (slOrders.length === 0) log(`  Missing: Stop Loss`, colors.red);
      if (tpOrders.length === 0) log(`  Missing: Take Profit`, colors.red);
    }

  } catch (error: any) {
    log(`\n❌ Error: ${error?.message}`, colors.red);
    if (error?.response?.data) {
      console.error('API Error:', error.response.data);
    }
    console.error(error);
  }
}

// Run the test
placeProtectionSimple().catch(console.error);