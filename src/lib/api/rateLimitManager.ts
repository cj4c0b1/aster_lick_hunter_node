/**
 * Rate Limit Manager for Aster Finance API
 *
 * Tracks and manages API rate limits to prevent 429 errors and IP bans.
 * Implements sliding window counters, priority queuing, and smart capacity reservation.
 */

import { EventEmitter } from 'events';

export enum RequestPriority {
  CRITICAL = 0,  // Order placement/cancellation - never delayed
  HIGH = 1,      // Position management - minimal delay
  MEDIUM = 2,    // Account info - can be delayed
  LOW = 3        // Market data - use WebSocket when possible
}

export interface RateLimitConfig {
  maxRequestWeight: number;  // Default: 2400 per minute
  maxOrderCount: number;     // Default: 1200 per minute
  reservePercent: number;     // Default: 30% reserved for orders
  windowMs: number;          // Default: 60000 (1 minute)
  enableBatching: boolean;   // Default: true
  queueTimeout: number;      // Default: 30000ms
}

export interface RequestInfo {
  weight: number;
  isOrder: boolean;
  priority: RequestPriority;
  timestamp: number;
}

export interface QueuedRequest {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  info: RequestInfo;
  addedAt: number;
}

export class RateLimitManager extends EventEmitter {
  private config: RateLimitConfig;
  private requestHistory: RequestInfo[] = [];
  private queue: QueuedRequest[] = [];
  private processing = false;
  private circuitBreakerActive = false;
  private circuitBreakerUntil = 0;
  private backoffMultiplier = 1;
  private lastRequestTime = 0;

  // Current usage from API headers
  private currentWeight = 0;
  private currentOrderCount = 0;
  private lastHeaderUpdate = 0;

  constructor(config: Partial<RateLimitConfig> = {}) {
    super();

    this.config = {
      maxRequestWeight: config.maxRequestWeight || 2400,
      maxOrderCount: config.maxOrderCount || 1200,
      reservePercent: config.reservePercent || 30,
      windowMs: config.windowMs || 60000,
      enableBatching: config.enableBatching ?? true,
      queueTimeout: config.queueTimeout || 30000
    };

    // Clean up old requests every 10 seconds
    setInterval(() => this.cleanupHistory(), 10000);

    // Process queue
    setInterval(() => this.processQueue(), 100);
  }

  /**
   * Check if a request can be made immediately
   */
  public canMakeRequest(weight: number, isOrder: boolean, priority: RequestPriority): boolean {
    if (this.circuitBreakerActive && Date.now() < this.circuitBreakerUntil) {
      return priority === RequestPriority.CRITICAL;
    }

    const usage = this.getCurrentUsage();
    const reservedWeight = this.config.maxRequestWeight * (this.config.reservePercent / 100);
    const reservedOrders = this.config.maxOrderCount * (this.config.reservePercent / 100);

    // Critical requests (orders) can use reserved capacity
    if (priority === RequestPriority.CRITICAL) {
      return usage.weight + weight <= this.config.maxRequestWeight &&
             (!isOrder || usage.orders < this.config.maxOrderCount);
    }

    // Non-critical requests cannot use reserved capacity
    const availableWeight = this.config.maxRequestWeight - reservedWeight;
    const availableOrders = this.config.maxOrderCount - reservedOrders;

    return usage.weight + weight <= availableWeight &&
           (!isOrder || usage.orders < availableOrders);
  }

