#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const readline = require('readline');

// ============================================================================
// ENHANCED: Progress Indicator System
// ============================================================================
class ProgressIndicator {
  constructor(total, label = 'Processing') {
    this.total = total;
    this.current = 0;
    this.label = label;
    this.startTime = Date.now();
    this.lastUpdate = 0;
  }

  update(increment = 1, details = '') {
    this.current += increment;
    const now = Date.now();

    // Update at most every 100ms to avoid console spam
    if (now - this.lastUpdate < 100 && this.current < this.total) {
      return;
    }

    this.lastUpdate = now;
    const percent = ((this.current / this.total) * 100).toFixed(1);
    const elapsed = ((now - this.startTime) / 1000).toFixed(1);
    const rate = this.current / ((now - this.startTime) / 1000);
    const eta = this.current > 0 ? ((this.total - this.current) / rate).toFixed(0) : '?';

    const bar = this.createBar(this.current, this.total, 30);

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      `\r📊 ${this.label}: ${bar} ${percent}% | ${this.current}/${this.total} | ⏱️ ${elapsed}s | ETA: ${eta}s ${details}`
    );

    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  createBar(current, total, width) {
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  complete() {
    this.current = this.total;
    this.update(0, '✓ Complete');
  }
}

// ============================================================================
// ENHANCED: Parallel Processing & Batch Operations
// ============================================================================
class BatchProcessor {
  constructor(batchSize = 100) {
    this.batchSize = batchSize;
  }

  async processBatch(items, processor, progressLabel = 'Processing') {
    const progress = new ProgressIndicator(items.length, progressLabel);
    const results = [];

    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, Math.min(i + this.batchSize, items.length));
      const batchResults = await Promise.all(batch.map(item => processor(item)));
      results.push(...batchResults);
      progress.update(batch.length);
    }

    progress.complete();
    return results;
  }
}

// ============================================================================
// ENHANCED: Optimized Cache with LRU eviction
// ============================================================================
class LRUCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
  }
}

// API request configuration
const API_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;

const FORCE_OPTIMIZER_OVERWRITE = process.env.FORCE_OPTIMIZER_OVERWRITE === '1';
const FORCE_OPTIMIZER_CONFIRM = process.env.FORCE_OPTIMIZER_CONFIRM === '1';

// Realistic Slippage Model
const EXIT_SLIPPAGE = {
  TP: 0.0010,
  SL: 0.0050,
  SL_VOLATILE: 0.0080,
  ENTRY_LIMIT: 0.0000,
  ENTRY_MARKET: 0.0020
};

const LIMIT_FILL_RATE = 0.85;
const MARKET_FALLBACK_RATE = 0.10;

const COMMISSION = {
  MAKER_FEE: 0.0002,
  TAKER_FEE: 0.0004,
  AVG_FILLS_PER_TRADE: 1.5
};

const DEFAULT_SCORING_WEIGHTS = {
  pnl: 50,
  sharpe: 30,
  drawdown: 20
};

function parseScoringWeights() {
  const parseWeight = (value, fallback) => {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return fallback;
    }

    return numeric;
  };

  const percent = {
    pnl: parseWeight(process.env.OPTIMIZER_WEIGHT_PNL, DEFAULT_SCORING_WEIGHTS.pnl),
    sharpe: parseWeight(process.env.OPTIMIZER_WEIGHT_SHARPE, DEFAULT_SCORING_WEIGHTS.sharpe),
    drawdown: parseWeight(process.env.OPTIMIZER_WEIGHT_DRAWDOWN, DEFAULT_SCORING_WEIGHTS.drawdown)
  };

  const total = percent.pnl + percent.sharpe + percent.drawdown;

  if (total <= 0) {
    const fallbackTotal = DEFAULT_SCORING_WEIGHTS.pnl + DEFAULT_SCORING_WEIGHTS.sharpe + DEFAULT_SCORING_WEIGHTS.drawdown;
    return {
      percent: { ...DEFAULT_SCORING_WEIGHTS },
      normalized: {
        pnl: DEFAULT_SCORING_WEIGHTS.pnl / fallbackTotal,
        sharpe: DEFAULT_SCORING_WEIGHTS.sharpe / fallbackTotal,
        drawdown: DEFAULT_SCORING_WEIGHTS.drawdown / fallbackTotal
      },
      isDefault: true
    };
  }

  return {
    percent,
    normalized: {
      pnl: percent.pnl / total,
      sharpe: percent.sharpe / total,
      drawdown: percent.drawdown / total
    },
    isDefault: false
  };
}

const scoringWeights = parseScoringWeights();
const normalizedScoringWeights = scoringWeights.normalized;

const formatWeightPercent = (value) => {
  if (!Number.isFinite(value)) {
    return '0%';
  }

  const rounded = Number(value.toFixed(1));
  if (Number.isInteger(rounded)) {
    return `${Math.trunc(rounded)}%`;
  }

  return `${rounded.toFixed(1)}%`;
};

// Connect to the database
const dbPath = path.join(__dirname, 'data', 'liquidations.db');
const db = new Database(dbPath, { readonly: true });

