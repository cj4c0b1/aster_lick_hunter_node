import { UserDataStream, AccountUpdate } from '../api/userDataStream';
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

  public async fetchInitialBalance(): Promise<void> {
    if (!this.credentials) throw new Error('No credentials available');

    try {
      const accountData = await getAccountInfo(this.credentials);

      if (accountData) {
        // availableBalance is the free balance available for trading
        const availableBalance = parseFloat(accountData.availableBalance || '0');
        // totalUnrealizedProfit is the sum of all unrealized PnL
        const totalPnL = parseFloat(accountData.totalUnrealizedProfit || '0');
        // totalPositionInitialMargin is the total margin used in positions
        const totalPositionMargin = parseFloat(accountData.totalPositionInitialMargin || '0');
        // Total wallet balance = available + margin used
        const totalBalance = availableBalance + totalPositionMargin;

        this.currentBalance = {
          totalBalance,
          availableBalance,
          totalPositionValue: totalPositionMargin, // This is actually margin, not notional value
          totalPnL,
          lastUpdate: Date.now()
        };
      }
    } catch (error) {
      console.error('Failed to fetch initial balance:', error);
      throw error;
    }
  }

  private handleAccountUpdate(update: AccountUpdate): void {
    // Update balance data based on WebSocket update
    this.updateBalanceFromStream(update);

    // Update timestamp
    this.currentBalance.lastUpdate = update.eventTime;

    // Emit balance update event
    this.emit('balanceUpdate', this.currentBalance);
  }

  private updateBalanceFromStream(update: AccountUpdate): void {
    const { balances, positions } = update.updateData;

    // Find USDT balance update
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    if (usdtBalance) {
      // walletBalance is the total balance in the account
      // crossWalletBalance is the balance across all margin assets (usually same as wallet for single asset mode)
      const walletBalance = parseFloat(usdtBalance.walletBalance);
      const crossWalletBalance = parseFloat(usdtBalance.crossWalletBalance);

      // Calculate available balance (wallet balance minus margin used in positions)
      // We'll calculate margin from positions below, then derive available
      this.currentBalance.totalBalance = walletBalance;
    }

    // Calculate total unrealized PnL and margin from all positions
    let totalUnrealizedPnL = 0;
    let totalPositionMargin = 0;

    positions.forEach(position => {
      const unrealizedPnL = parseFloat(position.unrealizedPnL);
      const positionAmount = parseFloat(position.positionAmount);
      const entryPrice = parseFloat(position.entryPrice);

      totalUnrealizedPnL += unrealizedPnL;

      // Calculate actual margin used (notional / leverage)
      // For futures, margin = (position size * entry price) / leverage
      // We need to get leverage from position or config
      if (positionAmount !== 0) {
        const notional = Math.abs(positionAmount * entryPrice);
        // Default to 10x leverage if not specified (will be refined based on actual data)
        const leverage = 10; // TODO: Get actual leverage from position data or config
        totalPositionMargin += notional / leverage;
      }
    });

    this.currentBalance.totalPnL = totalUnrealizedPnL;
    this.currentBalance.totalPositionValue = totalPositionMargin;

    // Available balance = Total balance - margin used in positions
    this.currentBalance.availableBalance = Math.max(0, this.currentBalance.totalBalance - totalPositionMargin);
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