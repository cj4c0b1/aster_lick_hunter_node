import { Rocket, Terminal, Settings, Play, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function GettingStartedPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Rocket className="h-8 w-8 text-primary" />
          Getting Started
        </h1>
        <p className="text-muted-foreground">
          Get your Aster Liquidation Hunter bot up and running in minutes
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prerequisites</CardTitle>
          <CardDescription>What you need before starting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Node.js 18+ installed</p>
              <p className="text-sm text-muted-foreground">Required for running the bot</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">AsterDex account (optional)</p>
              <p className="text-sm text-muted-foreground">Only needed for live trading</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Basic terminal knowledge</p>
              <p className="text-sm text-muted-foreground">For running commands</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Installation Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>Step 1</Badge>
                <span className="font-medium">Clone the repository</span>
              </div>
              <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                git clone https://github.com/CryptoGnome/aster_lick_hunter_node.git<br />
                cd aster_lick_hunter_node
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>Step 2</Badge>
                <span className="font-medium">Install dependencies</span>
              </div>
              <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                npm install
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>Step 3</Badge>
                <span className="font-medium">Build the application</span>
              </div>
              <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                npm run build
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>Step 4</Badge>
                <span className="font-medium">Start the bot</span>
              </div>
              <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                npm run dev
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This starts both the web UI (port 3000) and bot service (port 8080)
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>Step 5</Badge>
                <span className="font-medium">Open the dashboard</span>
              </div>
              <p className="text-sm">
                Navigate to <code className="bg-muted px-2 py-1 rounded">http://localhost:3000</code> in your browser
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Initial Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>Automatic Setup:</strong> When you first open the dashboard, an onboarding wizard will guide you through the configuration process.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div>
              <h4 className="font-medium mb-2">Paper Mode (Recommended for beginners)</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>No API keys required</li>
                <li>Simulates trades with fake money</li>
                <li>Perfect for learning and testing</li>
                <li>Generates mock liquidation events</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Live Mode (For experienced users)</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Requires AsterDex API credentials</li>
                <li>Trades with real money</li>
                <li>Monitors actual liquidation events</li>
                <li>Full risk management features</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Running the Bot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium mb-2">Available Commands</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <code className="text-sm">npm run dev</code>
                  <span className="text-xs text-muted-foreground">Development mode (both UI & bot)</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <code className="text-sm">npm run dev:web</code>
                  <span className="text-xs text-muted-foreground">Web UI only</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <code className="text-sm">npm run dev:bot</code>
                  <span className="text-xs text-muted-foreground">Bot service only</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <code className="text-sm">npm start</code>
                  <span className="text-xs text-muted-foreground">Production mode</span>
                </div>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Tip:</strong> Use Ctrl+C (Windows/Linux) or Cmd+C (Mac) to stop the bot gracefully.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          <strong>Next Steps:</strong> After setup, check out the <a href="/wiki/api-setup" className="underline">API Setup Guide</a> for connecting to AsterDex, or explore <a href="/wiki/trading-strategies" className="underline">Trading Strategies</a> to optimize your bot.
        </AlertDescription>
      </Alert>
    </div>
  );
}