'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import websocketService from '@/lib/services/websocketService';

interface DailyPnL {
  date: string;
  realizedPnl: number;
  commission: number;
  fundingFee: number;
  netPnl: number;
  tradeCount: number;
}

interface PnLMetrics {
  totalPnl: number;
  totalRealizedPnl: number;
  totalCommission: number;
  totalFundingFee: number;
  winRate: number;
  profitableDays: number;
  lossDays: number;
  bestDay: DailyPnL | null;
  worstDay: DailyPnL | null;
  avgDailyPnl: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
}

interface BalanceData {
  totalWalletBalance: number;
  totalUnrealizedProfit: number;
  totalMarginBalance: number;
  availableBalance: number;
}

export default function PerformanceCard() {
  const [pnlData, setPnlData] = useState<{ dailyPnL: DailyPnL[], metrics: PnLMetrics } | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial 24h data and balance data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both 24h PnL and balance data
        const [pnlResponse, balanceResponse] = await Promise.all([
          fetch('/api/income?range=24h'),
          fetch('/api/balance')
        ]);

        if (pnlResponse.ok) {
          const pnlData = await pnlResponse.json();
          setPnlData(pnlData);
        }

        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setBalanceData(balanceData);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Subscribe to real-time updates to refresh 24h data and balance
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'pnl_update' || message.type === 'trade_update' || message.type === 'balance_update') {
        // Refresh both 24h data and balance when trades occur
        Promise.all([
          fetch('/api/income?range=24h').then(r => r.json()),
          fetch('/api/balance').then(r => r.json())
        ]).then(([pnlData, balanceData]) => {
          setPnlData(pnlData);
          setBalanceData(balanceData);
        }).catch(error => console.error('Failed to refresh data:', error));
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

  if (isLoading || !pnlData || !balanceData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">24-Hour Performance</CardTitle>
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

  // Calculate 24h totals
  const totalPnL = pnlData.metrics.totalPnl;
  const totalRealizedPnL = pnlData.metrics.totalRealizedPnl;
  const totalTrades = pnlData.dailyPnL.reduce((sum, day) => sum + day.tradeCount, 0);
  const isProfit = totalPnL >= 0;

  // Calculate return percentage based on total wallet balance
  const totalBalance = balanceData.totalWalletBalance;
  const returnPercent = totalBalance > 0 ? (totalPnL / totalBalance) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">24-Hour Performance</CardTitle>
          {totalTrades > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              {totalTrades} trades
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
                totalRealizedPnL >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {formatCurrency(totalRealizedPnL)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Fees</p>
              <p className={cn(
                "font-medium",
                (pnlData.metrics.totalCommission + pnlData.metrics.totalFundingFee) >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {formatCurrency(pnlData.metrics.totalCommission + pnlData.metrics.totalFundingFee)}
              </p>
            </div>
          </div>


          {/* Time Period */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              24-Hour Period
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}