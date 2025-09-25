import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Config, LiquidationEvent, SymbolConfig } from '../types';
import { getExchangeInfo, getMarkPrice, getKlines } from '../api/market';
import { placeOrder, setLeverage } from '../api/orders';

export class Hunter extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Config;
  private isRunning = false;

  constructor(config: Config) {
    super();
    this.config = config;
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
    if (volumeUSDT < symbolConfig.volumeThresholdUSDT) return; // Too small

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
    try {
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

      // Get current balance or available
      // Assume can place - in real, check balance

      // Set leverage if needed (assuming not set)
      await setLeverage(symbol, symbolConfig.leverage, this.config.api);

      // Place market order
      const order = await placeOrder({
        symbol,
        side,
        type: 'MARKET',
        quantity: symbolConfig.tradeSize,
        positionSide: 'BOTH', // Adjust for hedge if needed
      }, this.config.api);

      console.log(`Hunter: Placed ${side} order for ${symbol}, orderId: ${order.orderId}`);

      this.emit('positionOpened', {
        symbol,
        side,
        quantity: symbolConfig.tradeSize,
        price: entryPrice,
        orderId: order.orderId,
        leverage: symbolConfig.leverage,
        paperMode: false
      });
    } catch (error) {
      console.error(`Hunter: Place trade error for ${symbol}:`, error);
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