  /**
   * Execute a request with rate limiting
   */
  public async executeRequest<T>(
    request: () => Promise<T>,
    weight: number,
    isOrder: boolean = false,
    priority: RequestPriority = RequestPriority.MEDIUM
  ): Promise<T> {
    // Immediate execution for critical requests if possible
    if (priority === RequestPriority.CRITICAL &&
        this.canMakeRequest(weight, isOrder, priority)) {
      return this.executeImmediate(request, weight, isOrder, priority);
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        execute: request,
        resolve,
        reject,
        info: {
          weight,
          isOrder,
          priority,
          timestamp: Date.now()
        },
        addedAt: Date.now()
      };

      this.queue.push(queuedRequest);
      this.queue.sort((a, b) => a.info.priority - b.info.priority);

      // Check for timeout
      setTimeout(() => {
        const index = this.queue.indexOf(queuedRequest);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new Error('Request timeout - rate limit queue full'));
        }
      }, this.config.queueTimeout);
    });
  }

  /**
   * Execute request immediately and track it
   */
  private async executeImmediate<T>(
    request: () => Promise<T>,
    weight: number,
    isOrder: boolean,
    priority: RequestPriority
  ): Promise<T> {
    // Add to history
    this.requestHistory.push({
      weight,
      isOrder,
      priority,
      timestamp: Date.now()
    });

    this.lastRequestTime = Date.now();

    try {
      const result = await request();
      this.backoffMultiplier = 1; // Reset on success
      return result;
    } catch (error: any) {
      // Handle 429 rate limit error
      if (error.response?.status === 429) {
        this.handle429Error();
      }
      throw error;
    }
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Process requests by priority
      for (let i = 0; i < this.queue.length; i++) {
        const request = this.queue[i];

        // Check if request has timed out
        if (Date.now() - request.addedAt > this.config.queueTimeout) {
          this.queue.splice(i, 1);
          request.reject(new Error('Request timeout'));
          i--;
          continue;
        }

        // Check if we can execute this request
        if (this.canMakeRequest(request.info.weight, request.info.isOrder, request.info.priority)) {
          this.queue.splice(i, 1);

          try {
            const result = await this.executeImmediate(
              request.execute,
              request.info.weight,
              request.info.isOrder,
              request.info.priority
            );
            request.resolve(result);
          } catch (error) {
            request.reject(error);
          }

          // Small delay between requests to avoid bursts
          if (this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          i--; // Adjust index since we removed an item
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Handle 429 rate limit error
   */
  private handle429Error(): void {
    this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 16);
    const backoffTime = 1000 * this.backoffMultiplier;

    this.circuitBreakerActive = true;
    this.circuitBreakerUntil = Date.now() + backoffTime;

    this.emit('rateLimitExceeded', {
      backoffMs: backoffTime,
      currentUsage: this.getCurrentUsage()
    });

    console.warn(`Rate limit hit! Backing off for ${backoffTime}ms`);
  }

  /**
   * Update usage from response headers
   */
  public updateFromHeaders(headers: any): void {
    const weightHeader = headers['x-mbx-used-weight-1m'];
    const orderHeader = headers['x-mbx-order-count-1m'];

    if (weightHeader) {
      this.currentWeight = parseInt(weightHeader);
      this.lastHeaderUpdate = Date.now();
    }

    if (orderHeader) {
      this.currentOrderCount = parseInt(orderHeader);
    }

    // Emit usage update
    const usage = this.getCurrentUsage();
    if (usage.weightPercent > 80 || usage.orderPercent > 80) {
      this.emit('highUsage', usage);
    }
  }

  /**
   * Get current usage statistics
   */
  public getCurrentUsage(): {
    weight: number;
    orders: number;
    weightPercent: number;
    orderPercent: number;
    queueLength: number;
  } {
    // Use header values if recent, otherwise calculate from history
    const now = Date.now();
    const useHeaders = this.lastHeaderUpdate && (now - this.lastHeaderUpdate < 5000);

    let weight = useHeaders ? this.currentWeight : 0;
    let orders = 0;

    if (!useHeaders) {
      const cutoff = now - this.config.windowMs;
      for (const req of this.requestHistory) {
        if (req.timestamp > cutoff) {
          weight += req.weight;
          if (req.isOrder) orders++;
        }
      }
    } else {
      // Count orders from history
      const cutoff = now - this.config.windowMs;
      orders = this.requestHistory.filter(
        req => req.timestamp > cutoff && req.isOrder
      ).length;
    }

    return {
      weight,
      orders,
      weightPercent: (weight / this.config.maxRequestWeight) * 100,
      orderPercent: (orders / this.config.maxOrderCount) * 100,
      queueLength: this.queue.length
    };
  }

  /**
   * Clean up old request history
   */
  private cleanupHistory(): void {
    const cutoff = Date.now() - this.config.windowMs * 2;
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoff);

    // Reset circuit breaker if enough time has passed
    if (this.circuitBreakerActive && Date.now() > this.circuitBreakerUntil) {
      this.circuitBreakerActive = false;
      this.emit('circuitBreakerReset');
    }
  }

  /**
   * Get queue statistics
   */
  public getQueueStats(): {
    total: number;
    byPriority: Record<RequestPriority, number>;
    oldestWaitTime: number;
  } {
    const byPriority = {
      [RequestPriority.CRITICAL]: 0,
      [RequestPriority.HIGH]: 0,
      [RequestPriority.MEDIUM]: 0,
      [RequestPriority.LOW]: 0
    };

    let oldestWaitTime = 0;
    const now = Date.now();

    for (const req of this.queue) {
      byPriority[req.info.priority]++;
      const waitTime = now - req.addedAt;
      if (waitTime > oldestWaitTime) {
        oldestWaitTime = waitTime;
      }
    }

    return {
      total: this.queue.length,
      byPriority,
      oldestWaitTime
    };
  }

  /**
   * Reset all counters and queues (for testing)
   */
  public reset(): void {
    this.requestHistory = [];
    this.queue = [];
    this.currentWeight = 0;
    this.currentOrderCount = 0;
    this.circuitBreakerActive = false;
    this.backoffMultiplier = 1;
  }
}

// Singleton instance
let instance: RateLimitManager | null = null;

export function getRateLimitManager(config?: Partial<RateLimitConfig>): RateLimitManager {
  if (!instance) {
    instance = new RateLimitManager(config);
  }
  return instance;
}