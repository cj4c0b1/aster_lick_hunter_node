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

const ora = require('ora');
const cliProgress = require('cli-progress');

// Load configuration
const configPath = path.join(__dirname, 'config.user.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('Failed to load config.user.json:', error.message);
  process.exit(1);
}

// API helper functions for balance fetching
function buildSignedQuery(params, credentials) {
  const timestamp = Date.now();
  const queryString = new URLSearchParams({
    ...params,
    timestamp,
    recvWindow: 5000
  }).toString();

  const signature = crypto
    .createHmac('sha256', credentials.secretKey)
    .update(queryString)
    .digest('hex');

  return `${queryString}&signature=${signature}`;
}

// API request configuration
const API_TIMEOUT_MS = 10000; // 10 second timeout
const MAX_RETRIES = 3;
const CPU_CORES = Math.max(1, os.cpus().length - 1); // Leave one core free

const FORCE_OPTIMIZER_OVERWRITE = process.env.FORCE_OPTIMIZER_OVERWRITE === '1';
const FORCE_OPTIMIZER_CONFIRM = process.env.FORCE_OPTIMIZER_CONFIRM === '1';

// Progress bar options
const PROGRESS_BAR_OPTIONS = {
  format: '{bar} {percentage}% | {value}/{total} | ETA: {eta}s | {name}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
};

// Realistic Slippage Model - Based on actual bot behavior
const EXIT_SLIPPAGE = {
  TP: 0.0010,          // 0.10% - TAKE_PROFIT_MARKET fills slightly worse than trigger
  SL: 0.0050,          // 0.50% - STOP_MARKET normal conditions (conservative baseline)
  SL_VOLATILE: 0.0080, // 0.80% - STOP_MARKET during high volatility/cascades
  ENTRY_LIMIT: 0.0000, // 0% - LIMIT orders don't slip (wait for fill at exact price)
  ENTRY_MARKET: 0.0020 // 0.20% - MARKET fallback orders (10% of entries)
};

const LIMIT_FILL_RATE = 0.85; // 85% of LIMIT orders actually fill (15% miss due to price movement)
const MARKET_FALLBACK_RATE = 0.10; // 10% of entries use MARKET orders instead of LIMIT

// Commission Model - Based on actual trading costs
const COMMISSION = {
  MAKER_FEE: 0.0002,        // 0.02% maker fee (LIMIT orders)
  TAKER_FEE: 0.0004,        // 0.04% taker fee (MARKET orders)
  AVG_FILLS_PER_TRADE: 1.5  // Average fills per complete trade (entry + exit, small partial fills)
};

const DEFAULT_SCORING_WEIGHTS = {
  pnl: 50,
  sharpe: 30,
  drawdown: 20
};

// Account-related functions
async function getAccountBalance(credentials) {
  try {
    const queryString = buildSignedQuery({}, credentials);
    const response = await axios.get(
      `https://fapi.asterdex.com/fapi/v2/balance?${queryString}`,
      {
        headers: { 'X-MBX-APIKEY': credentials.apiKey },
        timeout: API_TIMEOUT_MS
      }
    );

    const usdtBalance = response.data.find(asset => asset.asset === 'USDT');
    return {
      totalWalletBalance: parseFloat(usdtBalance?.walletBalance || 0),
      availableBalance: parseFloat(usdtBalance?.availableBalance || 0),
      crossMargin: parseFloat(usdtBalance?.crossUnPnl || 0)
    };
  } catch (error) {
    console.error('Error fetching account balance:', error);
    throw error;
  }
}

