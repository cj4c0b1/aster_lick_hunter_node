'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import websocketService from '@/lib/services/websocketService';

interface SessionPnL {
  startTime: number;
  startBalance: number;
  currentBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  commission: number;
  fundingFee: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
}

interface SessionMetrics {
  duration: number;
  returnPercent: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

export default function PerformanceCard() {
  const [sessionPnL, setSessionPnL] = useState<SessionPnL | null>(null);
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial session data
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const response = await fetch('/api/pnl/realtime');
        if (response.ok) {
          const data = await response.json();
          setSessionPnL(data.session);
          setSessionMetrics(data.metrics);
        }
      } catch (error) {
        console.error('Failed to fetch session PnL:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionData();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'pnl_update') {
        if (message.data?.session) {
          setSessionPnL(message.data.session);
        }
      }
    };

    const cleanup = websocketService.addMessageHandler(handleMessage);
    return cleanup;
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (isLoading || !sessionPnL) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Session Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPnL = sessionPnL.realizedPnl + sessionPnL.unrealizedPnl;
  const returnPercent = sessionMetrics?.returnPercent || 0;
  const isProfit = totalPnL >= 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Session Performance</CardTitle>
          {sessionPnL.tradeCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              {sessionPnL.tradeCount} trades
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Main PnL Display */}
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              {isProfit ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
              <span className={cn(
                "text-2xl font-bold",
                isProfit ? "text-green-500" : "text-red-500"
              )}>
                {formatCurrency(totalPnL)}
              </span>
            </div>
            <span className={cn(
              "text-sm font-medium",
              isProfit ? "text-green-500" : "text-red-500"
            )}>
              {returnPercent >= 0 ? '+' : ''}{returnPercent.toFixed(2)}%
            </span>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Realized</p>
              <p className={cn(
                "font-medium",
                sessionPnL.realizedPnl >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {formatCurrency(sessionPnL.realizedPnl)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Unrealized</p>
              <p className={cn(
                "font-medium",
                sessionPnL.unrealizedPnl >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {formatCurrency(sessionPnL.unrealizedPnl)}
              </p>
            </div>
          </div>

          {/* Stats */}
          {sessionPnL.tradeCount > 0 && (
            <div className="pt-2 border-t">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Win Rate</p>
                  <p className="font-medium">
                    {(sessionMetrics?.winRate || 0).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Win/Loss</p>
                  <p className="font-medium">
                    {sessionPnL.winCount || 0}/{sessionPnL.lossCount || 0}
                  </p>
                </div>
              </div>
              {sessionMetrics && sessionMetrics.profitFactor != null && sessionMetrics.profitFactor > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">Profit Factor</p>
                  <p className="text-sm font-medium">
                    {sessionMetrics.profitFactor === Infinity
                      ? '∞'
                      : sessionMetrics.profitFactor.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Session Duration */}
          {sessionMetrics && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Session: {formatDuration(sessionMetrics.duration)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}