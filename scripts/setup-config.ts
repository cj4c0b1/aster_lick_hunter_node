import { writeFile } from 'fs/promises';
import { join } from 'path';

export interface Config {
  version: string;
  api: {
    apiKey: string;
    secretKey: string;
  };
  symbols: Record<string, any>;
  global: any;
}

async function setupConfig() {
  const config: Config = {
    version: '1.1.0',
    api: {
      apiKey: process.env.BINANCE_API_KEY || '',
      secretKey: process.env.BINANCE_SECRET_KEY || '',
    },
    symbols: {
      BTCUSDT: {
        longVolumeThresholdUSDT: 10000,
        shortVolumeThresholdUSDT: 10000,
        tradeSize: 0.001,
        maxPositionMarginUSDT: 5000,
        leverage: 5,
        tpPercent: 5,
        slPercent: 2,
        priceOffsetBps: 5,
        maxSlippageBps: 50,
        orderType: 'LIMIT',
        vwapProtection: true,
        vwapTimeframe: '1m',
        vwapLookback: 200,
      },
      ETHUSDT: {
        longVolumeThresholdUSDT: 5000,
        shortVolumeThresholdUSDT: 5000,
        tradeSize: 0.01,
        maxPositionMarginUSDT: 3000,
        leverage: 10,
        tpPercent: 4,
        slPercent: 1.5,
        priceOffsetBps: 5,
        maxSlippageBps: 50,
        orderType: 'LIMIT',
        vwapProtection: true,
        vwapTimeframe: '1m',
        vwapLookback: 200,
      },
    },
    global: {
      riskPercent: 5,
      paperMode: true,
      positionMode: 'HEDGE',
      maxOpenPositions: 10,
      server: {
        dashboardPassword: '',
        dashboardPort: 3000,
        websocketPort: 8080,
      },
    },
  };

  const configPath = join(process.cwd(), 'config.user.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));
  console.log('✅ Config file created at:', configPath);
  console.log('Please update the API keys in the config file before continuing.');
}

setupConfig().catch(console.error);