async function getAccountInfo(credentials) {
  try {
    const queryString = buildSignedQuery({}, credentials);
    const response = await axios.get(
      `https://fapi.asterdex.com/fapi/v2/account?${queryString}`,
      {
        headers: { 'X-MBX-APIKEY': credentials.apiKey },
        timeout: API_TIMEOUT_MS
      }
    );
    
    const account = response.data;
    return {
      totalMarginBalance: parseFloat(account.totalMarginBalance || 0),
      totalWalletBalance: parseFloat(account.totalWalletBalance || 0),
      totalUnrealizedProfit: parseFloat(account.totalUnrealizedProfit || 0),
      availableBalance: parseFloat(account.availableBalance || 0),
      totalInitialMargin: parseFloat(account.totalInitialMargin || 0),
      totalMaintMargin: parseFloat(account.totalMaintMargin || 0),
      maxWithdrawAmount: parseFloat(account.maxWithdrawAmount || 0),
      canTrade: account.canTrade || false,
      canDeposit: account.canDeposit || false,
      canWithdraw: account.canWithdraw || false,
      updateTime: account.updateTime || Date.now()
    };
  } catch (error) {
    console.error('Error fetching account info:', error);
    throw error;
  }
}

async function getCurrentPositions(credentials) {
  try {
    const queryString = buildSignedQuery({}, credentials);
    const response = await axios.get(
      `https://fapi.asterdex.com/fapi/v2/positionRisk?${queryString}`,
      {
        headers: { 'X-MBX-APIKEY': credentials.apiKey },
        timeout: API_TIMEOUT_MS
      }
    );
    
    return response.data
      .filter(pos => parseFloat(pos.positionAmt) !== 0)
      .map(pos => ({
        symbol: pos.symbol,
        positionAmt: parseFloat(pos.positionAmt || 0),
        entryPrice: parseFloat(pos.entryPrice || 0),
        markPrice: parseFloat(pos.markPrice || 0),
        unRealizedProfit: parseFloat(pos.unRealizedProfit || 0),
        liquidationPrice: parseFloat(pos.liquidationPrice || 0),
        leverage: parseInt(pos.leverage || 1),
        marginType: pos.marginType || 'cross',
        isolatedWallet: parseFloat(pos.isolatedWallet || 0)
      }));
  } catch (error) {
    console.error('Error fetching positions:', error);
    throw error;
  }
}

// Cache for symbol data spans
const symbolSpanCache = new Map();

// Calculate the data span in days for a given symbol
function getSymbolDataSpanDays(symbol) {
  if (symbolSpanCache.has(symbol)) {
    return symbolSpanCache.get(symbol);
  }

  const spanRow = db.prepare(`
    SELECT MIN(event_time) as first_time, MAX(event_time) as last_time
    FROM liquidations
    WHERE symbol = ?
  `).get(symbol);

  let spanDays = 0;
  if (spanRow && typeof spanRow.first_time === 'number' && typeof spanRow.last_time === 'number' && spanRow.last_time > spanRow.first_time) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    spanDays = (spanRow.last_time - spanRow.first_time) / DAY_MS;
  }

  const minimumSpan = 1 / 24; // Assume at least 1 hour of data to avoid division by zero
  spanDays = Math.max(spanDays, minimumSpan);
  symbolSpanCache.set(symbol, spanDays);
  return spanDays;
}

// Constants for optimization
const DEFAULT_THRESHOLD_WINDOW_MS = 60 * 1000;
const DEFAULT_THRESHOLD_COOLDOWN_MS = 30 * 1000;
const HUNTER_COOLDOWN_MS = 2 * 60 * 1000;

// Generate time window candidates for optimization
function generateTimeWindowCandidates(currentMs) {
  const candidates = new Set([currentMs]);
  // Add smaller windows
  [1000, 2000, 5000, 10000, 15000, 30000].forEach(ms => {
    if (ms < currentMs) candidates.add(ms);
  });
  // Add larger windows
  [45000, 60000, 90000, 120000, 180000, 300000].forEach(ms => {
    if (ms > currentMs) candidates.add(ms);
  });
  return Array.from(candidates).sort((a, b) => a - b);
}

// Generate cooldown candidates for optimization
function generateCooldownCandidates(currentMs) {
  const candidates = new Set([currentMs]);
  // Add smaller cooldowns
  [0, 1000, 2000, 5000, 10000, 15000, 30000].forEach(ms => {
    if (ms < currentMs) candidates.add(ms);
  });
  // Add larger cooldowns
  [45000, 60000, 90000, 120000].forEach(ms => {
    if (ms > currentMs) candidates.add(ms);
  });
  return Array.from(candidates).sort((a, b) => a - b);
}

