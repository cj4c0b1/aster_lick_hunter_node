import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'fs';
import { Config } from '../types';
import { configLoader } from '../config/configLoader';
import { z } from 'zod';

export interface ConfigManagerEvents {
  'config:updated': (config: Config) => void;
  'config:error': (error: Error) => void;
}

export class ConfigManager extends EventEmitter {
  private static instance: ConfigManager | null = null;
  private config: Config | null = null;
  private configPath: string;
  private watcher: FSWatcher | null = null;
  private reloadTimeout: NodeJS.Timeout | null = null;
  private isReloading = false;

  private constructor() {
    super();
    // Now watch the user config file instead of config.json
    this.configPath = configLoader.getUserConfigPath();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  async initialize(): Promise<Config> {
    console.log('🔧 Initializing Config Manager...');

    // Load initial config using the new config loader
    this.config = await configLoader.loadConfig();

    // Start watching for changes
    this.startWatching();

    return this.config;
  }

  private startWatching(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    try {
      this.watcher = watch(this.configPath, { persistent: false }, (eventType) => {
        if (eventType === 'change') {
          // Debounce rapid changes (e.g., from editors that save multiple times)
          if (this.reloadTimeout) {
            clearTimeout(this.reloadTimeout);
          }

          this.reloadTimeout = setTimeout(() => {
            this.handleConfigChange();
          }, 500); // Wait 500ms after last change before reloading
        }
      });

      console.log(`👀 Watching ${this.configPath} for changes...`);
    } catch (error) {
      console.error('Failed to start config watcher:', error);
      this.emit('config:error', error as Error);
    }
  }

  private async handleConfigChange(): Promise<void> {
    if (this.isReloading) {
      return; // Prevent concurrent reloads
    }

    this.isReloading = true;
    console.log('📝 Config file changed, reloading...');

    try {
      // Use the config loader to reload and validate
      const validated = await configLoader.loadConfig();

      // Store old config for comparison
      const oldConfig = this.config;
      this.config = validated;

      // Log what changed
      this.logConfigChanges(oldConfig, validated);

      // Emit the update event
      this.emit('config:updated', validated);

      console.log('✅ Config reloaded successfully');
    } catch (error) {
      console.error('❌ Failed to reload config:', error);

      if (error instanceof z.ZodError) {
        const details = error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
        console.error('Validation errors:\n' + details);
        this.emit('config:error', new Error(`Config validation failed:\n${details}`));
      } else if (error instanceof SyntaxError) {
        this.emit('config:error', new Error('Invalid JSON in config file'));
      } else {
        this.emit('config:error', error as Error);
      }
    } finally {
      this.isReloading = false;
    }
  }

  private logConfigChanges(oldConfig: Config | null, newConfig: Config): void {
    if (!oldConfig) return;

    const changes: string[] = [];

    // Check global settings
    if (oldConfig.global.paperMode !== newConfig.global.paperMode) {
      changes.push(`Paper Mode: ${oldConfig.global.paperMode} → ${newConfig.global.paperMode}`);
    }
    if (oldConfig.global.riskPercent !== newConfig.global.riskPercent) {
      changes.push(`Risk Percent: ${oldConfig.global.riskPercent}% → ${newConfig.global.riskPercent}%`);
    }
    if (oldConfig.global.maxOpenPositions !== newConfig.global.maxOpenPositions) {
      changes.push(`Max Positions: ${oldConfig.global.maxOpenPositions} → ${newConfig.global.maxOpenPositions}`);
    }

    // Check symbol changes
    const oldSymbols = new Set(Object.keys(oldConfig.symbols));
    const newSymbols = new Set(Object.keys(newConfig.symbols));

    // Added symbols
    for (const symbol of newSymbols) {
      if (!oldSymbols.has(symbol)) {
        changes.push(`Added symbol: ${symbol}`);
      }
    }

    // Removed symbols
    for (const symbol of oldSymbols) {
      if (!newSymbols.has(symbol)) {
        changes.push(`Removed symbol: ${symbol}`);
      }
    }

    // Modified symbols
    for (const symbol of oldSymbols) {
      if (newSymbols.has(symbol)) {
        const oldSym = oldConfig.symbols[symbol];
        const newSym = newConfig.symbols[symbol];

        if (JSON.stringify(oldSym) !== JSON.stringify(newSym)) {
          changes.push(`Updated config for ${symbol}`);
        }
      }
    }

    if (changes.length > 0) {
      console.log('📋 Config changes:');
      changes.forEach(change => console.log(`  • ${change}`));
    }
  }

  getConfig(): Config | null {
    return this.config;
  }

  async reloadConfig(): Promise<Config> {
    this.config = await configLoader.loadConfig();
    this.emit('config:updated', this.config);
    return this.config;
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
      this.reloadTimeout = null;
    }

    console.log('🛑 Config Manager stopped');
  }

  // Type-safe event emitter
  on<K extends keyof ConfigManagerEvents>(
    event: K,
    listener: ConfigManagerEvents[K]
  ): this {
    return super.on(event, listener);
  }

  emit<K extends keyof ConfigManagerEvents>(
    event: K,
    ...args: Parameters<ConfigManagerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();