// Load current configuration
const configPath = path.join(__dirname, 'config.user.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// ============================================================================
// ENHANCED: Optimized cache with LRU
// ============================================================================
const priceDataCache = new LRUCache(50);
const backtestCache = new LRUCache(5000);

// API helper functions
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

async function getAccountBalance(credentials) {
  try {
    const queryString = buildSignedQuery({}, credentials);
    const response = await axios.get(
      `https://fapi.asterdex.com/fapi/v2/balance?${queryString}`,
      {
        headers: { 'X-MBX-APIKEY': credentials.apiKey }
      }
    );

    const usdtBalance = response.data.find(asset => asset.asset === 'USDT');
    return {
      totalWalletBalance: parseFloat(usdtBalance?.walletBalance || 0),
      availableBalance: parseFloat(usdtBalance?.availableBalance || 0),
      crossMargin: parseFloat(usdtBalance?.crossUnPnl || 0)
    };
  } catch (error) {
    console.error('❌ Failed to fetch balance:', error.response?.data || error.message);
    return { totalWalletBalance: 0, availableBalance: 0, crossMargin: 0 };
  }
}

async function getAccountInfo(credentials) {
  try {
    const queryString = buildSignedQuery({}, credentials);
    const response = await axios.get(
      `https://fapi.asterdex.com/fapi/v2/account?${queryString}`,
      {
        headers: { 'X-MBX-APIKEY': credentials.apiKey }
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch account info:', error.response?.data || error.message);
    return null;
  }
}

async function getUserTrades(credentials, symbol, limit = 100, startTime = null, endTime = null) {
  try {
    const params = { symbol, limit };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    const queryString = buildSignedQuery(params, credentials);
    const response = await axios.get(
      `https://fapi.asterdex.com/fapi/v1/userTrades?${queryString}`,
      {
        headers: { 'X-MBX-APIKEY': credentials.apiKey }
      }
    );

    return response.data;
  } catch (error) {
    console.error(`❌ Failed to fetch trade history for ${symbol}:`, error.response?.data || error.message);
    return [];
  }
}

async function getCurrentPositions(credentials) {
  try {
    const queryString = buildSignedQuery({}, credentials);
    const response = await axios.get(
      `https://fapi.asterdex.com/fapi/v2/positionRisk?${queryString}`,
      {
        headers: { 'X-MBX-APIKEY': credentials.apiKey }
      }
    );

    const activePositions = response.data.filter(pos => parseFloat(pos.positionAmt) !== 0);
    return activePositions;
  } catch (error) {
    console.error('❌ Failed to fetch positions:', error.response?.data || error.message);
    return [];
  }
}

async function retryWithTimeout(fn, retries = MAX_RETRIES, timeoutMs = API_TIMEOUT_MS) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const result = await fn(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        throw error;
      }

      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

const MAX_KLINE_LIMIT = 1500;

// ============================================================================
// ENHANCED: Optimized price data fetching with progress
// ============================================================================
async function getCachedHistoricalPrices(symbol, interval = '1m', totalCandles = 10080) {
  const cacheKey = `${symbol}:${interval}:${totalCandles}`;
  if (priceDataCache.has(cacheKey)) {
    return priceDataCache.get(cacheKey);
  }

  const collected = [];
  let remaining = Math.max(totalCandles, 0);
  let endTime = undefined;

  const totalRequests = Math.ceil(totalCandles / MAX_KLINE_LIMIT);
  let requestCount = 0;

  console.log(`📈 Fetching ${totalCandles} candles for ${symbol}...`);

  while (remaining > 0) {
    const requestLimit = Math.min(remaining, MAX_KLINE_LIMIT);
    const params = new URLSearchParams({
      symbol,
      interval,
      limit: requestLimit
    });

    if (endTime) {
      params.append('endTime', endTime);
    }

    let response;
    try {
      response = await retryWithTimeout(async (signal) => {
        return await axios.get(`https://fapi.asterdex.com/fapi/v1/klines?${params.toString()}`, {
          timeout: API_TIMEOUT_MS,
          signal
        });
      });
    } catch (error) {
      console.error(`❌ Failed to fetch price data for ${symbol} after ${MAX_RETRIES} retries`);
      break;
    }

    const rawKlines = Array.isArray(response.data) ? response.data : [];
    if (rawKlines.length === 0) {
      break;
    }

    const chunk = rawKlines.map(kline => ({
      timestamp: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    }));

    collected.unshift(...chunk);

    requestCount++;
    const progress = ((requestCount / totalRequests) * 100).toFixed(0);
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`   ⏳ Progress: ${progress}% (${collected.length}/${totalCandles} candles)`);

    const earliestTimestamp = chunk[0]?.timestamp;
    if (typeof earliestTimestamp === 'number') {
      endTime = earliestTimestamp - 1;
    } else {
      break;
    }

    if (rawKlines.length < requestLimit) {
      break;
    }

    remaining = Math.max(totalCandles - collected.length, 0);
  }

  process.stdout.write('\n');

  const priceData = collected.length > totalCandles
    ? collected.slice(collected.length - totalCandles)
    : collected;

  priceDataCache.set(cacheKey, priceData);
  return priceData;
}

console.log('🚀 LIQUIDATION BOT OPTIMIZATION TOOL - ENHANCED');
console.log('================================================\n');

// Helper functions
function formatNumber(num) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function formatLargeNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(2);
}

function formatCurrency(num) {
  return Number.isFinite(num) ? `$${formatNumber(num)}` : 'n/a';
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_THRESHOLD_WINDOW_MS = 60 * 1000;
const DEFAULT_THRESHOLD_COOLDOWN_MS = 30 * 1000;
const HUNTER_COOLDOWN_MS = 2 * 60 * 1000;

function generateTimeWindowCandidates(currentMs) {
  const seconds = Math.max(10, Math.round((currentMs || DEFAULT_THRESHOLD_WINDOW_MS) / 1000));
  const base = [20, 30, 45, 60, 75, 90, 120, 150, 180, 240];
  const dynamic = [
    seconds,
    Math.max(10, Math.round(seconds * 0.5)),
    Math.max(10, Math.round(seconds * 0.75)),
    Math.round(seconds * 1.25),
    Math.round(seconds * 1.5),
    Math.round(seconds * 2)
  ];

  const candidates = new Set([...base, ...dynamic]);
  const filtered = [...candidates]
    .filter((sec) => Number.isFinite(sec) && sec >= 10 && sec <= 300)
    .sort((a, b) => a - b);

  return filtered.map((sec) => sec * 1000);
}

function generateCooldownCandidates(currentMs) {
  const seconds = Math.max(5, Math.round((currentMs || DEFAULT_THRESHOLD_COOLDOWN_MS) / 1000));
  const base = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180];
  const dynamic = [
    seconds,
    Math.max(5, Math.round(seconds * 0.5)),
    Math.max(5, Math.round(seconds * 0.75)),
    Math.round(seconds * 1.25),
    Math.round(seconds * 1.5)
  ];

  const candidates = new Set([...base, ...dynamic]);
  const filtered = [...candidates]
    .filter((sec) => Number.isFinite(sec) && sec >= 5 && sec <= 240)
    .sort((a, b) => a - b);

  return filtered.map((sec) => sec * 1000);
}

function calculateCombinationScore(longResult, shortResult) {
  const combinedPnl = (longResult?.totalPnl || 0) + (shortResult?.totalPnl || 0);
  const rawLongSharpe = longResult?.sharpeRatio ?? 0;
  const rawShortSharpe = shortResult?.sharpeRatio ?? 0;
  const cappedLongSharpe = Number.isFinite(rawLongSharpe) ? Math.min(Math.max(rawLongSharpe, -5), 5) : 0;
  const cappedShortSharpe = Number.isFinite(rawShortSharpe) ? Math.min(Math.max(rawShortSharpe, -5), 5) : 0;
  const combinedSharpe = (cappedLongSharpe + cappedShortSharpe) / 2;
  const combinedDrawdown = Math.max(longResult?.maxDrawdown || 1, shortResult?.maxDrawdown || 1);
  const drawdownScore = combinedPnl / (combinedDrawdown + 1);

  const finalScore = (
    (combinedPnl * normalizedScoringWeights.pnl) +
    (combinedSharpe * normalizedScoringWeights.sharpe) +
    (drawdownScore * normalizedScoringWeights.drawdown)
  );

  return {
    finalScore,
    combinedPnl,
    combinedSharpe,
    drawdownScore,
  };
}

const symbolSpanCache = new Map();

function dedupeAndSort(values) {
  return Array.from(new Set(values.filter(v => Number.isFinite(v) && v > 0))).sort((a, b) => a - b);
}

function sampleCandidates(values, maxCount) {
  const sorted = dedupeAndSort(values);
  if (sorted.length <= maxCount) {
    return sorted;
  }

  const result = [];
  const step = (sorted.length - 1) / (maxCount - 1);
  for (let i = 0; i < maxCount; i++) {
    const index = Math.round(i * step);
    result.push(sorted[index]);
  }

  return dedupeAndSort(result);
}

function computePercentiles(values, percentiles) {
  if (!values.length) return {};

  const sorted = [...values].sort((a, b) => a - b);
  const results = {};
  percentiles.forEach(p => {
    if (p <= 0) {
      results[p] = sorted[0];
      return;
    }
    if (p >= 1) {
      results[p] = sorted[sorted.length - 1];
      return;
    }
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) {
      results[p] = sorted[lower];
    } else {
      const weight = index - lower;
      results[p] = sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
  });
  return results;
}

function getLiquidationVolumes(symbol, side) {
  const rows = db.prepare(`
    SELECT volume_usdt
    FROM liquidations
    WHERE symbol = ? AND side = ?
  `).all(symbol, side);

  return rows.map(row => parseFloat(row.volume_usdt) || 0).filter(v => v > 0);
}

function generateThresholdCandidates(symbol, side, currentThreshold) {
  const volumes = getLiquidationVolumes(symbol, side);
  if (volumes.length === 0) {
    return currentThreshold ? [currentThreshold] : [];
  }

  const percentiles = computePercentiles(volumes, [0.5, 0.65, 0.75, 0.85, 0.9, 0.95, 0.98]);
  const candidates = [currentThreshold];
  Object.values(percentiles).forEach(value => {
    if (value && value > 0) {
      candidates.push(Math.round(value / 10) * 10);
    }
  });

  if (currentThreshold) {
    candidates.push(currentThreshold * 0.75);
    candidates.push(currentThreshold * 0.5);
    candidates.push(currentThreshold * 1.25);
    candidates.push(currentThreshold * 1.5);
  }

  return dedupeAndSort(candidates);
}

function computePriceVolatility(priceData) {
  if (!priceData || priceData.length < 2) {
    return {
      avgAbsReturn: 0.5,
      perc90: 1,
      perc95: 1.5
    };
  }

  const returns = [];
  for (let i = 1; i < priceData.length; i++) {
    const prev = priceData[i - 1].close;
    const curr = priceData[i].close;
    if (prev > 0) {
      const changePct = Math.abs(((curr - prev) / prev) * 100);
      if (Number.isFinite(changePct)) {
        returns.push(changePct);
      }
    }
  }

  if (!returns.length) {
    return {
      avgAbsReturn: 0.5,
      perc90: 1,
      perc95: 1.5
    };
  }

  const avgAbsReturn = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const percentileValues = computePercentiles(returns, [0.9, 0.95]);

  return {
    avgAbsReturn,
    perc90: percentileValues[0.9] || avgAbsReturn,
    perc95: percentileValues[0.95] || percentileValues[0.9] || avgAbsReturn
  };
}

function generateTpCandidates(volStats, currentTp) {
  const base = Math.max(volStats.avgAbsReturn || 0.3, 0.1);
  const highVol = Math.max(volStats.perc95 || base * 2, base);
  const midVol = Math.max(volStats.perc90 || base, base);

  const anchors = Number.isFinite(currentTp) && currentTp > 0
    ? [currentTp, currentTp * 0.5, currentTp * 0.75, currentTp * 1.25, currentTp * 1.5, currentTp * 2]
    : [];

  const general = [0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const dynamic = [
    base * 0.5,
    base * 0.75,
    base,
    base * 1.25,
    base * 1.5,
    midVol,
    highVol,
    highVol * 1.5,
    highVol * 2
  ];

  const rawCandidates = [...general, ...dynamic, ...anchors]
    .map(val => Number.isFinite(val) ? parseFloat(val.toFixed(2)) : null)
    .filter(val => typeof val === 'number' && val > 0.05 && val <= 40);

  const candidates = sampleCandidates(rawCandidates, 15)
    .filter(val => val >= 0.1 && val <= 30);

  return candidates;
}

function generateSlCandidates(volStats, currentSl) {
  const base = Math.max(volStats.perc95 || volStats.avgAbsReturn * 2 || currentSl || 1, 0.5);

  const anchors = Number.isFinite(currentSl) && currentSl > 0
    ? [currentSl, currentSl * 0.5, currentSl * 0.75, currentSl * 1.25, currentSl * 1.5, currentSl * 2, currentSl * 3]
    : [];

  const general = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5];
  const dynamic = [
    base * 0.5,
    base * 0.75,
    base,
    base * 1.25,
    base * 1.5,
    base * 2,
    base * 3
  ];

  const rawCandidates = [...general, ...dynamic, ...anchors]
    .map(val => Number.isFinite(val) ? parseFloat(val.toFixed(2)) : null)
    .filter(val => typeof val === 'number' && val > 0.1 && val <= 80);

  const candidates = sampleCandidates(rawCandidates, 15)
    .filter(val => val >= 0.1 && val <= 40);

  return candidates;
}

function generateLeverageCandidates(currentLeverage) {
  const baseCandidates = [currentLeverage, 5, 7.5, 10, 12.5, 15, 20, 25];
  return dedupeAndSort(baseCandidates).filter(val => val > 0 && val <= 25);
}

function generateMarginCandidates(capitalBudget, currentMargin) {
  const base = currentMargin > 0 ? currentMargin : capitalBudget * 0.5;
  const candidates = [currentMargin, base * 0.75, base, base * 1.25, capitalBudget * 0.5, capitalBudget * 0.75, capitalBudget];
  const sanitized = dedupeAndSort(candidates).map(val => Math.min(val, capitalBudget));
  return sanitized.filter(val => val > 0);
}

// Continue with remaining functions... (Part 2 follows)

// ============================================================================
// ENHANCED: Optimized backtest with progress tracking
// ============================================================================
function calculateRiskMetrics(trades) {
  if (trades.length === 0) {
    return { sharpeRatio: 0, maxDrawdown: 0, maxDrawdownPercent: 0, profitFactor: 0, exitReasons: {} };
  }

  const returns = trades.map(t => t.pnl);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  let peak = 0;
  let maxDrawdown = 0;
  let runningPnl = 0;

  for (const trade of trades) {
    runningPnl += trade.pnl;
    if (runningPnl > peak) {
      peak = runningPnl;
    }
    const drawdown = peak - runningPnl;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;

  const totalWins = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? Infinity : 0);

  // Count exit reasons
  const exitReasons = {};
  trades.forEach(t => {
    exitReasons[t.exitReason] = (exitReasons[t.exitReason] || 0) + 1;
  });

  return { sharpeRatio, maxDrawdown, maxDrawdownPercent, profitFactor, exitReasons };
}

async function backtestSymbol(symbol, side, threshold, maxPositions, tradeSize, leverage, tpPercent, slPercent, options = {}) {
  const suppressLogs = options.suppressLogs || false;
  const cooldownMs = Number.isFinite(options.cooldownMs) ? Math.max(0, options.cooldownMs) : 0;
  const hunterCooldownMs = Number.isFinite(options.hunterCooldownMs) ? Math.max(0, options.hunterCooldownMs) : HUNTER_COOLDOWN_MS;
  const windowMs = Number.isFinite(options.windowMs) ? Math.max(1_000, options.windowMs) : DEFAULT_THRESHOLD_WINDOW_MS;

  // Get liquidations
  const liquidations = db.prepare(`
    SELECT event_time, volume_usdt, price
    FROM liquidations
    WHERE symbol = ? AND side = ?
    ORDER BY event_time
  `).all(symbol, side);

  if (liquidations.length === 0) {
    return {
      totalTrades: 0, wins: 0, losses: 0, totalPnl: 0, winRate: 0,
      avgWin: 0, avgLoss: 0, avgDuration: 0, activePositions: 0,
      sharpeRatio: 0, maxDrawdown: 0, maxDrawdownPercent: 0, profitFactor: 0, exitReasons: {}
    };
  }

  // Get price data
  let priceData = [];
  try {
    priceData = await getCachedHistoricalPrices(symbol, '1m', 10080);
  } catch (_error) {
    if (!suppressLogs) {
      console.log(`   ⚠️  Could not fetch historical prices for ${symbol}, using liquidation prices`);
    }
  }

  const allPrices = priceData.length > 0
    ? priceData.map(p => ({ event_time: p.timestamp, price: p.close, high: p.high, low: p.low }))
    : db.prepare(`SELECT event_time, price, price as high, price as low FROM liquidations WHERE symbol = ? ORDER BY event_time`).all(symbol);

  let activePositions = [];
  let completedTrades = [];
  let totalPnl = 0;
  let priceIndex = 0;
  let lastEntryTime = -Infinity;
  let lastHunterEntryTime = -Infinity;

  const calculateVolatilityFactor = (currentIndex, lookbackPeriods = 20) => {
    if (allPrices.length < 2) return 1.0;

    const startIndex = Math.max(0, currentIndex - lookbackPeriods);
    const endIndex = Math.min(allPrices.length, currentIndex + 1);
    const slice = allPrices.slice(startIndex, endIndex);

    if (slice.length < 2) return 1.0;

    let sumAbsReturn = 0;
    let count = 0;
    for (let i = 1; i < slice.length; i++) {
      const prev = slice[i - 1].price || slice[i - 1].close;
      const curr = slice[i].price || slice[i].close;
      if (prev > 0) {
        sumAbsReturn += Math.abs((curr - prev) / prev);
        count++;
      }
    }

    if (count === 0) return 1.0;

    const avgReturn = sumAbsReturn / count;
    return Math.max(0.5, Math.min(3.0, avgReturn / 0.005));
  };

  const recordExit = (pos, exitPrice, exitReason, priceEventTime, volatilityFactor = 1.0) => {
    let actualExitPrice = exitPrice;

    if (exitReason === 'TP') {
      actualExitPrice = pos.isLong
        ? exitPrice * (1 - EXIT_SLIPPAGE.TP)
        : exitPrice * (1 + EXIT_SLIPPAGE.TP);
    } else if (exitReason === 'SL') {
      const slippageRate = volatilityFactor > 1.5 ? EXIT_SLIPPAGE.SL_VOLATILE : EXIT_SLIPPAGE.SL;
      actualExitPrice = pos.isLong
        ? exitPrice * (1 - slippageRate)
        : exitPrice * (1 + slippageRate);
    }

    const grossPnl = pos.isLong
      ? (actualExitPrice - pos.entryPrice) * pos.size
      : (pos.entryPrice - actualExitPrice) * pos.size;

    const notional = tradeSize * leverage;
    const entryCommission = notional * (COMMISSION.MAKER_FEE * 0.9 + COMMISSION.TAKER_FEE * 0.1);
    const exitCommission = exitReason === 'EOD'
      ? notional * COMMISSION.MAKER_FEE
      : notional * COMMISSION.TAKER_FEE;

    const totalCommission = (entryCommission + exitCommission) * COMMISSION.AVG_FILLS_PER_TRADE;
    const netPnl = grossPnl - totalCommission;

    totalPnl += netPnl;
    completedTrades.push({
      symbol,
      side: pos.isLong ? 'LONG' : 'SHORT',
      entryPrice: pos.entryPrice,
      exitPrice: actualExitPrice,
      triggerPrice: exitPrice,
      slippage: Math.abs(actualExitPrice - exitPrice),
      grossPnl,
      commission: totalCommission,
      pnl: netPnl,
      exitReason,
      duration: priceEventTime - pos.entryTime,
      margin: tradeSize,
      volatilityFactor: exitReason === 'SL' ? volatilityFactor : null
    });
  };

  const evaluatePositionsOnBar = (priceBar, barIndex) => {
    const volatilityFactor = calculateVolatilityFactor(barIndex);

    activePositions = activePositions.filter(pos => {
      let shouldExit = false;
      let exitReason = null;
      let exitPrice = null;

      const tpTouched = pos.isLong ? priceBar.high >= pos.tpPrice : priceBar.low <= pos.tpPrice;
      const slTouched = pos.isLong ? priceBar.low <= pos.slPrice : priceBar.high >= pos.slPrice;

      if (tpTouched && slTouched) {
        const tpDistance = Math.abs(pos.tpPrice - pos.entryPrice);
        const slDistance = Math.abs(pos.slPrice - pos.entryPrice);

        const closerHitsFirst = Math.random() < 0.70;

        if (closerHitsFirst) {
          if (slDistance < tpDistance) {
            exitReason = 'SL';
            exitPrice = pos.slPrice;
          } else {
            exitReason = 'TP';
            exitPrice = pos.tpPrice;
          }
        } else {
          if (slDistance < tpDistance) {
            exitReason = 'TP';
            exitPrice = pos.tpPrice;
          } else {
            exitReason = 'SL';
            exitPrice = pos.slPrice;
          }
        }
        shouldExit = true;
      } else if (tpTouched) {
        shouldExit = true;
        exitReason = 'TP';
        exitPrice = pos.tpPrice;
      } else if (slTouched) {
        shouldExit = true;
        exitReason = 'SL';
        exitPrice = pos.slPrice;
      }

      if (shouldExit) {
        recordExit(pos, exitPrice, exitReason, priceBar.event_time, volatilityFactor);
        return false;
      }
      return true;
    });
  };

  // Process liquidations with progress tracking (only if not suppressed)
  for (let i = 0; i < liquidations.length; i++) {
    const currentEvent = liquidations[i];
    const currentTime = currentEvent.event_time;
    const windowStart = currentTime - windowMs;

    let windowVolume = 0;
    for (let j = i; j >= 0; j--) {
      if (liquidations[j].event_time >= windowStart && liquidations[j].event_time <= currentTime) {
        windowVolume += liquidations[j].volume_usdt;
      } else if (liquidations[j].event_time < windowStart) {
        break;
      }
    }

    while (priceIndex < allPrices.length && allPrices[priceIndex].event_time <= currentTime) {
      const priceBar = allPrices[priceIndex];
      evaluatePositionsOnBar(priceBar, priceIndex);
      priceIndex++;
    }

    const cooldownElapsed = currentTime - lastEntryTime >= cooldownMs;
    const hunterCooldownElapsed = currentTime - lastHunterEntryTime >= hunterCooldownMs;
    if (windowVolume >= threshold && activePositions.length < maxPositions && cooldownElapsed && hunterCooldownElapsed) {
      if (Math.random() > LIMIT_FILL_RATE) {
        continue;
      }

      let entryPrice = currentEvent.price;
      if (Math.random() < MARKET_FALLBACK_RATE) {
        const isLong = side === 'SELL';
        entryPrice = isLong
          ? entryPrice * (1 + EXIT_SLIPPAGE.ENTRY_MARKET)
          : entryPrice * (1 - EXIT_SLIPPAGE.ENTRY_MARKET);
      }

      const isLong = side === 'SELL';

      const tpPrice = isLong
        ? entryPrice * (1 + tpPercent/100)
        : entryPrice * (1 - tpPercent/100);
      const slPrice = isLong
        ? entryPrice * (1 - slPercent/100)
        : entryPrice * (1 + slPercent/100);

      activePositions.push({
        entryPrice,
        entryTime: currentTime,
        tpPrice,
        slPrice,
        isLong,
        size: tradeSize * leverage / entryPrice
      });
      lastEntryTime = currentTime;
      lastHunterEntryTime = currentTime;
    }
  }

  // Close remaining positions
  while (priceIndex < allPrices.length) {
    const priceBar = allPrices[priceIndex];
    evaluatePositionsOnBar(priceBar, priceIndex);
    priceIndex++;
  }

  if (activePositions.length > 0) {
    const fallbackEvent = liquidations[liquidations.length - 1];
    const lastBar = allPrices.length > 0
      ? allPrices[allPrices.length - 1]
      : {
          event_time: fallbackEvent?.event_time || Date.now(),
          price: fallbackEvent?.price ?? 0
        };

    activePositions.forEach(pos => {
      const fallbackPrice = typeof lastBar.price === 'number' && lastBar.price > 0
        ? lastBar.price
        : pos.entryPrice;
      recordExit(pos, fallbackPrice, 'EOD', lastBar.event_time || pos.entryTime);
    });

    activePositions = [];
  }

  // Calculate statistics
  const wins = completedTrades.filter(t => t.pnl > 0).length;
  const losses = completedTrades.filter(t => t.pnl < 0).length;
  const winRate = completedTrades.length > 0 ? (wins / completedTrades.length * 100) : 0;
  const avgWin = wins > 0 ? completedTrades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / wins : 0;
  const avgLoss = losses > 0 ? completedTrades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / losses : 0;
  const avgDuration = completedTrades.length > 0 ? completedTrades.reduce((sum, t) => sum + t.duration, 0) / completedTrades.length / 1000 / 60 : 0;

  const riskMetrics = calculateRiskMetrics(completedTrades);

  return {
    totalTrades: completedTrades.length,
    wins,
    losses,
    totalPnl,
    winRate,
    avgWin,
    avgLoss,
    avgDuration,
    activePositions: activePositions.length,
    recentTrades: completedTrades.slice(-3),
    ...riskMetrics
  };
}

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
    spanDays = (spanRow.last_time - spanRow.first_time) / DAY_MS;
  }

  const minimumSpan = 1 / 24;
  spanDays = Math.max(spanDays, minimumSpan);
  symbolSpanCache.set(symbol, spanDays);
  return spanDays;
}

