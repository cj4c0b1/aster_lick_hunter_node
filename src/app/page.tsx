'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity
} from 'lucide-react';
import MinimalBotStatus from '@/components/MinimalBotStatus';
import LiquidationFeed from '@/components/LiquidationFeed';
import PositionTable from '@/components/PositionTable';
import { useConfig } from '@/components/ConfigProvider';

interface AccountInfo {
  totalBalance: number;
  availableBalance: number;
  totalPositionValue: number;
  totalPnL: number;
}

export default function DashboardPage() {
  const { config, loading: configLoading } = useConfig();
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    totalBalance: 10000,
    availableBalance: 8500,
    totalPositionValue: 1500,
    totalPnL: 60,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAccountInfo();
    const interval = setInterval(loadAccountInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadAccountInfo = async () => {
    try {
      const response = await fetch('/api/balance');
      if (response.ok) {
        const data = await response.json();
        setAccountInfo(data);
      }
    } catch (error) {
      console.error('Failed to load account info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    const formatted = Math.abs(value).toFixed(2);
    return `${value >= 0 ? '+' : '-'}${formatted}%`;
  };

  return (
    <DashboardLayout>
      {/* Minimal Bot Status Bar */}
      <MinimalBotStatus />

      <div className="p-6 space-y-6">
        {/* Account Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(accountInfo.totalBalance)}</div>
                  <p className="text-xs text-muted-foreground">
                    +20.1% from last month
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(accountInfo.availableBalance)}</div>
                  <p className="text-xs text-muted-foreground">
                    Ready for trading
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Position Value</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(accountInfo.totalPositionValue)}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all positions
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unrealized PnL</CardTitle>
              {accountInfo.totalPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${
                    accountInfo.totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(accountInfo.totalPnL)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatPercentage(accountInfo.totalPnL / accountInfo.totalBalance * 100)} of balance
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="liquidations" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:w-[300px]">
            <TabsTrigger value="liquidations">Liquidations</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
          </TabsList>

          <TabsContent value="liquidations" className="space-y-4">
            <LiquidationFeed
              volumeThresholds={config?.symbols ?
                Object.entries(config.symbols).reduce((acc, [symbol, cfg]) => ({
                  ...acc,
                  [symbol]: cfg.volumeThresholdUSDT
                }), {}) : {}
              }
              maxEvents={20}
            />
          </TabsContent>

          <TabsContent value="positions" className="space-y-4">
            <PositionTable />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}