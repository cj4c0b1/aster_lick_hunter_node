import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { Config, SymbolConfig, GlobalConfig } from '../types';

// Zod schemas
export const symbolConfigSchema = z.object({
  volumeThresholdUSDT: z.number().min(0),
  tradeSize: z.number().min(0.00001),
  leverage: z.number().min(1).max(125),
  tpPercent: z.number().min(0.1),
  slPercent: z.number().min(0.1),
});

export const apiCredentialsSchema = z.object({
  apiKey: z.string(),  // Can be empty for paper mode
  secretKey: z.string(),  // Can be empty for paper mode
});

export const globalConfigSchema = z.object({
  riskPercent: z.number().min(0).max(100),
  paperMode: z.boolean(),
});

export const configSchema = z.object({
  api: apiCredentialsSchema,
  symbols: z.record(symbolConfigSchema),
  global: globalConfigSchema,
});

// Config loading logic
export async function loadConfig(): Promise<Config> {
  const configPath = path.join(process.cwd(), 'config.json');

  try {
    const data = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(data);

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
      volumeThresholdUSDT: 10000,
      tradeSize: 0.001,
      leverage: 5,
      tpPercent: 5,
      slPercent: 2,
    },
    ETHUSDT: {
      volumeThresholdUSDT: 5000,
      tradeSize: 0.01,
      leverage: 10,
      tpPercent: 4,
      slPercent: 1.5,
    },
  },
  global: {
    riskPercent: 5,
    paperMode: true,
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
