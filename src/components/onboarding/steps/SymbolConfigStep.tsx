import React, { useState } from 'react';
import { Settings, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';

interface SymbolConfig {
  symbol: string;
  volumeThreshold: number;
  leverage: number;
  tpPercent: number;
  slPercent: number;
  enabled: boolean;
}

interface SymbolConfigStepProps {
  onNext: (configs: SymbolConfig[], riskPercent: number) => void;
  onBack: () => void;
  isPaperMode: boolean;
}

const popularSymbols = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', recommended: true },
  { symbol: 'ETHUSDT', name: 'Ethereum', recommended: true },
  { symbol: 'SOLUSDT', name: 'Solana', recommended: false },
  { symbol: 'BNBUSDT', name: 'BNB', recommended: false },
];

const presets = {
  conservative: {
    leverage: 3,
    tpPercent: 3,
    slPercent: 1,
    riskPercent: 1,
    volumeThreshold: 50000,
  },
  balanced: {
    leverage: 5,
    tpPercent: 5,
    slPercent: 2,
    riskPercent: 2,
    volumeThreshold: 20000,
  },
  aggressive: {
    leverage: 10,
    tpPercent: 7,
    slPercent: 3,
    riskPercent: 3,
    volumeThreshold: 10000,
  },
};

export function SymbolConfigStep({ onNext, onBack, isPaperMode }: SymbolConfigStepProps) {
  const [selectedPreset, setSelectedPreset] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [riskPercent, setRiskPercent] = useState(2);
  const [configs, setConfigs] = useState<SymbolConfig[]>([
    {
      symbol: 'BTCUSDT',
      volumeThreshold: 20000,
      leverage: 5,
      tpPercent: 5,
      slPercent: 2,
      enabled: true,
    },
    {
      symbol: 'ETHUSDT',
      volumeThreshold: 20000,
      leverage: 5,
      tpPercent: 5,
      slPercent: 2,
      enabled: true,
    },
  ]);

  const applyPreset = (preset: 'conservative' | 'balanced' | 'aggressive') => {
    setSelectedPreset(preset);
    const settings = presets[preset];
    setRiskPercent(settings.riskPercent);
    setConfigs(configs.map(config => ({
      ...config,
      volumeThreshold: settings.volumeThreshold,
      leverage: settings.leverage,
      tpPercent: settings.tpPercent,
      slPercent: settings.slPercent,
    })));
  };

  const handleSubmit = () => {
    onNext(configs.filter(c => c.enabled), riskPercent);
  };

  const toggleSymbol = (symbol: string, enabled: boolean) => {
    setConfigs(configs.map(config =>
      config.symbol === symbol ? { ...config, enabled } : config
    ));
  };

  const _updateConfig = (symbol: string, field: keyof SymbolConfig, value: any) => {
    setConfigs(configs.map(config =>
      config.symbol === symbol ? { ...config, [field]: value } : config
    ));
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Settings className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Configure Trading Settings</h2>
        <p className="text-muted-foreground">
          Choose your trading pairs and risk parameters
        </p>
        {isPaperMode && (
          <Badge variant="secondary">Paper Mode - No Real Trading</Badge>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <Label>Quick Setup Presets</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <Button
              variant={selectedPreset === 'conservative' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyPreset('conservative')}
              className="flex flex-col h-auto py-3"
            >
              <span className="font-semibold">Conservative</span>
              <span className="text-xs opacity-70">Low Risk</span>
            </Button>
            <Button
              variant={selectedPreset === 'balanced' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyPreset('balanced')}
              className="flex flex-col h-auto py-3"
            >
              <span className="font-semibold">Balanced</span>
              <span className="text-xs opacity-70">Recommended</span>
            </Button>
            <Button
              variant={selectedPreset === 'aggressive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyPreset('aggressive')}
              className="flex flex-col h-auto py-3"
            >
              <span className="font-semibold">Aggressive</span>
              <span className="text-xs opacity-70">High Risk</span>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Trading Pairs</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select which pairs the bot will trade</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="space-y-2">
            {configs.map((config) => (
              <div key={config.symbol} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) => toggleSymbol(config.symbol, checked)}
                  />
                  <div>
                    <span className="font-medium">{config.symbol}</span>
                    {popularSymbols.find(s => s.symbol === config.symbol)?.recommended && (
                      <Badge variant="secondary" className="ml-2 text-xs">Recommended</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{config.leverage}x</span>
                  <span>•</span>
                  <span>TP {config.tpPercent}%</span>
                  <span>•</span>
                  <span>SL {config.slPercent}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Global Risk Percentage</Label>
            <span className="text-sm font-medium">{riskPercent}%</span>
          </div>
          <Slider
            value={[riskPercent]}
            onValueChange={([value]) => setRiskPercent(value)}
            min={0.5}
            max={5}
            step={0.5}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Maximum percentage of your balance to risk per trade
          </p>
        </div>

        {isPaperMode && (
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertDescription>
              <strong>Paper Mode:</strong> You can experiment with different settings without risk. The bot will simulate trades using fake money.
            </AlertDescription>
          </Alert>
        )}

        {!isPaperMode && (
          <Alert className="bg-yellow-500/10 border-yellow-500/20">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription>
              <strong>Live Trading:</strong> These settings will affect real trades. Start with conservative settings until you&apos;re comfortable.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!configs.some(c => c.enabled)}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}