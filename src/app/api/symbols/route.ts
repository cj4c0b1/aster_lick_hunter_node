import { NextResponse } from 'next/server';
import axios from 'axios';

interface ExchangeSymbol {
  symbol: string;
  minNotional: number;
  minQty: number;
  stepSize: number;
  pricePrecision: number;
  quantityPrecision: number;
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

        // Find MIN_NOTIONAL filter
        const minNotionalFilter = symbolInfo.filters?.find(
          (f: any) => f.filterType === 'MIN_NOTIONAL'
        );

        // Find PRICE_FILTER for precision
        const priceFilter = symbolInfo.filters?.find(
          (f: any) => f.filterType === 'PRICE_FILTER'
        );

        // Find LOT_SIZE for quantity precision
        const lotSizeFilter = symbolInfo.filters?.find(
          (f: any) => f.filterType === 'LOT_SIZE'
        );

        // The field is 'notional' and it's a string value
        const minNotional = minNotionalFilter && minNotionalFilter.notional ?
          parseFloat(minNotionalFilter.notional) :
          5;

        // Get minimum quantity and step size from LOT_SIZE filter
        const minQty = lotSizeFilter && lotSizeFilter.minQty ?
          parseFloat(lotSizeFilter.minQty) :
          0.001;

        const stepSize = lotSizeFilter && lotSizeFilter.stepSize ?
          parseFloat(lotSizeFilter.stepSize) :
          0.001;

        symbols.push({
          symbol: symbolInfo.symbol,
          minNotional: minNotional,
          minQty: minQty,
          stepSize: stepSize,
          pricePrecision: symbolInfo.pricePrecision || 2,
          quantityPrecision: symbolInfo.quantityPrecision || 3,
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