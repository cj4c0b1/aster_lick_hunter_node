/**
 * Rate Limit Toast Notifications
 *
 * Sends toast notifications to the web UI when rate limits are approached or exceeded
 */

import { getRateLimitMonitor } from './rateLimitMonitor';
import { StatusBroadcaster } from '../../bot/websocketServer';

let statusBroadcaster: StatusBroadcaster | null = null;
let isMonitoring = false;

export function initializeRateLimitToasts(broadcaster: StatusBroadcaster): void {
  if (isMonitoring) return;

  statusBroadcaster = broadcaster;
  const monitor = getRateLimitMonitor();

  // Start monitoring with 5 second intervals
  monitor.startMonitoring(5000);

  // Listen for warning level changes
  monitor.on('levelChange', ({ oldLevel, newLevel, stats }) => {
    if (!statusBroadcaster) return;

    switch (newLevel) {
      case 'critical':
        statusBroadcaster.broadcast('toast', {
          type: 'error',
          title: '🔴 Critical Rate Limit',
          message: `API usage critical! Weight: ${stats.weightPercent.toFixed(1)}%, Orders: ${stats.orderPercent.toFixed(1)}%`,
          duration: 10000,
        });
        break;

      case 'warning':
        statusBroadcaster.broadcast('toast', {
          type: 'warning',
          title: '⚠️ High API Usage',
          message: `Approaching rate limits. Weight: ${stats.weightPercent.toFixed(1)}%, Orders: ${stats.orderPercent.toFixed(1)}%`,
          duration: 8000,
        });
        break;

      case 'caution':
        // Only show caution when going up from safe
        if (oldLevel === 'safe') {
          statusBroadcaster.broadcast('toast', {
            type: 'info',
            title: '📊 Moderate API Usage',
            message: `API usage moderate. Weight: ${stats.weightPercent.toFixed(1)}%, Orders: ${stats.orderPercent.toFixed(1)}%`,
            duration: 5000,
          });
        }
        break;

      case 'safe':
        // Show success toast when returning to safe from higher levels
        if (oldLevel !== 'safe') {
          statusBroadcaster.broadcast('toast', {
            type: 'success',
            title: '✅ Rate Limits Normal',
            message: 'API usage returned to safe levels',
            duration: 4000,
          });
        }
        break;
    }
  });

  // Listen for rate limit exceeded (429) events
  monitor.on('rateLimitExceeded', (data) => {
    if (!statusBroadcaster) return;

    statusBroadcaster.broadcast('toast', {
      type: 'error',
      title: '🚨 Rate Limit Hit!',
      message: `429 Error - Backing off for ${(data.backoffMs / 1000).toFixed(1)}s`,
      duration: data.backoffMs,
    });
  });

  // Listen for high usage warnings
  monitor.on('highUsage', (usage) => {
    if (!statusBroadcaster) return;

    // Only send if queue is building up
    if (usage.queueLength > 5) {
      statusBroadcaster.broadcast('toast', {
        type: 'warning',
        title: '📈 Request Queue Building',
        message: `${usage.queueLength} requests queued. Consider reducing activity.`,
        duration: 6000,
      });
    }
  });

  // Listen for circuit breaker events
  monitor.on('circuitBreakerReset', () => {
    if (!statusBroadcaster) return;

    statusBroadcaster.broadcast('toast', {
      type: 'success',
      title: '🔄 Circuit Breaker Reset',
      message: 'Normal API operations resumed',
      duration: 4000,
    });
  });

  isMonitoring = true;
  console.log('✅ Rate limit toast notifications initialized');
}

/**
 * Send a custom rate limit toast
 */
export function sendRateLimitToast(
  type: 'success' | 'error' | 'warning' | 'info',
  title: string,
  message: string,
  duration?: number
): void {
  if (!statusBroadcaster) return;

  statusBroadcaster.broadcast('toast', {
    type,
    title,
    message,
    duration: duration || 5000,
  });
}

/**
 * Get current rate limit status for display
 */
export function getRateLimitStatus(): {
  status: 'safe' | 'caution' | 'warning' | 'critical';
  weightPercent: number;
  orderPercent: number;
  queueLength: number;
  message: string;
} {
  const monitor = getRateLimitMonitor();
  const stats = monitor.getCurrentStats();

  if (!stats) {
    return {
      status: 'safe',
      weightPercent: 0,
      orderPercent: 0,
      queueLength: 0,
      message: 'No data available',
    };
  }

  return {
    status: stats.warningLevel,
    weightPercent: stats.weightPercent,
    orderPercent: stats.orderPercent,
    queueLength: stats.queueLength,
    message: monitor.getStatusString(),
  };
}