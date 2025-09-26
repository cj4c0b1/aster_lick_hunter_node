import { NextResponse } from 'next/server';
import axios from 'axios';

interface ExchangeSymbol {
  symbol: string;
  status: string;
}

export async function GET() {
  try {
    // Fetch exchange info from Aster Finance
    const response = await axios.get('https://fapi.asterdex.com/fapi/v1/exchangeInfo');

    const symbols: ExchangeSymbol[] = [];

    for (const symbolInfo of response.data.symbols) {
      // Only include active USDT perpetual contracts
      if (symbolInfo.status === 'TRADING' &&
          symbolInfo.symbol.endsWith('USDT') &&
          symbolInfo.contractType === 'PERPETUAL') {

        symbols.push({
          symbol: symbolInfo.symbol,
          status: symbolInfo.status
        });
      }
    }

    // Sort alphabetically
    symbols.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return NextResponse.json({ symbols });
  } catch (error) {
    console.error('Failed to fetch exchange symbols:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange symbols' },
      { status: 500 }
    );
  }
}