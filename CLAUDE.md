# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Type
This is a cryptocurrency liquidation hunting bot built with Next.js 15 and TypeScript. The application monitors liquidation events on the Aster Finance exchange and automatically places trades to capitalize on price movements, with both a web UI for monitoring and a backend bot service.

## Development Commands

```bash
# Install dependencies
npm install

# Run both web UI and bot concurrently (development)
npm run dev

# Run only the web UI (development)
npm run dev:web

# Run only the bot (development with watch mode)
npm run dev:bot

# Build for production
npm run build

# Start production (both web and bot)
npm start

# Run only the bot (one-time)
npm run bot

# Run linting
npm run lint

# Check TypeScript types
npx tsc --noEmit

# Setup (install + build)
npm run setup
```

## Architecture Overview

The application has a dual architecture:
1. **Web UI**: Next.js application for configuration and monitoring
2. **Bot Service**: Standalone Node.js service that runs the trading logic

### Key Components

- **Hunter** (`src/lib/bot/hunter.ts`): Monitors liquidation WebSocket streams and triggers trades
- **PositionManager** (`src/lib/bot/positionManager.ts`): Manages open positions, SL/TP orders, and user data streams
- **AsterBot** (`src/bot/index.ts`): Main bot orchestrator that coordinates Hunter and PositionManager
- **StatusBroadcaster** (`src/bot/websocketServer.ts`): WebSocket server for real-time status updates to web UI
- **Services**: Helper services for balance (`balanceService.ts`), pricing (`priceService.ts`), and WebSocket management (`websocketService.ts`)

### Data Flow
1. Hunter connects to `wss://fstream.asterdex.com/ws/!forceOrder@arr` for liquidation events
2. When a qualifying liquidation occurs, Hunter analyzes price action and places entry orders
3. PositionManager monitors user data stream for order fills and automatically places SL/TP orders
4. Status updates are broadcasted to the web UI via internal WebSocket server

## Project Structure

- **src/app/**: Next.js pages and API routes
- **src/bot/**: Standalone bot service entry point and WebSocket server
- **src/lib/**: Shared business logic
  - `types.ts`: Core TypeScript interfaces for trading data
  - `api/`: Exchange API interaction (auth, orders, market data)
  - `bot/`: Bot components (hunter, position manager, config)
- **src/components/**: React components for the web UI
- **config.json**: Trading configuration (API keys, symbols, risk parameters)

## Configuration System

The bot reads from `config.json` which contains:
- **api**: API credentials for Aster Finance exchange
- **symbols**: Per-symbol trading configuration (volume thresholds, leverage, SL/TP percentages)
- **global**: Global settings (paper mode, risk percentage)

Example symbol configuration:
```json
"BTCUSDT": {
  "volumeThresholdUSDT": 10000,  // Minimum liquidation volume to trigger
  "tradeSize": 0.001,            // Base trade size
  "leverage": 5,                 // Leverage multiplier
  "tpPercent": 5,                // Take profit percentage
  "slPercent": 2                 // Stop loss percentage
}
```

## API Integration

Connects to Aster Finance exchange API (`https://fapi.asterdex.com`):
- **Authentication**: HMAC SHA256 signatures with API key/secret
- **Market Data**: WebSocket streams for liquidations, mark prices, klines
- **User Data**: WebSocket stream for account updates and order fills
- **Trading**: REST API for placing orders, setting leverage, managing positions

## Operating Modes

### Paper Mode
- Set `"paperMode": true` in config.json
- Simulates trading without placing real orders
- Generates mock liquidation events for testing
- Safe for development and testing

### Live Mode
- Requires valid API keys in config.json
- Places real orders on the exchange
- Monitors real liquidation streams
- Manages actual positions with real money

## Key Dependencies

- **concurrently**: Runs web UI and bot service simultaneously
- **tsx**: TypeScript execution for bot service with watch mode
- **ws**: WebSocket client for exchange connections and internal status server
- **axios**: HTTP client for REST API calls
- **@radix-ui/***: UI component library for the web interface
- **recharts**: Charts for displaying trading data
- **tailwindcss**: v4 for styling
- **ethers**: Ethereum utilities (for additional blockchain functionality)
- **zod**: Schema validation for configuration and API responses
- **sonner**: Toast notifications for the web UI

## Development Workflow

1. Configure `config.json` with your trading parameters (start in paper mode)
2. Run `npm run dev` to start both web UI and bot
3. Access web UI at http://localhost:3000 to monitor bot status
4. Bot logs will show in the terminal with detailed trade information
5. Use `/config` page to adjust settings without restarting

## Safety Features

- Paper mode for safe testing
- Automatic stop-loss and take-profit orders on all positions
- Risk management with configurable risk percentage per trade
- WebSocket auto-reconnection with exponential backoff
- Graceful shutdown handling (Ctrl+C to stop)

## Web UI Structure

The Next.js application uses App Router with key pages:
- `/` (dashboard): Main trading dashboard with positions, liquidation feed, and bot status
- `/config`: Configuration page for editing trading parameters and API keys
- `/api/*`: REST endpoints for bot communication (balance, positions, trades, config)

## Important Instructions for Claude Code

**NEVER** start the development server or run `npm run dev` or any server commands. The user manages the server themselves and starting additional servers can cause port conflicts and issues.

**SECURITY NOTE**: The `config.json` file contains API keys and should never be committed to version control. Always check that sensitive configuration is properly excluded from git.