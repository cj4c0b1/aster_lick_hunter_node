import { NextResponse } from 'next/server';
import { getBalance, getAccountInfo } from '@/lib/api/market';
import { loadConfig } from '@/lib/bot/config';

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

    // Try account info first (better for multi-asset mode)
    try {
      const accountData = await getAccountInfo(config.api);
      console.log('Account API response (first 500 chars):', JSON.stringify(accountData, null, 2).slice(0, 500) + '...');

      if (accountData) {
        // Use pre-calculated USDT-equivalent totals from account endpoint
        const walletBalance = parseFloat(accountData.totalWalletBalance || '0');
        const availableBalance = parseFloat(accountData.availableBalance || '0');
        const totalPnL = parseFloat(accountData.totalUnrealizedProfit || '0');
        const totalPositionValue = parseFloat(accountData.totalPositionInitialMargin || '0');

        // Total balance = margin used in positions + available balance
        // This represents your total trading equity/buying power
        const totalBalance = totalPositionValue + availableBalance;

        console.log('Account totals:', {
          walletBalance,
          totalBalance,
          availableBalance,
          totalPnL,
          totalPositionValue,
          calculatedTotal: totalPositionValue + availableBalance
        });

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

    // Fallback to balance API
    const balanceData = await getBalance(config.api);
    console.log('Balance API response (array):', Array.isArray(balanceData));

    let totalBalance = 0;
    let availableBalance = 0;
    let totalPositionValue = 0;
    let totalPnL = 0;

    if (balanceData && Array.isArray(balanceData)) {
      const usdtAsset = balanceData.find((a: any) => a.asset === 'USDT');
      console.log('Found USDT asset:', usdtAsset);
      if (usdtAsset) {
        totalBalance = parseFloat(usdtAsset.balance || '0');
        availableBalance = parseFloat(usdtAsset.availableBalance || '0');
        totalPnL = parseFloat(usdtAsset.crossUnPnl || '0');
        totalPositionValue = Math.abs(totalPnL);
        console.log('Parsed values:', { totalBalance, availableBalance, totalPnL, totalPositionValue });
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