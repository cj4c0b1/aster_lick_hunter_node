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
    this.connectWebSocket();
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
      qty: parseFloat(event.o.q),
      price: parseFloat(event.o.p),
      time: event.E,
    };

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
      const triggerBuy = liquidation.side === 'SELL' && liquidation.price / markPrice < 1.01; // 1% below
      const triggerSell = liquidation.side === 'BUY' && liquidation.price / markPrice > 0.99;  // 1% above

      if (triggerBuy) {
        console.log(`Hunter: Triggering BUY for ${liquidation.symbol} at ${liquidation.price}`);
        await this.placeTrade(liquidation.symbol, 'BUY', symbolConfig, liquidation.price);
      } else if (triggerSell) {
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
        this.emit('new_position', { symbol, side, quantity: symbolConfig.tradeSize });
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

      this.emit('new_position', { symbol, side, quantity: symbolConfig.tradeSize, orderId: order.orderId });
    } catch (error) {
      console.error(`Hunter: Place trade error for ${symbol}:`, error);
    }
  }
}
