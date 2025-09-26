'use client';

import React, { useState, useEffect } from 'react';
import { Config, SymbolConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Trash2,
  Save,
  Key,
  Eye,
  EyeOff,
  Shield,
  TrendingUp,
  AlertCircle,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

interface SymbolConfigFormProps {
  onSave: (config: Config) => void;
  currentConfig?: Config;
}

export default function SymbolConfigForm({ onSave, currentConfig }: SymbolConfigFormProps) {
  const [config, setConfig] = useState<Config>(currentConfig || {
    api: {
      apiKey: '',
      secretKey: '',
    },
    global: {
      riskPercent: 2,
      paperMode: true,
      positionMode: 'ONE_WAY',
    },
    symbols: {},
  });

  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [newSymbol, setNewSymbol] = useState<string>('');
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [availableSymbols, setAvailableSymbols] = useState<any[]>([]);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);

  // Function to generate default config based on min notional
  const getDefaultSymbolConfig = (minNotional: number = 10): SymbolConfig => {
    // Base trade size on minimum notional (use 2x minimum for safety)
    const tradeSize = Math.max(minNotional * 2, 20);
    const defaultThreshold = Math.max(minNotional * 10, 10000);

    return {
      longVolumeThresholdUSDT: defaultThreshold,  // For long positions (buy on sell liquidations)
      shortVolumeThresholdUSDT: defaultThreshold, // For short positions (sell on buy liquidations)
      leverage: 10,
      tradeSize: parseFloat(tradeSize.toFixed(2)),
      maxPositionMarginUSDT: parseFloat((tradeSize * 100).toFixed(2)), // Default to 100x trade size
      slPercent: 2,
      tpPercent: 3,
      priceOffsetBps: 5,      // 5 basis points offset for limit orders
      maxSlippageBps: 50,     // 50 basis points max slippage
      orderType: 'LIMIT' as 'LIMIT',
    };
  };

  const handleGlobalChange = (field: string, value: any) => {
    setConfig({
      ...config,
      global: {
        ...config.global,
        [field]: value,
      },
    });
  };

  const handleApiChange = (field: string, value: string) => {
    setConfig({
      ...config,
      api: {
        ...config.api,
        [field]: value,
      },
    });
  };

  const handleSymbolChange = (symbol: string, field: string, value: any) => {
    setConfig({
      ...config,
      symbols: {
        ...config.symbols,
        [symbol]: {
          ...config.symbols[symbol],
          [field]: value,
        },
      },
    });
  };

  // Fetch available symbols when the symbols tab is clicked
  const fetchAvailableSymbols = async () => {
    if (availableSymbols.length > 0) return; // Already loaded

    setLoadingSymbols(true);
    try {
      const response = await fetch('/api/symbols');
      const data = await response.json();
      if (data.symbols) {
        setAvailableSymbols(data.symbols);
      }
    } catch (error) {
      console.error('Failed to fetch symbols:', error);
      toast.error('Failed to load available symbols');
    } finally {
      setLoadingSymbols(false);
    }
  };

  const addSymbol = (symbolToAdd?: string, minNotional?: number) => {
    const symbol = symbolToAdd || newSymbol;
    if (symbol && !config.symbols[symbol]) {
      const defaultConfig = getDefaultSymbolConfig(minNotional);
      setConfig({
        ...config,
        symbols: {
          ...config.symbols,
          [symbol]: defaultConfig,
        },
      });
      setSelectedSymbol(symbol);
      setNewSymbol('');
      setShowSymbolPicker(false);
      setSymbolSearch('');
      toast.success(`Added ${symbol} to configuration`);
    }
  };

  const removeSymbol = (symbol: string) => {
    const { [symbol]: _, ...rest } = config.symbols;
    setConfig({
      ...config,
      symbols: rest,
    });
    if (selectedSymbol === symbol) {
      setSelectedSymbol('');
    }
    toast.success(`Removed ${symbol} from configuration`);
  };

  const handleSave = () => {
    onSave(config);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="api" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="global" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Global Settings
          </TabsTrigger>
          <TabsTrigger value="symbols" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Symbols
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Connect your exchange API for live trading or leave empty for paper mode
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="text"
                  value={config.api.apiKey}
                  onChange={(e) => handleApiChange('apiKey', e.target.value)}
                  placeholder="Enter your API key (optional for paper mode)"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Your API key for exchange authentication
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secretKey">Secret Key</Label>
                <div className="relative">
                  <Input
                    id="secretKey"
                    type={showApiSecret ? 'text' : 'password'}
                    value={config.api.secretKey}
                    onChange={(e) => handleApiChange('secretKey', e.target.value)}
                    placeholder="Enter your secret key (optional for paper mode)"
                    className="font-mono pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowApiSecret(!showApiSecret)}
                  >
                    {showApiSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your secret key is encrypted and never shared
                </p>
              </div>

              {!config.api.apiKey && !config.api.secretKey && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    No API keys configured - Bot will run in paper mode only
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="global" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Settings</CardTitle>
              <CardDescription>
                Risk management and trading mode configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="riskPercent">Risk Percentage</Label>
                <div className="flex items-center space-x-4">
                  <Input
                    id="riskPercent"
                    type="number"
                    value={config.global.riskPercent}
                    onChange={(e) => handleGlobalChange('riskPercent', parseFloat(e.target.value))}
                    className="w-24"
                    min="0.1"
                    max="100"
                    step="0.1"
                  />
                  <span className="text-sm text-muted-foreground">
                    % of account balance at risk
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum percentage of your account to risk across all positions
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="paperMode">Paper Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable simulation mode for risk-free testing
                  </p>
                </div>
                <Switch
                  id="paperMode"
                  checked={config.global.paperMode}
                  onCheckedChange={(checked) => handleGlobalChange('paperMode', checked)}
                />
              </div>

              {config.global.paperMode && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
                  <p className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Paper mode is enabled - No real trades will be executed
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="positionMode">Position Mode</Label>
                <select
                  id="positionMode"
                  value={config.global.positionMode || 'ONE_WAY'}
                  onChange={(e) => handleGlobalChange('positionMode', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="ONE_WAY">One-way Mode (BOTH)</option>
                  <option value="HEDGE">Hedge Mode (LONG/SHORT)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  One-way: All positions use BOTH | Hedge: Separate LONG and SHORT positions
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxOpenPositions">Max Open Positions</Label>
                <div className="flex items-center space-x-4">
                  <Input
                    id="maxOpenPositions"
                    type="number"
                    value={config.global.maxOpenPositions || 10}
                    onChange={(e) => handleGlobalChange('maxOpenPositions', parseInt(e.target.value))}
                    className="w-24"
                    min="1"
                    max="50"
                    step="1"
                  />
                  <span className="text-sm text-muted-foreground">
                    Maximum concurrent positions (hedged pairs count as one)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="symbols" className="space-y-4" onFocus={fetchAvailableSymbols}>
          <Card>
            <CardHeader>
              <CardTitle>Symbol Configuration</CardTitle>
              <CardDescription>
                Configure trading parameters for each symbol
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  placeholder="Enter symbol manually (e.g., BTCUSDT)"
                  onKeyPress={(e) => e.key === 'Enter' && addSymbol()}
                />
                <Button onClick={() => addSymbol()} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Manual
                </Button>
                <Button
                  onClick={() => {
                    fetchAvailableSymbols();
                    setShowSymbolPicker(!showSymbolPicker);
                  }}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Settings2 className="h-4 w-4" />
                  Browse Symbols
                </Button>
              </div>

              {/* Symbol Picker */}
              {showSymbolPicker && (
                <Card className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Available Symbols</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSymbolPicker(false)}
                      >
                        ✕
                      </Button>
                    </div>
                    <Input
                      type="text"
                      value={symbolSearch}
                      onChange={(e) => setSymbolSearch(e.target.value.toUpperCase())}
                      placeholder="Search symbols..."
                      className="mt-2"
                    />
                  </CardHeader>
                  <CardContent className="max-h-96 overflow-y-auto">
                    {loadingSymbols ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Loading available symbols...
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {availableSymbols
                          .filter(s =>
                            !config.symbols[s.symbol] && // Not already added
                            (!symbolSearch || s.symbol.includes(symbolSearch))
                          )
                          .slice(0, 50) // Show max 50 results
                          .map((symbolInfo) => (
                            <div
                              key={symbolInfo.symbol}
                              className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer"
                              onClick={() => addSymbol(symbolInfo.symbol, symbolInfo.minNotional)}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{symbolInfo.symbol}</span>
                                <Badge variant="secondary" className="text-xs">
                                  Min: ${symbolInfo.minNotional} USDT
                                </Badge>
                              </div>
                              <Button size="sm" variant="ghost">
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        {symbolSearch && availableSymbols.filter(s =>
                          !config.symbols[s.symbol] && s.symbol.includes(symbolSearch)
                        ).length === 0 && (
                          <div className="text-center py-4 text-muted-foreground">
                            No matching symbols found
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {Object.keys(config.symbols).length > 0 && (
                <>
                  <div className="flex gap-2 flex-wrap">
                    {Object.keys(config.symbols).map((symbol) => (
                      <Badge
                        key={symbol}
                        variant={selectedSymbol === symbol ? "default" : "outline"}
                        className="cursor-pointer py-1.5 px-3"
                        onClick={() => setSelectedSymbol(symbol)}
                      >
                        {symbol}
                      </Badge>
                    ))}
                  </div>

                  {selectedSymbol && config.symbols[selectedSymbol] && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{selectedSymbol} Settings</CardTitle>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeSymbol(selectedSymbol)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Long Volume Threshold (USDT)</Label>
                          <Input
                            type="number"
                            value={config.symbols[selectedSymbol].longVolumeThresholdUSDT || config.symbols[selectedSymbol].volumeThresholdUSDT || 0}
                            onChange={(e) => handleSymbolChange(selectedSymbol, 'longVolumeThresholdUSDT', parseFloat(e.target.value))}
                            min="0"
                          />
                          <p className="text-xs text-muted-foreground">
                            Min liquidation volume for longs (buy on sell liquidations)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Short Volume Threshold (USDT)</Label>
                          <Input
                            type="number"
                            value={config.symbols[selectedSymbol].shortVolumeThresholdUSDT || config.symbols[selectedSymbol].volumeThresholdUSDT || 0}
                            onChange={(e) => handleSymbolChange(selectedSymbol, 'shortVolumeThresholdUSDT', parseFloat(e.target.value))}
                            min="0"
                          />
                          <p className="text-xs text-muted-foreground">
                            Min liquidation volume for shorts (sell on buy liquidations)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Leverage</Label>
                          <Input
                            type="number"
                            value={config.symbols[selectedSymbol].leverage}
                            onChange={(e) => handleSymbolChange(selectedSymbol, 'leverage', parseInt(e.target.value))}
                            min="1"
                            max="125"
                          />
                          <p className="text-xs text-muted-foreground">
                            Trading leverage (1-125x)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Trade Size (USDT)</Label>
                          <Input
                            type="number"
                            value={config.symbols[selectedSymbol].tradeSize}
                            onChange={(e) => handleSymbolChange(selectedSymbol, 'tradeSize', parseFloat(e.target.value))}
                            min="0"
                          />
                          <p className="text-xs text-muted-foreground">
                            Position size in USDT
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Max Position Margin (USDT)</Label>
                          <Input
                            type="number"
                            value={config.symbols[selectedSymbol].maxPositionMarginUSDT || 0}
                            onChange={(e) => handleSymbolChange(selectedSymbol, 'maxPositionMarginUSDT', parseFloat(e.target.value))}
                            min="0"
                          />
                          <p className="text-xs text-muted-foreground">
                            Max total margin exposure for this symbol
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Stop Loss (%)</Label>
                          <Input
                            type="number"
                            value={config.symbols[selectedSymbol].slPercent}
                            onChange={(e) => handleSymbolChange(selectedSymbol, 'slPercent', parseFloat(e.target.value))}
                            min="0.1"
                            step="0.1"
                          />
                          <p className="text-xs text-muted-foreground">
                            Stop loss percentage
                          </p>
                        </div>

                        <div className="space-y-2 col-span-2">
                          <Label>Take Profit (%)</Label>
                          <Input
                            type="number"
                            value={config.symbols[selectedSymbol].tpPercent}
                            onChange={(e) => handleSymbolChange(selectedSymbol, 'tpPercent', parseFloat(e.target.value))}
                            min="0.1"
                            step="0.1"
                          />
                          <p className="text-xs text-muted-foreground">
                            Take profit percentage
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {Object.keys(config.symbols).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No symbols configured yet</p>
                  <p className="text-sm">Add a symbol above to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Configuration
        </Button>
      </div>
    </div>
  );
}