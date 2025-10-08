/**
 * Server-only Optimizer Service
 * 
 * This file contains server-side only code for the optimizer service.
 * It should only be imported by API routes or other server-side code.
 * The .server.ts extension ensures this is only used on the server.
 */
import { loadConfig, saveConfig } from '@/lib/bot/config';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { errorLogger } from '../errorLogger';

const JOBS_STATE_PATH = path.join(process.cwd(), 'data', 'optimizer-jobs.json');
const OPTIMIZATION_RESULTS_PATH = path.join(process.cwd(), 'optimization-results.json');

// Job state management
interface OptimizationConfig {
  weights: {
    pnl: number;
    sharpe: number;
    drawdown: number;
  };
  capitalAllocation?: number;
  symbols?: string[];
}

interface OptimizationResults {
  timestamp: string;
  summary: {
    currentDailyPnl: number;
    optimizedDailyPnl: number;
    dailyImprovement: number;
    monthlyImprovement: number;
    improvementPercent: number | null;
    recommendedMaxOpenPositions: number;
  };
  recommendations: SymbolRecommendation[];
  capitalAllocation: any;
  optimizedConfig: any;
}

interface SymbolRecommendation {
  symbol: string;
  thresholds: {
    current: { long: number; short: number };
    optimized: { long: number; short: number };
  };
  settings: {
    current: any;
    optimized: any;
  };
  improvement: {
    long: number;
    short: number;
    total: number;
  };
  performance: any;
  scoring: any;
}

interface OptimizationJob {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  currentStage: string;
  updatedAt: number;
  startTime: number;
  estimatedTimeRemaining?: number;
  elapsedTime?: number; // Calculated on the fly when getting job status
  results?: OptimizationResults;
  error?: string;
  config: {
    weights: {
      pnl: number;
      sharpe: number;
      drawdown: number;
    };
    capitalAllocation?: number;
    symbols?: string[];
  };
}

// In-memory job storage (use Redis for production multi-instance)
// Persist map on globalThis so route handlers share state during dev
const globalForOptimizerJobs = globalThis as typeof globalThis & { __optimizerJobs?: Map<string, OptimizationJob> };
const jobs = globalForOptimizerJobs.__optimizerJobs ?? (globalForOptimizerJobs.__optimizerJobs = new Map<string, OptimizationJob>());

// Load jobs from disk when the module loads
if (typeof window === 'undefined') {
  hydrateJobsFromDisk();
}

function hydrateJobsFromDisk(): void {
  try {
    if (!fs.existsSync(JOBS_STATE_PATH)) {
      return;
    }
    const raw = fs.readFileSync(JOBS_STATE_PATH, 'utf8');
    if (!raw.trim()) {
      return;
    }
    const parsed = JSON.parse(raw) as OptimizationJob[];
    for (const job of parsed) {
      jobs.set(job.jobId, job);
    }
  } catch (error) {
    console.error('Failed to hydrate optimizer jobs from disk', error);
  }
}

function persistJobsToDisk(): void {
  try {
    const dir = path.dirname(JOBS_STATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const serialized = JSON.stringify(Array.from(jobs.values()), null, 2);
    fs.writeFileSync(JOBS_STATE_PATH, serialized);
  } catch (error) {
    console.error('Failed to persist optimizer jobs to disk', error);
  }
}

// Generate unique job ID
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Update job progress
function updateJobProgress(
  jobId: string,
  progress: number,
  stage: string,
  estimatedTimeRemaining?: number
) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.progress = Math.min(100, Math.max(0, progress));
  job.currentStage = stage;
  if (estimatedTimeRemaining !== undefined) {
    job.estimatedTimeRemaining = estimatedTimeRemaining;
  }
  job.updatedAt = Date.now();
  
  persistJobsToDisk();
  return job;
}

// Start optimization job
async function startOptimization(
  config: {
    weights: {
      pnl: number;
      sharpe: number;
      drawdown: number;
    };
    capitalAllocation?: number;
    symbols?: string[];
  }
): Promise<{ jobId: string; status: string }> {
  const jobId = generateJobId();
  
  const job: OptimizationJob = {
    jobId,
    status: 'queued',
    progress: 0,
    currentStage: 'Initializing',
    startTime: Date.now(),
    config,
    updatedAt: Date.now(),
  };

  jobs.set(jobId, job);
  persistJobsToDisk();

  // Start optimization in the background
  runOptimization(jobId).catch(error => {
    console.error(`Optimization job ${jobId} failed:`, error);
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error.message;
      job.updatedAt = Date.now();
      persistJobsToDisk();
    }
  });

  return { jobId, status: job.status };
}

