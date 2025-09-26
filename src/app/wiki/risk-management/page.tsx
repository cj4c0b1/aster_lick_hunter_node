import { Shield, AlertTriangle, Target, DollarSign, TrendingDown, Settings, Calculator, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function RiskManagementPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          Risk Management
        </h1>
        <p className="text-muted-foreground">
          Protect your capital with comprehensive risk management strategies and safety measures
        </p>
      </div>

      <Alert className="border-red-500/50 bg-red-500/10">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <AlertDescription>
          <strong>Critical:</strong> Risk management is the difference between long-term success and account destruction. Never trade without proper safeguards.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="fundamentals" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
          <TabsTrigger value="position-sizing">Position Sizing</TabsTrigger>
          <TabsTrigger value="protection">Protection Systems</TabsTrigger>
          <TabsTrigger value="emergency">Emergency Procedures</TabsTrigger>
        </TabsList>

        <TabsContent value="fundamentals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Risk Management Principles
              </CardTitle>
              <CardDescription>Core concepts every trader must understand</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">The 1% Rule</h4>
                  <p className="text-sm text-muted-foreground">
                    Never risk more than 1-2% of your total account balance on a single trade.
                    This ensures you can withstand a long series of losses without destroying your account.
                  </p>
                  <div className="bg-muted p-3 rounded">
                    <p className="text-xs font-mono">
                      Account: $10,000<br />
                      Max Risk per Trade: $100-200<br />
                      Margin with 10x Leverage: $10-20<br />
                      Maximum Positions: 5-10
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium">Risk-Reward Ratio</h4>
                  <p className="text-sm text-muted-foreground">
                    Always maintain a positive risk-reward ratio. If you risk $100, aim to make $150+ profit.
                    This allows you to be profitable even with a 40% win rate.
                  </p>
                  <div className="bg-muted p-3 rounded">
                    <p className="text-xs font-mono">
                      Risk: 2% (Stop Loss)<br />
                      Reward: 5% (Take Profit)<br />
                      Ratio: 2.5:1<br />
                      Break-even Win Rate: 29%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Drawdown Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg">
                  <h4 className="font-medium text-yellow-600 mb-2">Maximum Drawdown Limits</h4>
                  <div className="grid md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="font-medium">Conservative</p>
                      <p className="text-muted-foreground">10% max drawdown</p>
                    </div>
                    <div>
                      <p className="font-medium">Moderate</p>
                      <p className="text-muted-foreground">20% max drawdown</p>
                    </div>
                    <div>
                      <p className="font-medium">Aggressive</p>
                      <p className="text-muted-foreground">30% max drawdown</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Drawdown Response Actions</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">5-10% Drawdown</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Review recent trades for patterns</li>
                        <li>Consider reducing position sizes</li>
                        <li>Tighten risk parameters</li>
                        <li>Increase monitoring frequency</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">15%+ Drawdown</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Stop trading immediately</li>
                        <li>Complete strategy review</li>
                        <li>Return to paper mode testing</li>
                        <li>Consider market condition changes</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Risk Calculation Examples
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Example 1: Conservative Trader</h4>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Account Balance:</strong> $5,000</p>
                      <p><strong>Risk per Trade:</strong> 1% = $50</p>
                      <p><strong>Stop Loss:</strong> 2%</p>
                      <p><strong>Leverage:</strong> 5x</p>
                    </div>
                    <div>
                      <p><strong>Position Size:</strong> $1,250 (5x leverage)</p>
                      <p><strong>Margin Required:</strong> $250</p>
                      <p><strong>Max Positions:</strong> 2-3</p>
                      <p><strong>Total Risk:</strong> $100-150 (2-3%)</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Example 2: Aggressive Trader</h4>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Account Balance:</strong> $20,000</p>
                      <p><strong>Risk per Trade:</strong> 2% = $400</p>
                      <p><strong>Stop Loss:</strong> 3%</p>
                      <p><strong>Leverage:</strong> 10x</p>
                    </div>
                    <div>
                      <p><strong>Position Size:</strong> $13,333 (10x leverage)</p>
                      <p><strong>Margin Required:</strong> $1,333</p>
                      <p><strong>Max Positions:</strong> 5</p>
                      <p><strong>Total Risk:</strong> $2,000 (10%)</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="position-sizing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Position Sizing Strategies
              </CardTitle>
              <CardDescription>How to determine optimal trade sizes for your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Fixed Dollar Risk</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Risk the same dollar amount on every trade regardless of stop loss distance.
                  </p>
                  <div className="bg-muted p-3 rounded text-xs font-mono">
                    Risk Amount = Account × Risk %<br />
                    Position Size = Risk Amount ÷ Stop Loss %<br />
                    <br />
                    Example:<br />
                    Account: $10,000<br />
                    Risk: 1% = $100<br />
                    Stop Loss: 2%<br />
                    Position Size: $100 ÷ 0.02 = $5,000
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Fixed Percentage Risk</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Risk the same percentage of account value, adjusting position size for volatility.
                  </p>
                  <div className="bg-muted p-3 rounded text-xs font-mono">
                    Risk % = Fixed (e.g., 1%)<br />
                    Position Size varies with SL distance<br />
                    <br />
                    Wide SL = Smaller position<br />
                    Tight SL = Larger position<br />
                    <br />
                    Better for varying market conditions
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leverage Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Alert className="border-orange-500/50 bg-orange-500/10">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <AlertDescription>
                    <strong>Warning:</strong> Higher leverage amplifies both profits and losses. Start conservative and increase gradually.
                  </AlertDescription>
                </Alert>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 border border-green-500/30 rounded-lg">
                    <h4 className="font-medium text-green-600 mb-2">Low Risk (2-5x)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Beginner traders</li>
                      <li>• Small accounts (&lt;$5k)</li>
                      <li>• Learning phase</li>
                      <li>• High volatility periods</li>
                    </ul>
                  </div>
                  <div className="p-4 border border-yellow-500/30 rounded-lg">
                    <h4 className="font-medium text-yellow-600 mb-2">Medium Risk (5-10x)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Experienced traders</li>
                      <li>• Medium accounts ($5-20k)</li>
                      <li>• Proven strategy</li>
                      <li>• Normal market conditions</li>
                    </ul>
                  </div>
                  <div className="p-4 border border-red-500/30 rounded-lg">
                    <h4 className="font-medium text-red-600 mb-2">High Risk (10x+)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Expert traders only</li>
                      <li>• Large accounts (&gt;$20k)</li>
                      <li>• Excellent risk management</li>
                      <li>• Low volatility periods</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Position Limits Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-3">Bot Configuration Example</h4>
                <div className="bg-background p-3 rounded font-mono text-xs">
{`{
  "global": {
    "maxPositions": 5,              // Maximum concurrent positions
    "riskPercentage": 2,            // Max % of account per trade
    "maxTotalRisk": 10,             // Max % of account at risk
    "paperMode": false              // Use real money
  },
  "BTCUSDT": {
    "tradeSize": 100,               // Base margin per trade
    "leverage": 5,                  // Position leverage
    "maxPositionMarginUSDT": 500,   // Max margin per symbol
    "slPercent": 2,                 // Stop loss percentage
    "tpPercent": 5                  // Take profit percentage
  }
}`}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Global Limits</h4>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• <strong>maxPositions:</strong> Prevents over-exposure</li>
                    <li>• <strong>riskPercentage:</strong> Risk per trade limit</li>
                    <li>• <strong>maxTotalRisk:</strong> Total account risk cap</li>
                    <li>• <strong>paperMode:</strong> Safe testing mode</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Per-Symbol Limits</h4>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• <strong>tradeSize:</strong> Margin amount per trade</li>
                    <li>• <strong>leverage:</strong> Position multiplier</li>
                    <li>• <strong>maxPositionMargin:</strong> Symbol exposure limit</li>
                    <li>• <strong>sl/tpPercent:</strong> Exit levels</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="protection" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Automated Protection Systems
              </CardTitle>
              <CardDescription>Built-in safeguards that protect your capital automatically</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border border-blue-500/30 bg-blue-500/10 rounded-lg">
                    <h4 className="font-medium text-blue-600 mb-2">Stop-Loss Orders</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Automatically placed on every position</li>
                      <li>• STOP_MARKET type for guaranteed execution</li>
                      <li>• Configurable percentage from entry price</li>
                      <li>• Adjusts for underwater positions</li>
                      <li>• Cannot be manually disabled</li>
                    </ul>
                  </div>
                  <div className="p-4 border border-green-500/30 bg-green-500/10 rounded-lg">
                    <h4 className="font-medium text-green-600 mb-2">Take-Profit Orders</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• LIMIT orders at target price levels</li>
                      <li>• Automatically secures profits</li>
                      <li>• Configurable percentage from entry</li>
                      <li>• May not fill in fast markets</li>
                      <li>• Better price than stop loss</li>
                    </ul>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg">
                    <h4 className="font-medium text-yellow-600 mb-2">Position Limits</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Maximum number of concurrent positions</li>
                      <li>• Per-symbol margin limits</li>
                      <li>• Total account risk percentage caps</li>
                      <li>• Prevents revenge trading</li>
                      <li>• Enforced at order level</li>
                    </ul>
                  </div>
                  <div className="p-4 border border-purple-500/30 bg-purple-500/10 rounded-lg">
                    <h4 className="font-medium text-purple-600 mb-2">Connection Monitoring</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• WebSocket auto-reconnection</li>
                      <li>• Exponential backoff on failures</li>
                      <li>• Graceful shutdown on Ctrl+C</li>
                      <li>• Position monitoring continues</li>
                      <li>• Emergency stop capabilities</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Validation & Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Pre-Trade Validation Layers</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">Layer 1: Account Checks</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Sufficient balance verification</li>
                        <li>Position count limits</li>
                        <li>API connection status</li>
                        <li>Exchange availability</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">Layer 2: Signal Quality</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Volume threshold compliance</li>
                        <li>Price proximity validation</li>
                        <li>VWAP protection filter</li>
                        <li>Market hours check</li>
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">Layer 3: Order Quality</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Price/quantity precision</li>
                        <li>Minimum notional value</li>
                        <li>Maximum order size</li>
                        <li>Slippage limits</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">Layer 4: Risk Management</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Position sizing validation</li>
                        <li>Risk percentage enforcement</li>
                        <li>Leverage compliance</li>
                        <li>Correlation limits</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emergency" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Emergency Procedures
              </CardTitle>
              <CardDescription>What to do when things go wrong</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <Alert className="border-red-500/50 bg-red-500/10">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <AlertDescription>
                    <strong>Emergency Stop:</strong> Press Ctrl+C to gracefully shut down the bot. All positions will remain open but new trades will stop.
                  </AlertDescription>
                </Alert>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border border-red-500/30 rounded-lg">
                    <h4 className="font-medium text-red-600 mb-3">Immediate Actions</h4>
                    <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                      <li>Stop the bot (Ctrl+C)</li>
                      <li>Open AsterDex manually</li>
                      <li>Check all open positions</li>
                      <li>Verify stop-loss orders are in place</li>
                      <li>Close positions manually if needed</li>
                      <li>Check account balance</li>
                    </ol>
                  </div>
                  <div className="p-4 border border-yellow-500/30 rounded-lg">
                    <h4 className="font-medium text-yellow-600 mb-3">Investigation Steps</h4>
                    <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                      <li>Review bot logs for errors</li>
                      <li>Check network connectivity</li>
                      <li>Verify API key permissions</li>
                      <li>Examine recent trades</li>
                      <li>Calculate actual vs expected P&L</li>
                      <li>Review configuration changes</li>
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Common Emergency Scenarios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-red-500">Critical</Badge>
                    <h4 className="font-medium">Large Unexpected Loss</h4>
                  </div>
                  <div className="text-sm space-y-2">
                    <p className="text-muted-foreground">
                      If you see a position with losses much larger than expected stop-loss levels.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium mb-1">Immediate Actions:</p>
                      <ol className="text-muted-foreground list-decimal list-inside text-xs space-y-1">
                        <li>Stop the bot immediately</li>
                        <li>Close the position manually on exchange</li>
                        <li>Check if stop-loss order was filled</li>
                        <li>Review exchange status for outages</li>
                        <li>Check for slippage in volatile markets</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-orange-500">High</Badge>
                    <h4 className="font-medium">Bot Stops Responding</h4>
                  </div>
                  <div className="text-sm space-y-2">
                    <p className="text-muted-foreground">
                      Bot appears frozen, not processing new liquidations or updating positions.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium mb-1">Immediate Actions:</p>
                      <ol className="text-muted-foreground list-decimal list-inside text-xs space-y-1">
                        <li>Check terminal for error messages</li>
                        <li>Verify internet connection</li>
                        <li>Restart the bot if necessary</li>
                        <li>Check AsterDex API status</li>
                        <li>Ensure positions have proper stop-losses</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-yellow-500">Medium</Badge>
                    <h4 className="font-medium">Rapid Consecutive Losses</h4>
                  </div>
                  <div className="text-sm space-y-2">
                    <p className="text-muted-foreground">
                      Multiple stop-losses triggered in succession, approaching daily loss limits.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium mb-1">Immediate Actions:</p>
                      <ol className="text-muted-foreground list-decimal list-inside text-xs space-y-1">
                        <li>Enable paper mode to stop real trading</li>
                        <li>Review market conditions for anomalies</li>
                        <li>Check configuration for errors</li>
                        <li>Consider reducing position sizes</li>
                        <li>Take a break from trading</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Recovery Procedures
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Getting Back to Normal Operations</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">1. Safety First</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Return to paper mode</li>
                        <li>Reduce position sizes by 50%</li>
                        <li>Lower leverage temporarily</li>
                        <li>Increase stop-loss percentages</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">2. Analysis</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Review trade history</li>
                        <li>Identify failure patterns</li>
                        <li>Check market condition changes</li>
                        <li>Validate configuration settings</li>
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">3. Testing</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Run paper mode for 24-48 hours</li>
                        <li>Monitor for similar issues</li>
                        <li>Test with minimal risk</li>
                        <li>Verify all systems working</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">4. Gradual Return</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Start with single positions</li>
                        <li>Gradually increase size</li>
                        <li>Monitor closely for 24 hours</li>
                        <li>Return to full operation slowly</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Remember:</strong> The best risk management is preparation. Review these procedures regularly and practice them in paper mode before you need them in a real emergency.
        </AlertDescription>
      </Alert>
    </div>
  );
}