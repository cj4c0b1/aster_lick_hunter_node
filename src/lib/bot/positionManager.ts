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

  constructor(config: Config) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('PositionManager: Starting...');

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
    // Start stream: POST /fapi/v1/listenKey
    const response: AxiosResponse = await axios.post(`${BASE_URL}/fapi/v1/listenKey`);
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
      await axios.put(`${BASE_URL}/fapi/v1/listenKey`);
      console.log('PositionManager: Keepalive sent');
    } catch (error) {
      console.error('PositionManager: Keepalive error:', error);
    }
  }

  private async closeUserDataStream(): Promise<void> {
    if (!this.listenKey) return;
    try {
      await axios.delete(`${BASE_URL}/fapi/v1/listenKey`);
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
    // Emit updated positions or something
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