// Get job status
function getJobStatus(jobId: string): OptimizationJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  
  return {
    ...job,
    // Calculate elapsed time in seconds
    elapsedTime: (Date.now() - job.startTime) / 1000,
  };
}

// Cancel optimization job
function cancelJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;
  
  if (job.status === 'running' || job.status === 'queued') {
    job.status = 'cancelled';
    job.updatedAt = Date.now();
    persistJobsToDisk();
    return true;
  }
  
  return false;
}

// Apply optimized configuration
async function applyOptimizedConfig(jobId: string): Promise<{
  success: boolean;
  backupPath?: string;
  error?: string;
}> {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'completed' || !job.results) {
    return { success: false, error: 'Job not found or not completed' };
  }

  try {
    // Create a backup of the current config
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'config');
    const backupPath = path.join(backupDir, `config.backup.${timestamp}.json`);
    
    // Ensure the config directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Load current config
    const currentConfig = await loadConfig();
    
    // Save current config as backup
    fs.writeFileSync(backupPath, JSON.stringify(currentConfig, null, 2));
    
    // Validate the optimized config before applying
    const optimizedConfig = job.results.optimizedConfig;
    if (!optimizedConfig || Object.keys(optimizedConfig).length === 0) {
      throw new Error('Optimized configuration is empty or invalid');
    }
    
    // Create a new config object that preserves the API keys and other critical settings
    const newConfig = {
      ...currentConfig,  // Keep existing config
      ...optimizedConfig, // Apply optimized settings
      // Ensure critical settings are preserved
      api: {
        ...currentConfig.api,
        ...(optimizedConfig.api || {})
      },
      global: {
        ...currentConfig.global,
        ...(optimizedConfig.global || {})
      }
    };
    
    // Save the new config
    await saveConfig(newConfig);
    
    console.log(`✅ Successfully applied optimized config. Backup saved to: ${backupPath}`);
    return { success: true, backupPath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error applying optimized config:', errorMessage, error);
    return { 
      success: false, 
      error: `Failed to apply optimized configuration: ${errorMessage}`
    };
  }
}