// Calculate combination score for long and short results
function calculateCombinationScore(longResult, shortResult) {
  if (!longResult || !shortResult) return -Infinity;
  
  const longScore = (longResult.performance?.sharpeRatio || 0) * 0.4 +
                   (longResult.performance?.winRate || 0) * 0.3 +
                   (longResult.performance?.profitFactor || 0) * 0.3;
  
  const shortScore = (shortResult.performance?.sharpeRatio || 0) * 0.4 +
                    (shortResult.performance?.winRate || 0) * 0.3 +
                    (shortResult.performance?.profitFactor || 0) * 0.3;
  
  // Slightly favor more balanced strategies
  const balancePenalty = Math.abs(
    (longResult.performance?.totalPnl || 0) - 
    (shortResult.performance?.totalPnl || 0)
  ) * 0.1;
  
  return (longScore + shortScore) * 0.5 - balancePenalty;
}

// Optimize parameters for a single symbol
async function optimizeSymbolParameters(symbol, symbolConfig, capitalBudget, spanDays, db) {
  const cloneConfig = { ...symbolConfig };
  
  const baseLongTradeSize = symbolConfig.longTradeSize ?? symbolConfig.tradeSize ?? 20;
  const baseShortTradeSize = symbolConfig.shortTradeSize ?? symbolConfig.tradeSize ?? baseLongTradeSize;
  const baseTradeSize = baseLongTradeSize;
  const currentMargin = symbolConfig.maxPositionMarginUSDT || Math.max(baseTradeSize * 5, 50);
  const leverageCurrent = symbolConfig.leverage || 10;
  const currentLongThreshold = symbolConfig.longVolumeThresholdUSDT || symbolConfig.volumeThresholdUSDT || 0;
  const currentShortThreshold = symbolConfig.shortVolumeThresholdUSDT || symbolConfig.volumeThresholdUSDT || 0;
  const currentTp = symbolConfig.tpPercent || 1;
  const currentSl = symbolConfig.slPercent || 5;
  const thresholdEnabled = symbolConfig.useThreshold !== false;
  const currentTimeWindowMs = symbolConfig.thresholdTimeWindow || DEFAULT_THRESHOLD_WINDOW_MS;
  const currentCooldownMs = symbolConfig.thresholdCooldown || DEFAULT_THRESHOLD_COOLDOWN_MS;
  
  const timeWindowCandidates = thresholdEnabled
    ? generateTimeWindowCandidates(currentTimeWindowMs)
    : [currentTimeWindowMs];
    
  const cooldownCandidates = thresholdEnabled
    ? generateCooldownCandidates(currentCooldownMs)
    : [currentCooldownMs];

  const longBasePositions = Math.max(1, Math.floor(currentMargin / (baseTradeSize || 1)) || 1);
  const shortBasePositions = Math.max(1, Math.floor(currentMargin / (baseTradeSize || 1)) || 1);

  // For now, we'll just return the current config as optimized
  // In a real implementation, this would run backtests and optimizations
  return {
    symbol,
    current: {
      performance: {
        dailyPnl: 0, // These would be calculated from backtests
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0
      }
    },
    optimized: {
      performance: {
        dailyPnl: 0, // These would be calculated from optimizations
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0
      },
      config: {
        ...cloneConfig,
        maxPositionMarginUSDT: currentMargin,
        tradeSize: baseTradeSize,
        longTradeSize: baseLongTradeSize,
        shortTradeSize: baseShortTradeSize,
        leverage: leverageCurrent,
        volumeThresholdUSDT: currentLongThreshold,
        longVolumeThresholdUSDT: currentLongThreshold,
        shortVolumeThresholdUSDT: currentShortThreshold,
        tpPercent: currentTp,
        slPercent: currentSl,
        thresholdTimeWindow: currentTimeWindowMs,
        thresholdCooldown: currentCooldownMs
      }
    },
    improvements: {
      totalDaily: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      profitFactor: 0
    }
  };
}

