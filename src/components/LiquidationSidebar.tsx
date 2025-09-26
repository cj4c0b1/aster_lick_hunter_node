'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Flame, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import websocketService from '@/lib/services/websocketService';

interface LiquidationEvent {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  quantity: number;
  price: number;
  averagePrice: number;
  orderStatus: string;
  eventTime: number;
  timestamp: Date;

  // Computed fields
  volume: number;
  isHighVolume: boolean;
}

interface LiquidationSidebarProps {
  volumeThresholds?: Record<string, number>;
  maxEvents?: number;
}

export default function LiquidationSidebar({ volumeThresholds = {}, maxEvents = 10 }: LiquidationSidebarProps) {
  const [events, setEvents] = useState<LiquidationEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load historical liquidations on mount
  useEffect(() => {
    const loadHistoricalLiquidations = async () => {
      try {
        const response = await fetch(`/api/liquidations?limit=${maxEvents}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const historicalEvents = result.data.map((liq: any) => {
              const volume = liq.volume_usdt || (liq.quantity * liq.price);
              const threshold = volumeThresholds[liq.symbol] || 10000;
              return {
                symbol: liq.symbol,
                side: liq.side,
                orderType: liq.order_type,
                quantity: liq.quantity,
                price: liq.price,
                averagePrice: liq.average_price || liq.price,
                orderStatus: liq.order_status,
                eventTime: liq.event_time,
                timestamp: new Date(liq.event_time),
                volume,
                isHighVolume: volume >= threshold,
              };
            });
            console.log(`Loaded ${historicalEvents.length} historical liquidations`);
            setEvents(historicalEvents);
          }
        }
      } catch (error) {
        console.error('Failed to load historical liquidations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistoricalLiquidations();
  }, []); // Only run once on mount

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'liquidation') {
        const liquidationData = message.data;

        // Calculate volume and determine if high volume
        const volume = liquidationData.quantity * liquidationData.price;
        const threshold = volumeThresholds[liquidationData.symbol] || 10000; // Default $10k
        const isHighVolume = volume >= threshold;

        const liquidationEvent: LiquidationEvent = {
          ...liquidationData,
          volume,
          isHighVolume,
        };

        setEvents(prev => {
          const newEvents = [liquidationEvent, ...prev].slice(0, maxEvents);
          return newEvents;
        });
      }
    };

    // Handle connection status changes
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
    };

    // Set up WebSocket service handlers
    const cleanupMessageHandler = websocketService.addMessageHandler(handleMessage);
    const cleanupConnectionListener = websocketService.addConnectionListener(handleConnectionChange);

    return () => {
      cleanupMessageHandler();
      cleanupConnectionListener();
    };
  }, [volumeThresholds, maxEvents]);

  const formatTime = (timestamp: Date | number): string => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    }
    if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    }
    return `$${volume.toFixed(0)}`;
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    return price.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  const getVolumeColor = (volume: number): string => {
    if (volume >= 5000000) return 'bg-green-500 text-white'; // $5M+
    if (volume >= 1000000) return 'bg-green-600/90 text-white'; // $1M+
    if (volume >= 500000) return 'bg-emerald-600/80 text-white'; // $500K+
    if (volume >= 250000) return 'bg-red-500 text-white'; // $250K+
    if (volume >= 100000) return 'bg-red-600/90 text-white'; // $100K+
    if (volume >= 50000) return 'bg-orange-600/80 text-white'; // $50K+
    return 'bg-gray-600/60 text-white'; // < $50K
  };

  return (
    <div className="w-72 border-l bg-black/95 hidden lg:block h-full overflow-hidden">
      <div className="h-full flex flex-col">
        <div className="border-b border-gray-800 p-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-200">Liquidations</h3>
            <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1 text-xs h-5">
              <Activity className={`h-2 w-2 ${isConnected ? 'animate-pulse' : ''}`} />
              {isConnected ? 'Live' : 'Offline'}
            </Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b border-gray-900">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))
          ) : events.length > 0 ? (
            events.map((event, index) => {
              const volumeColor = getVolumeColor(event.volume);
              // SELL liquidation = Longs getting liquidated (red background)
              // BUY liquidation = Shorts getting liquidated (green background)
              const isLongLiquidation = event.side === 'SELL';
              const positionType = isLongLiquidation ? 'LONG' : 'SHORT';
              const bgColor = isLongLiquidation
                ? 'bg-red-900/20 hover:bg-red-900/30'
                : 'bg-green-900/20 hover:bg-green-900/30';
              const textColor = isLongLiquidation ? 'text-red-400' : 'text-green-400';

              return (
                <div
                  key={`${event.symbol}-${event.eventTime}-${index}`}
                  className={`flex items-center justify-between px-3 py-1 border-b border-gray-900 transition-colors ${bgColor} cursor-default`}
                >
                  <div className="flex items-center gap-1.5 flex-1">
                    {event.volume >= 1000000 && (
                      <Flame className="h-3 w-3 text-orange-400 animate-pulse" />
                    )}
                    {event.volume >= 500000 && event.volume < 1000000 && (
                      <AlertTriangle className="h-3 w-3 text-yellow-400" />
                    )}
                    {isLongLiquidation ? (
                      <TrendingDown className={`h-3 w-3 ${textColor}`} />
                    ) : (
                      <TrendingUp className={`h-3 w-3 ${textColor}`} />
                    )}
                    <div className={`text-xs font-semibold ${textColor} w-10`}>
                      {positionType}
                    </div>
                    <div className="text-xs text-gray-300 font-medium">
                      {event.symbol.replace('USDT', '')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${volumeColor}`}>
                      {formatVolume(event.volume)}
                    </div>
                    <div className="text-[10px] text-gray-500 w-8 text-right">
                      {formatTime(event.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500 text-xs">
              No liquidations yet...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}