'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Wallet, X, Check, Edit3 } from 'lucide-react';
import websocketService from '@/lib/services/websocketService';

interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  pnlPercent: number;
  margin: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
}

interface PositionTableProps {
  positions?: Position[];
  onClosePosition?: (symbol: string, side: 'LONG' | 'SHORT') => void;
  onUpdateSL?: (symbol: string, side: 'LONG' | 'SHORT', price: number) => void;
  onUpdateTP?: (symbol: string, side: 'LONG' | 'SHORT', price: number) => void;
}

export default function PositionTable({
  positions = [],
  onClosePosition,
  onUpdateSL,
  onUpdateTP,
}: PositionTableProps) {
  const [editingSL, setEditingSL] = useState<string | null>(null);
  const [editingTP, setEditingTP] = useState<string | null>(null);
  const [tempSL, setTempSL] = useState<number>(0);
  const [tempTP, setTempTP] = useState<number>(0);
  const [realPositions, setRealPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markPrices, setMarkPrices] = useState<Record<string, number>>({});

  // Load initial positions and set up WebSocket updates
  useEffect(() => {
    loadPositions();

    // Set up WebSocket listener for real-time updates
    const handleMessage = (message: any) => {
      if (message.type === 'position_update') {
        // Refresh positions when we get position updates
        loadPositions();
      } else if (message.type === 'mark_price_update') {
        // Update mark prices for live PnL calculation
        if (Array.isArray(message.data)) {
          const priceUpdates: Record<string, number> = {};
          message.data.forEach((price: any) => {
            priceUpdates[price.symbol] = parseFloat(price.markPrice);
          });
          setMarkPrices(prev => ({ ...prev, ...priceUpdates }));
        }
      }
    };

    const cleanupMessageHandler = websocketService.addMessageHandler(handleMessage);

    // Cleanup on unmount
    return cleanupMessageHandler;
  }, []);

  const loadPositions = async () => {
    try {
      const response = await fetch('/api/positions');
      if (response.ok) {
        const data = await response.json();
        setRealPositions(data);
      }
    } catch (error) {
      console.error('Failed to load positions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Use passed positions if available, otherwise use fetched positions
  // Apply live mark prices to calculate real-time PnL
  const displayPositions = (positions.length > 0 ? positions : realPositions).map(position => {
    const liveMarkPrice = markPrices[position.symbol];
    if (liveMarkPrice && liveMarkPrice !== position.markPrice) {
      // Calculate live PnL based on current mark price
      const entryPrice = position.entryPrice;
      const quantity = position.quantity;
      const isLong = position.side === 'LONG';

      const priceDiff = liveMarkPrice - entryPrice;
      const livePnL = isLong ? priceDiff * quantity : -priceDiff * quantity;
      const notionalValue = quantity * entryPrice;
      const livePnLPercent = notionalValue > 0 ? (livePnL / notionalValue) * 100 : 0;

      return {
        ...position,
        markPrice: liveMarkPrice,
        pnl: livePnL,
        pnlPercent: livePnLPercent
      };
    }
    return position;
  });

  // Removed color helper functions since we're using inline classes now

  const handleSLEdit = (position: Position) => {
    const key = `${position.symbol}-${position.side}`;
    setEditingSL(key);
    setTempSL(position.stopLoss || 0);
  };

  const handleTPEdit = (position: Position) => {
    const key = `${position.symbol}-${position.side}`;
    setEditingTP(key);
    setTempTP(position.takeProfit || 0);
  };

  const saveSL = (position: Position) => {
    if (onUpdateSL && tempSL > 0) {
      onUpdateSL(position.symbol, position.side, tempSL);
    }
    setEditingSL(null);
  };

  const saveTP = (position: Position) => {
    if (onUpdateTP && tempTP > 0) {
      onUpdateTP(position.symbol, position.side, tempTP);
    }
    setEditingTP(null);
  };

  const totalPnL = displayPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalMargin = displayPositions.reduce((sum, p) => sum + p.margin, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Open Positions</CardTitle>
            <CardDescription>Manage your active trading positions</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline" className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              Margin: ${totalMargin.toFixed(2)}
            </Badge>
            <Badge
              variant={totalPnL >= 0 ? "default" : "destructive"}
              className="flex items-center gap-1"
            >
              {totalPnL >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Mark</TableHead>
                <TableHead className="text-right">PnL</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-center">Stop Loss</TableHead>
                <TableHead className="text-center">Take Profit</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : displayPositions.map((position) => {
              const key = `${position.symbol}-${position.side}`;
              return (
                <TableRow key={key}>
                  <TableCell className="font-medium">{position.symbol}</TableCell>
                  <TableCell>
                    <Badge
                      variant={position.side === 'LONG' ? 'default' : 'destructive'}
                      className="w-14 justify-center"
                    >
                      {position.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {position.quantity.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${position.entryPrice.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${position.markPrice.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div className={`${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono">${position.margin.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{position.leverage}x</div>
                  </TableCell>
                  <TableCell className="text-center">
                    {editingSL === key ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={tempSL}
                          onChange={(e) => setTempSL(parseFloat(e.target.value))}
                          className="w-20 h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveSL(position)}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingSL(null)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSLEdit(position)}
                        className="text-sm h-8"
                      >
                        {position.stopLoss ? (
                          <div className="flex items-center gap-1">
                            ${position.stopLoss.toLocaleString()}
                            <Edit3 className="h-3 w-3" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            Set SL
                            <Edit3 className="h-3 w-3" />
                          </div>
                        )}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {editingTP === key ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={tempTP}
                          onChange={(e) => setTempTP(parseFloat(e.target.value))}
                          className="w-20 h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveTP(position)}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingTP(null)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTPEdit(position)}
                        className="text-sm h-8"
                      >
                        {position.takeProfit ? (
                          <div className="flex items-center gap-1">
                            ${position.takeProfit.toLocaleString()}
                            <Edit3 className="h-3 w-3" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            Set TP
                            <Edit3 className="h-3 w-3" />
                          </div>
                        )}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onClosePosition && onClosePosition(position.symbol, position.side)}
                    >
                      Close
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && displayPositions.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No open positions
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