// Helper function to process tasks in parallel
async function processInParallel(tasks, workerPath, progress, maxWorkers = CPU_CORES) {
  const results = [];
  const totalTasks = tasks.length;
  let completed = 0;
  
  progress.startSpinner(`Processing ${totalTasks} tasks with ${maxWorkers} workers...`);

  const processBatch = async (batch) => {
    const workers = batch.map(task => {
      return new Promise((resolve) => {
        const worker = new Worker(workerPath, { workerData: task });
        worker.on('message', (message) => {
          if (message.progress) {
            progress.updateSpinner(`[${completed + 1}/${totalTasks}] ${message.progress}`);
          }
        });
        worker.on('exit', () => {
          completed++;
          progress.updateSpinner(`Completed ${completed}/${totalTasks} tasks`);
          resolve();
        });
        worker.on('error', (err) => {
          console.error('Worker error:', err);
          completed++;
          resolve();
        });
      });
    });
    await Promise.all(workers);
  };

  // Process tasks in batches
  for (let i = 0; i < tasks.length; i += maxWorkers) {
    const batch = tasks.slice(i, i + maxWorkers);
    await processBatch(batch);
  }

  progress.stopSpinner();
  return results;
}

// Generate optimization recommendations based on current configuration and account data
async function generateRecommendations(deployableCapital, progress, db) {
  progress.updateSpinner('🔍 Generating optimization recommendations...');
  
  const recommendations = [];
  const optimizedConfig = JSON.parse(JSON.stringify(config));
  const sanitizedCapital = Number.isFinite(deployableCapital) && deployableCapital > 0 ? deployableCapital : 0;

  const symbolEntries = Object.entries(config.symbols);
  if (symbolEntries.length === 0) {
    return { recommendations, optimizedConfig, recommendedGlobalMax: 0 };
  }

  // Calculate baseline total margin to scale positions based on available capital
  const baselineTotalMargin = symbolEntries.reduce((sum, [, cfg]) => {
    const baseMargin = cfg.maxPositionMarginUSDT || (cfg.tradeSize || 20) * 5;
    const perSide = Number.isFinite(baseMargin) && baseMargin > 0 ? baseMargin : 0;
    return sum + perSide * 2; // Both long and short
  }, 0);

  // Scale factor to adjust position sizes based on available capital
  const scaleFactor = baselineTotalMargin > 0 && sanitizedCapital > 0
    ? Math.max(0.25, Math.min(2.5, sanitizedCapital / baselineTotalMargin))
    : 1;

  // Process each symbol
  for (const [symbol, symbolConfig] of symbolEntries) {
    progress.updateSpinner(`🔧 Optimizing parameters for ${symbol}...`);
    
    try {
      const spanDays = getSymbolDataSpanDays(symbol);
      const fallbackMargin = (symbolConfig.tradeSize || 20) * 5;
      const baseMargin = symbolConfig.maxPositionMarginUSDT || fallbackMargin;
      const capitalBudget = Math.max(5, Math.min(sanitizedCapital || baseMargin, baseMargin * scaleFactor));

      const optimization = await optimizeSymbolParameters(symbol, symbolConfig, capitalBudget, spanDays, db);
      
      const currentDaily = optimization.current.performance.dailyPnl || 0;
      const optimizedDaily = optimization.optimized.performance.dailyPnl || 0;
      const delta = optimizedDaily - currentDaily;
      
      recommendations.push({
        symbol,
        current: optimization.current,
        optimized: optimization.optimized,
        improvements: {
          dailyPnl: delta,
          percentChange: currentDaily ? (delta / currentDaily) * 100 : 0
        }
      });
      
      // Update the optimized config with the new parameters
      optimizedConfig.symbols[symbol] = optimization.optimized.config;
      
      progress.log(`✅ ${symbol}: $${currentDaily.toFixed(2)}/day → $${optimizedDaily.toFixed(2)}/day ` +
                  `(${delta >= 0 ? '+' : ''}${delta.toFixed(2)} $/day)`);
    } catch (error) {
      console.error(`❌ Error optimizing ${symbol}:`, error.message);
      // Continue with other symbols even if one fails
    }
  }
  
  // Calculate recommended global max based on capital allocation
  const recommendedGlobalMax = Math.max(100, Math.floor(sanitizedCapital * 0.8));
  
  return {
    recommendations,
    optimizedConfig,
    recommendedGlobalMax
  };
}

