'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Flame } from 'lucide-react';
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

  useEffect(() => {
    setIsLoading(false);

    // Handle WebSocket messages
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
      return `$${(volume / 1000000).toFixed(2)}M`;
    }
    if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    }
    return `$${volume.toFixed(0)}`;
  };

  const formatPrice = (price: number): string => {
    return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <div className="w-80 border-l bg-background hidden lg:block">
      <Card className="border-0 rounded-none h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Liquidations</CardTitle>
            <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1 text-xs">
              <Activity className={`h-2 w-2 ${isConnected ? 'animate-pulse' : ''}`} />
              {isConnected ? 'Live' : 'Offline'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 px-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1 p-2 rounded border">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-8" />
                </div>
              </div>
            ))
          ) : events.length > 0 ? (
            events.map((event, index) => (
              <div
                key={`${event.symbol}-${event.eventTime}-${index}`}
                className={`p-2 rounded border transition-colors ${
                  event.isHighVolume
                    ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{event.symbol}</span>
                    {event.isHighVolume && (
                      <Flame className="h-3 w-3 text-orange-500" />
                    )}
                  </div>
                  <Badge
                    variant={event.side === 'BUY' ? 'default' : 'destructive'}
                    className="text-xs px-2 py-0"
                  >
                    {event.side}
                  </Badge>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="text-xs text-muted-foreground">
                    ${formatPrice(event.price)}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium">{formatVolume(event.volume)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(event.timestamp)}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No liquidations yet...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}