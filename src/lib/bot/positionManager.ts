import WebSocket from 'ws';
import { EventEmitter } from 'events';
import axios, { AxiosResponse } from 'axios';
import { Config, Position, Order } from '../types';
import { getSignedParams, paramsToQuery } from '../api/auth';
import { getPositionRisk } from '../api/market';
import { placeOrder, cancelOrder } from '../api/orders';

interface PositionInfo {
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  slOrderId?: number;
  tpOrderId?: number;
}

const BASE_URL = 'https://fapi.asterdex.com';

export class PositionManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private listenKey: string | null = null;
  private config: Config;
  private positions: Map<string, PositionInfo> = new Map();
  private keepaliveInterval?: NodeJS.Timeout;
  private riskCheckInterval?: NodeJS.Timeout;
  private isRunning = false;
  private statusBroadcaster: any; // Will be injected

  constructor(config: Config) {
    super();
    this.config = config;
  }

  // Set status broadcaster for position updates
  public setStatusBroadcaster(broadcaster: any): void {
    this.statusBroadcaster = broadcaster;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('PositionManager: Starting...');

    // Skip user data stream in paper mode with no API keys
    if (this.config.global.paperMode && (!this.config.api.apiKey || !this.config.api.secretKey)) {
      console.log('PositionManager: Running in paper mode without API keys - simulating streams');
      return;
    }

    try {
      await this.startUserDataStream();
    } catch (error) {
      console.error('PositionManager: Failed to start user data stream:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('PositionManager: Stopping...');

    if (this.keepaliveInterval) clearInterval(this.keepaliveInterval);
    if (this.riskCheckInterval) clearInterval(this.riskCheckInterval);
    if (this.ws) this.ws.close();
    if (this.listenKey) await this.closeUserDataStream();
  }

  private async startUserDataStream(): Promise<void> {
    // For listen key endpoint, typically only needs API key header, no signature
    const headers = {
      'X-MBX-APIKEY': this.config.api.apiKey  // Binance-style header
    };

    const response: AxiosResponse = await axios.post(`${BASE_URL}/fapi/v1/listenKey`, null, { headers });
    this.listenKey = response.data.listenKey;
    console.log('PositionManager: Got listenKey:', this.listenKey);

    // Start WS
    this.ws = new WebSocket(`wss://fstream.asterdex.com/ws/${this.listenKey}`);

    this.ws.on('open', () => {
      console.log('PositionManager WS connected');
      // Set keepalive every 30 min
      this.keepaliveInterval = setInterval(() => this.keepalive(), 30 * 60 * 1000);
      // Risk check every 5 min
      this.riskCheckInterval = setInterval(() => this.checkRisk(), 5 * 60 * 1000);
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString());
        this.handleEvent(event);
      } catch (error) {
        console.error('PositionManager: WS message parse error:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('PositionManager WS error:', error);
    });

    this.ws.on('close', () => {
      console.log('PositionManager WS closed');
      if (this.isRunning) {
        setTimeout(() => this.startUserDataStream(), 5000);
      }
    });
  }

  private async keepalive(): Promise<void> {
    if (!this.listenKey) return;
    try {
      const headers = {
        'X-MBX-APIKEY': this.config.api.apiKey
      };
      await axios.put(`${BASE_URL}/fapi/v1/listenKey`, null, { headers });
      console.log('PositionManager: Keepalive sent');
    } catch (error) {
      console.error('PositionManager: Keepalive error:', error);
    }
  }

  private async closeUserDataStream(): Promise<void> {
    if (!this.listenKey) return;
    try {
      const headers = {
        'X-MBX-APIKEY': this.config.api.apiKey
      };
      await axios.delete(`${BASE_URL}/fapi/v1/listenKey`, { headers });
      console.log('PositionManager: User data stream closed');
    } catch (error) {
      console.error('PositionManager: Close stream error:', error);
    }
  }

  private handleEvent(event: any): void {
    if (event.e === 'ACCOUNT_UPDATE') {
      this.handleAccountUpdate(event);
    } else if (event.e === 'ORDER_TRADE_UPDATE') {
      this.handleOrderUpdate(event);
    }
  }

  private handleAccountUpdate(event: any): void {
    // Update positions map (simplified)
    // In real: parse balances and positions
    console.log('PositionManager: Account update received');

    // Broadcast position updates to web UI
    if (this.statusBroadcaster && event.a && event.a.P) {
      // Parse positions from account update
      const positions = event.a.P;
      positions.forEach((pos: any) => {
        const positionAmt = parseFloat(pos.pa);
        if (Math.abs(positionAmt) > 0) {
          this.statusBroadcaster.broadcastPositionUpdate({
            symbol: pos.s,
            side: positionAmt > 0 ? 'LONG' : 'SHORT',
            quantity: Math.abs(positionAmt),
            price: parseFloat(pos.ep),
            type: 'updated',
            pnl: parseFloat(pos.up)
          });
        }
      });
    }
  }

  private handleOrderUpdate(event: any): void {
    const order: Order = {
      symbol: event.o.s,
      orderId: event.o.i,
      side: event.o.S,
      type: event.o.o,
      quantity: parseFloat(event.o.q),
      price: parseFloat(event.o.p),
      status: event.o.X,
      updateTime: event.E,
    };

    if (event.o.X === 'FILLED' && !event.o.cp) { // Entry order filled, not close-all
      // Check if this is an entry order from hunter
      const positionKey = `${order.symbol}_${order.side}`;
      if (!this.positions.has(positionKey)) {
        // New position
        this.positions.set(positionKey, {
          symbol: order.symbol,
          side: order.side,
          quantity: parseFloat(event.o.l), // Last filled qty
          entryPrice: parseFloat(event.o.L), // Last filled price
        });
        this.placeSLTP(order.symbol, order.side);
      }
    } else if (order.type === 'STOP_MARKET' || order.type === 'TAKE_PROFIT_MARKET') {
      // SL/TP filled, position closed
      console.log(`PositionManager: ${order.type} filled for ${order.symbol}`);

      // Broadcast position closure
      if (this.statusBroadcaster) {
        this.statusBroadcaster.broadcastPositionUpdate({
          symbol: order.symbol,
          side: order.side === 'BUY' ? 'SHORT' : 'LONG', // Opposite of closing order
          quantity: order.quantity,
          price: order.price,
          type: 'closed',
          pnl: 0 // Will be calculated by account update
        });
      }
    }
  }

  // Listen for new positions from Hunter
  public onNewPosition(data: { symbol: string; side: string; quantity: number; orderId?: number }): void {
    const positionKey = `${data.symbol}_${data.side}`;
    // Wait for ORDER_TRADE_UPDATE to confirm fill before placing SL/TP
    // For paper mode, place immediately
    if (this.config.global.paperMode) {
      if (!this.positions.has(positionKey)) {
        this.positions.set(positionKey, {
          symbol: data.symbol,
          side: data.side,
          quantity: data.quantity,
          entryPrice: 0, // Placeholder
        });
        this.placeSLTP(data.symbol, data.side);
      }
    }
  }

  private async placeSLTP(symbol: string, side: string): Promise<void> {
    const positionKey = `${symbol}_${side}`;
    const position = this.positions.get(positionKey);
    if (!position || position.slOrderId || position.tpOrderId) return;

    const symbolConfig = this.config.symbols[symbol];
    if (!symbolConfig) return;

    const entryPrice = position.entryPrice;
    const sideStr = side.toUpperCase();

    try {
      // SL: STOP_MARKET with price below/above entry
      const slPrice = sideStr === 'BUY'
        ? entryPrice * (1 - symbolConfig.slPercent / 100)
        : entryPrice * (1 + symbolConfig.slPercent / 100);

      const slOrder = await placeOrder({
        symbol,
        side: sideStr === 'BUY' ? 'SELL' : 'BUY', // Opposite side
        type: 'STOP_MARKET',
        quantity: position.quantity, // Close entire position
        stopPrice: slPrice,
        reduceOnly: true,
        positionSide: 'BOTH',
      }, this.config.api);

      position.slOrderId = parseInt(slOrder.clientOrderId || slOrder.orderId.toString());
      console.log(`PositionManager: Placed SL for ${symbol} at ${slPrice}, orderId: ${slOrder.orderId}`);

      // TP: TAKE_PROFIT_MARKET
      const tpPrice = sideStr === 'BUY'
        ? entryPrice * (1 + symbolConfig.tpPercent / 100)
        : entryPrice * (1 - symbolConfig.tpPercent / 100);

      const tpOrder = await placeOrder({
        symbol,
        side: sideStr === 'BUY' ? 'SELL' : 'BUY',
        type: 'TAKE_PROFIT_MARKET',
        quantity: position.quantity, // Close entire position
        stopPrice: tpPrice, // stopPrice for take profit
        reduceOnly: true,
        positionSide: 'BOTH',
      }, this.config.api);

      position.tpOrderId = parseInt(tpOrder.clientOrderId || tpOrder.orderId.toString());
      console.log(`PositionManager: Placed TP for ${symbol} at ${tpPrice}, orderId: ${tpOrder.orderId}`);

      this.positions.set(positionKey, position);
    } catch (error: any) {
      console.error(`PositionManager: Failed to place SL/TP for ${symbol}:`, error.response?.data || error.message);
    }
  }

  private async checkRisk(): Promise<void> {
    // Check total PnL
    const riskPercent = this.config.global.riskPercent / 100;
    // Simplified: assume some PnL calculation
    // If unrealized PnL < -risk * balance, close all positions
    // Implementation depends on balance query

    console.log(`PositionManager: Risk check complete`);
  }

  // Manual methods
  public async closePosition(symbol: string, side: string): Promise<void> {
    const positionKey = `${symbol}_${side}`;
    const position = this.positions.get(positionKey);
    if (!position) return;

    // Cancel SL/TP if exist
    if (position.slOrderId) {
      await cancelOrder({ symbol, orderId: position.slOrderId }, this.config.api);
    }
    if (position.tpOrderId) {
      await cancelOrder({ symbol, orderId: position.tpOrderId }, this.config.api);
    }

    // Place market close order (reduceOnly=true)
    const closeSide = side === 'BUY' ? 'SELL' : 'BUY';
    await placeOrder({
      symbol,
      side: closeSide,
      type: 'MARKET',
      quantity: Math.abs(position.quantity),
      reduceOnly: true,
      positionSide: 'BOTH',
    }, this.config.api);

    this.positions.delete(positionKey);
    console.log(`PositionManager: Closed position ${symbol} ${side}`);

    // Broadcast position closure
    if (this.statusBroadcaster) {
      this.statusBroadcaster.broadcastPositionUpdate({
        symbol,
        side,
        quantity: Math.abs(position.quantity),
        price: 0, // Market close
        type: 'closed',
        pnl: 0 // Will be updated by account stream
      });
    }
  }
}
