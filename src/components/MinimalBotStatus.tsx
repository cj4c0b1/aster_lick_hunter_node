'use client';

import React from 'react';
import { Circle } from 'lucide-react';
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

  return (
    <div className="border-b border-border/40 bg-background/95 backdrop-blur">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {/* Status Indicator */}
            <Circle className={`h-2 w-2 fill-current ${getStatusColor()} ${isConnected && status?.isRunning ? 'animate-pulse' : ''}`} />
            <span className="font-medium">{getStatusText()}</span>

            {/* Show minimal status message */}
            {isConnected && status?.isRunning && (
              <>
                <span className="text-muted-foreground/50 mx-2">•</span>
                <span className="text-xs text-muted-foreground">Bot is actively monitoring markets</span>
              </>
            )}
          </div>

          {/* Error display if disconnected */}
          {!isConnected && (
            <div className="text-xs text-muted-foreground">
              Run <code className="rounded bg-muted px-1 py-0.5">npm start</code> to start the bot
            </div>
          )}
        </div>
      </div>
    </div>
  );
}