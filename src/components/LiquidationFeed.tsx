'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingUp, Activity, Flame } from 'lucide-react';

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

interface LiquidationFeedProps {
  volumeThresholds?: Record<string, number>;
  maxEvents?: number;
}

export default function LiquidationFeed({ volumeThresholds = {}, maxEvents = 50 }: LiquidationFeedProps) {
  const [events, setEvents] = useState<LiquidationEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalVolume24h: 0,
    largestLiquidation: 0,
    totalEvents: 0,
  });

  useEffect(() => {
    let ws: WebSocket;

    // Connect to bot WebSocket server
    const connectWebSocket = () => {
      ws = new WebSocket('ws://localhost:8081');

      ws.onopen = () => {
        console.log('LiquidationFeed: Connected to bot WebSocket');
        setIsConnected(true);
        setIsLoading(false);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

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

              // Update stats
              const now = Date.now();
              const last24h = newEvents.filter(e =>
                (e.timestamp instanceof Date ? e.timestamp.getTime() : e.eventTime) > now - 24 * 60 * 60 * 1000
              );

              const totalVol = last24h.reduce((sum, e) => sum + e.volume, 0);
              const maxVol = Math.max(...last24h.map(e => e.volume), 0);

              setStats({
                totalVolume24h: totalVol,
                largestLiquidation: maxVol,
                totalEvents: last24h.length,
              });

              return newEvents;
            });
          }
        } catch (error) {
          console.error('LiquidationFeed: Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('LiquidationFeed: Disconnected from bot WebSocket');
        setIsConnected(false);

        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('LiquidationFeed: WebSocket error:', error);
        setIsConnected(false);
      };
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [volumeThresholds, maxEvents]);

  const formatTime = (timestamp: Date | number): string => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Live Liquidation Feed</CardTitle>
            <CardDescription>Real-time liquidation events from the market</CardDescription>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1">
            <Activity className={`h-3 w-3 ${isConnected ? 'animate-pulse' : ''}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">24h Volume</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p className="text-xl font-bold">{formatVolume(stats.totalVolume24h)}</p>
            )}
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Largest</p>
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p className="text-xl font-bold">{formatVolume(stats.largestLiquidation)}</p>
            )}
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Events</p>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-12 mt-1" />
            ) : (
              <p className="text-xl font-bold">{stats.totalEvents}</p>
            )}
          </div>
        </div>

        {/* Events Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Time</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : events.length > 0 ? (
                events.slice(0, maxEvents).map((event, index) => (
                  <TableRow key={`${event.symbol}-${event.eventTime}-${index}`} className={event.isHighVolume ? 'bg-orange-50 dark:bg-orange-950/20' : ''}>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatTime(event.timestamp)}
                    </TableCell>
                    <TableCell className="font-medium">{event.symbol}</TableCell>
                    <TableCell>
                      <Badge
                        variant={event.side === 'BUY' ? 'default' : 'destructive'}
                        className="w-14 justify-center"
                      >
                        {event.side}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${event.price.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {event.quantity.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <div className="flex items-center justify-end gap-1">
                        {formatVolume(event.volume)}
                        {event.isHighVolume && (
                          <Flame className="h-4 w-4 text-orange-500" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No liquidation events yet...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}