# Liquidation Hunter Bot Trading Strategy

## Executive Summary

The Aster Liquidation Hunter Bot implements a **momentum-driven contrarian strategy** that capitalizes on price dislocations created by forced liquidations on cryptocurrency futures markets. The bot monitors real-time liquidation events and automatically places trades in the opposite direction, exploiting the temporary price inefficiencies that occur when large positions are forcefully closed.

### Key Strategic Principles

1. **Contrarian Liquidation Trading**: Buy when longs are liquidated (forced selling), sell when shorts are liquidated (forced buying)
2. **Volume-Based Filtering**: Only trade on significant liquidations that can move the market
3. **VWAP Protection**: Ensure favorable entry prices relative to volume-weighted average
4. **Intelligent Execution**: Smart order placement using order book analysis
5. **Automated Risk Management**: Immediate stop-loss and take-profit orders on all positions

## Core Trading Logic

### The Liquidation Opportunity

When traders use leverage, they must maintain a minimum margin level. If the market moves against them and their margin falls below the maintenance requirement, the exchange forcefully closes their position through a liquidation order. This creates predictable market dynamics:

- **Long Liquidations** (forced SELL orders) → Temporary price depression → **BUY opportunity**
- **Short Liquidations** (forced BUY orders) → Temporary price spike → **SELL opportunity**

The bot exploits the fact that these forced orders often create oversold or overbought conditions that tend to revert.

## Signal Detection

### 1. Real-Time Liquidation Monitoring

The bot connects to the Aster Finance liquidation WebSocket stream:
```
wss://fstream.asterdex.com/ws/!forceOrder@arr
```

Each liquidation event contains:
- **Symbol**: The trading pair (e.g., BTCUSDT)
- **Side**: BUY (short liquidation) or SELL (long liquidation)
- **Price**: The liquidation price
- **Quantity**: Amount being liquidated
- **Time**: Exact timestamp

### 2. Volume Thresholds

Not all liquidations are tradeable. The bot filters for significant events:

```javascript
// Configuration per symbol
{
  "BTCUSDT": {
    "longVolumeThresholdUSDT": 10000,   // Min $10k liquidation to trigger long
    "shortVolumeThresholdUSDT": 10000,  // Min $10k liquidation to trigger short
  }
}
```

**Why Volume Matters**:
- Small liquidations (<$1k) don't move the market
- Medium liquidations ($1k-$10k) create minor opportunities
- Large liquidations (>$10k) create significant price dislocations
- Massive liquidations (>$100k) can trigger cascades

### 3. Price Proximity Check

The bot only trades if the liquidation price is close to current market price:
- **For Long Entry**: Liquidation price must be within 1% below mark price
- **For Short Entry**: Liquidation price must be within 1% above mark price

This ensures the liquidation is affecting current market conditions, not stale or out-of-range events.

## Entry Strategy

### VWAP Protection Filter

Before entering any position, the bot checks the Volume Weighted Average Price (VWAP):

```javascript
// VWAP Entry Rules
Long Entry:  Current Price < VWAP  // Buy below average
Short Entry: Current Price > VWAP  // Sell above average
```

**VWAP Calculation**:
- **Timeframe**: Configurable (1m, 5m, 15m, 30m, 1h)
- **Lookback**: Number of candles to include (e.g., 200)
- **Session-Based**: Resets at UTC 00:00 daily

**Why VWAP Protection Works**:
1. Prevents buying into momentum (when price > VWAP)
2. Prevents selling into downtrends (when price < VWAP)
3. Ensures favorable entry relative to average traded price
4. Reduces false signals during trending markets

### Intelligent Order Placement

The bot uses a sophisticated order placement system:

#### 1. Order Book Analysis
```javascript
// Analyze order book before placing trade
{
  bestBid: 50000.00,
  bestAsk: 50001.00,
  bidDepth: 10.5 BTC,  // Liquidity at best bid
  askDepth: 8.2 BTC,   // Liquidity at best ask
  spread: 0.002%       // Bid-ask spread percentage
}
```

#### 2. Smart Price Determination

For **LIMIT Orders**:
- **Buy Orders**: Place at bestBid + offset (typically 1-2 basis points)
- **Sell Orders**: Place at bestAsk - offset (typically 1-2 basis points)

Benefits:
- Better fill probability than placing at exact best bid/ask
- Often still gets maker fee rebate
- Reduces slippage compared to market orders

#### 3. Order Type Selection

```javascript
if (orderBookDepth >= tradeSize * 2 && spread < maxSpreadBps) {
  // Use LIMIT order - sufficient liquidity
  placeSmartLimitOrder()
} else {
  // Use MARKET order - insufficient liquidity or wide spread
  placeMarketOrder()
}
```

## Position Management

### Position Sizing

The bot uses a margin-based position sizing approach:

```javascript
// Position Size Calculation
Margin Amount = tradeSize (from config)
Leverage = leverage (from config)
Position Size = Margin × Leverage

// Example:
Margin: $100
Leverage: 10x
Position: $1,000 notional
```

### Maximum Position Limits

Multiple safety controls prevent over-exposure:

1. **Per-Symbol Margin Limit**: `maxPositionMarginUSDT`
2. **Global Position Count**: `maxPositions` (default: 5)
3. **Risk Percentage**: Maximum % of account balance at risk

### Position Tracking

The bot maintains comprehensive position state:
```javascript
{
  symbol: "BTCUSDT",
  side: "BUY",
  entryPrice: 50000,
  quantity: 0.001,
  margin: 100,
  leverage: 10,
  unrealizedPnL: 5.23,
  stopLossOrderId: 123456,
  takeProfitOrderId: 123457,
  entryTime: 1234567890000
}
```

## Exit Strategy

### Automatic Stop-Loss & Take-Profit

Every position gets immediate protection:

#### Stop-Loss Orders
- **Type**: STOP_MARKET (guaranteed execution)
- **Distance**: Configurable percentage from entry (e.g., 2%)
- **Calculation**:
  - Long: Entry Price × (1 - slPercent/100)
  - Short: Entry Price × (1 + slPercent/100)

#### Take-Profit Orders
- **Type**: LIMIT (better price, may not fill)
- **Distance**: Configurable percentage from entry (e.g., 5%)
- **Calculation**:
  - Long: Entry Price × (1 + tpPercent/100)
  - Short: Entry Price × (1 - tpPercent/100)

### Underwater Position Handling

If a position is already at a loss when SL/TP orders are placed:
```javascript
if (currentPrice < entryPrice && side === "BUY") {
  // Position underwater, adjust stop-loss
  stopPrice = currentPrice * (1 - bufferPercent)
}
```

This prevents immediate stop-loss triggers on volatile entries.

## Risk Management Framework

### Layer 1: Pre-Trade Validation
- Balance check (sufficient margin)
- Position limit check (not exceeding max positions)
- Symbol filter compliance (price/quantity precision)
- Notional value requirements (minimum trade size)

### Layer 2: Entry Protection
- VWAP filtering (favorable entry context)
- Volume thresholds (significant liquidations only)
- Price proximity check (relevant liquidations)
- Slippage limits (maximum acceptable price deviation)

### Layer 3: Position Protection
- Immediate stop-loss orders
- Take-profit targets
- Maximum position sizing
- Leverage limits per symbol

### Layer 4: System Protection
- WebSocket auto-reconnection
- Graceful error handling
- Order retry mechanisms
- Clean shutdown procedures

## Advanced Features

### 1. Multi-Symbol Support

The bot can monitor and trade multiple symbols simultaneously:
```javascript
{
  "BTCUSDT": { /* config */ },
  "ETHUSDT": { /* config */ },
  "ASTERUSDT": { /* config */ }
}
```

Each symbol has independent:
- Volume thresholds
- Position sizing
- Risk parameters
- VWAP settings

### 2. Position Mode Flexibility

Supports two position modes:
- **One-Way Mode**: Single position per symbol
- **Hedge Mode**: Separate long and short positions

### 3. Paper Trading Mode

Full strategy simulation without real money:
- Mock liquidation generation
- Simulated order execution
- Performance tracking
- Risk-free strategy testing

### 4. Real-Time Monitoring

WebSocket status server provides:
- Current positions and P&L
- Recent liquidations
- Bot activity status
- Configuration state
- Performance metrics

## Configuration Examples

### Conservative Configuration
```json
{
  "BTCUSDT": {
    "longVolumeThresholdUSDT": 50000,  // Only large liquidations
    "shortVolumeThresholdUSDT": 50000,
    "tradeSize": 50,                   // Small position size
    "leverage": 2,                      // Low leverage
    "tpPercent": 2,                     // Modest profit target
    "slPercent": 1,                     // Tight stop-loss
    "vwapProtection": true,
    "maxSlippageBps": 10                // Very tight slippage
  }
}
```

### Aggressive Configuration
```json
{
  "BTCUSDT": {
    "longVolumeThresholdUSDT": 5000,   // Smaller liquidations
    "shortVolumeThresholdUSDT": 5000,
    "tradeSize": 200,                  // Larger position size
    "leverage": 10,                     // Higher leverage
    "tpPercent": 5,                     // Ambitious profit target
    "slPercent": 3,                     // Wider stop-loss
    "vwapProtection": false,           // No VWAP filter
    "maxSlippageBps": 100               // Accept more slippage
  }
}
```