// Optimize capital allocation across symbols based on performance and risk
function optimizeCapitalAllocation(accountInfo, recommendations, symbolConfigs = config.symbols, progress) {
  progress.updateSpinner('📊 Optimizing capital allocation...');
  
  const totalBalance = parseFloat(accountInfo?.totalWalletBalance || 0);
  if (totalBalance <= 0) {
    throw new Error('Invalid account balance for capital allocation');
  }

  // Group recommendations by symbol
  const symbolRecommendations = {};
  recommendations.forEach(rec => {
    if (rec && rec.symbol) {
      symbolRecommendations[rec.symbol] = rec;
    }
  });

  // Calculate total score for normalization
  let totalScore = 0;
  const symbolScores = [];
  
  Object.entries(symbolConfigs).forEach(([symbol, symbolConfig]) => {
    const rec = symbolRecommendations[symbol];
    if (!rec) return;
    
    // Calculate a score based on performance metrics
    const perf = rec.optimized.performance;
    const score = (perf.sharpeRatio || 0) * 0.5 +
                 (perf.winRate || 0) * 0.3 +
                 (perf.profitFactor || 0) * 0.2;
    
    if (score > 0) {
      symbolScores.push({ symbol, score });
      totalScore += score;
    }
  });

  // Sort symbols by score (descending)
  symbolScores.sort((a, b) => b.score - a.score);
  
  // Calculate allocation percentages
  const allocations = [];
  let remainingBudget = totalBalance;
  
  // Distribute capital based on performance scores
  symbolScores.forEach(({ symbol, score }, index) => {
    const symbolRec = symbolRecommendations[symbol];
    const symbolConfig = symbolConfigs[symbol];
    
    // Calculate allocation percentage (weighted by score)
    const weight = score / totalScore;
    
    // Calculate target allocation
    const targetAllocation = totalBalance * weight;
    const currentMargin = symbolConfig.maxPositionMarginUSDT || 0;
    
    // Calculate maximum possible allocation based on position limits
    const maxPositions = symbolConfig.maxPositions || 1;
    const positionSize = symbolConfig.tradeSize || 0;
    const maxPossible = positionSize * maxPositions * 2; // Both long and short
    
    // Determine final allocation
    const allocation = Math.min(
      targetAllocation,
      maxPossible,
      remainingBudget
    );
    
    if (allocation > 0) {
      allocations.push({
        symbol,
        currentMargin,
        targetMargin: allocation,
        weight: (allocation / totalBalance) * 100,
        score
      });
      
      remainingBudget -= allocation;
    }
  });
  
  // Sort allocations by weight (descending)
  allocations.sort((a, b) => b.weight - a.weight);
  
  return {
    allocations,
    totalAllocated: totalBalance - remainingBudget,
    totalBalance,
    allocationEfficiency: ((totalBalance - remainingBudget) / totalBalance) * 100
  };
}