// ============================================================================
// ENHANCED: Optimized parameter search with progress indicator
// ============================================================================
async function optimizeSymbolParameters(symbol, symbolConfig, capitalBudget, spanDays, options = {}) {
  console.log(`\n🔍 Optimizing ${symbol}...`);

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
  
  // VWAP optimization with command-line control
  const vwapMode = options.vwap || 'auto';
  const currentVwapProtection = vwapMode === 'on' ? true : 
                               vwapMode === 'off' ? false : 
                               (symbolConfig.vwapProtection ?? true);
  const currentVwapTimeframe = symbolConfig.vwapTimeframe || '1m';
  const currentVwapLookback = symbolConfig.vwapLookback || 100;
  
  // VWAP candidates based on mode
  let vwapTimeframeCandidates = [currentVwapTimeframe];
  let vwapLookbackCandidates = [currentVwapLookback];
  
  if (vwapMode !== 'off') {
    if (options.fast) {
      vwapTimeframeCandidates = [currentVwapTimeframe, '5m'];
      vwapLookbackCandidates = [currentVwapLookback, 50, 100].filter(val => val >= 10 && val <= 500);
    } else {
      vwapTimeframeCandidates = ['1m', '3m', '5m', '15m'];
      vwapLookbackCandidates = [currentVwapLookback, 50, 100, 200, 500].filter(val => val >= 10 && val <= 500);
    }
  }

  // In fast mode, use only current timing values
  const timeWindowCandidates = options.fast 
    ? [currentTimeWindowMs] 
    : (thresholdEnabled ? generateTimeWindowCandidates(currentTimeWindowMs) : [currentTimeWindowMs]);
    
  const cooldownCandidates = options.fast 
    ? [currentCooldownMs]
    : (thresholdEnabled ? generateCooldownCandidates(currentCooldownMs) : [currentCooldownMs]);

  const longBasePositions = Math.max(1, Math.floor(currentMargin / (baseTradeSize || 1)) || 1);
  const shortBasePositions = Math.max(1, Math.floor(currentMargin / (baseShortTradeSize || 1)) || 1);

  // In fast mode, use much less data and simpler parameter space
  const candleLimit = options.fast ? 180 : 10080; // 3 hours vs 7 days
  const priceData = await getCachedHistoricalPrices(symbol, '1m', candleLimit);
  const volStats = computePriceVolatility(priceData);

  // Simplified parameter space for fast mode
  if (options.fast) {
    console.log('   ⚡ FAST MODE: Using minimal parameter space for testing');
    
    // Tesla-based threshold candidates
    const getTeslaThresholds = (current, min = 10, max = 10000) => {
      const teslaBases = [3, 6, 9];
      const values = new Set();
      
      // Always include current value if valid
      if (typeof current === 'number' && !isNaN(current) && current >= min && current <= max) {
        values.add(Math.round(current));
      }
      
      // Generate Tesla-based thresholds
      for (const base of teslaBases) {
        let val = base * base; // Start with squares (9, 36, 81)
        while (val <= max) {
          if (val >= min) {
            values.add(Math.round(val));
          }
          // Scale by multiples of 3, 6, 9
          val += base * 3;
        }
      }
      
      // Convert to array, sort, and ensure within bounds
      return Array.from(values)
        .sort((a, b) => a - b)
        .filter(v => v >= min && v <= max);
    };
    
    // Get Tesla-based thresholds
    const longThresholdCandidates = getTeslaThresholds(currentLongThreshold, 100, 10000);
    const shortThresholdCandidates = getTeslaThresholds(currentShortThreshold, 100, 10000);
    
    // Ensure we have at least 3 values for each threshold
    if (longThresholdCandidates.length < 3) {
      longThresholdCandidates.push(300, 600, 900);
    }
    if (shortThresholdCandidates.length < 3) {
      shortThresholdCandidates.push(300, 600, 900);
    }

    // Tesla numbers (3, 6, 9) based parameter space
    const getTeslaMultiples = (current, min, max, base = 1) => {
      const teslaBases = [3, 6, 9];
      const values = new Set();
      
      // Always include current value if it's a valid number
      if (typeof current === 'number' && !isNaN(current) && current >= min && current <= max) {
        values.add(Number(current.toFixed(2)));
      }
      
      // Generate Tesla-based values
      for (const base of teslaBases) {
        let val = base * base;
        while (val <= max) {
          if (val >= min) {
            values.add(Number(val.toFixed(2)));
          }
          val *= 1.5; // Scale by 1.5x for next Tesla multiple
        }
      }
      
      // Convert to array and sort
      return Array.from(values)
        .sort((a, b) => a - b)
        .filter(v => v >= min && v <= max);
    };
    
    // Get Tesla-based parameter values
    const tpCandidates = getTeslaMultiples(currentTp, 0.1, 5.0, 0.1);
    const slCandidates = getTeslaMultiples(currentSl, 0.5, 10.0, 0.5);
    const leverageCandidates = getTeslaMultiples(leverageCurrent, 1, 25, 1).map(Math.floor);
    const marginCandidates = getTeslaMultiples(currentMargin, 10, capitalBudget * 0.8, 10);
    
    // Ensure we have at least 2-3 values for each parameter
    if (tpCandidates.length < 2) tpCandidates.push(0.6, 1.2);
    if (slCandidates.length < 2) slCandidates.push(1.5, 3.0);
    if (leverageCandidates.length < 2) leverageCandidates.push(3, 6);
    if (marginCandidates.length < 2) marginCandidates.push(30, 60);
    
    // Include VWAP in fast mode but with reduced combinations
    const vwapProtectionCandidates = [true, false];
    
    return {
      longThresholdCandidates,
      shortThresholdCandidates,
      tpCandidates,
      slCandidates,
      leverageCandidates,
      marginCandidates,
      vwapProtectionCandidates,
      priceData,
      volStats
    };
  }
  
  // Regular mode - full parameter space
  const longThresholdCandidates = generateThresholdCandidates(symbol, 'SELL', currentLongThreshold || 1000);
  const shortThresholdCandidates = generateThresholdCandidates(symbol, 'BUY', currentShortThreshold || 1000);
  const tpCandidatesFull = generateTpCandidates(volStats, currentTp);
  const slCandidatesFull = generateSlCandidates(volStats, currentSl);
  const tpCandidates = tpCandidatesFull.length > 10
    ? [...tpCandidatesFull.slice(0, 5), ...tpCandidatesFull.slice(-5)]
    : tpCandidatesFull;
  const slCandidates = slCandidatesFull.length > 10
    ? [...slCandidatesFull.slice(0, 5), ...slCandidatesFull.slice(-5)]
    : slCandidatesFull;
  const leverageCandidates = generateLeverageCandidates(leverageCurrent);
  const marginCandidates = generateMarginCandidates(capitalBudget, currentMargin).slice(-6);

  const defaultCooldownMs = Math.max(0, currentCooldownMs);
  const defaultWindowMs = Math.max(5_000, currentTimeWindowMs || DEFAULT_THRESHOLD_WINDOW_MS);
  const defaultHunterCooldownMs = HUNTER_COOLDOWN_MS;

  const runBacktest = async (side, threshold, maxPositions, tradeSize, leverage, tp, sl, overrides = {}) => {
    const {
      cooldownMs = defaultCooldownMs,
      hunterCooldownMs = defaultHunterCooldownMs,
      windowMs = defaultWindowMs,
      vwapProtection = currentVwapProtection,
      vwapTimeframe = currentVwapTimeframe,
      vwapLookback = currentVwapLookback
    } = overrides;

    const key = [
      side, threshold, maxPositions, tradeSize, leverage, tp, sl, 
      cooldownMs, hunterCooldownMs, windowMs,
      vwapProtection ? '1' : '0', vwapTimeframe, vwapLookback
    ].map(v => Number.isFinite(v) ? Number(v).toFixed(6) : v).join('|');

    if (backtestCache.has(key)) {
      return backtestCache.get(key);
    }

    const result = await backtestSymbol(
      symbol,
      side,
      Math.max(1, Math.round(threshold)),
      maxPositions,
      tradeSize,
      leverage,
      tp,
      sl,
      {
        suppressLogs: true,
        cooldownMs,
        hunterCooldownMs,
        windowMs,
        vwapProtection,
        vwapTimeframe,
        vwapLookback
      }
    );

    backtestCache.set(key, result);
    return result;
  };

  // Baseline performance
  console.log('   📊 Running baseline tests...');
  const currentLongBacktest = await runBacktest('SELL', Math.max(1, currentLongThreshold), longBasePositions, baseTradeSize, leverageCurrent, currentTp, currentSl);
  const currentShortBacktest = await runBacktest('BUY', Math.max(1, currentShortThreshold), shortBasePositions, baseShortTradeSize, leverageCurrent, currentTp, currentSl);
  const currentTotalPnl = currentLongBacktest.totalPnl + currentShortBacktest.totalPnl;
  const dailyFactor = spanDays > 0 ? 1 / spanDays : 1;
  const currentDailyPnl = currentTotalPnl * dailyFactor;

  const rawCurrentLongSharpe = currentLongBacktest.sharpeRatio || 0;
  const rawCurrentShortSharpe = currentShortBacktest.sharpeRatio || 0;
  const cappedCurrentLongSharpe = Number.isFinite(rawCurrentLongSharpe) ? Math.min(Math.max(rawCurrentLongSharpe, -5), 5) : 0;
  const cappedCurrentShortSharpe = Number.isFinite(rawCurrentShortSharpe) ? Math.min(Math.max(rawCurrentShortSharpe, -5), 5) : 0;
  const currentSharpe = (cappedCurrentLongSharpe + cappedCurrentShortSharpe) / 2;
  const currentDrawdown = Math.max(currentLongBacktest.maxDrawdown || 1, currentShortBacktest.maxDrawdown || 1);
  const currentDrawdownScore = currentTotalPnl / (currentDrawdown + 1);
  const currentFinalScore = 
    (currentTotalPnl * normalizedScoringWeights.pnl) + 
    (currentSharpe * normalizedScoringWeights.sharpe) + 
    (currentDrawdownScore * normalizedScoringWeights.drawdown);

  let bestCombination = {
    totalPnl: currentTotalPnl,
    finalScore: currentFinalScore,
    sharpeRatio: currentSharpe,
    drawdownScore: currentDrawdownScore,
    leverage: leverageCurrent,
    margin: currentMargin,
    tp: currentTp,
    sl: currentSl,
    long: {
      threshold: Math.max(1, currentLongThreshold),
      result: currentLongBacktest,
      tradeSize: baseTradeSize,
      maxPositions: longBasePositions
    },
    short: {
      threshold: Math.max(1, currentShortThreshold),
      result: currentShortBacktest,
      tradeSize: baseShortTradeSize,
      maxPositions: shortBasePositions
    }
  };

  // Calculate total combinations and reduce to 10% in fast mode
  let leverageToTest = leverageCandidates;
  let marginToTest = marginCandidates;
  let tpToTest = tpCandidates;
  let slToTest = slCandidates;
  let vwapTimeframeToTest = vwapTimeframeCandidates;
  let vwapLookbackToTest = vwapLookbackCandidates;
  
  if (options.fast) {
    // In fast mode, sample 10% of the combinations by reducing each parameter space
    leverageToTest = sampleCandidates(leverageCandidates, Math.ceil(Math.sqrt(leverageCandidates.length)));
    marginToTest = sampleCandidates(marginCandidates, Math.ceil(Math.sqrt(marginCandidates.length)));
    tpToTest = sampleCandidates(tpCandidates, Math.ceil(Math.sqrt(tpCandidates.length)));
    slToTest = sampleCandidates(slCandidates, Math.ceil(Math.sqrt(slCandidates.length)));
    vwapTimeframeToTest = sampleCandidates(vwapTimeframeCandidates, Math.ceil(Math.sqrt(vwapTimeframeCandidates.length)));
    vwapLookbackToTest = sampleCandidates(vwapLookbackCandidates, Math.ceil(Math.sqrt(vwapLookbackCandidates.length)));
    
    // Ensure we don't end up with more combinations than 10% of total
    const maxFastCombinations = Math.max(10, Math.ceil((leverageCandidates.length * marginCandidates.length * 
      tpCandidates.length * slCandidates.length * vwapTimeframeCandidates.length * vwapLookbackCandidates.length) * 0.1));
      
    while (leverageToTest.length * marginToTest.length * tpToTest.length * slToTest.length * vwapTimeframeToTest.length * vwapLookbackToTest.length > maxFastCombinations) {
      // Reduce the largest dimension
      if (leverageToTest.length > 1) leverageToTest.pop();
      if (marginToTest.length > 1) marginToTest.pop();
      if (tpToTest.length > 2) tpToTest.pop();
      if (slToTest.length > 2) slToTest.pop();
      if (vwapTimeframeToTest.length > 1) vwapTimeframeToTest.pop();
      if (vwapLookbackToTest.length > 1) vwapLookbackToTest.pop();
    }
  }
  
  const totalCombinations = leverageToTest.length * marginToTest.length * tpToTest.length * slToTest.length * vwapTimeframeToTest.length * vwapLookbackToTest.length;
  const totalPossible = leverageCandidates.length * marginCandidates.length * tpCandidates.length * slCandidates.length * vwapTimeframeCandidates.length * vwapLookbackCandidates.length;
  
  if (options.fast) {
    console.log(`   ⚡ FAST MODE: Testing ${totalCombinations} of ${totalPossible} combinations (${Math.round((totalCombinations / totalPossible) * 100)}%)`);
  } else {
    console.log(`   🔬 Testing ${totalCombinations.toLocaleString()} parameter combinations...`);
  }

  const progress = new ProgressIndicator(totalCombinations, `   Optimizing ${symbol}`);
  let testedCount = 0;

  // Use the sampled parameter sets in fast mode
  const leverageSet = options.fast ? leverageToTest : leverageCandidates;
  const marginSet = options.fast ? marginToTest : marginCandidates;
  const tpSet = options.fast ? tpToTest : tpCandidates;
  const slSet = options.fast ? slToTest : slCandidates;
  const vwapTimeframeSet = options.fast ? vwapTimeframeToTest : vwapTimeframeCandidates;
  const vwapLookbackSet = options.fast ? vwapLookbackToTest : vwapLookbackCandidates;

  for (const leverage of leverageSet) {
    for (const margin of marginSet) {
      if (!Number.isFinite(margin) || margin <= 0) continue;

      const longTradeSize = margin / longBasePositions;
      const shortTradeSize = margin / shortBasePositions;
      if (!Number.isFinite(longTradeSize) || longTradeSize <= 0) continue;
      if (!Number.isFinite(shortTradeSize) || shortTradeSize <= 0) continue;

      for (const tp of tpSet) {
        for (const sl of slSet) {
          testedCount++;
          progress.update(1, `| Best: $${bestCombination.totalPnl.toFixed(2)}`);

          // Liquidation distance check
          const liquidationDistance = (100 / leverage) * 0.9;
          if (sl >= liquidationDistance) {
            continue;
          }

          // Risk-reward check
          const riskRewardRatio = tp / sl;
          if (riskRewardRatio < 0.33) {
            continue;
          }

          // VWAP parameter optimization
          for (const vwapTimeframe of vwapTimeframeSet) {
            for (const vwapLookback of vwapLookbackSet) {
              if (!Number.isFinite(vwapLookback) || vwapLookback < 10 || vwapLookback > 500) continue;

              let bestLongSide = null;
              for (const threshold of longThresholdCandidates) {
                const candidateThreshold = Math.max(1, threshold);
                const result = await runBacktest('SELL', candidateThreshold, longBasePositions, longTradeSize, leverage, tp, sl, {
                  vwapTimeframe,
                  vwapLookback
                });
                if (!bestLongSide || result.totalPnl > bestLongSide.result.totalPnl) {
                  bestLongSide = {
                    threshold: candidateThreshold,
                    result,
                    tradeSize: longTradeSize,
                    maxPositions: longBasePositions
                  };
                }
              }

              let bestShortSide = null;
              for (const threshold of shortThresholdCandidates) {
                const candidateThreshold = Math.max(1, threshold);
                const result = await runBacktest('BUY', candidateThreshold, shortBasePositions, shortTradeSize, leverage, tp, sl, {
                  vwapTimeframe,
                  vwapLookback
                });
                if (!bestShortSide || result.totalPnl > bestShortSide.result.totalPnl) {
                  bestShortSide = {
                    threshold: candidateThreshold,
                    result,
                    tradeSize: shortTradeSize,
                    maxPositions: shortBasePositions
                  };
                }
              }

              if (!bestLongSide || !bestShortSide) continue;

              const combinedPnl = bestLongSide.result.totalPnl + bestShortSide.result.totalPnl;
              const stopExitCount = (bestLongSide.result.exitReasons?.SL || 0) + (bestShortSide.result.exitReasons?.SL || 0);
              const totalTrades = (bestLongSide.result.totalTrades || 0) + (bestShortSide.result.totalTrades || 0);
              const stopRate = totalTrades > 0 ? stopExitCount / totalTrades : 0;
              const combinedProfitFactor = ((bestLongSide.result.profitFactor || 0) + (bestShortSide.result.profitFactor || 0)) / 2;

              if (combinedProfitFactor < 1.05 || stopRate > 0.65) {
                continue;
              }

              const requiredWinRate = sl / (tp + sl);
              const combinedWinRate = ((bestLongSide.result.winRate || 0) + (bestShortSide.result.winRate || 0)) / 2 / 100;

              if (combinedWinRate < requiredWinRate + 0.05) {
                continue;
              }

              const pnlScore = combinedPnl;
              const rawLongSharpe = bestLongSide.result.sharpeRatio || 0;
              const rawShortSharpe = bestShortSide.result.sharpeRatio || 0;
              const cappedLongSharpe = Number.isFinite(rawLongSharpe) ? Math.min(Math.max(rawLongSharpe, -5), 5) : 0;
              const cappedShortSharpe = Number.isFinite(rawShortSharpe) ? Math.min(Math.max(rawShortSharpe, -5), 5) : 0;
              const combinedSharpe = (cappedLongSharpe + cappedShortSharpe) / 2;
              const combinedDrawdown = Math.max(bestLongSide.result.maxDrawdown || 1, bestShortSide.result.maxDrawdown || 1);
              const drawdownScore = combinedPnl / (combinedDrawdown + 1);

              const finalScore = (
                (pnlScore * normalizedScoringWeights.pnl) +
                (combinedSharpe * normalizedScoringWeights.sharpe) +
                (drawdownScore * normalizedScoringWeights.drawdown)
              );

              if (!Number.isFinite(finalScore)) {
                continue;
              }

              if (finalScore > bestCombination.finalScore) {
                bestCombination = {
                  totalPnl: combinedPnl,
                  finalScore: finalScore,
                  sharpeRatio: combinedSharpe,
                  drawdownScore: drawdownScore,
                  leverage,
                  margin,
                  tp,
                  sl,
                  vwapTimeframe,
                  vwapLookback,
                  long: bestLongSide,
                  short: bestShortSide
                };
              }
            }
          }
        }
      }
    }
  }

  progress.complete();

  // Time window and cooldown optimization
  let bestWindowMs = currentTimeWindowMs;
  let bestCooldownMs = currentCooldownMs;
  let cachedBestScore = bestCombination.finalScore;
  let cachedBestLongResult = bestCombination.long.result;
  let cachedBestShortResult = bestCombination.short.result;

  if (thresholdEnabled && timeWindowCandidates.length > 1 && cooldownCandidates.length > 1) {
    const windowCombos = timeWindowCandidates.length * cooldownCandidates.length;
    console.log(`   ⏱️  Optimizing timing parameters (${windowCombos} combinations)...`);
    const timingProgress = new ProgressIndicator(windowCombos, `   Timing optimization`);

    for (const windowMs of timeWindowCandidates) {
      for (const cooldownMs of cooldownCandidates) {
        timingProgress.update(1);

        const longResult = await runBacktest(
          'SELL',
          Math.max(1, bestCombination.long.threshold),
          bestCombination.long.maxPositions,
          bestCombination.long.tradeSize,
          bestCombination.leverage,
          bestCombination.tp,
          bestCombination.sl,
          { windowMs, cooldownMs }
        );

        const shortResult = await runBacktest(
          'BUY',
          Math.max(1, bestCombination.short.threshold),
          bestCombination.short.maxPositions,
          bestCombination.short.tradeSize,
          bestCombination.leverage,
          bestCombination.tp,
          bestCombination.sl,
          { windowMs, cooldownMs }
        );

        const metrics = calculateCombinationScore(longResult, shortResult);

        if (metrics.finalScore > cachedBestScore + 1e-6) {
          cachedBestScore = metrics.finalScore;
          cachedBestLongResult = longResult;
          cachedBestShortResult = shortResult;
          bestWindowMs = windowMs;
          bestCooldownMs = cooldownMs;
          bestCombination.totalPnl = metrics.combinedPnl;
          bestCombination.sharpeRatio = metrics.combinedSharpe;
          bestCombination.drawdownScore = metrics.drawdownScore;
        }
      }
    }

    timingProgress.complete();
  }

  bestCombination.finalScore = cachedBestScore;
  bestCombination.long.result = cachedBestLongResult;
  bestCombination.short.result = cachedBestShortResult;
  bestCombination.windowMs = bestWindowMs;
  bestCombination.cooldownMs = bestCooldownMs;

  const finalMetrics = calculateCombinationScore(bestCombination.long.result, bestCombination.short.result);
  bestCombination.totalPnl = finalMetrics.combinedPnl;
  bestCombination.sharpeRatio = finalMetrics.combinedSharpe;
  bestCombination.drawdownScore = finalMetrics.drawdownScore;
  bestCombination.finalScore = Math.max(bestCombination.finalScore, finalMetrics.finalScore);

  const optimizedDailyPnl = bestCombination.totalPnl * dailyFactor;

  const longImprovement = (bestCombination.long.result.totalPnl - currentLongBacktest.totalPnl) * dailyFactor;
  const shortImprovement = (bestCombination.short.result.totalPnl - currentShortBacktest.totalPnl) * dailyFactor;

  // Respect the command-line VWAP setting
  let vwapOptimized;
  if (options.vwap === 'on') {
    // Always enable if explicitly set via command line
    vwapOptimized = true;
  } else if (options.vwap === 'off') {
    // Always disable if explicitly set via command line
    vwapOptimized = false;
  } else {
    // Auto mode: disable if thresholds are too aggressive
    vwapOptimized = !(
      bestCombination.long.threshold < Math.max(1, currentLongThreshold) * 0.7 ||
      bestCombination.short.threshold < Math.max(1, currentShortThreshold) * 0.7
    );
    
    // If VWAP was enabled in config, keep it enabled unless thresholds are too aggressive
    if (symbolConfig.vwapProtection) {
      vwapOptimized = vwapOptimized || symbolConfig.vwapProtection;
    }
  }

  // Calculate final trade sizes for config
  const finalLongTradeSize = parseFloat(bestCombination.long.tradeSize.toFixed(2));
  const finalShortTradeSize = parseFloat(bestCombination.short.tradeSize.toFixed(2));
  
  // Prepare config with only tradeSize by default
  const optimizedSymbolConfig = {
    ...cleanedConfig,
    longVolumeThresholdUSDT: Math.round(bestCombination.long.threshold),
    shortVolumeThresholdUSDT: Math.round(bestCombination.short.threshold),
    tradeSize: finalLongTradeSize,  // Use long trade size as the default
    ...(Math.abs(finalLongTradeSize - finalShortTradeSize) > 0.01 && {
      longTradeSize: finalLongTradeSize,
      shortTradeSize: finalShortTradeSize
    }),
    maxPositionMarginUSDT: parseFloat(bestCombination.margin.toFixed(2)),
    leverage: bestCombination.leverage,
    tpPercent: parseFloat(bestCombination.tp.toFixed(2)),
    slPercent: parseFloat(bestCombination.sl.toFixed(2)),
    vwapProtection: vwapOptimized,
    vwapTimeframe: bestCombination.vwapTimeframe || currentVwapTimeframe,
    vwapLookback: Math.max(10, Math.min(500, bestCombination.vwapLookback || currentVwapLookback)),
    thresholdTimeWindow: Math.round(bestCombination.windowMs || currentTimeWindowMs),
    thresholdCooldown: Math.round(bestCombination.cooldownMs || currentCooldownMs)
  };

  console.log(`   ✅ ${symbol} optimized: $${currentDailyPnl.toFixed(2)}/day → $${optimizedDailyPnl.toFixed(2)}/day (+$${(optimizedDailyPnl - currentDailyPnl).toFixed(2)})`);

  return {
    symbol,
    current: {
      longThreshold: Math.max(1, currentLongThreshold),
      shortThreshold: Math.max(1, currentShortThreshold),
      tradeSize: baseTradeSize,
      longTradeSize: baseTradeSize,
      shortTradeSize: baseShortTradeSize,
      margin: currentMargin,
      leverage: leverageCurrent,
      tp: currentTp,
      sl: currentSl,
      longMaxPositions: longBasePositions,
      shortMaxPositions: shortBasePositions,
      thresholdTimeWindow: currentTimeWindowMs,
      thresholdCooldown: currentCooldownMs,
      performance: {
        long: currentLongBacktest,
        short: currentShortBacktest,
        totalPnl: currentTotalPnl,
        dailyPnl: currentDailyPnl
      }
    },
    optimized: {
      config: optimizedSymbolConfig,
      cleanedConfig,
      long: bestCombination.long,
      short: bestCombination.short,
      leverage: bestCombination.leverage,
      thresholdTimeWindow: bestCombination.windowMs,
      thresholdCooldown: bestCombination.cooldownMs,
      tp: bestCombination.tp,
      sl: bestCombination.sl,
      totalPnl: bestCombination.totalPnl,
      dailyPnl: optimizedDailyPnl,
      finalScore: bestCombination.finalScore,
      sharpeRatio: bestCombination.sharpeRatio,
      drawdownScore: bestCombination.drawdownScore
    },
    improvements: {
      long: longImprovement,
      short: shortImprovement,
      totalDaily: optimizedDailyPnl - currentDailyPnl
    },
    spanDays,
    capitalBudget
  };
}

