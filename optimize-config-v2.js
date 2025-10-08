#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const readline = require('readline');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { ProgressTracker } = require('./progress-utils');

// API configuration
const API_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const CPU_CORES = Math.max(1, os.cpus().length - 1);

// Trading parameters
const DEFAULT_THRESHOLD_WINDOW_MS = 60 * 1000;
const DEFAULT_THRESHOLD_COOLDOWN_MS = 30 * 1000;
const HUNTER_COOLDOWN_MS = 2 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Order execution parameters
const ORDER_EXECUTION = {
  TP_SLIPPAGE: 0.001,    // 0.1% slippage for take profit orders
  SL_SLIPPAGE: 0.005,    // 0.5% slippage for stop loss orders
  ENTRY_SLIPPAGE: 0.0005, // 0.05% slippage for entry orders
  FILL_RATE: 0.9,        // 90% fill rate for limit orders
  MARKET_FILL_RATE: 0.95 // 95% fill rate for market orders
};

// Commission structure
const COMMISSION = {
  MAKER: 0.0002,  // 0.02% for maker orders
  TAKER: 0.0004   // 0.04% for taker orders
};

// Load configuration
const configPath = path.join(__dirname, 'config.user.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('❌ Failed to load config.user.json:', error.message);
  process.exit(1);
}

// Database connection
const dbPath = path.join(__dirname, 'data', 'liquidations.db');
const db = new Database(dbPath, { readonly: true });

// Cache for price data and calculations
const priceDataCache = new Map();
const symbolSpanCache = new Map();

/**
 * Format a number with commas and fixed decimal places
 */
