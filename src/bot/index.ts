#!/usr/bin/env node
import { loadConfig } from '../lib/bot/config';
import { Hunter } from '../lib/bot/hunter';
import { PositionManager } from '../lib/bot/positionManager';

async function main(): Promise<void> {
  console.log('Aster Liquidation Hunter Bot starting...');

  try {
    // Load configuration
    const config = await loadConfig();
    console.log('Config loaded for symbols:', Object.keys(config.symbols));

    // Initialize modules
    const hunter = new Hunter(config);
    const positionManager = new PositionManager(config);

    // Connect Hunter to Position Manager
    hunter.on('new_position', (data) => {
      console.log('New position event:', data);
      positionManager.onNewPosition(data);
    });

    // Start modules
    await positionManager.start();
    hunter.start();

    console.log('Bot modules started. Press Ctrl+C to stop.');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down bot...');
      hunter.stop();
      await positionManager.stop();
      process.exit(0);
    });

    // Keep running
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error('Bot startup error:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the bot
if (require.main === module) {
  main().catch(console.error);
}
