import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { LiquidationEvent } from '../lib/types';

export interface BotStatus {
  isRunning: boolean;
  paperMode: boolean;
  uptime: number;
  startTime: Date | null;
  lastActivity: Date | null;
  symbols: string[];
  positionsOpen: number;
  totalPnL: number;
  errors: string[];
}

export class StatusBroadcaster extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private status: BotStatus = {
    isRunning: false,
    paperMode: true,
    uptime: 0,
    startTime: null,
    lastActivity: null,
    symbols: [],
    positionsOpen: 0,
    totalPnL: 0,
    errors: [],
  };
  private uptimeInterval: NodeJS.Timeout | null = null;

  constructor(private port: number = 8081) {
    super();
  }

  async start(): Promise<void> {
    try {
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on('connection', (ws: WebSocket) => {
        console.log('📱 Web UI connected to bot');
        this.clients.add(ws);

        // Send initial status
        ws.send(JSON.stringify({
          type: 'status',
          data: this.status,
        }));

        ws.on('close', () => {
          console.log('📱 Web UI disconnected');
          this.clients.delete(ws);
        });

        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.clients.delete(ws);
        });

        // Handle ping/pong for keep-alive
        ws.on('ping', () => ws.pong());
      });

      // Update uptime every second
      this.uptimeInterval = setInterval(() => {
        if (this.status.isRunning && this.status.startTime) {
          this.status.uptime = Date.now() - this.status.startTime.getTime();
          this._broadcast('status', this.status);
        }
      }, 1000);

      console.log(`📡 WebSocket server running on port ${this.port}`);
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
    }
  }

  stop(): void {
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
    }

    this.clients.forEach(client => {
      client.close();
    });

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  updateStatus(updates: Partial<BotStatus>): void {
    this.status = { ...this.status, ...updates };
    this._broadcast('status', this.status);
  }

  setRunning(isRunning: boolean): void {
    this.status.isRunning = isRunning;
    if (isRunning) {
      this.status.startTime = new Date();
      this.status.uptime = 0;
    } else {
      this.status.startTime = null;
      this.status.uptime = 0;
    }
    this._broadcast('status', this.status);
  }

  addError(error: string): void {
    this.status.errors.push(error);
    // Keep only last 10 errors
    if (this.status.errors.length > 10) {
      this.status.errors.shift();
    }
    this._broadcast('status', this.status);
  }

  clearErrors(): void {
    this.status.errors = [];
    this._broadcast('status', this.status);
  }

  private _broadcast(type: string, data: any): void {
    const message = JSON.stringify({ type, data });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  logActivity(activity: string): void {
    this.status.lastActivity = new Date();
    this._broadcast('activity', {
      message: activity,
      timestamp: this.status.lastActivity,
    });
  }

  // Broadcast liquidation events to connected clients
  broadcastLiquidation(liquidationEvent: LiquidationEvent): void {
    this._broadcast('liquidation', {
      symbol: liquidationEvent.symbol,
      side: liquidationEvent.side,
      orderType: liquidationEvent.orderType,
      quantity: liquidationEvent.quantity,
      price: liquidationEvent.price,
      averagePrice: liquidationEvent.averagePrice,
      orderStatus: liquidationEvent.orderStatus,
      orderLastFilledQuantity: liquidationEvent.orderLastFilledQuantity,
      orderFilledAccumulatedQuantity: liquidationEvent.orderFilledAccumulatedQuantity,
      orderTradeTime: liquidationEvent.orderTradeTime,
      eventTime: liquidationEvent.eventTime,
      timestamp: new Date(),
    });
  }

  // Broadcast trade opportunities detected by the hunter
  broadcastTradeOpportunity(data: {
    symbol: string;
    side: string;
    reason: string;
    liquidationVolume: number;
    priceImpact: number;
    confidence: number;
  }): void {
    this._broadcast('trade_opportunity', {
      ...data,
      timestamp: new Date(),
    });
  }

  // Broadcast when a position is actually opened
  broadcastPositionUpdate(data: {
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    type: 'opened' | 'closed' | 'updated';
    pnl?: number;
  }): void {
    this._broadcast('position_update', {
      ...data,
      timestamp: new Date(),
    });
  }

  // Broadcast balance updates to web UI
  broadcastBalance(data: {
    totalBalance: number;
    availableBalance: number;
    totalPositionValue: number;
    totalPnL: number;
  }): void {
    this._broadcast('balance_update', {
      ...data,
      timestamp: new Date(),
    });
  }

  // Public broadcast method for external use
  broadcast(type: string, data: any): void {
    const message = JSON.stringify({ type, data });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}