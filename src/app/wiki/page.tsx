import { BookOpen, Rocket, Shield, Settings, TrendingUp, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function WikiPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Wiki & Documentation</h1>
        <p className="text-muted-foreground">
          Everything you need to know about the Aster Liquidation Hunter bot
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/wiki/getting-started">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Rocket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Getting Started</CardTitle>
                  <CardDescription>Quick setup guide for new users</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/wiki/api-setup">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Settings className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle>API Setup Guide</CardTitle>
                  <CardDescription>Detailed API key configuration</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/wiki/trading-strategies">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle>Trading Strategies</CardTitle>
                  <CardDescription>Optimize your liquidation hunting</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/wiki/risk-management">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Shield className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <CardTitle>Risk Management</CardTitle>
                  <CardDescription>Protect your capital effectively</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/wiki/troubleshooting">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <CardTitle>Troubleshooting</CardTitle>
                  <CardDescription>Common issues and solutions</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/wiki/faq">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <BookOpen className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle>FAQ</CardTitle>
                  <CardDescription>Frequently asked questions</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Need More Help?</CardTitle>
          <CardDescription>
            Join our community for support and updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="outline" asChild>
              <Link href="https://discord.gg/P8Ev3Up" target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                Join Discord
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="https://github.com/CryptoGnome/aster_lick_hunter_node" target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                GitHub Repo
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}