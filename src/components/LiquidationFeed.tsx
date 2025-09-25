'use client';

import React, { useEffect, useState } from 'react';

interface LiquidationEvent {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  volume: number;
  timestamp: number;
  isHighVolume: boolean;
}

interface LiquidationFeedProps {
  volumeThresholds?: Record<string, number>;
  maxEvents?: number;
}

export default function LiquidationFeed({ volumeThresholds = {}, maxEvents = 50 }: LiquidationFeedProps) {
  const [events, setEvents] = useState<LiquidationEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    totalVolume24h: 0,
    largestLiquidation: 0,
    totalEvents: 0,
  });

  useEffect(() => {
    // In production, this would connect to the WebSocket
    // For now, simulate some events for demonstration
    const mockEvents: LiquidationEvent[] = [
      {
        id: '1',
        symbol: 'BTCUSDT',
        side: 'SELL',
        price: 42000,
        quantity: 2.5,
        volume: 105000,
        timestamp: Date.now() - 60000,
        isHighVolume: true,
      },
      {
        id: '2',
        symbol: 'ETHUSDT',
        side: 'BUY',
        price: 2200,
        quantity: 10,
        volume: 22000,
        timestamp: Date.now() - 30000,
        isHighVolume: false,
      },
    ];

    setEvents(mockEvents);
    setIsConnected(true);

    // Update stats
    const totalVol = mockEvents.reduce((sum, e) => sum + e.volume, 0);
    const maxVol = Math.max(...mockEvents.map(e => e.volume));
    setStats({
      totalVolume24h: totalVol,
      largestLiquidation: maxVol,
      totalEvents: mockEvents.length,
    });
  }, []);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    }
    if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    }
    return `$${volume.toFixed(0)}`;
  };

  const getSideColor = (side: 'BUY' | 'SELL'): string => {
    return side === 'BUY' ? 'text-green-600' : 'text-red-600';
  };

  const getSideBgColor = (side: 'BUY' | 'SELL'): string => {
    return side === 'BUY' ? 'bg-green-50' : 'bg-red-50';
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Liquidation Feed</h2>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">Total Volume (24h)</p>
            <p className="text-lg font-semibold">{formatVolume(stats.totalVolume24h)}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">Largest Liquidation</p>
            <p className="text-lg font-semibold">{formatVolume(stats.largestLiquidation)}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">Total Events</p>
            <p className="text-lg font-semibold">{stats.totalEvents}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Time</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Symbol</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Side</th>
                <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Price</th>
                <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Quantity</th>
                <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Volume</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, maxEvents).map((event) => (
                <tr
                  key={event.id}
                  className={`border-b hover:bg-gray-50 ${event.isHighVolume ? 'font-semibold' : ''}`}
                >
                  <td className="py-2 px-3 text-sm">{formatTime(event.timestamp)}</td>
                  <td className="py-2 px-3 text-sm">{event.symbol}</td>
                  <td className="py-2 px-3">
                    <span className={`text-sm px-2 py-1 rounded ${getSideBgColor(event.side)} ${getSideColor(event.side)}`}>
                      {event.side}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-sm text-right">${event.price.toLocaleString()}</td>
                  <td className="py-2 px-3 text-sm text-right">{event.quantity.toFixed(4)}</td>
                  <td className={`py-2 px-3 text-sm text-right ${event.isHighVolume ? 'text-orange-600' : ''}`}>
                    {formatVolume(event.volume)}
                    {event.isHighVolume && (
                      <span className="ml-1 text-orange-500">🔥</span>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No liquidation events yet...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}