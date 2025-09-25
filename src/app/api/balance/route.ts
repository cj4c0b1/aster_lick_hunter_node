import { NextResponse } from 'next/server';
import { getBalance, getAccountInfo } from '@/lib/api/market';
import { loadConfig } from '@/lib/bot/config';
import { getBalanceService } from '@/lib/services/balanceService';

export async function GET() {
  try {
    const config = await loadConfig();

    // If no API key is configured, return mock data
    if (!config.api.apiKey || !config.api.secretKey) {
      return NextResponse.json({
        totalBalance: 10000,
        availableBalance: 8500,
        totalPositionValue: 1500,
        totalPnL: 60,
      });
    }

    // Try to use WebSocket balance service first (real-time data)
    const balanceService = getBalanceService();
    if (balanceService && balanceService.isInitialized()) {
      const balanceData = balanceService.getCurrentBalance();
      return NextResponse.json({
        totalBalance: balanceData.totalBalance,
        availableBalance: balanceData.availableBalance,
        totalPositionValue: balanceData.totalPositionValue,
        totalPnL: balanceData.totalPnL,
      });
    }

    // Fallback to REST API if WebSocket service is not available
    try {
      const accountData = await getAccountInfo(config.api);

      if (accountData) {
        // Use pre-calculated USDT-equivalent totals from account endpoint
        const availableBalance = parseFloat(accountData.availableBalance || '0');
        const totalPnL = parseFloat(accountData.totalUnrealizedProfit || '0');
        const totalPositionValue = parseFloat(accountData.totalPositionInitialMargin || '0');

        // Total balance = margin used in positions + available balance
        // This represents your total trading equity/buying power
        const totalBalance = totalPositionValue + availableBalance;

        return NextResponse.json({
          totalBalance,
          availableBalance,
          totalPositionValue,
          totalPnL,
        });
      }
    } catch (accountError) {
      console.error('Account API failed, falling back to balance API:', accountError);
    }

    // Final fallback to balance API
    const balanceData = await getBalance(config.api);

    let totalBalance = 0;
    let availableBalance = 0;
    let totalPositionValue = 0;
    let totalPnL = 0;

    if (balanceData && Array.isArray(balanceData)) {
      const usdtAsset = balanceData.find((a: any) => a.asset === 'USDT');
      if (usdtAsset) {
        totalBalance = parseFloat(usdtAsset.balance || '0');
        availableBalance = parseFloat(usdtAsset.availableBalance || '0');
        totalPnL = parseFloat(usdtAsset.crossUnPnl || '0');
        totalPositionValue = Math.abs(totalPnL);
      }
    }

    return NextResponse.json({
      totalBalance,
      availableBalance,
      totalPositionValue,
      totalPnL,
    });
  } catch (error: any) {
    console.error('API Balance error:', error);

    // Return mock data on error
    return NextResponse.json({
      totalBalance: 10000,
      availableBalance: 8500,
      totalPositionValue: 1500,
      totalPnL: 60,
    });
  }
}