// Continue with remaining code... (Part 3 follows)

// ============================================================================
// ENHANCED: Generate recommendations with progress tracking
// ============================================================================
async function generateRecommendations(deployableCapital, options = {}) {
  console.log('\n🎯 REALISTIC BACKTEST OPTIMIZATION');
  console.log('===================================\n');

  const recommendations = [];
  
  // Filter symbols if a specific symbol is provided
  const symbolsToOptimize = {};
  if (options.symbol) {
    if (config.symbols[options.symbol]) {
      symbolsToOptimize[options.symbol] = config.symbols[options.symbol];
      console.log(`🔍 Optimizing single symbol: ${options.symbol}`);
    } else {
      console.error(`❌ Symbol ${options.symbol} not found in config`);
      process.exit(1);
    }
  } else {
    Object.assign(symbolsToOptimize, config.symbols);
    console.log('🔍 Optimizing all symbols from config');
  }

  const symbolEntries = Object.entries(symbolsToOptimize);
  if (symbolEntries.length === 0) {
    return { 
      recommendations, 
      optimizedConfig: { ...config, symbols: {} }, 
      recommendedGlobalMax: 0 
    };
  }
  
  const optimizedConfig = JSON.parse(JSON.stringify({
    ...config,
    symbols: { ...symbolsToOptimize } // Only include symbols we're optimizing
  }));
  const sanitizedCapital = Number.isFinite(deployableCapital) && deployableCapital > 0 ? deployableCapital : 0;

  const baselineTotalMargin = Object.values(symbolsToOptimize).reduce((sum, cfg) => {
    const baseMargin = cfg.maxPositionMarginUSDT || (cfg.tradeSize || 20) * 5;
    const perSide = Number.isFinite(baseMargin) && baseMargin > 0 ? baseMargin : 0;
    return sum + perSide * 2;
  }, 0);

  const scaleFactor = baselineTotalMargin > 0 && sanitizedCapital > 0
    ? Math.max(0.25, Math.min(2.5, sanitizedCapital / baselineTotalMargin))
    : 1;

  console.log(`💰 Deployable capital: $${formatLargeNumber(sanitizedCapital)}`);
  console.log(`📊 Optimizing ${symbolEntries.length} symbols...\n`);

  const overallProgress = new ProgressIndicator(symbolEntries.length, '🔧 Overall Progress');

  for (let idx = 0; idx < symbolEntries.length; idx++) {
    const [symbol, symbolConfig] = symbolEntries[idx];

    const spanDays = getSymbolDataSpanDays(symbol);
    const fallbackMargin = (symbolConfig.tradeSize || 20) * 5;
    const baseMargin = symbolConfig.maxPositionMarginUSDT || fallbackMargin;
    const capitalBudget = Math.max(5, Math.min(sanitizedCapital || baseMargin, baseMargin * scaleFactor));

    const optimization = await optimizeSymbolParameters(symbol, symbolConfig, capitalBudget, spanDays);

    recommendations.push({
      symbol,
      currentLong: optimization.current.longThreshold,
      currentShort: optimization.current.shortThreshold,
      optimizedLong: optimization.optimized.config.longVolumeThresholdUSDT,
      optimizedShort: optimization.optimized.config.shortVolumeThresholdUSDT,
      currentTradeSize: optimization.current.tradeSize,
      currentLongTradeSize: optimization.current.longTradeSize,
      currentShortTradeSize: optimization.current.shortTradeSize,
      currentMargin: optimization.current.margin,
      currentLeverage: optimization.current.leverage,
      currentTp: optimization.current.tp,
      currentSl: optimization.current.sl,
      currentLongMaxPositions: optimization.current.longMaxPositions,
      currentShortMaxPositions: optimization.current.shortMaxPositions,
      currentTimeWindow: optimization.current.thresholdTimeWindow,
      currentCooldown: optimization.current.thresholdCooldown,
      optimizedTradeSize: optimization.optimized.config.tradeSize,
      optimizedLongTradeSize: optimization.optimized.config.longTradeSize,
      optimizedShortTradeSize: optimization.optimized.config.shortTradeSize,
      optimizedMargin: optimization.optimized.config.maxPositionMarginUSDT,
      optimizedLeverage: optimization.optimized.leverage,
      optimizedTp: optimization.optimized.tp,
      optimizedSl: optimization.optimized.sl,
      optimizedLongMaxPositions: optimization.optimized.long.maxPositions,
      optimizedShortMaxPositions: optimization.optimized.short.maxPositions,
      optimizedTimeWindow: optimization.optimized.config.thresholdTimeWindow,
      optimizedCooldown: optimization.optimized.config.thresholdCooldown,
      longImprovement: optimization.improvements.long,
      shortImprovement: optimization.improvements.short,
      totalDailyImprovement: optimization.improvements.totalDaily,
      currentPerformance: optimization.current.performance,
      optimizedPerformance: {
        long: optimization.optimized.long.result,
        short: optimization.optimized.short.result,
        totalPnl: optimization.optimized.totalPnl,
        dailyPnl: optimization.optimized.dailyPnl
      },
      optimizedScore: optimization.optimized.finalScore,
      optimizedSharpe: optimization.optimized.sharpeRatio,
      optimizedDrawdownScore: optimization.optimized.drawdownScore,
      optimizedConfig: optimization.optimized.config,
      spanDays: optimization.spanDays
    });

    optimizedConfig.symbols[symbol] = {
      ...optimization.optimized.cleanedConfig,
      ...optimization.optimized.config
    };

    overallProgress.update(1);
  }

  overallProgress.complete();

  console.log('\n📊 KEY BACKTEST INSIGHTS:');
  console.log('- Optimization considers thresholds, TP/SL, trade size, leverage, and margin per symbol');
  console.log('- Deployable capital scaled to $' + formatLargeNumber(sanitizedCapital));
  console.log('- VWAP protection disabled automatically where aggressive thresholds outperform');
  console.log();

  const recommendedGlobalMax = recommendations.length;
  const recommendedGlobalRounded = Math.max(1, Math.ceil(recommendedGlobalMax));

  if (!optimizedConfig.global) {
    optimizedConfig.global = {};
  }
  optimizedConfig.global.maxOpenPositions = recommendedGlobalRounded;

  const currentGlobalCap = config.global?.maxOpenPositions ?? 'n/a';
  console.log('📈 Recommended global max open positions: ' + recommendedGlobalRounded + ' (current ' + currentGlobalCap + ')');
  console.log();

  return { recommendations, optimizedConfig, recommendedGlobalMax: recommendedGlobalRounded };
}