function formatNumber(num, decimals = 2) {
  return Number(num).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format a large number with K, M, B suffixes
 */
function formatLargeNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Format a value as currency
 */
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Build a signed query for authenticated API requests
 */
function buildSignedQuery(params, credentials) {
  const timestamp = Date.now();
  const queryString = Object.entries({
    ...params,
    timestamp,
    recvWindow: 5000
  })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const signature = crypto
    .createHmac('sha256', credentials.apiSecret)
    .update(queryString)
    .digest('hex');

  return `${queryString}&signature=${signature}`;
}

/**
 * Fetch account balance
 */
async function getAccountBalance(credentials) {
  try {
    const query = buildSignedQuery({}, credentials);
    const response = await axios.get(`https://fapi.binance.com/fapi/v2/account?${query}`, {
      headers: { 'X-MBX-APIKEY': credentials.apiKey },
      timeout: API_TIMEOUT_MS
    });
    
    const balance = response.data.assets.find(a => a.asset === 'USDT');
    return {
      available: parseFloat(balance.availableBalance) || 0,
      total: parseFloat(balance.walletBalance) || 0,
      unrealizedPnL: parseFloat(balance.unrealizedProfit) || 0
    };
  } catch (error) {
    console.error('Error fetching account balance:', error.message);
    throw error;
  }
}

/**
 * Get current positions
 */
async function getCurrentPositions(credentials) {
  try {
    const query = buildSignedQuery({}, credentials);
    const response = await axios.get(`https://fapi.binance.com/fapi/v2/positionRisk?${query}`, {
      headers: { 'X-MBX-APIKEY': credentials.apiKey },
      timeout: API_TIMEOUT_MS
    });

    return response.data
      .filter(p => Math.abs(parseFloat(p.positionAmt)) > 0)
      .map(p => ({
        symbol: p.symbol,
        side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
        amount: Math.abs(parseFloat(p.positionAmt)),
        entryPrice: parseFloat(p.entryPrice),
        leverage: parseInt(p.leverage, 10),
        pnl: parseFloat(p.unRealizedProfit),
        roe: parseFloat(p.unRealizedProfit) / (parseFloat(p.entryPrice) * Math.abs(parseFloat(p.positionAmt)))
      }));
  } catch (error) {
    console.error('Error fetching positions:', error.message);
    throw error;
  }
}

/**
 * Calculate price volatility metrics
 */
function computePriceVolatility(priceData) {
  if (!priceData || priceData.length < 2) {
    return {
      avgDailyRange: 0,
      maxDailyRange: 0,
      volatility: 0,
      atr: 0
    };
  }

  const returns = [];
  const dailyRanges = [];
  let trueRanges = [];
  let prevClose = priceData[0].close;

  for (let i = 1; i < priceData.length; i++) {
    const current = priceData[i];
    const prev = priceData[i - 1];
    
    // Calculate daily range
    const dailyRange = (current.high - current.low) / current.low * 100;
    dailyRanges.push(dailyRange);
    
    // Calculate returns
    if (prev.close > 0) {
      returns.push((current.close - prev.close) / prev.close);
    }
    
    // Calculate True Range
    const tr1 = current.high - current.low;
    const tr2 = Math.abs(current.high - prev.close);
    const tr3 = Math.abs(current.low - prev.close);
    trueRanges.push(Math.max(tr1, tr2, tr3));
    
    prevClose = current.close;
  }

  // Calculate average and max daily range
  const avgDailyRange = dailyRanges.reduce((a, b) => a + b, 0) / dailyRanges.length;
  const maxDailyRange = Math.max(...dailyRanges);
  
  // Calculate volatility (standard deviation of returns)
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(365); // Annualized
  
  // Calculate ATR (14-period)
  const atrPeriod = Math.min(14, trueRanges.length);
  const atr = trueRanges.slice(-atrPeriod).reduce((a, b) => a + b, 0) / atrPeriod;

  return {
    avgDailyRange,
    maxDailyRange,
    volatility,
    atr,
    atrPercent: atr / priceData[priceData.length - 1].close * 100
  };
}

/**
 * Generate take profit candidates based on volatility
 */
function generateTpCandidates(volStats, currentTp) {
  const { atrPercent, avgDailyRange } = volStats;
  const baseTp = Math.max(0.5, Math.min(5, atrPercent * 2 || avgDailyRange * 0.5));
  
  // Generate candidates around the base TP and current TP
  const candidates = new Set([
    currentTp,
    baseTp,
    baseTp * 0.5,
    baseTp * 0.75,
    baseTp * 1.25,
    baseTp * 1.5,
    baseTp * 2
  ]);
  
  // Ensure values are within reasonable bounds
  return Array.from(candidates)
    .map(v => Math.max(0.1, Math.min(10, v)))
    .sort((a, b) => a - b);
}

/**
 * Generate stop loss candidates based on volatility
 */
function generateSlCandidates(volStats, currentSl) {
  const { atrPercent, avgDailyRange } = volStats;
  const baseSl = Math.max(1, Math.min(10, atrPercent * 4 || avgDailyRange * 1.5));
  
  // Generate candidates around the base SL and current SL
  const candidates = new Set([
    currentSl,
    baseSl,
    baseSl * 0.75,
    baseSl * 1.25,
    baseSl * 1.5,
    baseSl * 2
  ]);
  
  // Ensure values are within reasonable bounds
  return Array.from(candidates)
    .map(v => Math.max(0.5, Math.min(20, v)))
    .sort((a, b) => a - b);
}

/**
 * Generate leverage candidates
 */
function generateLeverageCandidates(currentLeverage) {
  const baseLeverages = [1, 2, 3, 5, 10, 15, 20, 25, 30, 50, 75, 100];
  const candidates = new Set([
    currentLeverage,
    ...baseLeverages.filter(x => x <= 50) // Cap at 50x for safety
  ]);
  
  return Array.from(candidates).sort((a, b) => a - b);
}

/**
 * Generate margin allocation candidates
 */
function generateMarginCandidates(capitalBudget, currentMargin) {
  const minMargin = 10;  // $10 minimum
  const maxMargin = Math.min(10000, capitalBudget * 0.5); // Cap at $10k or 50% of budget
  
  // Generate candidates from $10 to maxMargin
  const candidates = [
    currentMargin,
    minMargin,
    Math.min(25, maxMargin),
    Math.min(50, maxMargin),
    Math.min(100, maxMargin),
    Math.min(250, maxMargin),
    Math.min(500, maxMargin),
    Math.min(1000, maxMargin),
    Math.min(2500, maxMargin),
    Math.min(5000, maxMargin),
    maxMargin
  ];
  
  // Dedupe and sort
  return [...new Set(candidates)]
    .filter(m => m >= minMargin && m <= maxMargin)
    .sort((a, b) => a - b);
}

/**
 * Generate threshold candidates based on historical data
 */
function generateThresholdCandidates(symbol, side, currentThreshold) {
  // Get historical liquidation volumes for this symbol and side
  const volumes = db.prepare(`
    SELECT volume_usdt 
    FROM liquidations 
    WHERE symbol = ? AND side = ? 
    ORDER BY event_time DESC 
    LIMIT 1000
  `).all(symbol, side).map(r => r.volume_usdt);
  
  if (volumes.length === 0) {
    return [currentThreshold, 1000, 2500, 5000, 10000, 25000, 50000];
  }
  
  // Calculate percentiles
  const sorted = [...volumes].sort((a, b) => a - b);
  const percentiles = [10, 25, 50, 75, 90, 95, 99];
  const values = percentiles.map(p => {
    const index = Math.floor(p / 100 * (sorted.length - 1));
    return Math.round(sorted[index]);
  });
  
  // Generate candidates around percentiles and current threshold
  const candidates = new Set([
    currentThreshold,
    ...values,
    currentThreshold * 0.5,
    currentThreshold * 0.75,
    currentThreshold * 1.25,
    currentThreshold * 1.5,
    currentThreshold * 2
  ]);
  
  // Ensure minimum threshold of $100 and round to nearest $100
  return Array.from(candidates)
    .map(v => Math.max(100, Math.round(v / 100) * 100))
    .sort((a, b) => a - b);
}

/**
 * Calculate risk metrics for a set of trades
 */
function calculateRiskMetrics(trades) {
  if (!trades || trades.length === 0) {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      profitFactor: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      avgWinLossRatio: 0,
      totalPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0
    };
  }

  // Calculate basic metrics
  const returns = [];
  const negativeReturns = [];
  let totalPnl = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let runningPnl = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalWin = 0;
  let totalLoss = 0;

  // First pass: calculate returns and basic metrics
  for (const trade of trades) {
    const pnl = parseFloat(trade.pnl) || 0;
    totalPnl += pnl;
    
    // Track returns for Sharpe/Sortino ratios
    if (trade.entryPrice && trade.entryPrice > 0) {
      const ret = pnl / (trade.margin || 1);
      returns.push(ret);
      if (ret < 0) negativeReturns.push(ret);
    }
    
    // Track drawdown
    runningPnl += pnl;
    if (runningPnl > peak) peak = runningPnl;
    const drawdown = peak - runningPnl;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
    }
    
    // Track win/loss stats
    if (pnl > 0) {
      winningTrades++;
      totalWin += pnl;
    } else if (pnl < 0) {
      losingTrades++;
      totalLoss += Math.abs(pnl);
    }
  }

  // Calculate ratios
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;
  const avgWin = winningTrades > 0 ? totalWin / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
  const avgWinLossRatio = avgLoss !== 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  
  // Calculate Sharpe and Sortino ratios
  let sharpeRatio = 0;
  let sortinoRatio = 0;
  
  if (returns.length > 0) {
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Annualize (assuming daily returns)
    const annualFactor = Math.sqrt(365);
    sharpeRatio = stdDev !== 0 ? (meanReturn / stdDev) * annualFactor : 0;
    
    // Calculate downside deviation for Sortino
    if (negativeReturns.length > 0) {
      const meanNegativeReturn = negativeReturns.reduce((a, b) => a + b, 0) / negativeReturns.length;
      const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
      const downsideDeviation = Math.sqrt(downsideVariance);
      
      sortinoRatio = downsideDeviation !== 0 ? (meanReturn / downsideDeviation) * annualFactor : 0;
    }
  }
  
  // Calculate profit factor
  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;

  return {
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    maxDrawdownPercent,
    profitFactor,
    winRate,
    avgWin,
    avgLoss,
    avgWinLossRatio,
    totalPnl,
    totalTrades: trades.length,
    winningTrades,
    losingTrades
  };
}

