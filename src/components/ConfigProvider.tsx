'use client';

import React, { createContext, useState, useEffect, useContext } from 'react';
import { Config } from '@/lib/types';
import ApiKeyModal from './ApiKeyModal';

interface ConfigContextType {
  config: Config | null;
  loading: boolean;
  updateConfig: (newConfig: Config) => Promise<void>;
  reloadConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  loading: true,
  updateConfig: async () => {},
  reloadConfig: async () => {},
});

export const useConfig = () => useContext(ConfigContext);

export default function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);

        // Check if this is first time setup (no API keys and not explicitly set to paper mode)
        const isFirstTime = !data.api.apiKey && !data.api.secretKey &&
                           localStorage.getItem('aster_setup_complete') !== 'true';

        if (isFirstTime) {
          setShowApiKeyModal(true);
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // Initialize with default config
      const defaultConfig: Config = {
        api: {
          apiKey: '',
          secretKey: '',
        },
        global: {
          riskPercent: 2,
          paperMode: true,
        },
        symbols: {
          BTCUSDT: {
            volumeThresholdUSDT: 10000,
            tradeSize: 0.001,
            leverage: 5,
            tpPercent: 5,
            slPercent: 2,
          },
        },
      };
      setConfig(defaultConfig);
      setShowApiKeyModal(true);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (newConfig: Config) => {
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
        localStorage.setItem('aster_setup_complete', 'true');
      } else {
        throw new Error('Failed to save config');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  };

  const handleApiKeySave = async (apiKey: string, secretKey: string) => {
    if (config) {
      const updatedConfig = {
        ...config,
        api: {
          apiKey,
          secretKey,
        },
      };
      await updateConfig(updatedConfig);
      localStorage.setItem('aster_setup_complete', 'true');
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <ConfigContext.Provider
      value={{
        config,
        loading,
        updateConfig,
        reloadConfig: loadConfig,
      }}
    >
      {children}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={handleApiKeySave}
      />
    </ConfigContext.Provider>
  );
}