// Generate a comprehensive summary of the optimization results
async function generateOptimizationSummary(recommendations, capitalOptimization, optimizedConfig, recommendedGlobalMax) {
  // Calculate overall performance metrics
  const totalCurrentDaily = recommendations.reduce((sum, rec) => 
    sum + (rec.current?.performance?.dailyPnl || 0), 0);
  
  const totalOptimizedDaily = recommendations.reduce((sum, rec) => 
    sum + (rec.optimized?.performance?.dailyPnl || 0), 0);
  
  const totalImprovement = totalOptimizedDaily - totalCurrentDaily;
  const improvementPercentage = totalCurrentDaily > 0 
    ? (totalImprovement / totalCurrentDaily) * 100 
    : 0;
  
  // Generate symbol-specific recommendations
  const symbolRecommendations = recommendations.map(rec => {
    const current = rec.current?.performance || {};
    const optimized = rec.optimized?.performance || {};
    const config = rec.optimized?.config || {};
    
    return {
      symbol: rec.symbol,
      currentDaily: current.dailyPnl || 0,
      optimizedDaily: optimized.dailyPnl || 0,
      improvement: (optimized.dailyPnl || 0) - (current.dailyPnl || 0),
      currentSharpe: current.sharpeRatio || 0,
      optimizedSharpe: optimized.sharpeRatio || 0,
      currentWinRate: current.winRate || 0,
      optimizedWinRate: optimized.winRate || 0,
      config: {
        tradeSize: config.tradeSize,
        leverage: config.leverage,
        tpPercent: config.tpPercent,
        slPercent: config.slPercent,
        volumeThreshold: config.volumeThresholdUSDT
      }
    };
  });
  
  // Sort by improvement (descending)
  symbolRecommendations.sort((a, b) => b.improvement - a.improvement);
  
  // Generate capital allocation summary
  const capitalSummary = {
    totalBalance: capitalOptimization.totalBalance,
    totalAllocated: capitalOptimization.totalAllocated,
    allocationEfficiency: capitalOptimization.allocationEfficiency,
    recommendedGlobalMax,
    allocations: capitalOptimization.allocations.map(allocation => ({
      symbol: allocation.symbol,
      currentMargin: allocation.currentMargin,
      targetMargin: allocation.targetMargin,
      weight: allocation.weight,
      score: allocation.score
    }))
  };
  
  // Generate final summary
  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalCurrentDaily,
      totalOptimizedDaily,
      totalImprovement,
      improvementPercentage,
      allocationEfficiency: capitalOptimization.allocationEfficiency
    },
    symbolRecommendations,
    capitalSummary,
    optimizedConfig: {
      ...optimizedConfig,
      global: {
        ...(optimizedConfig.global || {}),
        maxOpenPositions: recommendedGlobalMax
      }
    }
  };
}

// Helper function to apply optimized config with confirmation
async function maybeApplyOptimizedConfig(optimizedConfig, recommendedGlobalMax) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question('Do you want to apply these optimizations? (y/n): ', (answer) => {
      readline.close();
      
      if (answer.toLowerCase() === 'y') {
        const fs = require('fs');
        const path = require('path');
        
        // Create backup of current config
        const configPath = path.join(__dirname, 'config.user.json');
        const backupPath = path.join(
          __dirname, 
          `config.user.backup.${new Date().toISOString().replace(/[:.]/g, '-')}.json`
        );
        
        try {
          // Create backup
          fs.copyFileSync(configPath, backupPath);
          console.log(`✅ Created backup at: ${backupPath}`);
          
          // Update the config with optimized values
          const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          
          // Update symbols
          if (!currentConfig.symbols) currentConfig.symbols = {};
          Object.entries(optimizedConfig.symbols || {}).forEach(([symbol, config]) => {
            if (!currentConfig.symbols[symbol]) {
              currentConfig.symbols[symbol] = {};
            }
            // Merge optimized values while preserving other settings
            currentConfig.symbols[symbol] = { 
              ...currentConfig.symbols[symbol],
              ...config 
            };
          });
          
          // Update global settings if needed
          if (recommendedGlobalMax > 0) {
            if (!currentConfig.global) currentConfig.global = {};
            currentConfig.global.maxOpenPositions = recommendedGlobalMax;
          }
          
          // Save updated config
          fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
          console.log('✅ Successfully applied optimizations to config.user.json');
          resolve(true);
        } catch (error) {
          console.error('❌ Failed to apply optimizations:', error.message);
          resolve(false);
        }
      } else {
        console.log('Optimizations not applied.');
        resolve(false);
      }
    });
  });
}