function generateOptimizationSummary(recommendations, capitalOptimization, optimizedConfig, recommendedGlobalMax) {
  console.log('\n📋 OPTIMIZATION SUMMARY');
  console.log('======================\n');

  const totalDailyImprovement = recommendations.reduce((sum, rec) => sum + rec.totalDailyImprovement, 0);
  const totalCurrentDaily = recommendations.reduce((sum, rec) => sum + rec.currentPerformance.dailyPnl, 0);
  const totalOptimizedDaily = totalCurrentDaily + totalDailyImprovement;
  const improvementPercent = Math.abs(totalCurrentDaily) > 1e-6
    ? (totalDailyImprovement / Math.abs(totalCurrentDaily)) * 100
    : null;

  console.log('💰 PERFORMANCE SUMMARY:');
  console.log(`   Current Daily P&L: $${totalCurrentDaily.toFixed(2)}`);
  console.log(`   Optimized Daily P&L: $${totalOptimizedDaily.toFixed(2)}`);
  const improvementText = improvementPercent === null
    ? 'n/a (baseline ≈ 0)'
    : `${improvementPercent.toFixed(1)}%`;
  console.log(`   Total Daily Improvement: +$${totalDailyImprovement.toFixed(2)} (+${improvementText})`);
  console.log(`   Monthly Improvement: +$${(totalDailyImprovement * 30).toFixed(2)}\n`);

  console.log('🎯 RECOMMENDED THRESHOLD CHANGES:');
  recommendations.forEach(rec => {
    if (rec.optimizedLong !== rec.currentLong || rec.optimizedShort !== rec.currentShort) {
      console.log(`   ${rec.symbol}:`);
      if (rec.optimizedLong !== rec.currentLong) {
        console.log(`      LONG: $${formatLargeNumber(rec.currentLong)} → $${formatLargeNumber(rec.optimizedLong)} (+$${rec.longImprovement.toFixed(2)}/day)`);
      }
      if (rec.optimizedShort !== rec.currentShort) {
        console.log(`      SHORT: $${formatLargeNumber(rec.currentShort)} → $${formatLargeNumber(rec.optimizedShort)} (+$${rec.shortImprovement.toFixed(2)}/day)`);
      }
      console.log(`      Trade Size (L/S): $${rec.currentLongTradeSize.toFixed(2)} → $${rec.optimizedLongTradeSize.toFixed(2)} / $${rec.currentShortTradeSize.toFixed(2)} → $${rec.optimizedShortTradeSize.toFixed(2)}`);
      console.log(`      TP/SL: ${rec.currentTp.toFixed(2)}%/${rec.currentSl.toFixed(2)}% → ${rec.optimizedTp.toFixed(2)}%/${rec.optimizedSl.toFixed(2)}%`);
      console.log(`      Leverage: ${rec.currentLeverage.toFixed(2)}x → ${rec.optimizedLeverage.toFixed(2)}x`);
      if (rec.optimizedScore !== undefined) {
        console.log(`      Score: ${rec.optimizedScore.toFixed(2)} (PnL: ${formatWeightPercent(scoringWeights.percent.pnl)}, Sharpe: ${formatWeightPercent(scoringWeights.percent.sharpe)}, Drawdown: ${formatWeightPercent(scoringWeights.percent.drawdown)})`);
      }
    }
  });

  console.log();

  if (capitalOptimization.isOverallocated) {
    console.log('⚠️  CAPITAL ALLOCATION WARNING:');
    console.log(`   Current: $${formatLargeNumber(capitalOptimization.currentAllocation)}`);
    console.log(`   Safe Max: $${formatLargeNumber(capitalOptimization.maxSafeAllocation)}`);
    console.log(`   Overallocated by: $${formatLargeNumber(capitalOptimization.currentAllocation - capitalOptimization.maxSafeAllocation)}\n`);
  }

  if (recommendedGlobalMax) {
    const currentGlobal = config.global?.maxOpenPositions;
    console.log('🌐 Global Position Capacity:');
    console.log(`   Current maxOpenPositions: ${currentGlobal ?? 'n/a'}`);
    console.log(`   Recommended maxOpenPositions: ${recommendedGlobalMax}`);
    console.log();
  }

  return {
    summary: {
      currentDailyPnl: totalCurrentDaily,
      optimizedDailyPnl: totalOptimizedDaily,
      dailyImprovement: totalDailyImprovement,
      monthlyImprovement: totalDailyImprovement * 30,
      recommendedMaxOpenPositions: recommendedGlobalMax
    }
  };
}

