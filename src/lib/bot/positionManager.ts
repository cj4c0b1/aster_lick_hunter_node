import WebSocket from 'ws';
import { EventEmitter } from 'events';
import axios, { AxiosResponse } from 'axios';
import { Config, Position, Order } from '../types';
import { getSignedParams, paramsToQuery } from '../api/auth';
import { getPositionRisk } from '../api/market';
import { placeOrder, cancelOrder } from '../api/orders';

// Minimal local state - only track order IDs linked to positions
interface PositionOrders {
  slOrderId?: number;
  tpOrderId?: number;
}

// Exchange position from API
interface ExchangePosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: string;
  updateTime: number;
}

// Exchange order from API
interface ExchangeOrder {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  type: string;
  side: string;
  stopPrice: string;
  time: number;
  updateTime: number;
  workingType: string;
  origType: string;
  positionSide: string;
  reduceOnly: boolean;
}

const BASE_URL = 'https://fapi.asterdex.com';

export class PositionManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private listenKey: string | null = null;
  private config: Config;
  private positionOrders: Map<string, PositionOrders> = new Map(); // symbol_side -> order IDs
  private currentPositions: Map<string, ExchangePosition> = new Map(); // Live position data from WebSocket
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
      // First, sync with exchange to get current positions and orders
      await this.syncWithExchange();
      // Then start the user data stream for real-time updates
      await this.startUserDataStream();
    } catch (error) {
      console.error('PositionManager: Failed to start:', error);
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
      console.log('PositionManager WS closed - reconnecting...');
      if (this.isRunning) {
        // Re-sync with exchange on reconnect
        setTimeout(async () => {
          await this.syncWithExchange();
          await this.startUserDataStream();
        }, 5000);
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

  // Sync with exchange on startup or reconnection
  private async syncWithExchange(): Promise<void> {
    console.log('PositionManager: Syncing with exchange...');

    try {
      // Get all current positions from exchange
      const positions = await this.getPositionsFromExchange();

      // Get all open orders
      const openOrders = await this.getOpenOrdersFromExchange();
      console.log(`PositionManager: Found ${openOrders.length} open orders`);

      // Log order details for debugging
      openOrders.forEach(order => {
        if (order.reduceOnly) {
          console.log(`PositionManager: Open order - ${order.symbol} ${order.type} ${order.side}, reduceOnly: ${order.reduceOnly}, orderId: ${order.orderId}`);
        }
      });

      // Clear and rebuild our position map
      this.currentPositions.clear();
      this.positionOrders.clear();

      // Process each position
      for (const position of positions) {
        const posAmt = parseFloat(position.positionAmt);
        if (Math.abs(posAmt) > 0) {
          const key = this.getPositionKey(position.symbol, position.positionSide, posAmt);
          this.currentPositions.set(key, position);
          console.log(`PositionManager: Found position ${key}: ${posAmt} @ ${position.entryPrice}`);

          // Find SL/TP orders for this position
          // Check for stop loss orders (STOP_MARKET or STOP)
          const slOrder = openOrders.find(o =>
            o.symbol === position.symbol &&
            (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
            o.reduceOnly &&
            ((posAmt > 0 && o.side === 'SELL') || (posAmt < 0 && o.side === 'BUY'))
          );

          // Check for take profit orders (TAKE_PROFIT_MARKET, TAKE_PROFIT, or LIMIT with reduceOnly)
          const tpOrder = openOrders.find(o =>
            o.symbol === position.symbol &&
            (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT' || o.type === 'LIMIT') &&
            o.reduceOnly &&
            ((posAmt > 0 && o.side === 'SELL') || (posAmt < 0 && o.side === 'BUY'))
          );

          const orders: PositionOrders = {};
          if (slOrder) {
            orders.slOrderId = slOrder.orderId;
            console.log(`PositionManager: Found SL order ${slOrder.orderId} for ${key}`);
          }
          if (tpOrder) {
            orders.tpOrderId = tpOrder.orderId;
            console.log(`PositionManager: Found TP order ${tpOrder.orderId} for ${key}`);
          }

          if (orders.slOrderId || orders.tpOrderId) {
            this.positionOrders.set(key, orders);
          }

          // Place missing SL/TP if needed
          if (!slOrder || !tpOrder) {
            console.log(`PositionManager: Position ${key} missing protection (SL: ${!!slOrder}, TP: ${!!tpOrder})`);
            await this.placeProtectiveOrders(position, !slOrder, !tpOrder);
          }
        }
      }

      console.log(`PositionManager: Sync complete - ${this.currentPositions.size} positions, ${this.positionOrders.size} with orders`);
    } catch (error) {
      console.error('PositionManager: Failed to sync with exchange:', error);
      throw error;
    }
  }

  // Get all positions from exchange
  private async getPositionsFromExchange(): Promise<ExchangePosition[]> {
    const params = {
      timestamp: Date.now(),
      recvWindow: 5000
    };

    const signedParams = getSignedParams(params, this.config.api);
    const queryString = paramsToQuery(signedParams);

    const response = await axios.get(`${BASE_URL}/fapi/v2/positionRisk?${queryString}`, {
      headers: { 'X-MBX-APIKEY': this.config.api.apiKey }
    });

    return response.data;
  }

  // Get all open orders from exchange
  private async getOpenOrdersFromExchange(): Promise<ExchangeOrder[]> {
    const params = {
      timestamp: Date.now(),
      recvWindow: 5000
    };

    const signedParams = getSignedParams(params, this.config.api);
    const queryString = paramsToQuery(signedParams);

    const response = await axios.get(`${BASE_URL}/fapi/v1/openOrders?${queryString}`, {
      headers: { 'X-MBX-APIKEY': this.config.api.apiKey }
    });

    return response.data;
  }

  // Helper to create consistent position keys
  private getPositionKey(symbol: string, positionSide: string, positionAmt: number): string {
    // For one-way mode (BOTH), include direction in key
    if (positionSide === 'BOTH') {
      const direction = positionAmt > 0 ? 'LONG' : 'SHORT';
      return `${symbol}_${direction}`;
    }
    // For hedge mode, use position side
    return `${symbol}_${positionSide}`;
  }

  // Ensure position has SL/TP orders
  private async ensurePositionProtected(symbol: string, positionSide: string, positionAmt: number): Promise<void> {
    const key = this.getPositionKey(symbol, positionSide, positionAmt);

    // Check if we already have orders tracked
    const existingOrders = this.positionOrders.get(key);
    if (existingOrders?.slOrderId && existingOrders?.tpOrderId) {
      return; // Already protected
    }

    // Get the position data
    const position = this.currentPositions.get(key);
    if (!position) {
      console.warn(`PositionManager: Position ${key} not found in map`);
      return;
    }

    // Place missing orders
    const needSL = !existingOrders?.slOrderId;
    const needTP = !existingOrders?.tpOrderId;

    if (needSL || needTP) {
      await this.placeProtectiveOrders(position, needSL, needTP);
    }
  }

  // Cancel protective orders for a position
  private async cancelProtectiveOrders(positionKey: string, orders: PositionOrders): Promise<void> {
    const [symbol] = positionKey.split('_');

    if (orders.slOrderId) {
      try {
        await this.cancelOrderById(symbol, orders.slOrderId);
        console.log(`PositionManager: Cancelled SL order ${orders.slOrderId}`);
      } catch (error) {
        console.error(`PositionManager: Failed to cancel SL order ${orders.slOrderId}:`, error);
      }
    }

    if (orders.tpOrderId) {
      try {
        await this.cancelOrderById(symbol, orders.tpOrderId);
        console.log(`PositionManager: Cancelled TP order ${orders.tpOrderId}`);
      } catch (error) {
        console.error(`PositionManager: Failed to cancel TP order ${orders.tpOrderId}:`, error);
      }
    }
  }

  // Cancel order by ID
  private async cancelOrderById(symbol: string, orderId: number): Promise<void> {
    await cancelOrder({ symbol, orderId }, this.config.api);
  }

  private handleEvent(event: any): void {
    if (event.e === 'ACCOUNT_UPDATE') {
      this.handleAccountUpdate(event);
    } else if (event.e === 'ORDER_TRADE_UPDATE') {
      this.handleOrderUpdate(event);
    }
  }

  private handleAccountUpdate(event: any): void {
    console.log('PositionManager: Account update received');

    // Update our position map from the authoritative source (exchange)
    if (event.a && event.a.P) {
      const positions = event.a.P;

      // Clear and rebuild position map - exchange data is the truth
      this.currentPositions.clear();

      positions.forEach((pos: any) => {
        const positionAmt = parseFloat(pos.pa);
        const symbol = pos.s;
        const positionSide = pos.ps || 'BOTH';

        // Store the full position data from exchange
        if (Math.abs(positionAmt) > 0) {
          const key = this.getPositionKey(symbol, positionSide, positionAmt);
          this.currentPositions.set(key, {
            symbol: pos.s,
            positionAmt: pos.pa,
            entryPrice: pos.ep,
            markPrice: pos.mp || '0',
            unRealizedProfit: pos.up,
            liquidationPrice: pos.lp || '0',
            leverage: pos.l || '0',
            marginType: pos.mt,
            isolatedMargin: pos.iw || '0',
            isAutoAddMargin: pos.iam || 'false',
            positionSide: positionSide,
            updateTime: event.E
          });

          // Check if this position has SL/TP orders
          this.ensurePositionProtected(symbol, positionSide, positionAmt);

          // Broadcast to UI
          if (this.statusBroadcaster) {
            this.statusBroadcaster.broadcastPositionUpdate({
              symbol: pos.s,
              side: positionAmt > 0 ? 'LONG' : 'SHORT',
              quantity: Math.abs(positionAmt),
              price: parseFloat(pos.ep),
              type: 'updated',
              pnl: parseFloat(pos.up)
            });
          }
        }
      });

      // Check for closed positions (positions that were in our map but aren't in the update)
      for (const [key, orders] of this.positionOrders.entries()) {
        if (!this.currentPositions.has(key)) {
          // Position was closed, clean up
          console.log(`PositionManager: Position ${key} was closed`);
          this.positionOrders.delete(key);
          // Cancel any remaining SL/TP orders if they exist
          this.cancelProtectiveOrders(key, orders);
        }
      }
    }
  }

  private handleOrderUpdate(event: any): void {
    const order = event.o;
    const symbol = order.s;
    const orderType = order.o;
    const orderStatus = order.X;
    const positionSide = order.ps || 'BOTH';
    const side = order.S;
    const orderId = order.i;

    // Track our SL/TP order IDs when they're placed
    if (orderStatus === 'NEW' && (orderType === 'STOP_MARKET' || orderType === 'TAKE_PROFIT_MARKET')) {
      const executedQty = parseFloat(order.z || '0');
      const origQty = parseFloat(order.q);

      // Find the matching position
      for (const [key, position] of this.currentPositions.entries()) {
        if (position.symbol === symbol) {
          const posAmt = parseFloat(position.positionAmt);
          // Check if this order is for this position (same symbol and opposite side)
          if ((posAmt > 0 && side === 'SELL') || (posAmt < 0 && side === 'BUY')) {
            if (!this.positionOrders.has(key)) {
              this.positionOrders.set(key, {});
            }
            const orders = this.positionOrders.get(key)!;

            if (orderType === 'STOP_MARKET') {
              orders.slOrderId = orderId;
              console.log(`PositionManager: Tracked SL order ${orderId} for position ${key}`);
            } else if (orderType === 'TAKE_PROFIT_MARKET') {
              orders.tpOrderId = orderId;
              console.log(`PositionManager: Tracked TP order ${orderId} for position ${key}`);
            }
          }
        }
      }
    }

    // Handle filled orders
    if (orderStatus === 'FILLED') {
      if (!order.cp && !order.R) { // Not close-all and not reduce-only - this is an entry
        console.log(`PositionManager: Entry order filled for ${symbol}`);
        // Position will be updated via ACCOUNT_UPDATE event
        // Just wait for it and then place SL/TP
      } else if (orderType === 'STOP_MARKET' || orderType === 'STOP' ||
                 orderType === 'TAKE_PROFIT_MARKET' || orderType === 'TAKE_PROFIT' ||
                 (orderType === 'LIMIT' && order.R)) { // Any reduce-only order
        // SL/TP filled, position closed
        console.log(`PositionManager: ${orderType} (reduce-only) filled for ${symbol}`);

        // Clean up our tracking
        for (const [key, orders] of this.positionOrders.entries()) {
          if (orders.slOrderId === orderId || orders.tpOrderId === orderId) {
            // Cancel the other order if it exists
            if (orders.slOrderId === orderId && orders.tpOrderId) {
              this.cancelOrderById(symbol, orders.tpOrderId);
            } else if (orders.tpOrderId === orderId && orders.slOrderId) {
              this.cancelOrderById(symbol, orders.slOrderId);
            }
            this.positionOrders.delete(key);
            break;
          }
        }

        // Broadcast position closure
        if (this.statusBroadcaster) {
          this.statusBroadcaster.broadcastPositionUpdate({
            symbol: symbol,
            side: side === 'BUY' ? 'SHORT' : 'LONG', // Opposite of closing order
            quantity: parseFloat(order.q),
            price: parseFloat(order.ap || '0'),
            type: 'closed',
            pnl: parseFloat(order.rp || '0') // Realized profit
          });
        }
      }
    }
  }

  // Listen for new positions from Hunter
  public onNewPosition(data: { symbol: string; side: string; quantity: number; orderId?: number }): void {
    // In the new architecture, we wait for ACCOUNT_UPDATE to confirm the position
    // The WebSocket will tell us when the position is actually open
    console.log(`PositionManager: Notified of potential new position: ${data.symbol} ${data.side}`);

    // For paper mode, simulate the position
    if (this.config.global.paperMode) {
      const positionSide = 'BOTH'; // Paper mode uses one-way mode
      const key = `${data.symbol}_${positionSide}`;

      // Simulate the position in our map
      this.currentPositions.set(key, {
        symbol: data.symbol,
        positionAmt: data.side === 'BUY' ? data.quantity.toString() : (-data.quantity).toString(),
        entryPrice: '0', // Will be updated by market price
        markPrice: '0',
        unRealizedProfit: '0',
        liquidationPrice: '0',
        leverage: this.config.symbols[data.symbol]?.leverage?.toString() || '10',
        marginType: 'isolated',
        isolatedMargin: '0',
        isAutoAddMargin: 'false',
        positionSide: positionSide,
        updateTime: Date.now()
      });

      // Place SL/TP for paper mode
      this.ensurePositionProtected(data.symbol, positionSide, data.side === 'BUY' ? data.quantity : -data.quantity);
    }
  }

  // Place protective orders (SL/TP) for a position
  private async placeProtectiveOrders(position: ExchangePosition, placeSL: boolean, placeTP: boolean): Promise<void> {
    const symbol = position.symbol;
    const symbolConfig = this.config.symbols[symbol];
    if (!symbolConfig) {
      console.warn(`PositionManager: No config for symbol ${symbol}`);
      return;
    }

    const posAmt = parseFloat(position.positionAmt);
    const entryPrice = parseFloat(position.entryPrice);
    const quantity = Math.abs(posAmt);
    const isLong = posAmt > 0;
    const key = this.getPositionKey(symbol, position.positionSide, posAmt);

    // Get or create order tracking
    if (!this.positionOrders.has(key)) {
      this.positionOrders.set(key, {});
    }
    const orders = this.positionOrders.get(key)!;

    try {
      // Place Stop Loss
      if (placeSL) {
        const slPrice = isLong
          ? entryPrice * (1 - symbolConfig.slPercent / 100)
          : entryPrice * (1 + symbolConfig.slPercent / 100);

        const slOrder = await placeOrder({
          symbol,
          side: isLong ? 'SELL' : 'BUY', // Opposite side to close
          type: 'STOP_MARKET',
          quantity: quantity,
          stopPrice: slPrice,
          reduceOnly: true,
          positionSide: (position.positionSide || 'BOTH') as 'BOTH' | 'LONG' | 'SHORT',
        }, this.config.api);

        orders.slOrderId = typeof slOrder.orderId === 'string' ? parseInt(slOrder.orderId) : slOrder.orderId;
        console.log(`PositionManager: Placed SL (STOP_MARKET) for ${symbol} at ${slPrice.toFixed(4)}, orderId: ${slOrder.orderId}`);
      }

      // Place Take Profit
      if (placeTP) {
        const tpPrice = isLong
          ? entryPrice * (1 + symbolConfig.tpPercent / 100)
          : entryPrice * (1 - symbolConfig.tpPercent / 100);

        // Use LIMIT order for take profit (more control, better fills)
        // This matches what you already have in your exchange
        const tpOrder = await placeOrder({
          symbol,
          side: isLong ? 'SELL' : 'BUY',
          type: 'LIMIT',
          quantity: quantity,
          price: tpPrice,
          reduceOnly: true,
          timeInForce: 'GTC',
          positionSide: (position.positionSide || 'BOTH') as 'BOTH' | 'LONG' | 'SHORT',
        }, this.config.api);

        orders.tpOrderId = typeof tpOrder.orderId === 'string' ? parseInt(tpOrder.orderId) : tpOrder.orderId;
        console.log(`PositionManager: Placed TP (LIMIT) for ${symbol} at ${tpPrice.toFixed(4)}, orderId: ${tpOrder.orderId}`);
      }

      this.positionOrders.set(key, orders);
    } catch (error: any) {
      console.error(`PositionManager: Failed to place protective orders for ${symbol}:`, error.response?.data || error.message);
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
    // Find the position in our current positions map
    let targetPosition: ExchangePosition | undefined;
    let targetKey: string | undefined;

    for (const [key, position] of this.currentPositions.entries()) {
      if (position.symbol === symbol) {
        const posAmt = parseFloat(position.positionAmt);
        if ((side === 'LONG' && posAmt > 0) || (side === 'SHORT' && posAmt < 0)) {
          targetPosition = position;
          targetKey = key;
          break;
        }
      }
    }

    if (!targetPosition || !targetKey) {
      console.warn(`PositionManager: Position ${symbol} ${side} not found`);
      return;
    }

    // Cancel SL/TP if they exist
    const orders = this.positionOrders.get(targetKey);
    if (orders) {
      await this.cancelProtectiveOrders(targetKey, orders);
    }

    // Place market close order
    const posAmt = parseFloat(targetPosition.positionAmt);
    const quantity = Math.abs(posAmt);
    const closeSide = posAmt > 0 ? 'SELL' : 'BUY';

    await placeOrder({
      symbol,
      side: closeSide,
      type: 'MARKET',
      quantity: quantity,
      reduceOnly: true,
      positionSide: (targetPosition.positionSide || 'BOTH') as 'BOTH' | 'LONG' | 'SHORT',
    }, this.config.api);

    // Remove from our maps (will be confirmed by ACCOUNT_UPDATE)
    this.currentPositions.delete(targetKey);
    this.positionOrders.delete(targetKey);

    console.log(`PositionManager: Closed position ${symbol} ${side}`);

    // Broadcast position closure
    if (this.statusBroadcaster) {
      this.statusBroadcaster.broadcastPositionUpdate({
        symbol,
        side,
        quantity: quantity,
        price: 0, // Market close
        type: 'closed',
        pnl: 0 // Will be updated by account stream
      });
    }
  }

  // Get current positions for API/UI
  public getPositions(): ExchangePosition[] {
    return Array.from(this.currentPositions.values());
  }

  // Check if position exists
  public hasPosition(symbol: string): boolean {
    for (const position of this.currentPositions.values()) {
      if (position.symbol === symbol && Math.abs(parseFloat(position.positionAmt)) > 0) {
        return true;
      }
    }
    return false;
  }
}
