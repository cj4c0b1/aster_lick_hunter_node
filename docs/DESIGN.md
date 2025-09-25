# Aster Liquidation Hunter Bot - Design Document

## Overview
The Aster Liquidation Hunter Bot is a Next.js-based application integrating a real-time trading bot for the Aster Finance Futures API v3. The bot monitors liquidation events via WebSockets, analyzes market conditions against configurable symbol-specific thresholds (e.g., volume in USDT), executes counter-trades, and manages positions with automated stop-loss (SL) and take-profit (TP) orders.

Key Features:
- **UI-Driven Config**: Users input API credentials (user address, signer address, private key) and symbol settings (volume threshold, trade size, leverage, TP%, SL%) via a React form, saved to `config.json` (local) or Vercel KV (cloud).
- **Modular Bot**: Separates hunter logic (detection/trading) from position management (SL/TP handling).
- **Local Execution**: Bot runs as a Node.js process for continuous operation; UI deploys to Vercel for web access.
- **Security**: Private keys handled server-side; config encrypted where possible.
- **Risk Management**: Trades only if liquidation volume > threshold; position sizing based on account balance %.

Tech Stack:
- Next.js 14+ (App Router, TypeScript, Tailwind CSS).
- Ethers.js for API signing (Web3 auth).
- WebSockets (ws lib) for real-time streams.
- Axios for HTTP API calls.
- Recharts for market charts.
- Zod for config validation.
- Child_process for spawning bot scripts locally.

## Architecture
The system divides into three layers: UI, Core Logic, and API Integration.

### 1. UI Layer (`app/` & `components/`)
- **Config Page (`/config`)**: Form for API keys and per-symbol settings. Saves to config store; triggers bot reload.
- **Dashboard (`/dashboard`)**: Real-time views for liquidations, positions, trades. Polls API routes every 5s; WebSocket for live updates (if local).
- **API Routes (`/api/`)**: Serverless endpoints (Vercel-safe) for balance fetching, config updates, historical data. Signed requests routed server-side.
- **Components**:
  - `SymbolConfigForm.tsx`: Dynamic inputs for symbols (add/edit/delete).
  - `LiquidationFeed.tsx`: List of recent events with volume highlights.
  - `PositionTable.tsx`: Open positions with manual adjust SL/TP buttons.
  - `BotControls.tsx`: Start/stop bot (spawns local process).

### 2. Core Logic Layer (`lib/bot/`)
- **Config Loader (`lib/bot/config.ts`)**: Loads/validates `config.json` with Zod schema. Exports types like:
  ```ts
  interface SymbolConfig {
    volumeThresholdUSDT: number;  // e.g., 10000
    tradeSize: number;            // Base quantity (adjusted by leverage)
    leverage: number;             // 1-125
    tpPercent: number;            // e.g., 5 (5%)
    slPercent: number;            // e.g., 2 (2%)
  }
  ```
- **Hunter Module (`lib/bot/hunter.ts`)**: Main detection loop.
  - Connects to WebSocket (`wss://fstream.asterdex.com/ws/!forceOrder@arr`).
  - On event: Parse symbol, qty * price > threshold? → Analyze → Trade.
  - Analysis: Fetch `/fapi/v1/premiumIndex` (mark price), `/fapi/v1/klines` (1m for trends). Simple rules: If liquidation SELL and price < mark * 0.99, buy.
  - Execute: Set leverage (`/fapi/v1/leverage`), place MARKET order via signed POST `/fapi/v3/order`.
  - Notifies Position Manager via EventEmitter.
- **Position Manager (`lib/bot/positionManager.ts`)**: Independent loop for ongoing management.
  - Starts user data stream (`/fapi/v1/listenKey`, WS `/ws/<key>`).
  - Subscribes to `ACCOUNT_UPDATE` (positions/balance), `ORDER_TRADE_UPDATE` (fills).
  - On entry fill: Place SL (`STOP_MARKET`, reduceOnly=true, price = entry * (1 - sl/100)), TP (`TAKE_PROFIT_MARKET`, price = entry * (1 + tp/100)).
  - Monitors: If partial fill, adjust orders. On SL/TP hit, cancel opposites. Query `/fapi/v3/positionRisk` periodically.
  - Risk: If unrealized PnL < -risk%, close all.