function optimizeCapitalAllocation(accountInfo, recommendations, symbolConfigs = config.symbols) {
  console.log('\n💼 CAPITAL ALLOCATION OPTIMIZER');
  console.log('================================\n');

  const totalWalletBalance = parseFloat(accountInfo?.totalWalletBalance ?? 0);
  const availableBalance = parseFloat(accountInfo?.availableBalance ?? 0);
  const targetUtilization = 0.80;
  const maxAllocation = totalWalletBalance * targetUtilization;

  console.log(`💰 Total Wallet Balance: $${formatLargeNumber(totalWalletBalance)}`);
  console.log(`📊 Available Balance: $${formatLargeNumber(availableBalance)}`);
  console.log(`🎯 Target Utilization: ${(targetUtilization * 100).toFixed(0)}%`);
  console.log(`✅ Max Safe Allocation: $${formatLargeNumber(maxAllocation)}\n`);

  let currentTotalAllocation = 0;
  for (const [_symbol, symbolConfig] of Object.entries(symbolConfigs)) {
    currentTotalAllocation += symbolConfig.maxPositionMarginUSDT || 100;
  }

  console.log(`📈 Current Total Allocation: $${formatLargeNumber(currentTotalAllocation)} (${(currentTotalAllocation / totalWalletBalance * 100).toFixed(1)}% of total balance)`);

  if (currentTotalAllocation > maxAllocation) {
    console.log(`⚠️  OVERALLOCATED by $${formatLargeNumber(currentTotalAllocation - maxAllocation)}`);
    console.log(`💡 Recommendation: Reduce per-symbol allocation or disable low-performing symbols\n`);
  } else {
    console.log(`✅ Capital allocation within safe range\n`);
  }

  const rankedSymbols = recommendations.sort((a, b) => b.totalDailyImprovement - a.totalDailyImprovement);

  console.log('🏆 Symbol Priority by Expected Daily Profit Improvement:');
  console.log('Rank | Symbol    | Current Daily | Optimized Daily | Improvement | Allocation');
  console.log('-----|-----------|---------------|-----------------|-------------|------------');

  rankedSymbols.forEach((rec, i) => {
    const symbolConfig = symbolConfigs[rec.symbol];
    const allocation = symbolConfig.maxPositionMarginUSDT || 100;
    const currentDaily = rec.currentPerformance.dailyPnl;
    const optimizedDaily = currentDaily + rec.totalDailyImprovement;
    const improvement = rec.totalDailyImprovement;

    console.log(
      `${(i + 1).toString().padEnd(4)} | ` +
      `${rec.symbol.padEnd(9)} | ` +
      `$${currentDaily.toFixed(2).padEnd(13)} | ` +
      `$${optimizedDaily.toFixed(2).padEnd(15)} | ` +
      `+$${improvement.toFixed(2).padEnd(11)} | ` +
      `$${formatLargeNumber(allocation)}`
    );
  });

  console.log();

  if (currentTotalAllocation > maxAllocation) {
    console.log('💡 REBALANCING RECOMMENDATIONS:');
    const allocationPerSymbol = Math.floor(maxAllocation / Object.keys(config.symbols).length);

    console.log(`   Option 1: Equal allocation of $${formatLargeNumber(allocationPerSymbol)} per symbol`);
    console.log(`   Option 2: Weighted by expected profitability (top performers get more)`);
    console.log(`   Option 3: Disable bottom 25% performers and reallocate to top performers\n`);
  }

  return {
    currentAllocation: currentTotalAllocation,
    maxSafeAllocation: maxAllocation,
    isOverallocated: currentTotalAllocation > maxAllocation,
    rankedSymbols
  };
}

