import { UserDataStream, AccountUpdate, BalanceUpdate, PositionUpdate } from '../api/userDataStream';
import { getAccountInfo } from '../api/market';
import { ApiCredentials } from '../types';
import { EventEmitter } from 'events';

export interface BalanceData {
  totalBalance: number;
  availableBalance: number;
  totalPositionValue: number;
  totalPnL: number;
  lastUpdate: number;
}

export class BalanceService extends EventEmitter {
  private userDataStream: UserDataStream | null = null;
  private currentBalance: BalanceData = {
    totalBalance: 0,
    availableBalance: 0,
    totalPositionValue: 0,
    totalPnL: 0,
    lastUpdate: 0
  };
  private credentials: ApiCredentials | null = null;
  private initialized = false;

  constructor() {
    super();
  }

  async initialize(credentials: ApiCredentials): Promise<void> {
    this.credentials = credentials;

    // Get initial balance data from REST API
    await this.fetchInitialBalance();

    // Start WebSocket stream for real-time updates
    this.userDataStream = new UserDataStream(credentials);
    await this.userDataStream.start(this.handleAccountUpdate.bind(this));

    this.initialized = true;
    console.log('Balance service initialized with WebSocket stream');

    // Emit initial balance
    this.emit('balanceUpdate', this.currentBalance);
  }

  async stop(): Promise<void> {
    if (this.userDataStream) {
      await this.userDataStream.stop();
      this.userDataStream = null;
    }
    this.initialized = false;
    console.log('Balance service stopped');
  }

  getCurrentBalance(): BalanceData {
    return { ...this.currentBalance };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private async fetchInitialBalance(): Promise<void> {
    if (!this.credentials) throw new Error('No credentials available');

    try {
      const accountData = await getAccountInfo(this.credentials);

      if (accountData) {
        const availableBalance = parseFloat(accountData.availableBalance || '0');
        const totalPnL = parseFloat(accountData.totalUnrealizedProfit || '0');
        const totalPositionValue = parseFloat(accountData.totalPositionInitialMargin || '0');
        const totalBalance = totalPositionValue + availableBalance;

        this.currentBalance = {
          totalBalance,
          availableBalance,
          totalPositionValue,
          totalPnL,
          lastUpdate: Date.now()
        };

        console.log('Initial balance loaded from REST API:', this.currentBalance);
      }
    } catch (error) {
      console.error('Failed to fetch initial balance:', error);
      throw error;
    }
  }

  private handleAccountUpdate(update: AccountUpdate): void {
    console.log(`Account update received: ${update.updateData.reasonType}`);

    // Update balance data based on WebSocket update
    this.updateBalanceFromStream(update);

    // Update timestamp
    this.currentBalance.lastUpdate = update.eventTime;

    console.log('Balance updated from WebSocket:', this.currentBalance);

    // Emit balance update event
    this.emit('balanceUpdate', this.currentBalance);
  }

  private updateBalanceFromStream(update: AccountUpdate): void {
    const { balances, positions } = update.updateData;

    // Find USDT balance update
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    if (usdtBalance) {
      // Note: For multi-asset mode, we might need to sum all assets
      // For now, we'll use USDT as the primary reference
      const walletBalance = parseFloat(usdtBalance.walletBalance);
      const crossWalletBalance = parseFloat(usdtBalance.crossWalletBalance);

      // Update available balance (this might need refinement based on actual data structure)
      // We'll estimate based on cross wallet balance for now
      this.currentBalance.availableBalance = crossWalletBalance;
    }

    // Calculate total unrealized PnL from all positions
    let totalUnrealizedPnL = 0;
    let totalPositionMargin = 0;

    positions.forEach(position => {
      const unrealizedPnL = parseFloat(position.unrealizedPnL);
      const positionAmount = parseFloat(position.positionAmount);
      const entryPrice = parseFloat(position.entryPrice);

      totalUnrealizedPnL += unrealizedPnL;

      // Estimate position margin (this is simplified)
      if (positionAmount !== 0) {
        totalPositionMargin += Math.abs(positionAmount * entryPrice);
      }
    });

    this.currentBalance.totalPnL = totalUnrealizedPnL;
    this.currentBalance.totalPositionValue = totalPositionMargin;
    this.currentBalance.totalBalance = this.currentBalance.totalPositionValue + this.currentBalance.availableBalance;
  }
}

// Global instance
let balanceService: BalanceService | null = null;

export function getBalanceService(): BalanceService | null {
  return balanceService;
}

export function initializeBalanceService(credentials: ApiCredentials): Promise<void> {
  balanceService = new BalanceService();
  return balanceService.initialize(credentials);
}

export async function stopBalanceService(): Promise<void> {
  if (balanceService) {
    await balanceService.stop();
    balanceService = null;
  }
}