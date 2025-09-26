import { TrendingUp, Target, BarChart3, Settings, Zap, AlertCircle, Brain, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TradingStrategiesPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          Trading Strategies
        </h1>
        <p className="text-muted-foreground">
          Optimize your liquidation hunting with proven strategies and configuration tips
        </p>
      </div>

      <Alert className="border-blue-500/50 bg-blue-500/10">
        <Brain className="h-4 w-4 text-blue-500" />
        <AlertDescription>
          <strong>Strategy Overview:</strong> The bot implements a momentum-driven contrarian strategy that capitalizes on price dislocations created by forced liquidations.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="core-strategy" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="core-strategy">Core Strategy</TabsTrigger>
          <TabsTrigger value="configurations">Configurations</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
        </TabsList>

        <TabsContent value="core-strategy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Liquidation Hunting Logic
              </CardTitle>
              <CardDescription>How the bot identifies and capitalizes on liquidation events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <h4 className="font-semibold text-red-500 mb-2">Long Liquidations → BUY</h4>
                  <p className="text-sm text-muted-foreground">
                    When leveraged long positions get liquidated, they create forced selling pressure.
                    The bot capitalizes by buying into this temporary price depression.
                  </p>
                </div>
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <h4 className="font-semibold text-green-500 mb-2">Short Liquidations → SELL</h4>
                  <p className="text-sm text-muted-foreground">
                    When leveraged short positions get liquidated, they create forced buying pressure.
                    The bot capitalizes by selling into this temporary price spike.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Signal Detection Criteria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge className="bg-blue-500">1</Badge>
                  <div>
                    <h4 className="font-medium">Volume Thresholds</h4>
                    <p className="text-sm text-muted-foreground">
                      Only trades liquidations above configurable USD thresholds (e.g., $10,000+).
                      Small liquidations don't move markets significantly.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="bg-blue-500">2</Badge>
                  <div>
                    <h4 className="font-medium">Price Proximity</h4>
                    <p className="text-sm text-muted-foreground">
                      Liquidation price must be within 1% of current mark price to ensure relevance.
                      Stale liquidations are filtered out.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="bg-blue-500">3</Badge>
                  <div>
                    <h4 className="font-medium">VWAP Protection</h4>
                    <p className="text-sm text-muted-foreground">
                      Ensures favorable entry context: Buy when price &lt; VWAP, Sell when price &gt; VWAP.
                      Prevents buying into momentum or selling into downtrends.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Intelligent Order Execution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <h4 className="font-medium">Smart Limit Orders</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Places orders slightly inside the spread for better fills</li>
                  <li>• Analyzes order book depth before execution</li>
                  <li>• Falls back to market orders when liquidity is insufficient</li>
                  <li>• Applies configurable price offsets (typically 1-2 basis points)</li>
                </ul>
              </div>
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <h4 className="font-medium">Automatic Risk Management</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Places stop-loss orders immediately after entry</li>
                  <li>• Sets take-profit targets based on configuration</li>
                  <li>• Adjusts for underwater positions to prevent immediate stops</li>
                  <li>• Monitors positions with real-time P&L tracking</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configurations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Presets</CardTitle>
              <CardDescription>Ready-to-use configurations for different trading styles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-green-500">Conservative</Badge>
                    <h4 className="font-medium">Low Risk, Steady Returns</h4>
                  </div>
                  <div className="bg-muted p-3 rounded font-mono text-xs">
{`{
  "BTCUSDT": {
    "longVolumeThresholdUSDT": 50000,  // Large liquidations only
    "shortVolumeThresholdUSDT": 50000,
    "tradeSize": 50,                   // Small position size
    "leverage": 2,                     // Low leverage
    "tpPercent": 2,                    // Modest profit target
    "slPercent": 1,                    // Tight stop-loss
    "vwapProtection": true,
    "maxSlippageBps": 10               // Very tight slippage
  }
}`}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Best for: Beginners, small accounts, risk-averse traders
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-orange-500">Aggressive</Badge>
                    <h4 className="font-medium">Higher Risk, Higher Returns</h4>
                  </div>
                  <div className="bg-muted p-3 rounded font-mono text-xs">
{`{
  "BTCUSDT": {
    "longVolumeThresholdUSDT": 5000,   // Smaller liquidations
    "shortVolumeThresholdUSDT": 5000,
    "tradeSize": 200,                  // Larger position size
    "leverage": 10,                    // Higher leverage
    "tpPercent": 5,                    // Ambitious profit target
    "slPercent": 3,                    // Wider stop-loss
    "vwapProtection": false,           // No VWAP filter
    "maxSlippageBps": 100              // Accept more slippage
  }
}`}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Best for: Experienced traders, larger accounts, active management
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-purple-500">Scalping</Badge>
                    <h4 className="font-medium">Quick Profits, Frequent Trades</h4>
                  </div>
                  <div className="bg-muted p-3 rounded font-mono text-xs">
{`{
  "BTCUSDT": {
    "longVolumeThresholdUSDT": 2000,   // Frequent signals
    "shortVolumeThresholdUSDT": 2000,
    "tradeSize": 100,
    "leverage": 5,
    "tpPercent": 0.5,                  // Quick profits
    "slPercent": 0.3,                  // Tight stops
    "vwapProtection": true,
    "vwapTimeframe": "1m",             // Short-term VWAP
    "vwapLookback": 60                 // 1-hour lookback
  }
}`}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Best for: High-frequency trading, short-term profits, tight spreads
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Key Configuration Parameters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-medium">Volume & Entry</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">volumeThresholdUSDT</span>
                        <span>Minimum liquidation size</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">priceOffsetBps</span>
                        <span>Order price offset</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">maxSlippageBps</span>
                        <span>Maximum slippage allowed</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">vwapProtection</span>
                        <span>Enable VWAP filtering</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium">Risk & Position</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">tradeSize</span>
                        <span>Base trade size (USDT)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">leverage</span>
                        <span>Position leverage</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">tpPercent</span>
                        <span>Take profit %</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">slPercent</span>
                        <span>Stop loss %</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Optimization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Parameter Tuning Guidelines</h4>
                  <div className="space-y-2">
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">Volume Thresholds</p>
                      <p className="text-xs text-muted-foreground">Start high ($50k+), reduce gradually while monitoring win rate changes</p>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">Leverage</p>
                      <p className="text-xs text-muted-foreground">Begin with 2-3x, increase only with proven profitability</p>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">TP/SL Ratios</p>
                      <p className="text-xs text-muted-foreground">Maintain positive risk-reward, adjust for market volatility</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium">Market Adaptations</h4>
                  <div className="space-y-2">
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">High Volatility</p>
                      <p className="text-xs text-muted-foreground">Increase thresholds, widen stops, reduce leverage</p>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">Low Volatility</p>
                      <p className="text-xs text-muted-foreground">Decrease thresholds, tighten stops, more aggressive entries</p>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium text-sm">Trending Markets</p>
                      <p className="text-xs text-muted-foreground">Consider direction-specific thresholds, adjust VWAP timeframes</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-3">Key Performance Indicators</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Win Rate</span>
                      <span className="text-green-500">Target: &gt;55%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Risk-Reward Ratio</span>
                      <span className="text-green-500">Target: &gt;1.5:1</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Sharpe Ratio</span>
                      <span className="text-green-500">Target: &gt;1.0</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Max Drawdown</span>
                      <span className="text-yellow-500">Monitor closely</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Monitoring Dashboard</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Current positions with live P&L</p>
                    <p>• Recent liquidation events</p>
                    <p>• Hit rate (successful entries)</p>
                    <p>• Session P&L and statistics</p>
                    <p>• Average trade duration</p>
                    <p>• Configuration status</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trading Scenario Examples</CardTitle>
              <CardDescription>Real-world examples of how the bot responds to different market conditions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-green-500">Scenario 1</Badge>
                  <h4 className="font-medium">Large Long Liquidation</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Event:</strong> $50,000 BTCUSDT long liquidation at $48,500</p>
                  <div className="bg-muted p-3 rounded">
                    <p className="font-medium mb-1">Bot Response:</p>
                    <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                      <li>Detects liquidation via WebSocket</li>
                      <li>Validates: $50k &gt; $10k threshold ✓</li>
                      <li>Checks proximity: $48,500 within 1% of $49,000 ✓</li>
                      <li>VWAP check: $48,600 &lt; $49,200 VWAP ✓</li>
                      <li>Places LIMIT BUY at $48,501 for 0.01 BTC</li>
                      <li>Sets STOP at $47,531 (-2%) and TP at $50,926 (+5%)</li>
                    </ol>
                  </div>
                  <p><strong>Result:</strong> TP hits for +5% profit on margin</p>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-orange-500">Scenario 2</Badge>
                  <h4 className="font-medium">Cascade Liquidation Event</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Event:</strong> Multiple sequential liquidations</p>
                  <div className="bg-muted p-3 rounded">
                    <p className="font-medium mb-1">Bot Response:</p>
                    <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                      <li>First liquidation triggers entry</li>
                      <li>Second liquidation ignored (already positioned)</li>
                      <li>Stop-loss triggers at -2% (price continues down)</li>
                      <li>Third liquidation creates new signal</li>
                      <li>Bot re-enters with fresh position</li>
                      <li>Market reverses strongly, TP hits at +5%</li>
                    </ol>
                  </div>
                  <p><strong>Result:</strong> -2% loss, then +5% profit = +3% net</p>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-red-500">Scenario 3</Badge>
                  <h4 className="font-medium">VWAP Protection Filter</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Event:</strong> $15,000 ETHUSDT short liquidation</p>
                  <div className="bg-muted p-3 rounded">
                    <p className="font-medium mb-1">Bot Response:</p>
                    <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                      <li>Detects liquidation</li>
                      <li>Volume check: $15k &gt; $10k threshold ✓</li>
                      <li>VWAP check: Current $2,100 &lt; VWAP $2,080 ✗</li>
                      <li>Trade skipped - unfavorable VWAP position</li>
                      <li>Continues monitoring for better opportunities</li>
                    </ol>
                  </div>
                  <p><strong>Result:</strong> No trade, no loss - protection worked</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> Always start with conservative settings and paper mode. Gradually optimize based on your results and risk tolerance. Past performance doesn't guarantee future results.
        </AlertDescription>
      </Alert>
    </div>
  );
}