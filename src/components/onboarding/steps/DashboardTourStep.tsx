import React, { useState } from 'react';
import { Layout, Activity, DollarSign, TrendingUp, Settings, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface DashboardTourStepProps {
  onNext: () => void;
  onBack: () => void;
  onStartTour: () => void;
}

const features = [
  {
    icon: Activity,
    title: 'Live Status Panel',
    description: 'Monitor bot connection, trading mode, and active positions in real-time',
    location: 'Sidebar',
    color: 'text-green-500',
  },
  {
    icon: DollarSign,
    title: 'Liquidation Feed',
    description: 'Watch incoming liquidation events and see which ones trigger trades',
    location: 'Main Dashboard',
    color: 'text-blue-500',
  },
  {
    icon: TrendingUp,
    title: 'Position Management',
    description: 'Track your open positions, P&L, and automatic stop-loss/take-profit orders',
    location: 'Dashboard Cards',
    color: 'text-purple-500',
  },
  {
    icon: Settings,
    title: 'Configuration',
    description: 'Adjust trading parameters, symbols, and risk settings anytime',
    location: 'Settings Page',
    color: 'text-orange-500',
  },
];

export function DashboardTourStep({ onNext, onBack, onStartTour }: DashboardTourStepProps) {
  const [tourStarted, setTourStarted] = useState(false);

  const handleStartTour = () => {
    setTourStarted(true);
    onStartTour();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Layout className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Explore the Dashboard</h2>
        <p className="text-muted-foreground">
          Learn about the key features and how to use them effectively
        </p>
      </div>

      <div className="space-y-3">
        {features.map((feature, index) => (
          <Card key={index} className="p-4">
            <div className="flex gap-3">
              <div className={`mt-1 p-2 bg-muted rounded-lg ${feature.color}`}>
                <feature.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <Badge variant="outline" className="text-xs">
                    {feature.location}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1">
          <p className="text-sm">
            <strong>Interactive Tour:</strong> Click &quot;Start Tour&quot; to see these features highlighted on your actual dashboard with helpful tooltips.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        {!tourStarted && (
          <Button
            variant="outline"
            onClick={handleStartTour}
            className="flex-1"
          >
            Start Interactive Tour
          </Button>
        )}
        <Button onClick={onNext} className="flex-1">
          {tourStarted ? 'Finish Setup' : 'Skip Tour'}
        </Button>
      </div>
    </div>
  );
}