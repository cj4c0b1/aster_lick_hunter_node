'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import LiquidationFeed from '@/components/LiquidationFeed';
import PositionTable from '@/components/PositionTable';
import BotControls from '@/components/BotControls';
import { Config } from '@/lib/types';

interface AccountInfo {
  totalBalance: number;
  availableBalance: number;
  totalPositionValue: number;
  totalPnL: number;
}

export default function DashboardPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    totalBalance: 10000,
    availableBalance: 8500,
    totalPositionValue: 1500,
    totalPnL: 60,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadConfig();
    loadAccountInfo();
    // Set up polling for account info
    const interval = setInterval(loadAccountInfo, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadAccountInfo = async () => {
    try {
      const response = await fetch('/api/balance');
      if (response.ok) {
        const data = await response.json();
        setAccountInfo(data);
      }
    } catch (error) {
      console.error('Failed to load account info:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadConfig(), loadAccountInfo()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleClosePosition = async (symbol: string, side: 'LONG' | 'SHORT') => {
    console.log('Closing position:', symbol, side);
    // API call to close position would go here
  };

  const handleUpdateSL = async (symbol: string, side: 'LONG' | 'SHORT', price: number) => {
    console.log('Updating SL:', symbol, side, price);
    // API call to update stop loss would go here
  };

  const handleUpdateTP = async (symbol: string, side: 'LONG' | 'SHORT', price: number) => {
    console.log('Updating TP:', symbol, side, price);
    // API call to update take profit would go here
  };

  const getPnLColor = (pnl: number): string => {
    if (pnl > 0) return 'text-green-600';
    if (pnl < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Aster Liquidation Hunter Dashboard</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                className={`px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
                disabled={isRefreshing}
              >
                🔄 Refresh
              </button>
              <Link
                href="/config"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Configuration
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Account Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-1">Total Balance</p>
            <p className="text-2xl font-bold">${accountInfo.totalBalance.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-1">Available Balance</p>
            <p className="text-2xl font-bold">${accountInfo.availableBalance.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-1">Position Value</p>
            <p className="text-2xl font-bold">${accountInfo.totalPositionValue.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-1">Unrealized PnL</p>
            <p className={`text-2xl font-bold ${getPnLColor(accountInfo.totalPnL)}`}>
              {accountInfo.totalPnL >= 0 ? '+' : ''}${accountInfo.totalPnL.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Bot Controls */}
        <div className="mb-6">
          <BotControls
            onStart={() => console.log('Starting bot...')}
            onStop={() => console.log('Stopping bot...')}
            isRunning={false}
          />
        </div>

        {/* Status Indicators */}
        {config && (
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h2 className="text-lg font-semibold mb-3">Configuration Status</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${config.global.paperMode ? 'bg-yellow-500' : 'bg-green-500'}`} />
                <span className="text-sm">
                  Mode: <span className="font-medium">{config.global.paperMode ? 'Paper Trading' : 'Live Trading'}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  Risk Limit: <span className="font-medium">{config.global.riskPercent}%</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  Active Symbols: <span className="font-medium">{Object.keys(config.symbols).length}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Liquidation Activity</h2>
            <LiquidationFeed
              volumeThresholds={config?.symbols ?
                Object.entries(config.symbols).reduce((acc, [symbol, cfg]) => ({
                  ...acc,
                  [symbol]: cfg.volumeThresholdUSDT
                }), {}) : {}
              }
              maxEvents={20}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Active Positions</h2>
            <PositionTable
              onClosePosition={handleClosePosition}
              onUpdateSL={handleUpdateSL}
              onUpdateTP={handleUpdateTP}
            />
          </div>
        </div>

        {/* Recent Trades */}
        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Recent Trades</h2>
          <div className="text-sm text-gray-500">
            Trade history will appear here once the bot starts executing trades.
          </div>
        </div>
      </div>
    </div>
  );
}