async function askYesNo(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

async function maybeApplyOptimizedConfig(originalConfig, optimizedConfig, summary) {
  const autoMode = FORCE_OPTIMIZER_OVERWRITE;
  const autoConfirm = FORCE_OPTIMIZER_CONFIRM || autoMode;

  const canPrompt = Boolean(process.stdin.isTTY || process.stdout.isTTY);
  if (!canPrompt && !autoMode) {
    console.log('⏩ No interactive TTY detected. Skipping config overwrite prompt.');
    return;
  }

  console.log('\n📝 Optimization Delta Overview:');
  if (summary) {
    console.log(`   Current Daily P&L: ${formatCurrency(summary.currentDailyPnl)}`);
    console.log(`   Optimized Daily P&L: ${formatCurrency(summary.optimizedDailyPnl)}`);
    console.log(`   Daily Improvement: ${formatCurrency(summary.dailyImprovement)} (Monthly +${formatCurrency(summary.monthlyImprovement)})`);
    if (summary.recommendedMaxOpenPositions) {
      console.log(`   Current maxOpenPositions: ${config.global?.maxOpenPositions ?? 'n/a'}`);
      console.log(`   Recommended maxOpenPositions: ${summary.recommendedMaxOpenPositions}`);
    }
  } else {
    console.log('   (Detailed summary unavailable)');
  }
  console.log();

  let confirm = autoConfirm;
  if (!confirm) {
    confirm = await askYesNo('💾 Overwrite config.user.json with optimized settings? (y/N): ');
  } else {
    console.log('🤖 Auto-confirm enabled via FORCE_OPTIMIZER_OVERWRITE/CONFIRM environment variables');
  }

  if (!confirm) {
    console.log('🔒 Keeping existing config.user.json');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `config.user.backup-${timestamp}.json`);

  fs.writeFileSync(backupPath, JSON.stringify(originalConfig, null, 2));
  fs.writeFileSync(configPath, JSON.stringify(optimizedConfig, null, 2));

  console.log(`💾 Backup saved to ${backupPath}`);
  console.log('✅ config.user.json overwritten with optimized settings');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    symbol: null,
    fast: false,
    help: false,
    vwap: 'auto' // 'on', 'off', or 'auto'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--symbol' || arg === '-s') && i + 1 < args.length) {
      options.symbol = args[++i].toUpperCase();
    } else if (arg.startsWith('--symbol=')) {
      options.symbol = arg.split('=')[1].toUpperCase();
    } else if (arg === '--fast' || arg === '-f') {
      options.fast = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if ((arg === '--vwap' || arg === '-v') && i + 1 < args.length) {
      const vwapArg = args[++i].toLowerCase();
      if (['on', 'off', 'auto'].includes(vwapArg)) {
        options.vwap = vwapArg;
      }
    } else if (arg.startsWith('--vwap=')) {
      const vwapArg = arg.split('=')[1].toLowerCase();
      if (['on', 'off', 'auto'].includes(vwapArg)) {
        options.vwap = vwapArg;
      }
    }
  }
  return options;
}

