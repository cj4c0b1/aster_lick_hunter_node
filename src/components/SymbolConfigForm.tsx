'use client';

import React, { useState, useEffect } from 'react';
import { Config, SymbolConfig } from '@/lib/types';

interface SymbolConfigFormProps {
  onSave: (config: Config) => void;
  currentConfig?: Config;
}

export default function SymbolConfigForm({ onSave, currentConfig }: SymbolConfigFormProps) {
  const [config, setConfig] = useState<Config>(currentConfig || {
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

  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [newSymbol, setNewSymbol] = useState<string>('');
  const [showApiSecret, setShowApiSecret] = useState(false);

  const defaultSymbolConfig: SymbolConfig = {
    volumeThresholdUSDT: 100000,
    leverage: 10,
    tradeSize: 100,
    slPercent: 2,
    tpPercent: 3,
  };

  const handleGlobalChange = (field: string, value: any) => {
    setConfig({
      ...config,
      global: {
        ...config.global,
        [field]: value,
      },
    });
  };

  const handleApiChange = (field: string, value: string) => {
    setConfig({
      ...config,
      api: {
        ...config.api,
        [field]: value,
      },
    });
  };

  const handleSymbolChange = (symbol: string, field: string, value: any) => {
    setConfig({
      ...config,
      symbols: {
        ...config.symbols,
        [symbol]: {
          ...config.symbols[symbol],
          [field]: value,
        },
      },
    });
  };

  const addSymbol = () => {
    if (newSymbol && !config.symbols[newSymbol]) {
      setConfig({
        ...config,
        symbols: {
          ...config.symbols,
          [newSymbol]: { ...defaultSymbolConfig },
        },
      });
      setSelectedSymbol(newSymbol);
      setNewSymbol('');
    }
  };

  const removeSymbol = (symbol: string) => {
    const { [symbol]: _, ...rest } = config.symbols;
    setConfig({
      ...config,
      symbols: rest,
    });
    if (selectedSymbol === symbol) {
      setSelectedSymbol('');
    }
  };

  const handleSave = () => {
    onSave(config);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">API Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="text"
              value={config.api.apiKey}
              onChange={(e) => handleApiChange('apiKey', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Enter your API key"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">API Secret</label>
            <div className="flex gap-2">
              <input
                type={showApiSecret ? 'text' : 'password'}
                value={config.api.secretKey}
                onChange={(e) => handleApiChange('secretKey', e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="Enter your API secret"
              />
              <button
                onClick={() => setShowApiSecret(!showApiSecret)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                {showApiSecret ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Global Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Risk Percent (%)</label>
            <input
              type="number"
              value={config.global.riskPercent}
              onChange={(e) => handleGlobalChange('riskPercent', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border rounded-md"
              min="0.1"
              max="100"
              step="0.1"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="paperMode"
              checked={config.global.paperMode}
              onChange={(e) => handleGlobalChange('paperMode', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="paperMode" className="text-sm font-medium">
              Paper Mode (simulated trading)
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Symbol Configuration</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            className="flex-1 px-3 py-2 border rounded-md"
            placeholder="Enter symbol (e.g., BTCUSDT)"
          />
          <button
            onClick={addSymbol}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Symbol
          </button>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {Object.keys(config.symbols).map((symbol) => (
            <button
              key={symbol}
              onClick={() => setSelectedSymbol(symbol)}
              className={`px-3 py-1 rounded ${
                selectedSymbol === symbol
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {symbol}
            </button>
          ))}
        </div>

        {selectedSymbol && config.symbols[selectedSymbol] && (
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-lg font-semibold">{selectedSymbol} Settings</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Volume Threshold (USDT)</label>
                <input
                  type="number"
                  value={config.symbols[selectedSymbol].volumeThresholdUSDT}
                  onChange={(e) => handleSymbolChange(selectedSymbol, 'volumeThresholdUSDT', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Leverage</label>
                <input
                  type="number"
                  value={config.symbols[selectedSymbol].leverage}
                  onChange={(e) => handleSymbolChange(selectedSymbol, 'leverage', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                  min="1"
                  max="125"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Trade Size (USDT)</label>
                <input
                  type="number"
                  value={config.symbols[selectedSymbol].tradeSize}
                  onChange={(e) => handleSymbolChange(selectedSymbol, 'tradeSize', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Stop Loss (%)</label>
                <input
                  type="number"
                  value={config.symbols[selectedSymbol].slPercent}
                  onChange={(e) => handleSymbolChange(selectedSymbol, 'slPercent', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                  min="0.1"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Take Profit (%)</label>
                <input
                  type="number"
                  value={config.symbols[selectedSymbol].tpPercent}
                  onChange={(e) => handleSymbolChange(selectedSymbol, 'tpPercent', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                  min="0.1"
                  step="0.1"
                />
              </div>
            </div>

            <button
              onClick={() => removeSymbol(selectedSymbol)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Remove {selectedSymbol}
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
}