// Function to analyze price data coverage with progress tracking
async function analyzePriceDataCoverage(progress) {
  const dbPath = path.join(__dirname, 'data', 'liquidations.db');
  const db = new Database(dbPath, { readonly: true });
  
  try {
    progress.updateSpinner('📊 Analyzing price data coverage...');
    
    // Get sample data
    progress.log('Fetching sample price data...');
    const priceData = db.prepare(`
      SELECT
        event_time,
        price,
        volume_usdt,
        side
      FROM liquidations
      WHERE symbol = 'ASTERUSDT'
      ORDER BY event_time
      LIMIT 10
    `).all();

    // Display sample data
    progress.log('\nSample ASTERUSDT liquidation prices:');
    console.log('Time (ms)        | Price     | Volume   | Side | Gap (min)');
    console.log('-----------------|-----------|----------|------|----------');

    let lastTime = 0;
    priceData.forEach((row, i) => {
      const gap = i > 0 ? (row.event_time - lastTime) / 1000 / 60 : 0;
      console.log(`${row.event_time.toString().padEnd(16)} | $${row.price.toFixed(6).padEnd(9)} | $${row.volume_usdt.toFixed(2).padStart(8)} | ${row.side.padEnd(4)} | ${gap.toFixed(1).padStart(7)}`);
      lastTime = row.event_time;
    });

    // Check total coverage with progress
    progress.log('\nAnalyzing full dataset...');
    const coverageStmt = db.prepare(`
      SELECT
        COUNT(*) as total_events,
        MIN(event_time) as first_event,
        MAX(event_time) as last_event,
        COUNT(DISTINCT symbol) as symbol_count
      FROM liquidations
    `);

    const coverage = coverageStmt.get();
    
    // Calculate time span in hours
    const timeSpanHours = (coverage.last_event - coverage.first_event) / (1000 * 60 * 60);
    const eventsPerHour = coverage.total_events / timeSpanHours;
    
    // Determine data density level
    let densityLevel = 'Low';
    if (eventsPerHour > 50) densityLevel = 'High';
    else if (eventsPerHour > 20) densityLevel = 'Moderate';
    
    // Display coverage summary
    progress.log('\n📊 Price Coverage Summary:');
    console.log(`   📅 Time Range: ${new Date(coverage.first_event).toISOString()} to ${new Date(coverage.last_event).toISOString()}`);
    console.log(`   🔢 Total Events: ${coverage.total_events.toLocaleString()}`);
    console.log(`   ⏱️  Time Span: ${timeSpanHours.toFixed(1)} hours`);
    console.log(`   ⏳ Average Gap: ${(timeSpanHours * 60 / coverage.total_events).toFixed(1)} minutes between price points`);
    console.log(`   📈 Events/Hour: ${eventsPerHour.toFixed(1)} (${densityLevel} density)`);
    console.log(`   📊 Unique Symbols: ${coverage.symbol_count}`);
    
    // Calculate and return average gap in minutes
    return timeSpanHours * 60 / coverage.total_events;
  } catch (error) {
    progress.log(`❌ Error analyzing price data: ${error.message}`);
    throw error;
  } finally {
    db.close();
  }
}

