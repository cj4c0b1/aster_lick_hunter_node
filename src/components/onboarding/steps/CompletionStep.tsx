import React from 'react';
import { CheckCircle, Rocket, BookOpen, MessageCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

interface CompletionStepProps {
  onComplete: () => void;
  isPaperMode: boolean;
  hasApiKeys: boolean;
}

export function CompletionStep({ onComplete, isPaperMode, hasApiKeys }: CompletionStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold">Setup Complete!</h2>
        <p className="text-muted-foreground">
          Your Aster Liquidation Hunter is ready to start
        </p>
        <div className="flex justify-center gap-2">
          {isPaperMode ? (
            <Badge variant="secondary">Paper Mode Active</Badge>
          ) : (
            <Badge variant="default">Live Trading Enabled</Badge>
          )}
          {hasApiKeys && (
            <Badge variant="outline">API Connected</Badge>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Card className="p-4">
          <div className="flex gap-3">
            <div className="mt-1 p-2 bg-primary/10 rounded-lg">
              <Play className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Start the Bot</h3>
              <p className="text-sm text-muted-foreground">
                Run <code className="bg-muted px-1 py-0.5 rounded">npm run dev</code> in your terminal to start both the web UI and bot service
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex gap-3">
            <div className="mt-1 p-2 bg-blue-500/10 rounded-lg">
              <Rocket className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Monitor Performance</h3>
              <p className="text-sm text-muted-foreground">
                Watch the dashboard for liquidation events, positions, and P&L tracking
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex gap-3">
            <div className="mt-1 p-2 bg-purple-500/10 rounded-lg">
              <BookOpen className="h-4 w-4 text-purple-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Learn More</h3>
              <p className="text-sm text-muted-foreground">
                Check out the Wiki for advanced strategies and troubleshooting
              </p>
            </div>
          </div>
        </Card>
      </div>

      {isPaperMode && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-center">
            <strong>Paper Mode Tip:</strong> Test your strategies risk-free. When you&apos;re ready,
            switch to live trading in the Configuration page.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Button onClick={onComplete} className="w-full">
          Go to Dashboard
        </Button>

        <div className="flex gap-3 text-sm">
          <Link href="https://discord.gg/P8Ev3Up" target="_blank" className="flex-1">
            <Button variant="outline" className="w-full">
              <MessageCircle className="mr-2 h-4 w-4" />
              Join Discord
            </Button>
          </Link>
          <Link href="https://github.com/CryptoGnome/aster_lick_hunter_node" target="_blank" className="flex-1">
            <Button variant="outline" className="w-full">
              <BookOpen className="mr-2 h-4 w-4" />
              View Docs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}