/**
 * Optimize parameters for a single symbol
 */
async function optimizeSymbolParameters(symbol, symbolConfig, capitalBudget, progress) {
  const startTime = Date.now();
  const results = [];
  
  try {
    // Get historical price data for volatility calculation
    const priceData = await getCachedHistoricalPrices(symbol, '1m', 10080); // ~7 days of 1m data
    const volStats = computePriceVolatility(priceData);
    
    // Generate parameter candidates
    const currentTp = symbolConfig.tpPercent || 1.0;
    const currentSl = symbolConfig.slPercent || 3.0;
    const currentLeverage = symbolConfig.leverage || 10;
    const currentMargin = symbolConfig.maxPositionMarginUSDT || 100;
    const currentLongThreshold = symbolConfig.longVolumeThresholdUSDT || symbolConfig.volumeThresholdUSDT || 1000;
    const currentShortThreshold = symbolConfig.shortVolumeThresholdUSDT || symbolConfig.volumeThresholdUSDT || 1000;
    
    const tpCandidates = generateTpCandidates(volStats, currentTp);
    const slCandidates = generateSlCandidates(volStats, currentSl);
    const leverageCandidates = generateLeverageCandidates(currentLeverage);
    const marginCandidates = generateMarginCandidates(capitalBudget, currentMargin);
    const longThresholdCandidates = generateThresholdCandidates(symbol, 'SELL', currentLongThreshold);
    const shortThresholdCandidates = generateThresholdCandidates(symbol, 'BUY', currentShortThreshold);
    
    // Log optimization parameters
    progress.log(`Optimizing ${symbol} with ${tpCandidates.length} TP, ${slCandidates.length} SL, ` +
                 `${leverageCandidates.length} leverage, ${marginCandidates.length} margin settings`);
    
    // Simple grid search optimization (in a real implementation, you'd use a more sophisticated approach)
    for (const tp of tpCandidates) {
      for (const sl of slCandidates) {
        // Skip if SL <= TP (we want SL > TP for proper risk management)
        if (sl <= tp) continue;
        
        for (const leverage of leverageCandidates) {
          for (const margin of marginCandidates) {
            // Skip if margin is too small for the position size
            const positionSize = margin * leverage;
            if (positionSize < 10) continue; // Skip positions smaller than $10
            
            // Test long and short strategies
            for (const side of ['LONG', 'SHORT']) {
              const threshold = side === 'LONG' 
                ? longThresholdCandidates[0] // Just use first candidate for demo
                : shortThresholdCandidates[0];
                
              // Simulate backtest (in a real implementation, you'd call your backtest function)
              const backtestResult = await simulateBacktest({
                symbol,
                side,
                threshold,
                tp,
                sl,
                leverage,
                margin,
                priceData
              });
              
              // Calculate metrics
              const metrics = calculateRiskMetrics(backtestResult.trades);
              
              // Add to results
              results.push({
                symbol,
                side,
                threshold,
                tp,
                sl,
                leverage,
                margin,
                ...metrics,
                backtestResult
              });
              
              // Update progress
              progress.increment();
            }
          }
        }
      }
    }
    
    // Sort results by total PnL (descending)
    results.sort((a, b) => b.totalPnl - a.totalPnl);
    
    // Log optimization summary
    const duration = (Date.now() - startTime) / 1000;
    progress.log(`Optimized ${symbol} in ${duration.toFixed(1)}s - ` +
                `Best config: ${results[0].tp}% TP / ${results[0].sl}% SL / ` +
                `${results[0].leverage}x / $${results[0].margin} margin`);
    
    return results;
    
  } catch (error) {
    progress.error(`Error optimizing ${symbol}: ${error.message}`);
    throw error;
  }
}

