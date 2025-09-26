import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Config, LiquidationEvent, SymbolConfig } from '../types';
import { getMarkPrice } from '../api/market';
import { placeOrder, setLeverage } from '../api/orders';
import { calculateOptimalPrice, validateOrderParams, analyzeOrderBookDepth, getSymbolFilters } from '../api/pricing';
import { getPositionSide } from '../api/positionMode';
import { PositionTracker } from './positionManager';
import { liquidationStorage } from '../services/liquidationStorage';
import { vwapService } from '../services/vwapService';
import { vwapStreamer } from '../services/vwapStreamer';
import {
  parseExchangeError,
  NotionalError,
  RateLimitError,
  InsufficientBalanceError,
  ReduceOnlyError,
  PricePrecisionError,
  QuantityPrecisionError
} from '../errors/TradingErrors';

export class Hunter extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Config;
  private isRunning = false;
  private statusBroadcaster: any; // Will be injected
  private isHedgeMode: boolean;
  private positionTracker: PositionTracker | null = null;

  constructor(config: Config, isHedgeMode: boolean = false) {
    super();
    this.config = config;
    this.isHedgeMode = isHedgeMode;
  }

  // Set status broadcaster for order events
  public setStatusBroadcaster(broadcaster: any): void {
    this.statusBroadcaster = broadcaster;
  }

  // Set position tracker for position limit checks
  public setPositionTracker(tracker: PositionTracker): void {
    this.positionTracker = tracker;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // In paper mode with no API keys, simulate liquidation events
    if (this.config.global.paperMode && (!this.config.api.apiKey || !this.config.api.secretKey)) {
      console.log('Hunter: Running in paper mode without API keys - simulating liquidations');
      this.simulateLiquidations();
    } else {
      this.connectWebSocket();
    }
  }

  stop(): void {
    this.isRunning = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private connectWebSocket(): void {
    this.ws = new WebSocket('wss://fstream.asterdex.com/ws/!forceOrder@arr');

    this.ws.on('open', () => {
      console.log('Hunter WS connected');
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString());
        this.handleLiquidationEvent(event);
      } catch (error) {
        console.error('Hunter: WS message parse error:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('Hunter WS error:', error);
      // Reconnect after delay
      setTimeout(() => this.connectWebSocket(), 5000);
    });

    this.ws.on('close', () => {
      console.log('Hunter WS closed');
      if (this.isRunning) {
        setTimeout(() => this.connectWebSocket(), 5000);
      }
    });
  }

  private async handleLiquidationEvent(event: any): Promise<void> {
    if (event.e !== 'forceOrder') return; // Not a liquidation event

    const liquidation: LiquidationEvent = {
      symbol: event.o.s,
      side: event.o.S,
      orderType: event.o.o,
      quantity: parseFloat(event.o.q),
      price: parseFloat(event.o.p),
      averagePrice: parseFloat(event.o.ap),
      orderStatus: event.o.X,
      orderLastFilledQuantity: parseFloat(event.o.l),
      orderFilledAccumulatedQuantity: parseFloat(event.o.z),
      orderTradeTime: event.o.T,
      eventTime: event.E,
      qty: parseFloat(event.o.q), // Keep for backward compatibility
      time: event.E, // Keep for backward compatibility
    };

    // Emit liquidation event to WebSocket clients (all liquidations)
    this.emit('liquidationDetected', liquidation);

    const symbolConfig = this.config.symbols[liquidation.symbol];
    if (!symbolConfig) return; // Symbol not in config

    const volumeUSDT = liquidation.qty * liquidation.price;

    // Store liquidation in database (non-blocking)
    liquidationStorage.saveLiquidation(liquidation, volumeUSDT).catch(error => {
      console.error('Hunter: Failed to store liquidation:', error);
    });

    // Check direction-specific volume thresholds
    // SELL liquidation means longs are getting liquidated, we might want to BUY
    // BUY liquidation means shorts are getting liquidated, we might want to SELL
    const thresholdToCheck = liquidation.side === 'SELL'
      ? (symbolConfig.longVolumeThresholdUSDT ?? symbolConfig.volumeThresholdUSDT ?? 0)
      : (symbolConfig.shortVolumeThresholdUSDT ?? symbolConfig.volumeThresholdUSDT ?? 0);

    if (volumeUSDT < thresholdToCheck) return; // Too small

    console.log(`Hunter: Liquidation detected - ${liquidation.symbol} ${liquidation.side} ${volumeUSDT.toFixed(2)} USDT`);

    // Analyze and trade
    await this.analyzeAndTrade(liquidation, symbolConfig);
  }

  private async analyzeAndTrade(liquidation: LiquidationEvent, symbolConfig: SymbolConfig): Promise<void> {
    try {
      // Get mark price and recent 1m kline
      const [markPriceData] = Array.isArray(await getMarkPrice(liquidation.symbol)) ?
        await getMarkPrice(liquidation.symbol) as any[] :
        [await getMarkPrice(liquidation.symbol)];

      const markPrice = parseFloat(markPriceData.markPrice);

      // Simple analysis: If SELL liquidation and price is > 0.99 * mark, buy
      // If BUY liquidation, sell
      const priceRatio = liquidation.price / markPrice;
      const triggerBuy = liquidation.side === 'SELL' && priceRatio < 1.01; // 1% below
      const triggerSell = liquidation.side === 'BUY' && priceRatio > 0.99;  // 1% above

      // Check VWAP protection if enabled
      if (symbolConfig.vwapProtection) {
        const timeframe = symbolConfig.vwapTimeframe || '1m';
        const lookback = symbolConfig.vwapLookback || 100;

        if (triggerBuy) {
          // Try to use streamer data first (real-time)
          const streamedVWAP = vwapStreamer.getCurrentVWAP(liquidation.symbol);
          let vwapCheck;

          if (streamedVWAP && Date.now() - streamedVWAP.timestamp < 5000) {
            // Use streamed data if it's fresh (less than 5 seconds old)
            const allowed = liquidation.price < streamedVWAP.vwap;
            vwapCheck = {
              allowed,
              vwap: streamedVWAP.vwap,
              reason: allowed
                ? `Price is below VWAP - BUY entry allowed`
                : `Price ($${liquidation.price.toFixed(2)}) is above VWAP ($${streamedVWAP.vwap.toFixed(2)}) - blocking long entry`
            };
          } else {
            // Fallback to API fetch if no fresh streamer data
            vwapCheck = await vwapService.checkVWAPFilter(
              liquidation.symbol,
              'BUY',
              liquidation.price,
              timeframe,
              lookback
            );
          }

          if (!vwapCheck.allowed) {
            console.log(`Hunter: VWAP Protection - ${vwapCheck.reason}`);

            // Emit blocked trade opportunity for monitoring
            this.emit('tradeBlocked', {
              symbol: liquidation.symbol,
              side: 'BUY',
              reason: vwapCheck.reason,
              vwap: vwapCheck.vwap,
              currentPrice: liquidation.price,
              blockType: 'VWAP_FILTER'
            });

            return; // Block the trade
          } else {
            console.log(`Hunter: VWAP Check Passed - Price $${liquidation.price.toFixed(2)} below VWAP $${vwapCheck.vwap.toFixed(2)}`);
          }
        } else if (triggerSell) {
          // Try to use streamer data first (real-time)
          const streamedVWAP = vwapStreamer.getCurrentVWAP(liquidation.symbol);
          let vwapCheck;

          if (streamedVWAP && Date.now() - streamedVWAP.timestamp < 5000) {
            // Use streamed data if it's fresh (less than 5 seconds old)
            const allowed = liquidation.price > streamedVWAP.vwap;
            vwapCheck = {
              allowed,
              vwap: streamedVWAP.vwap,
              reason: allowed
                ? `Price is above VWAP - SELL entry allowed`
                : `Price ($${liquidation.price.toFixed(2)}) is below VWAP ($${streamedVWAP.vwap.toFixed(2)}) - blocking short entry`
            };
          } else {
            // Fallback to API fetch if no fresh streamer data
            vwapCheck = await vwapService.checkVWAPFilter(
              liquidation.symbol,
              'SELL',
              liquidation.price,
              timeframe,
              lookback
            );
          }

          if (!vwapCheck.allowed) {
            console.log(`Hunter: VWAP Protection - ${vwapCheck.reason}`);

            // Emit blocked trade opportunity for monitoring
            this.emit('tradeBlocked', {
              symbol: liquidation.symbol,
              side: 'SELL',
              reason: vwapCheck.reason,
              vwap: vwapCheck.vwap,
              currentPrice: liquidation.price,
              blockType: 'VWAP_FILTER'
            });

            return; // Block the trade
          } else {
            console.log(`Hunter: VWAP Check Passed - Price $${liquidation.price.toFixed(2)} above VWAP $${vwapCheck.vwap.toFixed(2)}`);
          }
        }
      }

      if (triggerBuy) {
        const volumeUSDT = liquidation.qty * liquidation.price;

        // Emit trade opportunity
        this.emit('tradeOpportunity', {
          symbol: liquidation.symbol,
          side: 'BUY',
          reason: `SELL liquidation at ${((1 - priceRatio) * 100).toFixed(2)}% below mark price`,
          liquidationVolume: volumeUSDT,
          priceImpact: (1 - priceRatio) * 100,
          confidence: Math.min(95, 50 + (volumeUSDT / 1000) * 10) // Higher confidence for larger volumes
        });

        console.log(`Hunter: Triggering BUY for ${liquidation.symbol} at ${liquidation.price}`);
        await this.placeTrade(liquidation.symbol, 'BUY', symbolConfig, liquidation.price);
      } else if (triggerSell) {
        const volumeUSDT = liquidation.qty * liquidation.price;

        // Emit trade opportunity
        this.emit('tradeOpportunity', {
          symbol: liquidation.symbol,
          side: 'SELL',
          reason: `BUY liquidation at ${((priceRatio - 1) * 100).toFixed(2)}% above mark price`,
          liquidationVolume: volumeUSDT,
          priceImpact: (priceRatio - 1) * 100,
          confidence: Math.min(95, 50 + (volumeUSDT / 1000) * 10)
        });

        console.log(`Hunter: Triggering SELL for ${liquidation.symbol} at ${liquidation.price}`);
        await this.placeTrade(liquidation.symbol, 'SELL', symbolConfig, liquidation.price);
      }
    } catch (error) {
      console.error('Hunter: Analysis error:', error);
    }
  }

  private async placeTrade(symbol: string, side: 'BUY' | 'SELL', symbolConfig: SymbolConfig, entryPrice: number): Promise<void> {
    // Declare variables that will be used in error handling
    let currentPrice: number = entryPrice;
    let quantity: number = 0;
    let notionalUSDT: number = 0;

    try {
      // Check position limits before placing trade
      if (this.positionTracker && !this.config.global.paperMode) {
        // Check global max positions limit
        const maxPositions = this.config.global.maxOpenPositions || 10;
        const currentPositionCount = this.positionTracker.getUniquePositionCount(this.isHedgeMode);

        if (currentPositionCount >= maxPositions) {
          console.log(`Hunter: Skipping trade - max positions reached (${currentPositionCount}/${maxPositions})`);
          return;
        }

        // Check symbol-specific margin limit
        if (symbolConfig.maxPositionMarginUSDT) {
          const currentMargin = this.positionTracker.getMarginUsage(symbol);
          const newTradeMargin = symbolConfig.tradeSize;
          const totalMargin = currentMargin + newTradeMargin;

          // Enhanced logging to debug margin issues
          console.log(`Hunter: Margin check for ${symbol} - Current: ${currentMargin.toFixed(2)} USDT, New trade: ${newTradeMargin} USDT, Total: ${totalMargin.toFixed(2)} USDT, Max allowed: ${symbolConfig.maxPositionMarginUSDT} USDT`);

          if (totalMargin > symbolConfig.maxPositionMarginUSDT) {
            console.log(`Hunter: Skipping trade - would exceed max margin for ${symbol} (${totalMargin.toFixed(2)}/${symbolConfig.maxPositionMarginUSDT} USDT)`);
            return;
          }
        }
      }

      if (this.config.global.paperMode) {
        console.log(`Hunter: PAPER MODE - Would place ${side} order for ${symbol}, quantity: ${symbolConfig.tradeSize}, leverage: ${symbolConfig.leverage}`);
        this.emit('positionOpened', {
          symbol,
          side,
          quantity: symbolConfig.tradeSize,
          price: entryPrice,
          leverage: symbolConfig.leverage,
          paperMode: true
        });
        return;
      }

      // Determine order type from config (default to LIMIT for better fills)
      let orderType = symbolConfig.orderType || 'LIMIT';
      let orderPrice = entryPrice;

      if (orderType === 'LIMIT') {
        // Calculate optimal limit order price
        const priceOffsetBps = symbolConfig.priceOffsetBps || 1;
        const usePostOnly = symbolConfig.usePostOnly || false;

        const optimalPrice = await calculateOptimalPrice(symbol, side, priceOffsetBps, usePostOnly);
        if (optimalPrice) {
          orderPrice = optimalPrice;

          // Analyze liquidity at this price level
          const targetNotional = symbolConfig.tradeSize * orderPrice;
          const liquidityAnalysis = await analyzeOrderBookDepth(symbol, side, targetNotional);

          if (!liquidityAnalysis.liquidityOk) {
            console.log(`Hunter: Limited liquidity for ${symbol} ${side} - may use market order instead`);
          }

          // Check if optimal price is within acceptable slippage
          const maxSlippageBps = symbolConfig.maxSlippageBps || 50;
          const slippageBps = Math.abs((orderPrice - entryPrice) / entryPrice) * 10000;

          if (slippageBps > maxSlippageBps) {
            console.log(`Hunter: Slippage ${slippageBps.toFixed(1)}bp exceeds max ${maxSlippageBps}bp for ${symbol} - using market order`);
            orderPrice = entryPrice;
            orderType = 'MARKET';
          }
        } else {
          console.log(`Hunter: Could not calculate optimal price for ${symbol} - falling back to market order`);
          orderType = 'MARKET';
        }
      }

      // Fetch symbol info for precision and filters
      const symbolInfo = await getSymbolFilters(symbol);
      if (!symbolInfo) {
        console.error(`Hunter: Could not fetch symbol info for ${symbol}`);
        return;
      }

      // Extract minimum notional from filters
      const minNotionalFilter = symbolInfo.filters.find(f => f.filterType === 'MIN_NOTIONAL');
      const minNotional = minNotionalFilter ? parseFloat(minNotionalFilter.notional || '5') : 5;

      // Fetch current price for quantity calculation first
      if (orderType === 'LIMIT' && orderPrice) {
        // For limit orders, use the order price for calculation
        currentPrice = orderPrice;
      } else {
        // For market orders, fetch the current mark price
        const markPriceData = await getMarkPrice(symbol);
        currentPrice = parseFloat(Array.isArray(markPriceData) ? markPriceData[0].markPrice : markPriceData.markPrice);
      }

      // Calculate proper quantity based on USDT margin value
      // tradeSize is the margin in USDT, multiply by leverage to get notional, then divide by price for quantity
      notionalUSDT = symbolConfig.tradeSize * symbolConfig.leverage;

      // Ensure we meet minimum notional requirement
      if (notionalUSDT < minNotional) {
        console.log(`Hunter: Adjusting notional from ${notionalUSDT} to minimum ${minNotional} for ${symbol}`);
        notionalUSDT = minNotional * 1.01; // Add 1% buffer to ensure we're above minimum
      }

      const calculatedQuantity = notionalUSDT / currentPrice;

      // Round to the symbol's quantity precision
      const quantityPrecision = symbolInfo.quantityPrecision || 8;
      quantity = parseFloat(calculatedQuantity.toFixed(quantityPrecision));

      // Validate order parameters
      if (orderType === 'LIMIT') {
        const validation = await validateOrderParams(symbol, side, orderPrice, quantity);
        if (!validation.valid) {
          console.error(`Hunter: Order validation failed for ${symbol}: ${validation.error}`);
          return;
        }

        // Use adjusted values if provided
        if (validation.adjustedPrice) orderPrice = validation.adjustedPrice;
        if (validation.adjustedQuantity) quantity = validation.adjustedQuantity;
      }

      // Set leverage if needed
      await setLeverage(symbol, symbolConfig.leverage, this.config.api);

      console.log(`Hunter: Calculated quantity for ${symbol}: margin=${symbolConfig.tradeSize} USDT, leverage=${symbolConfig.leverage}x, price=${currentPrice}, notional=${notionalUSDT} USDT, quantity=${quantity}`);

      // Prepare order parameters
      const orderParams: any = {
        symbol,
        side,
        type: orderType,
        quantity,
        positionSide: getPositionSide(this.isHedgeMode, side),
      };

      // Add price for limit orders
      if (orderType === 'LIMIT') {
        orderParams.price = orderPrice;
        orderParams.timeInForce = symbolConfig.usePostOnly ? 'GTX' : 'GTC';
      }

      // Place the order
      const order = await placeOrder(orderParams, this.config.api);

      const displayPrice = orderType === 'LIMIT' ? ` at ${orderPrice}` : '';
      console.log(`Hunter: Placed ${orderType} ${side} order for ${symbol}${displayPrice}, orderId: ${order.orderId}`);

      // Broadcast order placed event
      if (this.statusBroadcaster) {
        this.statusBroadcaster.broadcastOrderPlaced({
          symbol,
          side,
          orderType,
          quantity,
          price: orderType === 'LIMIT' ? orderPrice : undefined,
          orderId: order.orderId?.toString(),
        });
      }

      this.emit('positionOpened', {
        symbol,
        side,
        quantity,
        price: orderType === 'LIMIT' ? orderPrice : entryPrice,
        orderId: order.orderId,
        leverage: symbolConfig.leverage,
        orderType,
        paperMode: false
      });

    } catch (error: any) {
      // Parse the error with context
      const tradingError = parseExchangeError(error, {
        symbol,
        quantity,
        price: currentPrice,
        leverage: symbolConfig.leverage
      });

      // Special handling for specific error types
      if (tradingError instanceof NotionalError) {
        console.error(`Hunter: NOTIONAL ERROR for ${symbol}:`);
        console.error(`  Required: ${tradingError.requiredNotional} USDT`);
        console.error(`  Actual: ${tradingError.actualNotional.toFixed(2)} USDT`);
        console.error(`  Price: ${tradingError.price}`);
        console.error(`  Quantity: ${tradingError.quantity}`);
        console.error(`  Leverage: ${tradingError.leverage}x`);
        console.error(`  Margin used: ${symbolConfig.tradeSize} USDT`);
        console.error(`  This indicates the symbol may have special requirements or price has moved significantly.`);
      } else if (tradingError instanceof RateLimitError) {
        console.error(`Hunter: RATE LIMIT ERROR - Too many requests, please slow down`);
        console.error(`  Consider reducing order frequency or implementing request throttling`);
      } else if (tradingError instanceof InsufficientBalanceError) {
        console.error(`Hunter: INSUFFICIENT BALANCE ERROR for ${symbol}`);
        console.error(`  Check account balance and margin requirements`);
      } else if (tradingError instanceof ReduceOnlyError) {
        console.error(`Hunter: REDUCE ONLY ERROR for ${symbol}`);
        console.error(`  Cannot place reduce-only order when no position exists`);
      } else if (tradingError instanceof PricePrecisionError) {
        console.error(`Hunter: PRICE PRECISION ERROR for ${symbol}`);
        console.error(`  Price ${tradingError.price} doesn't meet tick size requirements`);
      } else if (tradingError instanceof QuantityPrecisionError) {
        console.error(`Hunter: QUANTITY PRECISION ERROR for ${symbol}`);
        console.error(`  Quantity ${tradingError.quantity} doesn't meet step size requirements`);
      } else {
        console.error(`Hunter: Place trade error for ${symbol} (${tradingError.code}):`, tradingError.message);
      }

      // Broadcast the error
      if (this.statusBroadcaster) {
        this.statusBroadcaster.broadcastOrderFailed({
          symbol,
          side,
          reason: tradingError.message,
          details: tradingError.details
        });
      }

      // If limit order fails, try fallback to market order
      if (symbolConfig.orderType !== 'MARKET') {
        console.log(`Hunter: Retrying with market order for ${symbol}`);

        // Declare fallback variables for error handling
        let fallbackQuantity: number = 0;
        let fallbackPrice: number = 0;

        try {
          await setLeverage(symbol, symbolConfig.leverage, this.config.api);

          // Fetch symbol info for precision and filters
          const fallbackSymbolInfo = await getSymbolFilters(symbol);
          if (!fallbackSymbolInfo) {
            console.error(`Hunter: Could not fetch symbol info for fallback order ${symbol}`);
            throw new Error('Symbol info unavailable');
          }

          // Extract minimum notional from filters
          const fallbackMinNotionalFilter = fallbackSymbolInfo.filters.find(f => f.filterType === 'MIN_NOTIONAL');
          const fallbackMinNotional = fallbackMinNotionalFilter ? parseFloat(fallbackMinNotionalFilter.notional || '5') : 5;

          // Fetch current price for fallback market order
          const markPriceData = await getMarkPrice(symbol);
          fallbackPrice = parseFloat(Array.isArray(markPriceData) ? markPriceData[0].markPrice : markPriceData.markPrice);

          // Calculate quantity for fallback order
          let fallbackNotionalUSDT = symbolConfig.tradeSize * symbolConfig.leverage;

          // Ensure we meet minimum notional requirement
          if (fallbackNotionalUSDT < fallbackMinNotional) {
            console.log(`Hunter: Adjusting fallback notional from ${fallbackNotionalUSDT} to minimum ${fallbackMinNotional} for ${symbol}`);
            fallbackNotionalUSDT = fallbackMinNotional * 1.01; // Add 1% buffer
          }

          const fallbackQuantityPrecision = fallbackSymbolInfo.quantityPrecision || 8;
          fallbackQuantity = parseFloat((fallbackNotionalUSDT / fallbackPrice).toFixed(fallbackQuantityPrecision));

          console.log(`Hunter: Fallback calculation for ${symbol}: margin=${symbolConfig.tradeSize} USDT, leverage=${symbolConfig.leverage}x, price=${fallbackPrice}, notional=${fallbackNotionalUSDT} USDT, quantity=${fallbackQuantity}, precision=${fallbackQuantityPrecision}`);

          const fallbackOrder = await placeOrder({
            symbol,
            side,
            type: 'MARKET',
            quantity: fallbackQuantity,
            positionSide: getPositionSide(this.isHedgeMode, side) as 'BOTH' | 'LONG' | 'SHORT',
          }, this.config.api);

          console.log(`Hunter: Fallback market order placed for ${symbol}, orderId: ${fallbackOrder.orderId}`);

          // Broadcast fallback order placed event
          if (this.statusBroadcaster) {
            this.statusBroadcaster.broadcastOrderPlaced({
              symbol,
              side,
              orderType: 'MARKET',
              quantity: fallbackQuantity,
              orderId: fallbackOrder.orderId?.toString(),
            });
          }

          this.emit('positionOpened', {
            symbol,
            side,
            quantity: fallbackQuantity,
            price: entryPrice,
            orderId: fallbackOrder.orderId,
            leverage: symbolConfig.leverage,
            orderType: 'MARKET',
            paperMode: false
          });

        } catch (fallbackError: any) {
          // Parse the fallback error with context
          const fallbackTradingError = parseExchangeError(fallbackError, {
            symbol,
            quantity: fallbackQuantity,
            price: fallbackPrice,
            leverage: symbolConfig.leverage
          });

          if (fallbackTradingError instanceof NotionalError) {
            console.error(`Hunter: CRITICAL NOTIONAL ERROR in fallback for ${symbol}:`);
            console.error(`  Required: ${fallbackTradingError.requiredNotional} USDT`);
            console.error(`  Actual: ${fallbackTradingError.actualNotional.toFixed(2)} USDT`);
            console.error(`  Price: ${fallbackTradingError.price}`);
            console.error(`  Quantity: ${fallbackTradingError.quantity}`);
            console.error(`  Even with adjustments, notional requirement not met!`);
            console.error(`  Check if symbol has special requirements or if price data is stale.`);
          } else if (fallbackTradingError instanceof RateLimitError) {
            console.error(`Hunter: RATE LIMIT in fallback - backing off`);
          } else if (fallbackTradingError instanceof InsufficientBalanceError) {
            console.error(`Hunter: INSUFFICIENT BALANCE in fallback for ${symbol}`);
          } else {
            console.error(`Hunter: Fallback order failed for ${symbol} (${fallbackTradingError.code}):`, fallbackTradingError.message);
          }

          // Broadcast fallback order failed event
          if (this.statusBroadcaster) {
            this.statusBroadcaster.broadcastOrderFailed({
              symbol,
              side,
              reason: fallbackTradingError.message,
              details: fallbackTradingError.details,
            });
          }
        }
      }
    }
  }

  private simulateLiquidations(): void {
    // Simulate liquidation events for paper mode testing
    const symbols = Object.keys(this.config.symbols);
    if (symbols.length === 0) {
      console.log('Hunter: No symbols configured for simulation');
      return;
    }

    // Generate random liquidation events every 5-10 seconds
    const generateEvent = () => {
      if (!this.isRunning) return;

      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const side = Math.random() > 0.5 ? 'SELL' : 'BUY';
      const price = symbol === 'BTCUSDT' ? 40000 + Math.random() * 5000 : 2000 + Math.random() * 500;
      const qty = Math.random() * 10;

      const mockEvent = {
        o: {
          s: symbol,
          S: side,
          p: price.toString(),
          q: qty.toString(),
          T: Date.now()
        }
      };

      console.log(`Hunter: Simulated liquidation - ${symbol} ${side} ${qty.toFixed(4)} @ $${price.toFixed(2)}`);
      this.handleLiquidationEvent(mockEvent);

      // Schedule next event
      const delay = 5000 + Math.random() * 5000; // 5-10 seconds
      setTimeout(generateEvent, delay);
    };

    // Start generating events after 2 seconds
    setTimeout(generateEvent, 2000);
  }
}