// Main optimization logic
async function runOptimization(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  try {
    // Update job status to running
    job.status = 'running';
    job.progress = 5;
    job.currentStage = 'Preparing optimization';
    persistJobsToDisk();

    // Load current config and historical data
    updateJobProgress(jobId, 10, 'Loading configuration and market data');
    const currentConfig = await loadConfig();
    
    // Get symbols to optimize (or use all from config if none specified)
    const symbols = job.config.symbols || Object.keys(currentConfig.symbols || {});
    
    // 1. Analyze historical performance for each symbol
    updateJobProgress(jobId, 20, 'Analyzing historical performance');
    const symbolAnalytics = await analyzeSymbolsPerformance(symbols);
    
    // 2. Calculate optimal capital allocation (simple example: allocate based on Sharpe ratio)
    updateJobProgress(jobId, 50, 'Calculating capital allocation');
    const capitalAllocation = calculateCapitalAllocation(symbolAnalytics);
    
    // 3. Generate trading recommendations
    updateJobProgress(jobId, 70, 'Generating recommendations');
    const recommendations = generateRecommendations(symbolAnalytics, currentConfig);
    
    // 4. Create optimized configuration
    updateJobProgress(jobId, 85, 'Creating optimized configuration');
    const optimizedConfig = createOptimizedConfig(
      currentConfig, 
      symbolAnalytics, 
      recommendations
    );
    
    // 5. Calculate performance metrics
    updateJobProgress(jobId, 90, 'Calculating performance metrics');
    const performanceMetrics = await calculatePerformanceMetrics(
      optimizedConfig,
      currentConfig
    );

    // Mark as completed with results
    job.status = 'completed';
    job.progress = 100;
    job.currentStage = 'Optimization complete';
    job.results = {
      timestamp: new Date().toISOString(),
      summary: {
        currentDailyPnl: performanceMetrics.currentDailyPnl,
        optimizedDailyPnl: performanceMetrics.optimizedDailyPnl,
        dailyImprovement: performanceMetrics.dailyImprovement,
        monthlyImprovement: performanceMetrics.monthlyImprovement,
        improvementPercent: performanceMetrics.improvementPercent,
        recommendedMaxOpenPositions: performanceMetrics.recommendedMaxOpenPositions,
      },
      recommendations: recommendations,
      capitalAllocation: capitalAllocation,
      optimizedConfig: optimizedConfig
    };
    job.updatedAt = Date.now();
    persistJobsToDisk();

  } catch (error) {
    console.error(`Optimization job ${jobId} failed:`, error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    job.updatedAt = Date.now();
    persistJobsToDisk();
    throw error;
  }
}

// Helper function to analyze historical performance of symbols
async function analyzeSymbolsPerformance(symbols: string[]) {
  // In a real implementation, you would fetch historical data here
  // This is a simplified example
  const analytics = new Map<string, any>();
  
  for (const symbol of symbols) {
    // Simulate fetching historical data and calculating metrics
    const sharpeRatio = Math.random() * 2; // Random value for demo
    const volatility = 0.05 + Math.random() * 0.1;
    const avgReturn = 0.001 + Math.random() * 0.005;
    
    analytics.set(symbol, {
      symbol,
      sharpeRatio,
      volatility,
      avgReturn,
      // Add more metrics as needed
    });
  }
  
  return analytics;
}

// Calculate capital allocation based on performance metrics
function calculateCapitalAllocation(analytics: Map<string, any>) {
  const allocation: Record<string, number> = {};
  let totalScore = 0;
  
  // Calculate total score (using Sharpe ratio as weight)
  analytics.forEach((data) => {
    const score = Math.max(0, data.sharpeRatio); // Ensure non-negative
    totalScore += score;
  });
  
  // Calculate allocation percentages
  if (totalScore > 0) {
    analytics.forEach((data, symbol) => {
      allocation[symbol] = data.sharpeRatio / totalScore;
    });
  } else {
    // If no positive scores, distribute equally
    const equalShare = 1 / analytics.size;
    analytics.forEach((_, symbol) => {
      allocation[symbol] = equalShare;
    });
  }
  
  return allocation;
}

// Generate trading recommendations
function generateRecommendations(
  analytics: Map<string, any>,
  currentConfig: any
) {
  const recommendations: any[] = [];
  
  // Define threshold constants at function scope
  const MIN_THRESHOLD = 5000;  // Absolute minimum $5,000
  const MAX_THRESHOLD = 100000; // Maximum $100,000
  
  analytics.forEach((data, symbol) => {
    const currentSettings = currentConfig.symbols?.[symbol] || {};
    
    // Get pair-specific volume data
    const pairVolume = data.avgVolume || 0; // Expected in USD
    const pairVolatility = data.volatility || 0.02; // 2% default volatility
    
    // Calculate initial base threshold as a percentage of average volume
    // More liquid pairs can have higher thresholds
    const baseThresholdPercentage = 0.05; // Start with 5% of average volume
    const initialBaseThreshold = pairVolume * baseThresholdPercentage;
    
    // Set dynamic minimum based on pair volume (0.5% to 2% of average volume)
    const minThresholdPercentage = 0.005 + (0.015 * (1 - Math.min(1, pairVolume / 5000000)));
    const pairMinThreshold = Math.max(MIN_THRESHOLD, pairVolume * minThresholdPercentage);
    
    // Set maximum threshold (20% of average volume, up to $100k)
    const pairMaxThreshold = Math.min(MAX_THRESHOLD, pairVolume * 0.2);
    
    // Adjust for volatility - higher volatility needs higher thresholds
    const volatilityMultiplier = 1 + (pairVolatility * 10);
    
    // Get current thresholds or calculate new ones
    const currentLong = currentSettings.longThreshold || MIN_THRESHOLD;
    const currentShort = currentSettings.shortThreshold || MIN_THRESHOLD;
    
    // Calculate optimized thresholds based on market conditions
    // 1. Volume Analysis - Higher volume pairs can use higher thresholds
    // Scale with square root of volume in millions, capped at 3x
    const volumeFactor = Math.min(3, Math.sqrt(pairVolume / 1000000));
    
    // 2. Volatility Adjustment - More volatile markets need higher thresholds
    const volatilityFactor = 1 + (pairVolatility * 5); // Higher volatility = higher threshold
    
    // 3. Liquidity Analysis - Consider order book depth if available
    const liquidityScore = data.liquidityScore || 1; // 1 = average liquidity
    
    // Calculate new thresholds (minimum $10,000, scales with volume and volatility)
    const MIN_LIQUIDATION_VOLUME = 10000; // Minimum $10,000 for liquidation hunting
    const baseThreshold = MIN_LIQUIDATION_VOLUME * volumeFactor * volatilityFactor * liquidityScore;
    
    // Ensure thresholds are within bounds and never negative
    const newLong = Math.max(pairMinThreshold, Math.min(pairMaxThreshold, baseThreshold));
    const newShort = newLong; // Keep long and short thresholds the same for consistency
    
    recommendations.push({
      symbol,
      // Add thresholds at the root level as expected by the frontend
      thresholds: {
        current: {
          long: currentLong,
          short: currentShort
        },
        optimized: {
          long: newLong,
          short: newShort
        }
      },
      settings: {
        current: {
          ...currentSettings,
          thresholdTimeWindow: currentSettings.thresholdTimeWindow || 60000,
          thresholdCooldown: currentSettings.thresholdCooldown || 0,
          tradeSize: currentSettings.tradeSize || 100,  // Default trade size
          leverage: currentSettings.leverage || 1,      // Default leverage
          // Add other required settings with defaults
        },
        optimized: {
          ...currentSettings, // Keep all current settings
          thresholdTimeWindow: Math.max(30000, Math.min(120000, 
            (currentSettings.thresholdTimeWindow || 60000) * (1 + (0.5 - data.volatility * 5)))),
          thresholdCooldown: Math.max(0, Math.min(300000, 
            (currentSettings.thresholdCooldown || 0) * (0.8 + (data.volatility * 0.4)))),
          // Add optimized trade size and leverage with some adjustments
          tradeSize: Math.max(10, Math.min(1000, (currentSettings.tradeSize || 100) * (1 + (data.avgReturn * 10)))),
          leverage: Math.max(1, Math.min(10, (currentSettings.leverage || 1) * (1 + (data.sharpeRatio * 0.2)))),
          // Add other optimized settings
        }
      },
      metrics: {
        sharpeRatio: data.sharpeRatio,
        volatility: data.volatility,
        expectedReturn: data.avgReturn,
      },
      improvement: {
        long: newLong - currentLong,
        short: Math.abs(newShort - currentShort),
        total: (newLong - currentLong) + Math.abs(newShort - currentShort)
      }
    });
  });
  
  return recommendations;
}

// Create optimized configuration based on analysis
function createOptimizedConfig(
  currentConfig: any,
  analytics: Map<string, any>,
  recommendations: any[]
) {
  const optimized = { ...currentConfig };
  
  // Update global settings
  optimized.global = {
    ...optimized.global,
    // Example: Adjust position size based on overall volatility
    positionSize: Math.min(0.1, 0.05 / Math.max(0.01, Array.from(analytics.values())
      .reduce((sum, data) => sum + data.volatility, 0) / analytics.size))
  };
  
  // Update symbol-specific settings
  optimized.symbols = { ...optimized.symbols };
  recommendations.forEach(rec => {
    if (!optimized.symbols[rec.symbol]) {
      optimized.symbols[rec.symbol] = {};
    }
    
    optimized.symbols[rec.symbol] = {
      ...optimized.symbols[rec.symbol],
      ...rec.recommendedSettings,
    };
  });
  
  return optimized;
}

// Calculate performance metrics
async function calculatePerformanceMetrics(
  optimizedConfig: any,
  currentConfig: any
) {
  // In a real implementation, you would backtest both configs
  // This is a simplified example with mock data
  const currentDailyPnl = 1000;
  const optimizedDailyPnl = currentDailyPnl * (1 + Math.random() * 0.5); // 0-50% improvement
  const dailyImprovement = optimizedDailyPnl - currentDailyPnl;
  
  return {
    currentDailyPnl,
    optimizedDailyPnl,
    dailyImprovement,
    monthlyImprovement: dailyImprovement * 30, // Simple projection
    improvementPercent: (dailyImprovement / currentDailyPnl) * 100,
    recommendedMaxOpenPositions: 5, // Could be dynamic based on risk metrics
  };
}

// Clean up old jobs (call periodically)
function cleanupOldJobs(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  let count = 0;
  
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.startTime > maxAgeMs) {
      jobs.delete(jobId);
      count++;
    }
  }
  
  if (count > 0) {
    persistJobsToDisk();
  }
  
  return count;
}

// Reset optimizer state
function resetOptimizerState(): void {
  jobs.clear();
  
  try {
    // Remove the jobs file if it exists
    if (fs.existsSync(JOBS_STATE_PATH)) {
      fs.unlinkSync(JOBS_STATE_PATH);
    }
    
    // Remove optimization results if they exist
    if (fs.existsSync(OPTIMIZATION_RESULTS_PATH)) {
      fs.unlinkSync(OPTIMIZATION_RESULTS_PATH);
    }
  } catch (error) {
    console.error('Error cleaning up optimizer files:', error);
    // Don't rethrow - we've already cleared the in-memory state
  }
}

// Export all functions that should be available to API routes
export {
  startOptimization,
  getJobStatus,
  cancelJob,
  applyOptimizedConfig,
  cleanupOldJobs,
  resetOptimizerState
};

// Export types for API routes
export type {
  OptimizationJob,
  OptimizationConfig,
  OptimizationResults,
  SymbolRecommendation,
};
