/**
 * Chart Data Manager - Efficient data handling for financial charts
 * Handles data aggregation, caching, and real-time updates
 */

export interface OptimizedDataPoint {
  time: number; // Unix timestamp (seconds)
  value: number; // Primary value (netPnL)
  volume?: number; // Optional volume/trade count
  meta?: {
    realizedPnl: number;
    commission: number;
    fundingFee: number;
    tradeCount: number;
  };
}

export interface ChartDataRange {
  start: number;
  end: number;
  aggregation: AggregationLevel;
}

export enum AggregationLevel {
  MINUTE = '1m',
  FIVE_MINUTES = '5m',
  HOUR = '1h',
  DAY = '1d',
  WEEK = '1w'
}

export interface ChartMetrics {
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  bestDay: OptimizedDataPoint | null;
  worstDay: OptimizedDataPoint | null;
  avgDailyPnl: number;
  maxDrawdown: number;
}

class ChartDataManager {
  private cache = new Map<string, OptimizedDataPoint[]>();
  private metricsCache = new Map<string, ChartMetrics>();
  private maxCacheSize = 100; // Limit cache entries
  private realtimeBuffer: OptimizedDataPoint[] = [];
  private bufferFlushTimer: NodeJS.Timeout | null = null;

  /**
   * Get optimal aggregation level based on time range
   */
  private getOptimalAggregation(start: number, end: number): AggregationLevel {
    const duration = end - start; // seconds

    if (duration <= 86400) return AggregationLevel.MINUTE; // 1 day
    if (duration <= 604800) return AggregationLevel.FIVE_MINUTES; // 1 week
    if (duration <= 2592000) return AggregationLevel.HOUR; // 30 days
    if (duration <= 31536000) return AggregationLevel.DAY; // 1 year
    return AggregationLevel.WEEK; // > 1 year
  }

