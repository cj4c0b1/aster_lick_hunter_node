'use client';

import React, { useState, useEffect } from 'react';
import SymbolConfigForm from '@/components/SymbolConfigForm';
import { Config } from '@/lib/types';
import Link from 'next/link';

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      } else {
        // Initialize with default config if none exists
        setConfig({
          api: {
            apiKey: '',
            secretKey: '',
          },
          global: {
            riskPercent: 2,
            paperMode: true,
          },
          symbols: {},
        });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // Initialize with default config on error
      setConfig({
        api: {
          apiKey: '',
          secretKey: '',
        },
        global: {
          riskPercent: 2,
          paperMode: true,
        },
        symbols: {},
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (newConfig: Config) => {
    setSaveStatus('saving');
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (response.ok) {
        setConfig(newConfig);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error('Failed to save config');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Bot Configuration</h1>
            <div className="flex items-center gap-4">
              {saveStatus === 'saved' && (
                <span className="text-green-600 font-medium">✓ Configuration saved</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-600 font-medium">✗ Failed to save</span>
              )}
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
          <p className="mt-2 text-gray-600">
            Configure your API credentials and trading parameters for each symbol.
          </p>
        </div>

        {config && (
          <SymbolConfigForm
            onSave={handleSave}
            currentConfig={config}
          />
        )}

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notes:</h3>
          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
            <li>Keep your API credentials secure and never share them</li>
            <li>Start with Paper Mode enabled to test your configuration</li>
            <li>Use conservative stop-loss percentages to limit risk</li>
            <li>Monitor your positions regularly when running in live mode</li>
            <li>The bot must be running locally for trading to occur</li>
          </ul>
        </div>
      </div>
    </div>
  );
}