- **Utilities (`lib/api/`)**:
  - `auth.ts`: Signing function (params → sorted JSON → ABI encode with user/signer/nonce → keccak → ECDSA sign).
  - `market.ts`: GET public (e.g., exchangeInfo, klines) or signed (e.g., balance).
  - `orders.ts`: POST signed orders, queries, cancels.

### 3. Data Flow & Storage
- **Config Storage**: Local `config.json` (gitignored, .env for private key fallback). Vercel: KV for settings, but keys local-only.
- **Logs/History**: Persist trades to `data/trades.json` (local) or API route to Vercel Postgres (optional).
- **Events**: Internal EventEmitter for hunter ↔ position manager comms (e.g., 'new_position').

## Flow Tree
The bot's execution flow is event-driven with two parallel processes: Hunter (detection) and Position Manager (maintenance). Below is a Mermaid diagram (copy to mermaid.live for visualization).

```mermaid
graph TD
    A[Start Bot: Load Config.json] --> B{Hunter Active?}
    B -->|Yes| C[Connect WS: !forceOrder@arr]
    C --> D[Listen for Liquidation Events]
    D --> E[Event Received: Parse Symbol, Volume = qty * price]
    E --> F{Volume > Threshold?}
    F -->|No| D
    F -->|Yes| G[Fetch Data: Mark Price, 1m Klines]
    G --> H[Analyze: e.g., Price Deviation? Volume Spike?]
    H --> I{Analysis Triggers Trade?}
    I -->|No| D
    I -->|Yes| J[Set Leverage for Symbol]
    J --> K[Place Entry Order: MARKET BUY/SELL, qty = tradeSize]
    K --> L[Notify Position Manager: 'new_position']
    L --> D

    B -->|Yes| M[Position Manager Active?]
    M -->|Yes| N[Start User Data WS: /ws/<listenKey>]
    N --> O[Listen: ACCOUNT_UPDATE, ORDER_TRADE_UPDATE]
    O --> P{Entry Order Filled?}
    P -->|Yes| Q[Place SL: STOP_MARKET @ entry - sl%]
    P -->|No| O
    Q --> R[Place TP: TAKE_PROFIT_MARKET @ entry + tp%]
    R --> S[Monitor Updates: Adjust on Partial Fills]
    S --> T{Cancel/Close if Risk Hit?}
    T -->|Yes| U[Cancel Opposing Orders / Close Position]
    T -->|No| O
    U --> O

    V[UI: Config Edit] --> W[Save to config.json / KV]
    W --> X[Restart/Reload Bot Modules]
    X --> A

    Y[Error: Rate Limit / Invalid Sig] --> Z[Backoff / Log / Retry]
    Z --> Relevant Node

    %% Styling
    classDef botProcess fill:#e1f5fe
    classDef ui fill:#f3e5f5
    class A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z botProcess
    class V,W,X ui
```

### Flow Explanation
1. **Initialization**: Bot loads config, spawns Hunter and Position Manager as parallel loops (e.g., setInterval or promises).
2. **Detection (Hunter)**: WS loop parses liquidations every ~1s. Threshold filter prevents noise. Analysis is lightweight (no ML, rule-based).
3. **Trading**: Signed API calls ensure auth. Entry order params: side opposite to liquidation, quantity scaled by leverage/balance.
4. **Management (Position Manager)**: Event-driven; uses listenKey (keepalive every 30min). Ensures SL/TP always active for open positions.
5. **UI Interaction**: Edits trigger restarts; dashboard reflects state via polling or local WS.
6. **Error Handling**: Retries on 429 (rate limit), logs signatures for debug. Graceful shutdown on config change.
7. **Termination**: Stop closes WS, cancels open orders (`/fapi/v1/allOpenOrders`).

## Risks & Considerations
- **API Limits**: WS for streams to avoid REQUEST_WEIGHT (2400/min). Orders: 1200/min per account.
- **Latency**: Local WS preferred; Vercel proxy for UI.
- **Testing**: Simulate with mock WS/events; paper mode flag in config to log without trading.
- **Scalability**: Multi-symbol via combined WS; extend to more indicators (e.g., integrate TA.js).

This design ensures robustness and ease of extension. Ready to implement in code.
