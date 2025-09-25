# Aster Liquidation Hunter Bot - Implementation Plan

This document outlines the step-by-step implementation of the Aster Liquidation Hunter Bot, based on the [DESIGN.md](DESIGN.md). Follow this checklist in order for a structured build. Include a changelog at the end to track progress and changes.

## Checklist
- [x] **Setup Project Structure**
  - Initialize Next.js with TypeScript, Tailwind CSS, App Router.
  - Install dependencies: `ethers@^6`, `ws@^8`, `axios@^1`, `recharts@^2`, `zod@^3`, `@types/node`, `next@latest`.
  - Create folder layout as per DESIGN.md.

- [x] **Implement Types and Config**
  - Define TypeScript interfaces in `lib/types.ts` (e.g., SymbolConfig, Config, ApiCredentials).
  - Create `lib/bot/config.ts`: Zod schema for validation, load from `config.json`, handle .env for private keys.

- [x] **Build API Authentication Layer**
  - Implement signing in `lib/api/auth.ts`: Convert params to sorted JSON, ABI encode (per API docs), keccak hash, ECDSA sign with ethers.js.
  - Create utility functions in `lib/api/auth.ts` for nonce generation (microseconds).

- [x] **Develop Market Data Utilities**
  - In `lib/api/market.ts`: Functions for GET requests (exchangeInfo, klines, mark price, recent trades).
  - Handle public (no auth) vs. signed requests (balance, position risk).
  - Error handling: Retry 429 errors, log rate limits.

- [x] **Implement Order Management**
  - In `lib/api/orders.ts`: Functions for POST orders (new, cancel, batch), GET queries (open orders, all orders).
  - Wrap with signed auth; handle responses (e.g., orderId, status).

- [x] **Core Bot Logic: Hunter Module**
  - Build `lib/bot/hunter.ts`: WebSocket connection to `!forceOrder@arr`.
  - Parse liquidation events: Calculate volume (qty * price), check against thresholds.
  - Simple analysis: Fetch mark price, basic trend check (e.g., price deviation).
  - Execute trades: Set leverage, place MARKET orders (counter to liquidation side).
  - Emit events to Position Manager.

- [x] **Core Bot Logic: Position Manager**
  - Build `lib/bot/positionManager.ts`: Start listenKey stream (`/ws/<key>`).
  - Listen for ACCOUNT_UPDATE, ORDER_TRADE_UPDATE.
  - On entry fill: Place SL/TP orders (STOP_MARKET, TAKE_PROFIT_MARKET with reduceOnly).
  - Monitor and adjust: Partial fills, cancel on SL/TP hit, risk checks.

- [x] **Standalone Bot Entry Point**
  - Create `bot/index.ts`: Load config, spawn Hunter and Position Manager as async operations.
  - Add paper mode (simulate without real orders).
  - Readme section: Run `node bot/index.js` locally.

- [x] **UI Components**
  - `components/SymbolConfigForm.tsx`: Form for API keys and per-symbol settings (volume, leverage, etc.).
  - `components/LiquidationFeed.tsx`: Display liquidation events.
  - `components/PositionTable.tsx`: Show open positions, SL/TP.
  - `components/BotControls.tsx`: Start/stop bot (via child_process for local runs).

- [x] **UI Pages**
  - `app/config/page.tsx`: Wrap SymbolConfigForm, save to config.json.
  - `app/dashboard/page.tsx`: Dashboard with feeds, tables, charts (Recharts for klines).
  - `app/layout.tsx`: Global layout, nav to config/dashboard.
  - `app/page.tsx`: Landing page explain bot.

- [x] **API Routes (Serverless)**
  - `/api/balance`: Fetch balance (signed).
  - `/api/trades`: Get recent trades (signed).
  - `/api/config`: Load/save config (for polling).
  - Guard private keys server-side.

- [x] **Integration and Testing**
  - Integrate bot start/stop: UI spawns `bot/index.js` via child_process.
  - Test API calls with mock data (e.g., simulate WS events).
  - Add logging: Console logs for trades, errors; later, persist to `data/logs.json`.
  - Edge cases: Rate limits, invalid keys, network issues.

- [ ] **Deployment and Polish**
  - Local: `npm run dev` for app, `npm run bot` for standalone.
  - Vercel: Deploy UI/API; bots run locally (app deploys with instructions).
  - Security: .gitignore config.json, .env; warn on private key exposure.
  - Final README: Setup, run, config explanation.

## Changelog
Track changes, bugs, and additions here. Format: `[Date] - Description (Commit/Issue #)`

- [2025-09-25] - INITIAL: Created IMPLEMENTATION_PLAN.md and DESIGN.md. (#initial)
- [2025-09-25] - CLARIFIED: Defined per-symbol configs with thresholds, SL/TP as %; Position Manager separate. (#clarify)
- [2025-09-25] - SETUP: Initialized Next.js project. Added deps ethers, ws, axios, recharts, zod. Created folder structure. (#setup)
- [2025-09-25] - TYPES: Added lib/types.ts with interfaces, lib/bot/config.ts with Zod. Created config.json template. (#types)
- [2025-09-25] - AUTH_FIXED: Changed to API key/secret auth, updated types and config. (#auth_fix)
- [2025-09-25] - AUTH: Implemented signing in lib/api/auth.ts. (#auth)
- [2025-09-25] - MARKET: Built market.ts for data fetching. (#market)
- [2025-09-25] - ORDERS: Implemented orders.ts for trading. (#orders)
- [2025-09-25] - HUNTER: Developed hunter.ts WebSocket logic. (#hunter)
- [2025-09-25] - POS_MGR: Built positionManager.ts with authentication fixes. (#pos_mgr)
- [2025-09-25] - BOT_ENTRY: Created bot/index.ts entry point with start/stop/status commands. (#bot_entry)
- [2025-09-25] - COMPONENTS: Created all UI components - SymbolConfigForm, LiquidationFeed, PositionTable, BotControls. (#components)
- [2025-09-25] - PAGES: Built config, dashboard, and landing pages with full routing. (#pages)
- [2025-09-25] - API_ROUTES: Added /api/balance, /api/trades, /api/config routes with mock data support. (#api)
- [2025-09-25] - INTEGRATION: Connected UI to bot modules, added npm scripts for bot execution. (#integration)
- [2025-09-25] - TESTING: Fixed TypeScript errors, added paper mode, verified compilation. (#testing)
- [2025-09-25] - FIXES: Fixed authentication issues, TypeScript errors in orders.ts, added missing dependencies. (#fixes)
- [TBD] - DEPLOY: Tested local/Vercel deployment. (#deploy)
- [TBD] - FINAL: Added comprehensive README, final polish. (#final)