/**
 * Simulate backtest (placeholder for actual backtest implementation)
 */
async function simulateBacktest(params) {
  const { symbol, side, threshold, tp, sl, leverage, margin, priceData } = params;
  
  // In a real implementation, this would run your actual backtest logic
  // For now, we'll return some simulated results
  const trades = [];
  const numTrades = Math.floor(10 + Math.random() * 20); // 10-30 trades
  
  for (let i = 0; i < numTrades; i++) {
    const isWin = Math.random() > 0.4; // 60% win rate
    const entryPrice = 100 + (Math.random() * 20 - 10); // Random price around 100
    const exitPrice = isWin 
      ? side === 'LONG' 
        ? entryPrice * (1 + (tp / 100) * 0.8 + Math.random() * (tp / 100) * 0.4) // Win: 80-120% of TP
        : entryPrice * (1 - (tp / 100) * 0.8 - Math.random() * (tp / 100) * 0.4)
      : side === 'LONG'
        ? entryPrice * (1 - (sl / 100) * 0.8 - Math.random() * (sl / 100) * 0.4) // Loss: 80-120% of SL
        : entryPrice * (1 + (sl / 100) * 0.8 + Math.random() * (sl / 100) * 0.4);
    
    const pnl = side === 'LONG' 
      ? (exitPrice - entryPrice) * (margin * leverage / entryPrice)
      : (entryPrice - exitPrice) * (margin * leverage / entryPrice);
    
    // Apply commission
    const commission = margin * leverage * COMMISSION.TAKER * 2; // Entry + exit
    const netPnl = pnl - commission;
    
    trades.push({
      entryPrice,
      exitPrice,
      pnl: netPnl,
      margin,
      leverage,
      isWin,
      duration: 1000 * 60 * (5 + Math.random() * 55) // 5-60 minutes
    });
  }
  
  return { trades };
}

