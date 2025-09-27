import React from 'react';
import { Zap, TrendingUp, Shield, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Welcome to Aster Liquidation Hunter</h2>
        <p className="text-muted-foreground">
          Your automated trading bot for capturing liquidation opportunities
        </p>
      </div>

      <div className="grid gap-4">
        <div className="flex gap-3 items-start">
          <div className="mt-1 p-2 bg-blue-500/10 rounded-lg">
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Automated Trading</h3>
            <p className="text-sm text-muted-foreground">
              Monitors liquidation events 24/7 and automatically places strategic trades
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="mt-1 p-2 bg-green-500/10 rounded-lg">
            <Shield className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Risk Management</h3>
            <p className="text-sm text-muted-foreground">
              Built-in stop-loss and take-profit orders protect your positions
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="mt-1 p-2 bg-purple-500/10 rounded-lg">
            <Bot className="h-4 w-4 text-purple-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Paper Mode</h3>
            <p className="text-sm text-muted-foreground">
              Test strategies risk-free with simulated trading before going live
            </p>
          </div>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm text-center">
          This setup will take about <strong>3 minutes</strong> to complete
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1">
          Skip Setup (Paper Mode)
        </Button>
        <Button onClick={onNext} className="flex-1">
          Get Started
        </Button>
      </div>
    </div>
  );
}