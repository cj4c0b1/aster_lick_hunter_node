import { AlertCircle, Wifi, Key, Activity, Terminal, RefreshCw, Bug, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TroubleshootingPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-primary" />
          Troubleshooting
        </h1>
        <p className="text-muted-foreground">
          Common issues and solutions to keep your bot running smoothly
        </p>
      </div>

      <Alert className="border-blue-500/50 bg-blue-500/10">
        <Bug className="h-4 w-4 text-blue-500" />
        <AlertDescription>
          <strong>Quick Start:</strong> Most issues are resolved by restarting the bot and checking your internet connection. Try these first before diving deeper.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="connection" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connection">Connection Issues</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trading">Trading Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                WebSocket Connection Problems
              </CardTitle>
              <CardDescription>Issues with real-time data feeds and liquidation monitoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border border-red-500/30 bg-red-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-red-500">Error</Badge>
                    <h4 className="font-medium">"WebSocket connection failed" or "Connection timeout"</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      The bot cannot connect to AsterDex's real-time data streams.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Solutions (try in order):</p>
                      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                        <li>Check your internet connection (try opening asterdex.com)</li>
                        <li>Restart the bot with Ctrl+C, then <code>npm run dev</code></li>
                        <li>Try a different network (mobile hotspot, VPN)</li>
                        <li>Check if your firewall is blocking WebSocket connections</li>
                        <li>Verify AsterDex is not under maintenance (check their Twitter/Discord)</li>
                        <li>Wait 5-10 minutes and try again (temporary server issues)</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-yellow-500">Warning</Badge>
                    <h4 className="font-medium">"WebSocket disconnected" (frequent reconnections)</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Bot keeps losing connection and reconnecting every few minutes.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Possible causes & solutions:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li><strong>Unstable internet:</strong> Switch to wired connection or better WiFi</li>
                        <li><strong>VPN issues:</strong> Try without VPN or switch servers</li>
                        <li><strong>ISP throttling:</strong> Contact your internet provider</li>
                        <li><strong>Computer sleep mode:</strong> Disable sleep/hibernation</li>
                        <li><strong>Router issues:</strong> Restart your router/modem</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-blue-500/30 bg-blue-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-500">Info</Badge>
                    <h4 className="font-medium">Connection Status Indicators</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <p className="font-medium mb-1">🟢 Connected</p>
                        <p className="text-xs text-muted-foreground">All systems working normally</p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">🟡 Connecting</p>
                        <p className="text-xs text-muted-foreground">Attempting to establish connection</p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">🔴 Disconnected</p>
                        <p className="text-xs text-muted-foreground">No connection, check network</p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">⚪ Reconnecting</p>
                        <p className="text-xs text-muted-foreground">Automatic retry in progress</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Network Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Required Network Access</h4>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-medium text-sm mb-2">The bot needs access to these domains:</p>
                  <div className="grid md:grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <p className="text-green-600">✓ fapi.asterdex.com</p>
                      <p className="text-muted-foreground">REST API (HTTPS)</p>
                    </div>
                    <div>
                      <p className="text-green-600">✓ fstream.asterdex.com</p>
                      <p className="text-muted-foreground">WebSocket streams</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Firewall Configuration</h4>
                  <div className="bg-background border p-3 rounded text-xs">
                    <p className="font-medium mb-1">Allow outbound connections:</p>
                    <p>• Port 443 (HTTPS) to *.asterdex.com</p>
                    <p>• Port 443 (WSS) to fstream.asterdex.com</p>
                    <p>• Port 3000 (HTTP) for local web UI</p>
                    <p>• Port 8080 (WebSocket) for internal status</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authentication" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Authentication Issues
              </CardTitle>
              <CardDescription>Problems with API keys and account access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border border-red-500/30 bg-red-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-red-500">Error</Badge>
                    <h4 className="font-medium">"Invalid API key" or "Signature verification failed"</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Your API credentials are incorrect or malformed.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Check these items:</p>
                      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                        <li>API key is exactly 64 characters (no spaces/extra characters)</li>
                        <li>Secret key is exactly 64 characters (copy the entire string)</li>
                        <li>Keys are case-sensitive - match exactly from AsterDex</li>
                        <li>No quotes or brackets in the configuration file</li>
                        <li>Both keys are from the same API pair</li>
                        <li>API key is active (not deleted or expired)</li>
                      </ol>
                    </div>
                    <div className="bg-background border p-3 rounded">
                      <p className="font-medium text-xs mb-1">Example correct format in config.user.json:</p>
                      <code className="text-xs">
{`{
  "api": {
    "apiKey": "abcd1234...64chars",
    "secretKey": "xyz9876...64chars"
  }
}`}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-yellow-500">Warning</Badge>
                    <h4 className="font-medium">"IP not whitelisted" or "Access denied"</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Your IP address is not allowed to use this API key.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Solutions:</p>
                      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                        <li>Log into AsterDex and go to API Management</li>
                        <li>Find your API key and edit IP whitelist</li>
                        <li>Add your current IP address (Google "what is my IP")</li>
                        <li>Or remove IP restrictions entirely (less secure)</li>
                        <li>Save changes and restart the bot</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-orange-500/30 bg-orange-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-orange-500">Warning</Badge>
                    <h4 className="font-medium">"Insufficient permissions" or "Trading not enabled"</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      API key doesn't have the required permissions for trading.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Required permissions:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>✓ Enable Reading (account data, positions)</li>
                        <li>✓ Enable Futures Trading (place/cancel orders)</li>
                        <li>✓ Enable Withdrawals (optional, for transfers)</li>
                        <li>⚠️ Note: Some exchanges require additional verification</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Connection Testing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Manual API Test</h4>
                <p className="text-sm text-muted-foreground">
                  You can test your API connection independently to verify credentials.
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-medium text-sm mb-2">Using terminal/command prompt:</p>
                  <div className="bg-background border p-3 rounded font-mono text-xs">
{`# Test basic connection (replace with your API key)
curl -H "X-MBX-APIKEY: your-api-key-here" \\
https://fapi.asterdex.com/fapi/v1/exchangeInfo

# Should return exchange information if connection works`}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="font-medium mb-1">✅ Success Response</p>
                    <p className="text-xs text-muted-foreground">JSON data with symbols and trading rules</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">❌ Error Response</p>
                    <p className="text-xs text-muted-foreground">Error message about invalid key or network</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Performance & Memory Issues
              </CardTitle>
              <CardDescription>Bot running slowly or consuming too many resources</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-yellow-500">Performance</Badge>
                    <h4 className="font-medium">High CPU or Memory Usage</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Bot is using too many system resources, causing slowdowns.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Optimization steps:</p>
                      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                        <li>Reduce number of symbols being monitored</li>
                        <li>Increase volume thresholds to reduce signal frequency</li>
                        <li>Restart the bot daily to clear memory</li>
                        <li>Close other resource-heavy applications</li>
                        <li>Consider upgrading to a faster computer/VPS</li>
                        <li>Check for other Node.js processes running</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-blue-500/30 bg-blue-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-500">Info</Badge>
                    <h4 className="font-medium">Normal Resource Usage</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <p className="font-medium mb-1">Typical CPU Usage</p>
                        <p className="text-xs text-muted-foreground">5-15% on average systems</p>
                        <p className="text-xs text-muted-foreground">Spikes to 30-50% during trades</p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Typical Memory Usage</p>
                        <p className="text-xs text-muted-foreground">100-300MB for the bot</p>
                        <p className="text-xs text-muted-foreground">Additional 200MB for web UI</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-orange-500/30 bg-orange-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-orange-500">Warning</Badge>
                    <h4 className="font-medium">Slow Trade Execution</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Orders are being placed too slowly, missing opportunities.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Possible causes:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li><strong>Network latency:</strong> Use a VPS closer to exchange servers</li>
                        <li><strong>System overload:</strong> Close unnecessary programs</li>
                        <li><strong>API rate limits:</strong> Bot automatically handles this</li>
                        <li><strong>Order book analysis:</strong> Reduce depth analysis complexity</li>
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
                <Terminal className="h-5 w-5" />
                Log Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Understanding Bot Logs</h4>
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded">
                    <p className="font-medium text-sm mb-1">🟢 Normal Log Messages</p>
                    <div className="text-xs font-mono text-muted-foreground">
                      <p>[INFO] WebSocket connected to liquidation stream</p>
                      <p>[INFO] Position opened: BTCUSDT LONG 0.001 BTC</p>
                      <p>[INFO] Take profit filled: +5.23%</p>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <p className="font-medium text-sm mb-1">🟡 Warning Messages</p>
                    <div className="text-xs font-mono text-muted-foreground">
                      <p>[WARN] Order rejected: insufficient balance</p>
                      <p>[WARN] WebSocket reconnecting (attempt 2/5)</p>
                      <p>[WARN] VWAP filter blocked trade opportunity</p>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <p className="font-medium text-sm mb-1">🔴 Error Messages</p>
                    <div className="text-xs font-mono text-muted-foreground">
                      <p>[ERROR] API authentication failed</p>
                      <p>[ERROR] Network timeout placing order</p>
                      <p>[ERROR] Invalid symbol configuration</p>
                    </div>
                  </div>
                </div>
                <div className="bg-background border p-3 rounded">
                  <p className="font-medium text-sm mb-2">Enable Debug Logging (if needed):</p>
                  <p className="text-xs font-mono">LOG_LEVEL=debug npm run dev</p>
                  <p className="text-xs text-muted-foreground mt-1">Shows detailed WebSocket and API messages</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Trading Execution Problems
              </CardTitle>
              <CardDescription>Issues with order placement, fills, and position management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border border-red-500/30 bg-red-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-red-500">Error</Badge>
                    <h4 className="font-medium">Orders Not Being Placed</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Bot detects liquidations but doesn't place any trades.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Check these settings:</p>
                      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                        <li>Verify you're not in paper mode (unless intended)</li>
                        <li>Check volume thresholds aren't too high</li>
                        <li>Ensure VWAP protection isn't blocking all trades</li>
                        <li>Verify sufficient account balance</li>
                        <li>Check if max positions limit is reached</li>
                        <li>Confirm symbol configuration is correct</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-yellow-500">Warning</Badge>
                    <h4 className="font-medium">Orders Rejected by Exchange</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Bot places orders but they get rejected by AsterDex.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Common rejection reasons:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li><strong>Insufficient margin:</strong> Reduce position size or leverage</li>
                        <li><strong>Price too far from market:</strong> Increase price offset tolerance</li>
                        <li><strong>Quantity too small:</strong> Check minimum order size for symbol</li>
                        <li><strong>Symbol not available:</strong> Verify symbol exists and is tradeable</li>
                        <li><strong>Market closed:</strong> Some symbols have trading hours</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-blue-500/30 bg-blue-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-500">Info</Badge>
                    <h4 className="font-medium">Stop-Loss Not Triggering</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Position moved against you but stop-loss didn't execute.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Possible explanations:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li><strong>Gap in price:</strong> Market jumped past your stop level</li>
                        <li><strong>Insufficient liquidity:</strong> No buyers/sellers at stop price</li>
                        <li><strong>Stop order not placed:</strong> Check order history on exchange</li>
                        <li><strong>Exchange issues:</strong> System problems during volatile periods</li>
                        <li><strong>Wrong order type:</strong> Stop-limit vs stop-market behavior</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Position Synchronization Issues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border border-orange-500/30 bg-orange-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-orange-500">Warning</Badge>
                    <h4 className="font-medium">Bot Shows Different Positions Than Exchange</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Dashboard shows positions that don't match what you see on AsterDex.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Synchronization steps:</p>
                      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                        <li>Restart the bot to refresh position data</li>
                        <li>Check if you manually closed positions on the exchange</li>
                        <li>Verify user data stream is connected</li>
                        <li>Clear browser cache and refresh dashboard</li>
                        <li>Compare timestamps between bot and exchange</li>
                        <li>Check for timezone differences in logs</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-purple-500/30 bg-purple-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-purple-500">Info</Badge>
                    <h4 className="font-medium">Manual Trading Interference</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      What happens when you manually trade alongside the bot.
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm mb-2">Best practices:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>Avoid manual trades on bot-managed symbols</li>
                        <li>Use separate symbols for manual and bot trading</li>
                        <li>If you must intervene, stop the bot first</li>
                        <li>Restart bot after manual position changes</li>
                        <li>Monitor for conflicting orders</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Quick Diagnostics Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Before reporting issues or asking for help, try these quick checks:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Basic Checks</h4>
                <div className="space-y-1 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>Internet connection working</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>Bot restarted recently</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>AsterDex website accessible</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>No error messages in terminal</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Configuration Checks</h4>
                <div className="space-y-1 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>API keys are 64 characters each</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>No extra spaces in API keys</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>Volume thresholds are reasonable</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>Sufficient account balance</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Still need help?</strong> Join our Discord community or create a GitHub issue with your specific error messages and configuration details (never share API keys).
        </AlertDescription>
      </Alert>
    </div>
  );
}