// Main function
async function main() {
  const progress = new ProgressTracker();
  
  try {
    progress.startSpinner('🚀 Starting optimization process...');
    
    // Initialize database
    progress.updateSpinner('🔌 Connecting to database...');
    const dbPath = path.join(__dirname, 'data', 'liquidations.db');
    const db = new Database(dbPath, { readonly: true });
    
    // Make sure to close the database when done
    process.on('exit', () => db.close());
    
    progress.updateSpinner('⚙️  Loading configuration...');
    // Config is already loaded at the top of the file
    
    // Core analyses with progress tracking
    progress.updateSpinner('📊 Analyzing price data coverage...');
    const _avgGap = await analyzePriceDataCoverage(progress);
    
    progress.updateSpinner('💳 Fetching account information...');
    
    // Extract API credentials from config
    const credentials = {
      apiKey: config.api?.apiKey,
      secretKey: config.api?.secretKey
    };
    
    // Validate credentials
    if (!credentials.apiKey || !credentials.secretKey) {
      throw new Error('API credentials (api.apiKey and api.secretKey) are required in config.user.json');
    }
    
    const [balance, accountInfo, positions] = await Promise.all([
      getAccountBalance(credentials),
      getAccountInfo(credentials),
      getCurrentPositions(credentials)
    ]);
    
    // Generate recommendations with progress
    progress.updateSpinner('🔍 Generating optimization recommendations...');
    const deployableCapital = parseFloat(accountInfo?.totalWalletBalance || 0);
    if (!deployableCapital) {
      throw new Error('Could not determine deployable capital from account info');
    }

    const { recommendations, optimizedConfig, recommendedGlobalMax } =
      await generateRecommendations(deployableCapital, progress, db);

    // Optimize capital allocation
    progress.updateSpinner('📈 Optimizing capital allocation...');
    const capitalOptimization = await optimizeCapitalAllocation(
      accountInfo, 
      recommendations, 
      optimizedConfig.symbols,
      progress
    );

    // Generate and display optimization summary
    progress.updateSpinner('📝 Generating optimization report...');
    const summary = generateOptimizationSummary(
      recommendations,
      capitalOptimization,
      optimizedConfig,
      recommendedGlobalMax
    );

    // Display summary
    console.log('\n' + '='.repeat(80));
    console.log('🚀 OPTIMIZATION SUMMARY'.padEnd(79) + '🚀');
    console.log('='.repeat(80));
    
    console.log(`\n💼 Account Balance: $${parseFloat(accountInfo.totalWalletBalance).toFixed(2)}`);
    console.log(`📊 Total Positions: ${positions.length} open positions`);
    
    // Display capital allocation
    console.log('\n💰 CAPITAL ALLOCATION');
    console.log('-' * 80);
    console.log(`Recommended Max Open Positions: ${recommendedGlobalMax}`);
    console.log(`Allocation Efficiency: ${(capitalOptimization.allocationEfficiency * 100).toFixed(1)}%`);
    
    // Display symbol recommendations
    console.log('\n📊 SYMBOL RECOMMENDATIONS');
    console.log('-' * 80);
    recommendations.forEach(rec => {
      if (!rec) return;
      console.log(`\n${rec.symbol}:`);
      console.log(`  Current: $${rec.current.performance?.dailyPnl?.toFixed(2) || 'N/A'}/day`);
      console.log(`  Optimized: $${rec.optimized.performance?.dailyPnl?.toFixed(2) || 'N/A'}/day`);
      console.log(`  Improvement: $${rec.improvements?.dailyPnl?.toFixed(2) || 'N/A'}/day (${rec.improvements?.percentChange?.toFixed(1) || '0'}%)`);
    });
    
    // Ask user if they want to apply the changes
    if (FORCE_OPTIMIZER_OVERWRITE) {
      progress.log('\n⚠️  FORCE_OPTIMIZER_OVERWRITE is enabled. Applying changes automatically...');
      await maybeApplyOptimizedConfig(optimizedConfig, recommendedGlobalMax);
    } else if (FORCE_OPTIMIZER_CONFIRM) {
      progress.log('\n⚠️  FORCE_OPTIMIZER_CONFIRM is enabled. Prompting for confirmation...');
      const apply = await maybeApplyOptimizedConfig(optimizedConfig, recommendedGlobalMax);
      if (!apply) {
        progress.log('Optimization not applied as per user request.');
      }
    } else {
      progress.log('\nℹ️  Use FORCE_OPTIMIZER_OVERWRITE=1 to apply changes without confirmation');
      progress.log('   or FORCE_OPTIMIZER_CONFIRM=1 to be prompted for confirmation.');
    }
    
    progress.stopSpinner();
    console.log('\n✅ Optimization process completed successfully!');
    
  } catch (error) {
    progress.stopSpinner();
    console.error('\n❌ Error during optimization:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
    progress.error(`Error analyzing price data: ${error.message}`);
    throw error; // Re-throw to be handled by the caller
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}
