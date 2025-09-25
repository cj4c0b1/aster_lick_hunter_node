# Test Suite for Aster Liquidation Hunter Bot

This folder contains comprehensive tests for the limit order system and trading bot functionality.

## Available Tests

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

### Individual Tests
```bash
# Core limit order tests
npm run test

# Bot simulation test
npm run test:simulation

# Limit order flow demonstration
npm run test:flow
```

### Run All Tests
```bash
npm run test:all
```

### Direct Execution
```bash
# Run any test directly with tsx
npx tsx tests/test-limit-orders.ts
```

## Test Configuration

Tests use the main `config.json` file in the project root. For safe testing:

1. **Paper Mode**: Ensure `paperMode: true` in config.json
2. **Trade Size**: Must meet minimum notional ($5 for ASTERUSDT)
3. **API Keys**: Required for market data fetching

## Expected Results

### ✅ Successful Test Output
- Order book data fetched successfully
- Optimal prices calculated within spread
- Order parameters validated
- Liquidity analysis completed
- Paper mode orders simulated

### ⚠️ Common Issues
- **Min Notional Error**: Increase trade size if below $5
- **API Connection**: Check API keys and network connection
- **Symbol Not Found**: Verify symbol exists on exchange

## Test Coverage

| Component | Coverage | Test File |
|-----------|----------|-----------|
| Order Book API | ✅ | test-limit-orders.ts |
| Price Calculation | ✅ | test-limit-orders.ts |
| Symbol Filters | ✅ | test-limit-orders.ts |
| Order Validation | ✅ | test-limit-orders.ts |
| Hunter Logic | ✅ | test-bot-simulation.ts |
| Event Handling | ✅ | test-bot-simulation.ts |
| Cost Analysis | ✅ | test-limit-order-flow.ts |

## Performance Metrics

Based on test results with ASTERUSDT:
- **Spread**: ~0.5-1.5 basis points
- **Price Improvement**: 2-5 bps per trade
- **Fee Advantage**: 6 bps (maker rebate vs taker fee)
- **Total Savings**: ~0.04-0.08% per trade

## Development

To add new tests:
1. Create a new `.ts` file in this folder
2. Import from `../src/` for project modules
3. Add npm script to package.json
4. Document test purpose in this README

## Continuous Testing

Before deploying to production:
1. Run all tests: `npm run test:all`
2. Verify all tests pass
3. Check TypeScript compilation: `npx tsc --noEmit`
4. Review linting: `npm run lint`