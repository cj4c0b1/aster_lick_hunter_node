# Test Suite for Aster Liquidation Hunter Bot

This folder contains comprehensive tests for both the trading bot functionality and PnL data consistency.

## PnL Data Consistency Test Suite

### Master Test Runner: `run-pnl-tests.js`
**Primary Purpose**: Comprehensive validation of PnL data consistency fixes

Executes all PnL-related tests and provides detailed reporting on:
- Data consistency between 24h and 7d views
- Session data integration without double-counting
- Cache behavior and performance
- Chart component data processing

**Run:** `node tests/run-pnl-tests.js`

### Individual PnL Test Suites:

#### 1. **test-pnl-data-consistency.js** - API Data Consistency
Tests core API data consistency between time ranges:
- ✅ Today's data matches between 24h and 7d API responses
- ✅ Session data integration without double-counting
- ✅ PnL component aggregation (realized + commission + funding = net)
- ✅ Cache behavior and response times

#### 2. **test-chart-data-integration.js** - Chart Processing Logic
Validates chart component data processing:
- ✅ Chart processing consistency between time ranges
- ✅ Session data integration in chart components
- ✅ Client-side filtering logic (1y, all ranges)
- ✅ Data integrity and field validation

#### 3. **test-session-data-merging.js** - Session Data Merging
Tests session data merging without double-counting:
- ✅ Session data replaces historical today's data (not adds to it)
- ✅ Session data added when no historical today exists
- ✅ Empty session data handling
- ✅ Real API integration validation

#### 4. **test-cache-behavior.js** - Cache Performance & TTL
Validates caching system behavior:
- ✅ Cache hit performance (faster than cache miss)
- ✅ Different TTL values for different ranges
- ✅ Concurrent request handling
- ✅ Memory usage and error handling

## Bot Trading Test Suite

### 1. **test-limit-orders.ts** - Core Limit Order System Tests
Tests the fundamental components of the limit order implementation:
- Order book fetching from Aster Finance API
- Optimal price calculation algorithms
- Symbol filter validation (tick size, step size, min notional)
- Order book depth analysis for liquidity assessment
- Limit order placement with proper parameters

**Run:** `npm run test`

### 2. **test-bot-simulation.ts** - Bot Integration Test
Simulates the complete trading flow with mock liquidation events:
- Hunter initialization and configuration
- Liquidation event detection and processing
- Trade opportunity analysis
- Order placement decision logic
- Event handling and status updates

**Run:** `npm run test:simulation`

### 3. **test-limit-order-flow.ts** - Performance Comparison Demo
Demonstrates the improvements of limit orders vs market orders:
- Side-by-side comparison of market vs limit orders
- Cost analysis including fees and spreads
- Savings calculations and projections
- Visual demonstration of price improvements

**Run:** `npm run test:flow`

## Running Tests

### PnL Data Consistency Tests

#### Prerequisites
1. **API Server Running**: Start the development server first
   ```bash
   npm run dev
   ```

2. **Valid Configuration**: Ensure `config.json` has API credentials
3. **API Accessibility**: Server should respond at `http://localhost:3000`

#### Run PnL Tests
```bash
# Run comprehensive PnL test suite
node tests/run-pnl-tests.js

# Or run individual PnL test suites
node tests/test-pnl-data-consistency.js
node tests/test-chart-data-integration.js
node tests/test-session-data-merging.js
node tests/test-cache-behavior.js
```

### Bot Trading Tests
```bash
# Core limit order tests
npm run test

# Bot simulation test
npm run test:simulation

# Limit order flow demonstration
npm run test:flow

# Run all bot tests
npm run test:all
```

### Direct Execution
```bash
# Run any test directly with tsx or node
npx tsx tests/test-limit-orders.ts
node tests/run-pnl-tests.js
```

## Test Configuration

### PnL Tests Configuration
- Requires valid API credentials in `config.json`
- Uses real API endpoints (requires network access)
- Tests both cached and fresh data scenarios

### Bot Tests Configuration
Tests use the main `config.json` file in the project root. For safe testing:

1. **Paper Mode**: Ensure `paperMode: true` in config.json
2. **Trade Size**: Must meet minimum notional ($5 for ASTERUSDT)
3. **API Keys**: Required for market data fetching

## Expected Results

### ✅ PnL Tests Successful Output
```
🧪 PnL Data Consistency Test Suite
=====================================

✅ PASS: Today's Net PnL matches between 24h and 7d
✅ PASS: Session data replaces historical today
✅ PASS: Cache hit is faster than cache miss

📊 Test Summary
===============
✅ Passed: 47
❌ Failed: 0
📈 Success Rate: 100.0%

🎉 ALL TESTS PASSED!
```

### ✅ Bot Tests Successful Output
- Order book data fetched successfully
- Optimal prices calculated within spread
- Order parameters validated
- Liquidity analysis completed
- Paper mode orders simulated

### ⚠️ Common Issues

#### PnL Tests
- **API Server Not Running**: Start with `npm run dev`
- **API Credentials Missing**: Add keys to `config.json`
- **Data Inconsistency**: Check cache TTL and session merging

#### Bot Tests
- **Min Notional Error**: Increase trade size if below $5
- **API Connection**: Check API keys and network connection
- **Symbol Not Found**: Verify symbol exists on exchange

## Test Coverage

| Component | Coverage | Test File |
|-----------|----------|-----------|
| **PnL Data Consistency** |
| API Data Consistency | ✅ | test-pnl-data-consistency.js |
| Chart Processing Logic | ✅ | test-chart-data-integration.js |
| Session Data Merging | ✅ | test-session-data-merging.js |
| Cache Behavior & TTL | ✅ | test-cache-behavior.js |
| **Bot Trading System** |
| Order Book API | ✅ | test-limit-orders.ts |
| Price Calculation | ✅ | test-limit-orders.ts |
| Symbol Filters | ✅ | test-limit-orders.ts |
| Order Validation | ✅ | test-limit-orders.ts |
| Hunter Logic | ✅ | test-bot-simulation.ts |
| Event Handling | ✅ | test-bot-simulation.ts |
| Cost Analysis | ✅ | test-limit-order-flow.ts |

## Performance Metrics

### PnL Test Performance
Expected performance improvements:
- **Cache Hit**: < 50ms (vs 200-500ms cache miss)
- **Data Consistency**: 100% accuracy across time ranges
- **API Efficiency**: Single calls instead of batch loops
- **Memory Usage**: Stable cache with TTL cleanup

### Bot Test Metrics
Based on test results with ASTERUSDT:
- **Spread**: ~0.5-1.5 basis points
- **Price Improvement**: 2-5 bps per trade
- **Fee Advantage**: 6 bps (maker rebate vs taker fee)
- **Total Savings**: ~0.04-0.08% per trade

## Development

To add new tests:
1. Create a new `.js` or `.ts` file in this folder
2. Import from `../src/` for project modules
3. Add npm script to package.json (if needed)
4. Document test purpose in this README

## Continuous Testing

### Before Deploying to Production:
1. **Run PnL Tests**: `node tests/run-pnl-tests.js`
2. **Run Bot Tests**: `npm run test:all`
3. **Type Check**: `npx tsc --noEmit`
4. **Lint Code**: `npm run lint`
5. **Verify All Pass**: Ensure 100% success rate

### After PnL Tests Pass:
1. **UI Verification**: Test actual web interface for visual consistency
2. **Real Trading**: Make test trades to verify real-time integration
3. **Performance Monitoring**: Watch cache performance in production
4. **Ongoing Monitoring**: Run tests periodically to catch regressions