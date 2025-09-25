import { NextResponse } from 'next/server';
import { getBalance } from '@/lib/api/market';
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

    // Get real balance from API
    const balanceData = await getBalance(config.api);

    // Calculate summary
    let totalBalance = 0;
    let availableBalance = 0;
    let totalPositionValue = 0;
    let totalPnL = 0;

    if (balanceData && balanceData.assets) {
      const usdtAsset = balanceData.assets.find((a: any) => a.asset === 'USDT');
      if (usdtAsset) {
        totalBalance = parseFloat(usdtAsset.walletBalance || '0');
        availableBalance = parseFloat(usdtAsset.availableBalance || '0');
        totalPositionValue = totalBalance - availableBalance;
        totalPnL = parseFloat(usdtAsset.unrealizedProfit || '0');
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