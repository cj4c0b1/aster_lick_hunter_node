'use client';

import React, { useState } from 'react';
import { Key, Eye, EyeOff, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, secretKey: string) => void;
}

export default function ApiKeyModal({ isOpen, onClose, onSave }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);

  const handleSave = () => {
    onSave(apiKey, secretKey);
    onClose();
  };

  const handleSkip = () => {
    // Save empty keys for paper mode
    onSave('', '');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Key className="h-4 w-4 text-primary-foreground" />
            </div>
            Welcome to Aster Liquidation Hunter
          </DialogTitle>
          <DialogDescription>
            Configure your API credentials or continue in Paper Mode for testing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Paper Mode:</strong> Test the bot without real trades. Leave fields empty to use Paper Mode.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your 64-character API key (optional)"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for paper trading mode
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secretKey">Secret Key</Label>
              <div className="relative">
                <Input
                  id="secretKey"
                  type={showSecretKey ? 'text' : 'password'}
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Enter your 64-character secret key (optional)"
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                >
                  {showSecretKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your secret key is never shared and stored locally
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSkip}
            className="flex-1"
          >
            Skip (Paper Mode)
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
          >
            {apiKey || secretKey ? 'Save & Continue' : 'Continue in Paper Mode'}
          </Button>
        </div>

        <div className="flex justify-center">
          {!apiKey && !secretKey ? (
            <Badge variant="secondary">Paper Mode Active</Badge>
          ) : (
            <Badge variant="default">Live Trading Ready</Badge>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}