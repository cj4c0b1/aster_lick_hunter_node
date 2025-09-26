/**
 * Rate Limit Monitor
 *
 * Provides monitoring and alerting for rate limit usage
 * Tracks API usage patterns and warns when approaching limits
 */

import { getRateLimitManager } from './rateLimitManager';
import { EventEmitter } from 'events';

export interface RateLimitStats {
  currentWeight: number;
  maxWeight: number;
  weightPercent: number;
  currentOrders: number;
  maxOrders: number;
  orderPercent: number;
  queueLength: number;
  isCircuitBreakerActive: boolean;
  warningLevel: 'safe' | 'caution' | 'warning' | 'critical';
}

export class RateLimitMonitor extends EventEmitter {
  private rateLimitManager = getRateLimitManager();
  private monitorInterval: NodeJS.Timeout | null = null;
  private lastStats: RateLimitStats | null = null;

  // Thresholds for warnings
  private readonly thresholds = {
    caution: 50,   // 50% usage
    warning: 70,   // 70% usage
    critical: 85   // 85% usage
  };

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Start monitoring rate limits
   */
  public startMonitoring(intervalMs: number = 5000): void {
    if (this.monitorInterval) {
      this.stopMonitoring();
    }

    this.monitorInterval = setInterval(() => {
      this.checkUsage();
    }, intervalMs);

    // Initial check
    this.checkUsage();
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Setup event listeners on rate limit manager
   */
  private setupEventListeners(): void {
    this.rateLimitManager.on('rateLimitExceeded', (data) => {
      console.error(`⚠️ RATE LIMIT EXCEEDED - Backing off for ${data.backoffMs}ms`);
      this.emit('rateLimitExceeded', data);
    });

    this.rateLimitManager.on('highUsage', (usage) => {
      console.warn(`⚠️ HIGH API USAGE - Weight: ${usage.weightPercent.toFixed(1)}%, Orders: ${usage.orderPercent.toFixed(1)}%`);
      this.emit('highUsage', usage);
    });

    this.rateLimitManager.on('circuitBreakerReset', () => {
      console.log('✅ Circuit breaker reset - Normal operations resumed');
      this.emit('circuitBreakerReset');
    });
  }

  /**
   * Check current usage and emit appropriate events
   */
  private checkUsage(): void {
    const usage = this.rateLimitManager.getCurrentUsage();
    const queueStats = this.rateLimitManager.getQueueStats();

    // Determine warning level
    let warningLevel: 'safe' | 'caution' | 'warning' | 'critical' = 'safe';
    const maxPercent = Math.max(usage.weightPercent, usage.orderPercent);

    if (maxPercent >= this.thresholds.critical) {
      warningLevel = 'critical';
    } else if (maxPercent >= this.thresholds.warning) {
      warningLevel = 'warning';
    } else if (maxPercent >= this.thresholds.caution) {
      warningLevel = 'caution';
    }

    const stats: RateLimitStats = {
      currentWeight: usage.weight,
      maxWeight: 2400, // From config
      weightPercent: usage.weightPercent,
      currentOrders: usage.orders,
      maxOrders: 1200, // From config
      orderPercent: usage.orderPercent,
      queueLength: usage.queueLength,
      isCircuitBreakerActive: false, // Would need to expose from manager
      warningLevel
    };

    // Check for level changes
    if (this.lastStats && this.lastStats.warningLevel !== stats.warningLevel) {
      this.handleLevelChange(this.lastStats.warningLevel, stats.warningLevel, stats);
    }

    // Emit regular stats update
    this.emit('stats', stats);

    // Log if there's a queue building up
    if (queueStats.total > 0) {
      console.log(`📊 Rate Limit Queue: ${queueStats.total} requests pending`);
      if (queueStats.oldestWaitTime > 5000) {
        console.warn(`⏳ Oldest request waiting: ${(queueStats.oldestWaitTime / 1000).toFixed(1)}s`);
      }
    }

    this.lastStats = stats;
  }

  /**
   * Handle warning level changes
   */
  private handleLevelChange(
    oldLevel: string,
    newLevel: string,
    stats: RateLimitStats
  ): void {
    const emoji = {
      safe: '✅',
      caution: '🟡',
      warning: '🟠',
      critical: '🔴'
    };

    console.log(`${emoji[newLevel as keyof typeof emoji]} Rate Limit Status: ${oldLevel} → ${newLevel}`);
    console.log(`  Weight: ${stats.currentWeight}/${stats.maxWeight} (${stats.weightPercent.toFixed(1)}%)`);
    console.log(`  Orders: ${stats.currentOrders}/${stats.maxOrders} (${stats.orderPercent.toFixed(1)}%)`);

    this.emit('levelChange', { oldLevel, newLevel, stats });

    // Take action based on new level
    switch (newLevel) {
      case 'critical':
        console.error('🚨 CRITICAL: Approaching rate limits! Non-essential requests will be delayed.');
        break;
      case 'warning':
        console.warn('⚠️ WARNING: High API usage detected. Consider reducing request frequency.');
        break;
      case 'caution':
        console.log('📊 CAUTION: Moderate API usage. Monitoring closely.');
        break;
      case 'safe':
        console.log('✅ Rate limits normalized.');
        break;
    }
  }

  /**
   * Get current stats
   */
  public getCurrentStats(): RateLimitStats | null {
    return this.lastStats;
  }

  /**
   * Get formatted status string
   */
  public getStatusString(): string {
    if (!this.lastStats) {
      return 'No data available';
    }

    const { weightPercent, orderPercent, queueLength, warningLevel } = this.lastStats;
    const emoji = {
      safe: '✅',
      caution: '🟡',
      warning: '🟠',
      critical: '🔴'
    };

    return `${emoji[warningLevel]} Weight: ${weightPercent.toFixed(1)}% | Orders: ${orderPercent.toFixed(1)}% | Queue: ${queueLength}`;
  }

  /**
   * Check if it's safe to make non-critical requests
   */
  public isSafeForNonCritical(): boolean {
    if (!this.lastStats) return true;
    return this.lastStats.warningLevel === 'safe' || this.lastStats.warningLevel === 'caution';
  }

  /**
   * Get recommendations based on current usage
   */
  public getRecommendations(): string[] {
    if (!this.lastStats) return [];

    const recommendations: string[] = [];
    const { weightPercent, orderPercent, queueLength } = this.lastStats;

    if (weightPercent > 70) {
      recommendations.push('Consider using WebSocket streams for market data instead of REST API');
      recommendations.push('Batch multiple operations where possible');
    }

    if (orderPercent > 70) {
      recommendations.push('Use batch orders API to place multiple orders at once');
      recommendations.push('Consider reducing order frequency or consolidating orders');
    }

    if (queueLength > 10) {
      recommendations.push('High queue length detected - reduce request frequency');
      recommendations.push('Prioritize critical operations over market data requests');
    }

    if (this.lastStats.warningLevel === 'critical') {
      recommendations.push('URGENT: Pause all non-essential operations immediately');
      recommendations.push('Switch to WebSocket streams for all data feeds');
    }

    return recommendations;
  }
}

// Singleton instance
let monitorInstance: RateLimitMonitor | null = null;

export function getRateLimitMonitor(): RateLimitMonitor {
  if (!monitorInstance) {
    monitorInstance = new RateLimitMonitor();
  }
  return monitorInstance;
}

/**
 * Console logger for rate limit status
 */
export function startRateLimitLogging(intervalMs: number = 30000): void {
  const monitor = getRateLimitMonitor();

  // Start monitoring
  monitor.startMonitoring(5000);

  // Log status periodically
  setInterval(() => {
    const status = monitor.getStatusString();
    const recommendations = monitor.getRecommendations();

    console.log(`\n📊 Rate Limit Status: ${status}`);

    if (recommendations.length > 0) {
      console.log('💡 Recommendations:');
      recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
  }, intervalMs);

  console.log('✅ Rate limit monitoring started');
}