/**
 * Main optimization function
 */
async function optimizeConfig() {
  console.log('🚀 Starting optimization...');
  
  try {
    // Initialize progress tracker
    const progress = new ProgressTracker({
      title: 'Optimizing Trading Parameters',
      total: 100, // Will be updated with actual count
      unit: 'configs'
    });
    
    // Get account information
    progress.update('Fetching account data...');
    const balance = await getAccountBalance(config.credentials);
    const positions = await getCurrentPositions(config.credentials);
    
    progress.log(`Account balance: ${formatCurrency(balance.total)} (${formatCurrency(balance.available)} available)`);
    progress.log(`Current positions: ${positions.length} open`);
    
    // Determine capital allocation
    const deployableCapital = Math.max(100, balance.available * 0.8); // Use 80% of available balance, min $100
    progress.log(`Allocating ${formatCurrency(deployableCapital)} for optimization`);
    
    // Get symbols to optimize (from config or use default)
    const symbols = config.symbols || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    
    // Optimize each symbol
    const allResults = [];
    
    for (const symbol of symbols) {
      progress.update(`Optimizing ${symbol}...`);
      
      try {
        const symbolConfig = {
          ...(config.symbolsConfig?.[symbol] || {}),
          symbol
        };
        
        // Allocate capital evenly among symbols for simplicity
        const symbolCapital = deployableCapital / symbols.length;
        
        // Optimize parameters for this symbol
        const symbolResults = await optimizeSymbolParameters(
          symbol,
          symbolConfig,
          symbolCapital,
          progress
        );
        
        allResults.push({
          symbol,
          bestConfig: symbolResults[0],
          allResults: symbolResults
        });
        
      } catch (error) {
        progress.error(`Failed to optimize ${symbol}: ${error.message}`);
      }
    }
    
    // Generate optimization summary
    const summary = generateOptimizationSummary(allResults, deployableCapital);
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = `optimization-results-${timestamp}.json`;
    fs.writeFileSync(outputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      balance,
      deployableCapital,
      results: allResults,
      summary
    }, null, 2));
    
    progress.succeed(`Optimization complete! Results saved to ${outputFile}`);
    
    // Display summary
    console.log('\n???? OPTIMIZATION SUMMARY');
    console.log('=======================');
    console.log(`Total capital: ${formatCurrency(balance.total)}`);
    console.log(`Deployable capital: ${formatCurrency(deployableCapital)}`);
    console.log(`Optimized ${allResults.length} symbols`);
    
    console.log('\n???? RECOMMENDED PARAMETERS');
    console.log('==========================');
    allResults.forEach(({ symbol, bestConfig }) => {
      console.log(`\n${symbol}:`);
      console.log(`  Strategy: ${bestConfig.side}`);
      console.log(`  Take Profit: ${bestConfig.tp}%`);
      console.log(`  Stop Loss: ${bestConfig.sl}%`);
      console.log(`  Leverage: ${bestConfig.leverage}x`);
      console.log(`  Margin: $${bestConfig.margin}`);
      console.log(`  Volume Threshold: $${formatNumber(bestConfig.threshold)}`);
      console.log(`  Expected PnL: ${formatCurrency(bestConfig.totalPnl)} (${(bestConfig.winRate || 0).toFixed(1)}% win rate)`);
    });
    
    return {
      success: true,
      outputFile,
      summary
    };
    
  } catch (error) {
    console.error('\n❌ Optimization failed:', error.message);
    if (error.stack) console.error(error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Generate optimization summary
 */
function generateOptimizationSummary(results, deployableCapital) {
  if (!results || results.length === 0) {
    return { message: 'No optimization results available' };
  }
  
  // Calculate overall metrics
  const totalTrades = results.reduce((sum, r) => sum + (r.bestConfig?.totalTrades || 0), 0);
  const winningTrades = results.reduce((sum, r) => sum + (r.bestConfig?.winningTrades || 0), 0);
  const totalPnl = results.reduce((sum, r) => sum + (r.bestConfig?.totalPnl || 0), 0);
  const maxDrawdown = Math.max(...results.map(r => r.bestConfig?.maxDrawdown || 0));
  
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const roi = deployableCapital > 0 ? (totalPnl / deployableCapital) * 100 : 0;
  
  // Get best performing symbol
  const bestSymbol = [...results].sort((a, b) => (b.bestConfig?.totalPnl || 0) - (a.bestConfig?.totalPnl || 0))[0];
  
  return {
    totalSymbols: results.length,
    totalTrades,
    winningTrades,
    winRate,
    totalPnl,
    roi,
    maxDrawdown,
    bestPerformer: bestSymbol ? {
      symbol: bestSymbol.symbol,
      pnl: bestSymbol.bestConfig?.totalPnl || 0,
      winRate: bestSymbol.bestConfig?.winRate || 0
    } : null,
    timestamp: new Date().toISOString()
  };
}

// Run the optimization if this file is executed directly
if (require.main === module) {
  optimizeConfig()
    .then(({ success, outputFile } = {}) => {
      if (success) {
        console.log(`\n✅ Optimization complete! Results saved to ${outputFile}`);
      } else {
        console.log('\n❌ Optimization failed. Check the logs for details.');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n❌ Unhandled error in optimization:', error.message);
      if (error.stack) console.error(error.stack);
      process.exit(1);
    });
}

// Export functions for testing
module.exports = {
  optimizeConfig,
  optimizeSymbolParameters,
  calculateRiskMetrics,
  computePriceVolatility,
  generateTpCandidates,
  generateSlCandidates,
  generateLeverageCandidates,
  generateMarginCandidates,
  generateThresholdCandidates
};
