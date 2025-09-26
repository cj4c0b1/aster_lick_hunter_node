import { Config, SymbolConfig, GlobalConfig } from '../types';
import { configLoader } from '../config/configLoader';

// Re-export schemas from the new config module for backward compatibility
export { symbolConfigSchema, apiCredentialsSchema, globalConfigSchema, configSchema } from '../config/types';


// Config loading logic - now delegates to the new config loader
export async function loadConfig(): Promise<Config> {
  return await configLoader.loadConfig();
}

export async function saveConfig(config: Config): Promise<void> {
  return await configLoader.saveConfig(config);
}

// Re-export default config from the new module
import { DEFAULT_CONFIG } from '../config/defaults';

export const defaultConfig: Omit<Config, 'api'> = {
  symbols: DEFAULT_CONFIG.symbols,
  global: DEFAULT_CONFIG.global,
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