### Scalping Configuration
```json
{
  "BTCUSDT": {
    "longVolumeThresholdUSDT": 2000,   // Frequent signals
    "shortVolumeThresholdUSDT": 2000,
    "tradeSize": 100,
    "leverage": 5,
    "tpPercent": 0.5,                  // Quick profits
    "slPercent": 0.3,                   // Tight stops
    "vwapProtection": true,
    "vwapTimeframe": "1m",              // Short-term VWAP
    "vwapLookback": 60                  // 1-hour lookback
  }
}
```

## Trading Scenario Examples

### Scenario 1: Large Long Liquidation

**Event**: $50,000 BTCUSDT long liquidation at $48,500

**Bot Response**:
1. Detect liquidation via WebSocket
2. Check volume threshold: $50,000 > $10,000 ✓
3. Check price proximity: $48,500 within 1% of $49,000 mark ✓
4. Check VWAP: Current $48,600 < VWAP $49,200 ✓
5. Analyze order book: 5 BTC depth at bid, 0.1% spread
6. Place LIMIT BUY at $48,501 for 0.01 BTC
7. Order fills at $48,501
8. Place STOP at $47,531 (-2%)
9. Place TP at $50,926 (+5%)
10. Monitor position until exit

**Result**: TP hits, +5% profit on margin

### Scenario 2: Cascade Event

**Event**: Multiple liquidations in sequence

**Bot Response**:
1. First liquidation triggers entry
2. Second liquidation occurs (ignored - already positioned)
3. Price continues against position
4. Stop-loss triggers at -2%
5. Third liquidation creates new signal
6. Bot re-enters with fresh position
7. Market reverses strongly
8. Take-profit hits for +5%

**Result**: -2% loss, then +5% profit = +3% net

### Scenario 3: Failed Entry

**Event**: $15,000 ETHUSDT short liquidation

**Bot Response**:
1. Detect liquidation
2. Check VWAP: Current $2,100 < VWAP $2,080 ✗
3. Skip trade - unfavorable VWAP position
4. Log skipped opportunity
5. Continue monitoring

**Result**: No trade, no loss

## Performance Metrics

### Key Performance Indicators

1. **Win Rate**: Percentage of profitable trades
   - Target: >55% with proper configuration
   - Measured over minimum 100 trades

2. **Risk-Reward Ratio**: Average win / Average loss
   - Target: >1.5:1 (TP:SL ratio matters)
   - Adjustable via tpPercent/slPercent

3. **Sharpe Ratio**: Risk-adjusted returns
   - Measures consistency of profits
   - Higher is better (>1.0 good, >2.0 excellent)

4. **Maximum Drawdown**: Largest peak-to-trough decline
   - Critical risk metric
   - Should align with risk tolerance

5. **Average Trade Duration**: Time in position
   - Shorter = more capital efficient
   - Depends on market volatility

### Monitoring Dashboard Metrics

The web UI displays real-time:
- Current positions with live P&L
- Recent liquidation events
- Hit rate (successful entries)
- Session P&L
- Average trade metrics
- Configuration status

## Strategy Optimization

### Parameter Tuning Guidelines

1. **Volume Thresholds**:
   - Start high, reduce gradually
   - Monitor win rate changes
   - Find balance between frequency and quality

2. **Leverage**:
   - Start low (2-3x)
   - Increase only with proven profitability
   - Consider volatility levels

3. **TP/SL Ratios**:
   - Maintain positive risk-reward
   - Adjust based on market conditions
   - Wider in trending markets, tighter in ranges

4. **VWAP Settings**:
   - Longer timeframes for position trading
   - Shorter for scalping
   - Disable only in strong trending markets

### Market Condition Adaptations

**High Volatility Markets**:
- Increase volume thresholds
- Widen stop-losses
- Reduce leverage
- Shorten VWAP lookback

**Low Volatility Markets**:
- Decrease volume thresholds
- Tighten stops and targets
- Use more aggressive entries
- Extend VWAP lookback

**Trending Markets**:
- Consider disabling contrary trades
- Use direction-specific thresholds
- Implement trend filters
- Adjust VWAP timeframes

## Conclusion

The Liquidation Hunter Bot implements a sophisticated yet robust trading strategy that:

1. **Exploits Market Inefficiencies**: Capitalizes on forced selling/buying
2. **Manages Risk Systematically**: Multiple layers of protection
3. **Adapts to Conditions**: Configurable for different markets
4. **Operates Autonomously**: Full automation with monitoring
5. **Provides Transparency**: Complete visibility into operations

Success depends on:
- Proper configuration for market conditions
- Adequate capital for drawdowns
- Regular monitoring and adjustment
- Understanding of liquidation dynamics
- Patience during quiet periods

The strategy is designed for traders who understand:
- Futures market mechanics
- Liquidation dynamics
- Risk management principles
- The importance of discipline

When properly configured and monitored, the bot provides a systematic approach to profiting from one of crypto markets' most reliable inefficiencies: forced liquidations.