'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, BookOpen, Rocket, Settings, TrendingUp, Shield, AlertCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const wikiNavigation = [
  {
    title: 'Overview',
    href: '/wiki',
    icon: BookOpen,
  },
  {
    title: 'Getting Started',
    href: '/wiki/getting-started',
    icon: Rocket,
  },
  {
    title: 'API Setup',
    href: '/wiki/api-setup',
    icon: Settings,
  },
  {
    title: 'Trading Strategies',
    href: '/wiki/trading-strategies',
    icon: TrendingUp,
  },
  {
    title: 'Risk Management',
    href: '/wiki/risk-management',
    icon: Shield,
  },
  {
    title: 'Troubleshooting',
    href: '/wiki/troubleshooting',
    icon: AlertCircle,
  },
  {
    title: 'FAQ',
    href: '/wiki/faq',
    icon: HelpCircle,
  },
];

export function WikiSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-muted/10 h-full">
      <div className="p-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <h2 className="font-semibold text-lg mb-4">Documentation</h2>

        <nav className="space-y-1">
          {wikiNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}