  /**
   * Aggregate data points based on level
   */
  private aggregateData(data: OptimizedDataPoint[], level: AggregationLevel): OptimizedDataPoint[] {
    if (data.length === 0) return [];

    const interval = this.getAggregationInterval(level);
    const aggregated = new Map<number, OptimizedDataPoint>();

    data.forEach(point => {
      const bucket = Math.floor(point.time / interval) * interval;

      if (!aggregated.has(bucket)) {
        aggregated.set(bucket, {
          time: bucket,
          value: 0,
          volume: 0,
          meta: {
            realizedPnl: 0,
            commission: 0,
            fundingFee: 0,
            tradeCount: 0
          }
        });
      }

      const bucketData = aggregated.get(bucket)!;
      bucketData.value += point.value;
      bucketData.volume = (bucketData.volume || 0) + (point.volume || 0);

      if (point.meta && bucketData.meta) {
        bucketData.meta.realizedPnl += point.meta.realizedPnl;
        bucketData.meta.commission += point.meta.commission;
        bucketData.meta.fundingFee += point.meta.fundingFee;
        bucketData.meta.tradeCount += point.meta.tradeCount;
      }
    });

    return Array.from(aggregated.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Get aggregation interval in seconds
   */
  private getAggregationInterval(level: AggregationLevel): number {
    switch (level) {
      case AggregationLevel.MINUTE: return 60;
      case AggregationLevel.FIVE_MINUTES: return 300;
      case AggregationLevel.HOUR: return 3600;
      case AggregationLevel.DAY: return 86400;
      case AggregationLevel.WEEK: return 604800;
      default: return 86400;
    }
  }

  /**
   * Convert legacy data format to optimized format
   */
  convertLegacyData(legacyData: any[]): OptimizedDataPoint[] {
    return legacyData.map(item => ({
      time: new Date(item.date).getTime() / 1000,
      value: item.netPnl || 0,
      volume: item.tradeCount || 0,
      meta: {
        realizedPnl: item.realizedPnl || 0,
        commission: item.commission || 0,
        fundingFee: item.fundingFee || 0,
        tradeCount: item.tradeCount || 0
      }
    }));
  }

  /**
   * Get data for specific range with optimal aggregation
   */
  getDataForRange(start: number, end: number, rawData?: OptimizedDataPoint[]): OptimizedDataPoint[] {
    const aggregation = this.getOptimalAggregation(start, end);
    const cacheKey = `${aggregation}_${start}_${end}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // If no raw data provided, return empty (will be loaded from API)
    if (!rawData) return [];

    // Aggregate and cache
    const aggregated = this.aggregateData(rawData, aggregation);
    this.cache.set(cacheKey, aggregated);

    // Maintain cache size
    if (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    return aggregated;
  }

  /**
   * Calculate performance metrics efficiently
   */
  calculateMetrics(data: OptimizedDataPoint[]): ChartMetrics {
    if (data.length === 0) {
      return {
        totalPnl: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        bestDay: null,
        worstDay: null,
        avgDailyPnl: 0,
        maxDrawdown: 0
      };
    }

    // Calculate basic metrics
    const totalPnl = data.reduce((sum, d) => sum + d.value, 0);
    const avgDailyPnl = totalPnl / data.length;

    // Find best/worst days
    let bestDay = data[0];
    let worstDay = data[0];
    data.forEach(point => {
      if (point.value > bestDay.value) bestDay = point;
      if (point.value < worstDay.value) worstDay = point;
    });

    // Calculate win rate
    const winningDays = data.filter(d => d.value > 0).length;
    const winRate = data.length > 0 ? (winningDays / data.length) * 100 : 0;

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    data.forEach(point => {
      cumulative += point.value;
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    // Calculate profit factor
    const totalWins = data.filter(d => d.value > 0).reduce((sum, d) => sum + d.value, 0);
    const totalLosses = Math.abs(data.filter(d => d.value < 0).reduce((sum, d) => sum + d.value, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Calculate Sharpe ratio (simplified)
    const returns = data.map(d => d.value);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

    return {
      totalPnl,
      winRate,
      profitFactor,
      sharpeRatio,
      bestDay,
      worstDay,
      avgDailyPnl,
      maxDrawdown
    };
  }

  /**
   * Get cached metrics
   */
  getMetrics(data: OptimizedDataPoint[]): ChartMetrics {
    const cacheKey = `metrics_${data.length}_${data[0]?.time || 0}_${data[data.length - 1]?.time || 0}`;

    if (this.metricsCache.has(cacheKey)) {
      return this.metricsCache.get(cacheKey)!;
    }

    const metrics = this.calculateMetrics(data);
    this.metricsCache.set(cacheKey, metrics);

    return metrics;
  }

  /**
   * Add real-time update to buffer
   */
  addRealtimeUpdate(update: OptimizedDataPoint): void {
    this.realtimeBuffer.push(update);

    // Flush buffer every 100ms
    if (!this.bufferFlushTimer) {
      this.bufferFlushTimer = setTimeout(() => {
        this.flushRealtimeBuffer();
      }, 100);
    }
  }

  /**
   * Flush buffered updates
   */
  private flushRealtimeBuffer(): void {
    if (this.realtimeBuffer.length === 0) return;

    // Process buffered updates
    // This would typically update the chart directly
    console.log(`[ChartDataManager] Flushing ${this.realtimeBuffer.length} real-time updates`);

    this.realtimeBuffer = [];
    this.bufferFlushTimer = null;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.metricsCache.clear();
    this.realtimeBuffer = [];
    if (this.bufferFlushTimer) {
      clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): { cacheSize: number; metricsCacheSize: number; bufferSize: number } {
    return {
      cacheSize: this.cache.size,
      metricsCacheSize: this.metricsCache.size,
      bufferSize: this.realtimeBuffer.length
    };
  }
}

// Export singleton instance
export const chartDataManager = new ChartDataManager();
export default chartDataManager;