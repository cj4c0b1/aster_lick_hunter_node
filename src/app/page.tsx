'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity
} from 'lucide-react';
import MinimalBotStatus from '@/components/MinimalBotStatus';
import LiquidationSidebar from '@/components/LiquidationSidebar';
import PositionTable from '@/components/PositionTable';
import PnLChart from '@/components/PnLChart';
import PerformanceCard from '@/components/PerformanceCard';
import { useConfig } from '@/components/ConfigProvider';
import websocketService from '@/lib/services/websocketService';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import dataStore, { AccountInfo, Position } from '@/lib/services/dataStore';

interface BalanceStatus {
  source?: string;
  timestamp?: number;
  error?: string;
}

export default function DashboardPage() {
  const { config } = useConfig();
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    totalBalance: 10000,
    availableBalance: 8500,
    totalPositionValue: 1500,
    totalPnL: 60,
  });
  const [balanceStatus, setBalanceStatus] = useState<BalanceStatus>({});
  const [isLoading, setIsLoading] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [markPrices, setMarkPrices] = useState<Record<string, number>>({});

  // Initialize order notifications
  useOrderNotifications();

  useEffect(() => {
    // Load initial data from data store
    const loadInitialData = async () => {
      try {
        const [balanceData, positionsData] = await Promise.all([
          dataStore.fetchBalance(),
          dataStore.fetchPositions()
        ]);
        setAccountInfo(balanceData);
        setPositions(positionsData);
        setBalanceStatus({ source: 'api', timestamp: Date.now() });
      } catch (error) {
        console.error('[Dashboard] Failed to load initial data:', error);
        setBalanceStatus({ error: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();

    // Listen to data store updates
    const handleBalanceUpdate = (data: AccountInfo & { source: string }) => {
      console.log('[Dashboard] Balance updated from data store:', data.source);
      setAccountInfo(data);
      setBalanceStatus({ source: data.source, timestamp: Date.now() });
      setIsLoading(false);
    };

    const handlePositionsUpdate = (data: Position[]) => {
      console.log('[Dashboard] Positions updated from data store');
      setPositions(data);
    };

    const handleMarkPricesUpdate = (prices: Record<string, number>) => {
      setMarkPrices(prices);
    };

    // Subscribe to data store events
    dataStore.on('balance:update', handleBalanceUpdate);
    dataStore.on('positions:update', handlePositionsUpdate);
    dataStore.on('markPrices:update', handleMarkPricesUpdate);

    // Set up WebSocket listener for real-time updates
    const handleWebSocketMessage = (message: any) => {
      // Forward to data store for centralized handling
      dataStore.handleWebSocketMessage(message);
    };

    const cleanupMessageHandler = websocketService.addMessageHandler(handleWebSocketMessage);

    // Cleanup on unmount
    return () => {
      dataStore.off('balance:update', handleBalanceUpdate);
      dataStore.off('positions:update', handlePositionsUpdate);
      dataStore.off('markPrices:update', handleMarkPricesUpdate);
      cleanupMessageHandler();
    };
  }, []); // No dependencies - only run once on mount

  // Refresh data manually if needed
  const refreshData = async () => {
    try {
      const [balanceData, positionsData] = await Promise.all([
        dataStore.fetchBalance(true), // Force refresh
        dataStore.fetchPositions(true)
      ]);
      setAccountInfo(balanceData);
      setPositions(positionsData);
      setBalanceStatus({ source: 'manual', timestamp: Date.now() });
    } catch (error) {
      console.error('[Dashboard] Failed to refresh data:', error);
      setBalanceStatus({ error: error instanceof Error ? error.message : 'Unknown error' });
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

  // Calculate live account info with real-time mark prices
  // This supplements the official balance data with live price updates
  const liveAccountInfo = useMemo(() => {
    if (positions.length === 0) {
      return accountInfo;
    }

    // Calculate live PnL based on current mark prices
    let liveTotalPnL = 0;
    let hasLivePrices = false;

    positions.forEach(position => {
      const liveMarkPrice = markPrices[position.symbol];
      if (liveMarkPrice && liveMarkPrice !== position.markPrice) {
        hasLivePrices = true;
        const entryPrice = position.entryPrice;
        const quantity = position.quantity;
        const isLong = position.side === 'LONG';

        // Calculate live PnL for this position
        const priceDiff = liveMarkPrice - entryPrice;
        const positionPnL = isLong ? priceDiff * quantity : -priceDiff * quantity;
        liveTotalPnL += positionPnL;
      } else {
        // Use the position's current PnL if no live price available
        liveTotalPnL += position.pnl || 0;
      }
    });

    // If we have live prices, update the PnL only
    // Total balance should remain consistent (available + margin)
    if (hasLivePrices) {
      return {
        ...accountInfo,
        totalPnL: liveTotalPnL,
        // Don't recalculate total balance - it's already correct
        totalBalance: accountInfo.totalBalance
      };
    }

    // Otherwise return official balance data
    return accountInfo;
  }, [accountInfo, positions, markPrices]);

  const handleClosePosition = async (_symbol: string, _side: 'LONG' | 'SHORT') => {
    try {
      // TODO: Implement position closing API call
      // For now, just log the action
    } catch (_error) {
    }
  };

  const handleUpdateSL = async (_symbol: string, _side: 'LONG' | 'SHORT', _price: number) => {
    try {
      // TODO: Implement stop loss update API call
      // For now, just log the action
    } catch (_error) {
    }
  };

  const handleUpdateTP = async (_symbol: string, _side: 'LONG' | 'SHORT', _price: number) => {
    try {
      // TODO: Implement take profit update API call
      // For now, just log the action
    } catch (_error) {
    }
  };

  return (
    <DashboardLayout>
      {/* Minimal Bot Status Bar */}
      <MinimalBotStatus />

      <div className="flex h-full overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Account Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
                    <div className="text-2xl font-bold">{formatCurrency(liveAccountInfo.totalBalance)}</div>
                    <p className="text-xs text-muted-foreground">
                      {balanceStatus.error ? (
                        <span className="text-red-500">Connection error</span>
                      ) : balanceStatus.source === 'websocket' ? (
                        <span className="text-green-500">● Live</span>
                      ) : balanceStatus.source === 'rest-account' || balanceStatus.source === 'rest-balance' ? (
                        <span className="text-yellow-500">● REST API</span>
                      ) : (
                        'Account equity'
                      )}
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
                    <div className="text-2xl font-bold">{formatCurrency(liveAccountInfo.availableBalance)}</div>
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
                    <div className="text-2xl font-bold">{formatCurrency(liveAccountInfo.totalPositionValue)}</div>
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
                {liveAccountInfo.totalPnL >= 0 ? (
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
                      liveAccountInfo.totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(liveAccountInfo.totalPnL)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {liveAccountInfo.totalBalance > 0 ?
                        formatPercentage(liveAccountInfo.totalPnL / liveAccountInfo.totalBalance * 100) :
                        '0.00%'
                      } of balance
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Session Performance Card */}
            <PerformanceCard />
          </div>

          {/* PnL Chart */}
          <PnLChart />

          {/* Positions Table */}
          <PositionTable
            onClosePosition={handleClosePosition}
            onUpdateSL={handleUpdateSL}
            onUpdateTP={handleUpdateTP}
          />
        </div>

        {/* Liquidation Sidebar */}
        <LiquidationSidebar
          volumeThresholds={config?.symbols ?
            Object.entries(config.symbols).reduce((acc, [symbol, cfg]) => ({
              ...acc,
              [symbol]: cfg.volumeThresholdUSDT
            }), {}) : {}
          }
          maxEvents={50}
        />
      </div>
    </DashboardLayout>
  );
}