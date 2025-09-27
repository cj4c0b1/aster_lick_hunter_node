'use client';

import { BookOpen, HelpCircle, Shield, Zap, Settings, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';

function CollapsibleItem({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border rounded-lg">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t">
          <div className="mt-3">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          Frequently Asked Questions
        </h1>
        <p className="text-muted-foreground">
          Common questions and answers about the Aster Liquidation Hunter bot
        </p>
      </div>

      <Alert className="border-blue-500/50 bg-blue-500/10">
        <HelpCircle className="h-4 w-4 text-blue-500" />
        <AlertDescription>
          <strong>Quick Start:</strong> New to the bot? Check out our <a href="/wiki/getting-started" className="underline">Getting Started Guide</a> first, then return here for specific questions.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              General Questions
            </CardTitle>
            <CardDescription>Basic information about the bot and how it works</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <CollapsibleItem title="What is a liquidation hunter bot?">
                <div className="space-y-3">
                  <p>
                    A liquidation hunter bot monitors forced liquidations on cryptocurrency futures exchanges and automatically
                    places trades to profit from the temporary price inefficiencies these events create.
                  </p>
                  <p>
                    When traders use leverage, they must maintain minimum margin levels. If the market moves against them,
                    their positions get liquidated (force-closed), creating selling or buying pressure that temporarily moves prices.
                    Our bot trades in the opposite direction to capture the reversion.
                  </p>
                </div>
              </CollapsibleItem>

              <CollapsibleItem title="How profitable is liquidation hunting?">
                <div className="space-y-3">
                  <p>
                    Profitability depends on market conditions, configuration, and risk management. The strategy exploits
                    a real market inefficiency, but success isn't guaranteed.
                  </p>
                  <div className="bg-muted p-3 rounded">
                    <p className="font-medium text-sm mb-1">Typical Results (with proper configuration):</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                      <li>Win rate: 55-65% in normal markets</li>
                      <li>Risk-reward ratio: 1.5:1 to 3:1</li>
                      <li>Monthly returns: Highly variable (5-30%)</li>
                      <li>Drawdowns: 10-25% are normal</li>
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Important:</strong> Past performance doesn't guarantee future results. Always start with small amounts and paper mode.
                  </p>
                </div>
              </CollapsibleItem>

              <CollapsibleItem title="Is this bot really free?">
                <div className="space-y-3">
                  <p>
                    Yes! The bot is completely free and open-source. There are no subscription fees, hidden costs,
                    or profit sharing. You keep 100% of any profits.
                  </p>
                  <p>
                    If you find the bot useful, you can support development by:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Creating your AsterDex account with our referral link</li>
                    <li>Starring the GitHub repository</li>
                    <li>Contributing to the codebase</li>
                    <li>Sharing with other traders</li>
                  </ul>
                </div>
              </CollapsibleItem>

              <CollapsibleItem title="What is paper mode and should I use it?">
                <div className="space-y-3">
                  <p>
                    Paper mode simulates trading without using real money. The bot generates fake liquidation events
                    and simulates order execution to help you learn and test strategies safely.
                  </p>
                  <div className="bg-muted p-3 rounded">
                    <p className="font-medium text-sm mb-1">Use paper mode when:</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                      <li>Learning how the bot works</li>
                      <li>Testing new configurations</li>
                      <li>You don't have AsterDex API keys yet</li>
                      <li>Markets are too volatile</li>
                      <li>Debugging issues</li>
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Recommendation:</strong> Start with paper mode for at least 24-48 hours before risking real money.
                  </p>
                </div>
              </CollapsibleItem>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration & Setup
            </CardTitle>
            <CardDescription>Questions about getting the bot configured and running</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <CollapsibleItem title="Do I need API keys to use the bot?">
                <div className="space-y-3">
                  <p>
                    <strong>For paper mode:</strong> No API keys required. You can test everything without an exchange account.
                  </p>
                  <p>
                    <strong>For live trading:</strong> Yes, you need AsterDex API keys with futures trading permissions.
                  </p>
                  <p>
                    The bot never shares your keys with external services - they're stored locally and only used
                    to communicate directly with AsterDex.
                  </p>
                </div>
              </CollapsibleItem>

              <CollapsibleItem title="What's the minimum account balance needed?">
                <div className="space-y-3">
                  <p>
                    There's no hard minimum, but practical recommendations:
                  </p>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded">
                      <p className="font-medium text-green-600">Conservative Start</p>
                      <p className="text-xs text-muted-foreground">$500-1,000 USDT</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside mt-1">
                        <li>Low leverage (2-3x)</li>
                        <li>Small position sizes</li>
                        <li>Single symbol focus</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                      <p className="font-medium text-blue-600">Comfortable Operation</p>
                      <p className="text-xs text-muted-foreground">$2,000-5,000 USDT</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside mt-1">
                        <li>Medium leverage (5-10x)</li>
                        <li>Multiple positions</li>
                        <li>Several symbols</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Remember: Never risk more than you can afford to lose completely.
                  </p>
                </div>
              </CollapsibleItem>

              <CollapsibleItem title="Which symbols work best for liquidation hunting?">
                <div className="space-y-3">
                  <p>
                    The best symbols have high liquidity, frequent liquidations, and good price movements:
                  </p>
                  <div className="grid md:grid-cols-3 gap-3 text-sm">
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium">🥇 Tier 1 (Best)</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>BTCUSDT</li>
                        <li>ETHUSDT</li>
                        <li>High volume, stable</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium">🥈 Tier 2 (Good)</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Major altcoins</li>
                        <li>SOLUSDT, ADAUSDT</li>
                        <li>Decent liquidity</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <p className="font-medium">🥉 Tier 3 (Risky)</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Small cap tokens</li>
                        <li>New listings</li>
                        <li>High volatility</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Recommendation:</strong> Start with BTCUSDT only, then expand as you gain experience.
                  </p>
                </div>
              </CollapsibleItem>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Safety & Risk
            </CardTitle>
            <CardDescription>Questions about security and risk management</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <CollapsibleItem title="Is it safe to give API keys to the bot?">
                <div className="space-y-3">
                  <p>
                    The bot is open-source, so you can verify exactly what it does with your keys:
                  </p>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="font-medium mb-1">✅ What the bot does:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>Stores keys locally only</li>
                        <li>Uses them for AsterDex API calls</li>
                        <li>Places/cancels orders</li>
                        <li>Checks balances and positions</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium mb-1">❌ What it never does:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>Send keys to external servers</li>
                        <li>Share keys with third parties</li>
                        <li>Withdraw funds</li>
                        <li>Access your personal data</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CollapsibleItem>

              <CollapsibleItem title="Can I lose money using this bot?">
                <div className="space-y-3">
                  <p>
                    <strong>Yes, absolutely.</strong> Cryptocurrency trading involves significant risk, and losses are possible.
                  </p>
                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded">
                    <p className="font-medium text-red-600 text-sm">Risk Factors:</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                      <li>Market volatility can cause rapid losses</li>
                      <li>Liquidation events don't always mean profitable reversals</li>
                      <li>Technical issues can prevent stop-losses from executing</li>
                      <li>Exchange outages can trap you in positions</li>
                      <li>Configuration errors can lead to unexpected behavior</li>
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Risk Management:</strong> Never risk more than 1-2% of your account per trade, use proper stop-losses,
                    start with paper mode, and only trade with money you can afford to lose completely.
                  </p>
                </div>
              </CollapsibleItem>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Technical Questions
            </CardTitle>
            <CardDescription>Questions about the bot's technical operation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <CollapsibleItem title="How fast does the bot react to liquidations?">
                <div className="space-y-3">
                  <p>
                    The bot typically reacts within 100-500 milliseconds of detecting a liquidation, depending on:
                  </p>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="font-medium mb-1">⚡ Fast Reaction (&lt;200ms):</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>Good internet connection</li>
                        <li>Fast computer/VPS</li>
                        <li>Simple order book analysis</li>
                        <li>LIMIT orders ready to place</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium mb-1">🐌 Slower Reaction (&gt;500ms):</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>Poor network connection</li>
                        <li>Overloaded system</li>
                        <li>Complex VWAP calculations</li>
                        <li>API rate limiting</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    For optimal speed, run the bot on a VPS near AsterDex servers and keep the configuration simple.
                  </p>
                </div>
              </CollapsibleItem>

              <CollapsibleItem title="Should I use a VPS instead of my home computer?">
                <div className="space-y-3">
                  <p>
                    A VPS (Virtual Private Server) offers several advantages for running trading bots:
                  </p>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded">
                      <p className="font-medium text-green-600">VPS Advantages</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>24/7 uptime (no power outages)</li>
                        <li>Faster, stable internet</li>
                        <li>Lower latency to exchanges</li>
                        <li>No computer sleep/shutdown</li>
                        <li>Dedicated resources</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                      <p className="font-medium text-yellow-600">Home Computer</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>Free to use</li>
                        <li>Easy to access and monitor</li>
                        <li>No monthly VPS costs</li>
                        <li>May have connection issues</li>
                        <li>Needs to stay on 24/7</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Recommendation:</strong> Start with your home computer to learn the bot,
                    then consider a VPS if you're trading larger amounts or want maximum reliability.
                  </p>
                </div>
              </CollapsibleItem>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <HelpCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Still have questions?</strong> Join our <a href="https://discord.gg/P8Ev3Up" className="underline" target="_blank">Discord community</a>
          or check the <a href="/wiki/troubleshooting" className="underline">Troubleshooting guide</a> for technical issues.
        </AlertDescription>
      </Alert>
    </div>
  );
}