function showHelp() {
  console.log(`
Optimization Script Usage:
  node ${path.basename(__filename)} [options]

Options:
  --symbol <SYMBOL>    Optimize a specific trading pair (e.g., BTCUSDT)
  --fast, -f           Run in fast mode (reduced iterations for testing)
  --vwap <MODE>, -v    VWAP protection: 'on', 'off', or 'auto' (default: auto)
  --help, -h           Show this help message
`);
  process.exit(0);
}

async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
  }

  if (options.fast) {
    console.log('🚀 FAST MODE ENABLED: Using reduced iterations for faster testing');
  }
  try {
    const weightSummary = `${formatWeightPercent(scoringWeights.percent.pnl)} / ${formatWeightPercent(scoringWeights.percent.sharpe)} / ${formatWeightPercent(scoringWeights.percent.drawdown)}`;
    const weightLabel = scoringWeights.isDefault ? ' (default)' : '';
    console.log(`⚖️  Using scoring weights (PnL / Sharpe / Drawdown): ${weightSummary}${weightLabel}\n`);

    console.log('🌐 Fetching complete account snapshot...\n');
    const [balance, accountInfo, positions] = await Promise.all([
      getAccountBalance(config.api),
      getAccountInfo(config.api),
      getCurrentPositions(config.api)
    ]);

    const deployableCapital = parseFloat(accountInfo?.totalWalletBalance ?? balance.totalWalletBalance ?? 0);

    console.log(`\n💰 Account Balance: $${formatLargeNumber(balance.availableBalance)}`);
    console.log(`📊 Total Wallet: $${formatLargeNumber(deployableCapital)}`);
    console.log(`📈 Active Positions: ${positions.length}`);

    const { recommendations, optimizedConfig, recommendedGlobalMax } = await generateRecommendations(deployableCapital, options);

    const capitalOptimization = optimizeCapitalAllocation(accountInfo, recommendations, optimizedConfig.symbols);

    const optimizationResults = generateOptimizationSummary(recommendations, capitalOptimization, optimizedConfig, recommendedGlobalMax);

    // Save detailed results to JSON file
    const resultsPath = path.join(__dirname, 'optimization-results.json');
    const detailedResults = {
      timestamp: new Date().toISOString(),
      summary: optimizationResults.summary,
      recommendations,
      capitalOptimization,
      optimizedConfig
    };
    fs.writeFileSync(resultsPath, JSON.stringify(detailedResults, null, 2));
    console.log(`\n💾 Detailed results saved to: ${resultsPath}`);

    await maybeApplyOptimizedConfig(config, optimizedConfig, optimizationResults.summary);

    console.log('\n🎉 Optimization analysis complete!');
    const totalValue = parseFloat(accountInfo?.totalMarginBalance || balance.totalWalletBalance || 0);
    console.log(`💰 Total account value: $${formatLargeNumber(totalValue)}`);
    console.log('🚀 Strategy: Accumulate positions during cascades, profit on rebounds');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    db.close();
  }
}

// Run the analysis
main();
