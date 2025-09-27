'use client';

import React, { useState } from 'react';
import { HelpCircle, BookOpen, RefreshCw, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import Link from 'next/link';
import { useOnboarding } from './onboarding/OnboardingProvider';

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const { resetOnboarding, setShowTutorial } = useOnboarding();

  const handleRestartOnboarding = () => {
    setOpen(false);
    resetOnboarding();
  };

  const handleStartTutorial = () => {
    setOpen(false);
    setShowTutorial(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          aria-label="Help and resources"
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-2">
          <h3 className="font-semibold">Need Help?</h3>

          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={handleRestartOnboarding}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Restart Setup Wizard
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={handleStartTutorial}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Interactive Tutorial
            </Button>

            <Link href="/wiki" onClick={() => setOpen(false)}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Documentation
              </Button>
            </Link>

            <Link href="https://discord.gg/P8Ev3Up" target="_blank" onClick={() => setOpen(false)}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Discord Support
              </Button>
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}