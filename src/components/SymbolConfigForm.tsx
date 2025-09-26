'use client';

import React, { useState } from 'react';
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

  const defaultSymbolConfig: SymbolConfig = {
    volumeThresholdUSDT: 100000,
    leverage: 10,
    tradeSize: 100,
    slPercent: 2,
    tpPercent: 3,
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

  const addSymbol = () => {
    if (newSymbol && !config.symbols[newSymbol]) {
      setConfig({
        ...config,
        symbols: {
          ...config.symbols,
          [newSymbol]: { ...defaultSymbolConfig },
        },
      });
      setSelectedSymbol(newSymbol);
      setNewSymbol('');
      toast.success(`Added ${newSymbol} to configuration`);
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="symbols" className="space-y-4">
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
                  placeholder="Enter symbol (e.g., BTCUSDT)"
                  onKeyPress={(e) => e.key === 'Enter' && addSymbol()}
                />
                <Button onClick={addSymbol} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Symbol
                </Button>
              </div>

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
                          <Label>Volume Threshold (USDT)</Label>
                          <Input
                            type="number"
                            value={config.symbols[selectedSymbol].volumeThresholdUSDT}
                            onChange={(e) => handleSymbolChange(selectedSymbol, 'volumeThresholdUSDT', parseFloat(e.target.value))}
                            min="0"
                          />
                          <p className="text-xs text-muted-foreground">
                            Minimum liquidation volume to trigger
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