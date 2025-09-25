'use client';

import React from 'react';
import { Circle, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useBotStatus } from '@/hooks/useBotStatus';

export default function MinimalBotStatus() {
  const { status, isConnected } = useBotStatus();

  const getStatusColor = () => {
    if (!isConnected) return 'bg-red-500';
    if (!status?.isRunning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!isConnected) return 'Disconnected';
    if (!status?.isRunning) return 'Connected';
    return 'Running';
  };

  const formatPnL = (value: number) => {
    const formatted = Math.abs(value).toFixed(2);
    return `${value >= 0 ? '+' : '-'}$${formatted}`;
  };

  return (
    <div className="border-b border-border/40 bg-background/95 backdrop-blur">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              <Circle className={`h-2 w-2 fill-current ${getStatusColor()} ${isConnected && status?.isRunning ? 'animate-pulse' : ''}`} />
              <span className="font-medium">{getStatusText()}</span>
            </div>

            {isConnected && status && (
              <>
                {/* Separator */}
                <span className="text-muted-foreground/50">•</span>

                {/* Mode */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Mode:</span>
                  <Badge
                    variant={status.paperMode ? "secondary" : "default"}
                    className="h-5 px-2 text-xs font-medium"
                  >
                    {status.paperMode ? "Paper" : "Live"}
                  </Badge>
                </div>

                {/* Separator */}
                <span className="text-muted-foreground/50">•</span>

                {/* Positions */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Positions:</span>
                  <span className="font-medium">{status.positionsOpen || 0}</span>
                </div>

                {/* Separator */}
                <span className="text-muted-foreground/50">•</span>

                {/* PnL */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">PnL:</span>
                  <div className={`flex items-center gap-1 font-medium ${
                    (status.totalPnL || 0) >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {(status.totalPnL || 0) >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatPnL(status.totalPnL || 0)}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active Symbols on the right */}
          {isConnected && status && status.symbols.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Active:</span>
              <div className="flex gap-1">
                {status.symbols.map((symbol) => (
                  <Badge
                    key={symbol}
                    variant="outline"
                    className="h-5 px-2 text-xs font-normal border-border/50"
                  >
                    {symbol}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error display if disconnected */}
        {!isConnected && (
          <div className="mt-2 text-xs text-muted-foreground">
            Bot not connected. Run <code className="rounded bg-muted px-1 py-0.5">npm start</code> to start the bot.
          </div>
        )}
      </div>
    </div>
  );
}