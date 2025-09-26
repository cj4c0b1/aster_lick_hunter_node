import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { Config, SymbolConfig, GlobalConfig } from '../types';

// Zod schemas
export const symbolConfigSchema = z.object({
  // Volume thresholds - support both legacy and new format
  volumeThresholdUSDT: z.number().min(0).optional(),
  longVolumeThresholdUSDT: z.number().min(0).optional(),
  shortVolumeThresholdUSDT: z.number().min(0).optional(),

  // Position sizing
  tradeSize: z.number().min(0.00001),
  maxPositionMarginUSDT: z.number().min(0).optional(),

  // Risk parameters
  leverage: z.number().min(1).max(125),
  tpPercent: z.number().min(0.1),
  slPercent: z.number().min(0.1),

  // Limit order settings (optional)
  priceOffsetBps: z.number().optional(),
  usePostOnly: z.boolean().optional(),
  maxSlippageBps: z.number().optional(),
  orderType: z.enum(['LIMIT', 'MARKET']).optional(),

  // VWAP protection settings (optional)
  vwapProtection: z.boolean().optional(),
  vwapTimeframe: z.string().optional(),
  vwapLookback: z.number().min(10).max(500).optional(),
}).refine(data => {
  // Ensure we have either legacy or new volume thresholds
  return data.volumeThresholdUSDT !== undefined ||
         (data.longVolumeThresholdUSDT !== undefined && data.shortVolumeThresholdUSDT !== undefined);
}, {
  message: "Either volumeThresholdUSDT or both longVolumeThresholdUSDT and shortVolumeThresholdUSDT must be provided"
});

export const apiCredentialsSchema = z.object({
  apiKey: z.string(),  // Can be empty for paper mode
  secretKey: z.string(),  // Can be empty for paper mode
});

export const globalConfigSchema = z.object({
  riskPercent: z.number().min(0).max(100),
  paperMode: z.boolean(),
  positionMode: z.enum(['ONE_WAY', 'HEDGE']).optional(),
  maxOpenPositions: z.number().min(1).optional(),
});

export const configSchema = z.object({
  api: apiCredentialsSchema,
  symbols: z.record(symbolConfigSchema),
  global: globalConfigSchema,
});

// Helper function to migrate legacy configs
function migrateConfig(config: any): any {
  // Migrate symbol configs
  if (config.symbols) {
    Object.keys(config.symbols).forEach(symbol => {
      const symbolConfig = config.symbols[symbol];

      // If only legacy volumeThresholdUSDT exists, set it for both long and short
      if (symbolConfig.volumeThresholdUSDT !== undefined &&
          symbolConfig.longVolumeThresholdUSDT === undefined &&
          symbolConfig.shortVolumeThresholdUSDT === undefined) {
        symbolConfig.longVolumeThresholdUSDT = symbolConfig.volumeThresholdUSDT;
        symbolConfig.shortVolumeThresholdUSDT = symbolConfig.volumeThresholdUSDT;
      }

      // Set default maxPositionMarginUSDT if not present
      if (symbolConfig.maxPositionMarginUSDT === undefined) {
        // Default to 10x the trade size as a reasonable limit
        const tradeValue = (symbolConfig.tradeSize || 1) * 1000; // Rough estimate
        symbolConfig.maxPositionMarginUSDT = tradeValue * (symbolConfig.leverage || 10);
      }
    });
  }

  // Set default maxOpenPositions if not present
  if (config.global && config.global.maxOpenPositions === undefined) {
    config.global.maxOpenPositions = 10; // Default to 10 max positions
  }

  return config;
}

// Config loading logic
export async function loadConfig(): Promise<Config> {
  const configPath = path.join(process.cwd(), 'config.json');

  try {
    const data = await fs.readFile(configPath, 'utf8');
    let parsed = JSON.parse(data);

    // Migrate legacy config format
    parsed = migrateConfig(parsed);

    const validated = configSchema.parse(parsed);

    // Validate API keys only if not in paper mode
    if (!validated.global.paperMode) {
      if (validated.api.apiKey.length !== 64 || validated.api.secretKey.length !== 64) {
        throw new Error('API keys must be 64 characters when not in paper mode');
      }
    }

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Config validation error: ${error.issues.map(i => i.message).join(', ')}`);
    }
    if (error instanceof Error) {
      throw new Error(`Failed to load config: ${error.message}`);
    }
    throw new Error('Failed to load config: Unknown error');
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const configPath = path.join(process.cwd(), 'config.json');

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

// Default config for initialization
export const defaultConfig: Omit<Config, 'api'> = {
  symbols: {
    BTCUSDT: {
      longVolumeThresholdUSDT: 10000,
      shortVolumeThresholdUSDT: 10000,
      tradeSize: 0.001,
      maxPositionMarginUSDT: 5000,
      leverage: 5,
      tpPercent: 5,
      slPercent: 2,
    },
    ETHUSDT: {
      longVolumeThresholdUSDT: 5000,
      shortVolumeThresholdUSDT: 5000,
      tradeSize: 0.01,
      maxPositionMarginUSDT: 3000,
      leverage: 10,
      tpPercent: 4,
      slPercent: 1.5,
    },
  },
  global: {
    riskPercent: 5,
    paperMode: true,
    maxOpenPositions: 10,
  },
};

export async function updateSymbolConfig(symbol: string, updates: Partial<SymbolConfig>): Promise<void> {
  const config = await loadConfig();
  if (!config.symbols[symbol]) {
    throw new Error(`Symbol ${symbol} not found in config`);
  }
  config.symbols[symbol] = { ...config.symbols[symbol], ...updates };
  await saveConfig(config);
}

export async function updateGlobalConfig(updates: Partial<GlobalConfig>): Promise<void> {
  const config = await loadConfig();
  config.global = { ...config.global, ...updates };
  await saveConfig(config);
}
