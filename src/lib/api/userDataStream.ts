import WebSocket from 'ws';
import axios from 'axios';
import { ApiCredentials } from '../types';

const BASE_URL = 'https://fapi.asterdex.com';
const WS_BASE_URL = 'wss://fstream.asterdex.com';

export interface BalanceUpdate {
  asset: string;
  walletBalance: string;
  crossWalletBalance: string;
  balanceChange: string;
}

export interface PositionUpdate {
  symbol: string;
  positionAmount: string;
  entryPrice: string;
  accumulatedRealized: string;
  unrealizedPnL: string;
  marginType: string;
  isolatedWallet: string;
  positionSide: string;
}

export interface AccountUpdate {
  eventType: 'ACCOUNT_UPDATE';
  eventTime: number;
  transactionTime: number;
  updateData: {
    reasonType: string;
    balances: BalanceUpdate[];
    positions: PositionUpdate[];
  };
}

export class UserDataStream {
  private ws: WebSocket | null = null;
  private listenKey: string | null = null;
  private credentials: ApiCredentials;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private onAccountUpdate?: (data: AccountUpdate) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(credentials: ApiCredentials) {
    this.credentials = credentials;
  }

  async start(onAccountUpdate?: (data: AccountUpdate) => void): Promise<void> {
    this.onAccountUpdate = onAccountUpdate;

    try {
      // Get listen key
      this.listenKey = await this.getListenKey();

      // Connect to WebSocket
      await this.connect();

      // Start keepalive
      this.startKeepAlive();

      console.log('User data stream started successfully');
    } catch (error) {
      console.error('Failed to start user data stream:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    // Stop keepalive
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Close listen key
    if (this.listenKey) {
      await this.closeListenKey();
      this.listenKey = null;
    }

    console.log('User data stream stopped');
  }

  private async getListenKey(): Promise<string> {
    const response = await axios.post(`${BASE_URL}/fapi/v1/listenKey`, {}, {
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey
      }
    });
    return response.data.listenKey;
  }

  private async keepAliveListenKey(): Promise<void> {
    if (!this.listenKey) return;

    await axios.put(`${BASE_URL}/fapi/v1/listenKey`, {}, {
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey
      }
    });
  }

  private async closeListenKey(): Promise<void> {
    if (!this.listenKey) return;

    await axios.delete(`${BASE_URL}/fapi/v1/listenKey`, {
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey
      }
    });
  }

  private async connect(): Promise<void> {
    if (!this.listenKey) throw new Error('No listen key available');

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_BASE_URL}/ws/${this.listenKey}`);

      this.ws.on('open', () => {
        console.log('User data stream WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      });

      this.ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('User data stream WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('User data stream WebSocket closed');
        this.ws = null;
        this.attemptReconnect();
      });
    });
  }

  private handleMessage(message: any): void {
    if (message.e === 'ACCOUNT_UPDATE') {
      const accountUpdate: AccountUpdate = {
        eventType: 'ACCOUNT_UPDATE',
        eventTime: message.E,
        transactionTime: message.T,
        updateData: {
          reasonType: message.a.m,
          balances: message.a.B?.map((b: any) => ({
            asset: b.a,
            walletBalance: b.wb,
            crossWalletBalance: b.cw,
            balanceChange: b.bc
          })) || [],
          positions: message.a.P?.map((p: any) => ({
            symbol: p.s,
            positionAmount: p.pa,
            entryPrice: p.ep,
            accumulatedRealized: p.cr,
            unrealizedPnL: p.up,
            marginType: p.mt,
            isolatedWallet: p.iw,
            positionSide: p.ps
          })) || []
        }
      };

      if (this.onAccountUpdate) {
        this.onAccountUpdate(accountUpdate);
      }
    } else if (message.e === 'listenKeyExpired') {
      console.log('Listen key expired, refreshing...');
      this.refreshConnection();
    }
  }

  private startKeepAlive(): void {
    // Send keepalive every 50 minutes (10 minutes before expiry)
    this.keepAliveInterval = setInterval(async () => {
      try {
        await this.keepAliveListenKey();
        console.log('User data stream keepalive sent');
      } catch (error) {
        console.error('Failed to send keepalive:', error);
      }
    }, 50 * 60 * 1000);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.refreshConnection();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, delay);
  }

  private async refreshConnection(): Promise<void> {
    // Close existing connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Get new listen key
    this.listenKey = await this.getListenKey();

    // Reconnect
    await this.connect();
  }
}