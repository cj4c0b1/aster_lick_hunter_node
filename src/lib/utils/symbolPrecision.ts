// Symbol precision utilities for formatting prices and quantities according to exchange rules

export interface SymbolFilter {
  symbol: string;
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: string;
  stepSize: string;
}

export class SymbolPrecisionManager {
  private symbolFilters: Map<string, SymbolFilter> = new Map();

  // Parse exchange info and store symbol filters
  public parseExchangeInfo(exchangeInfo: any): void {
    if (!exchangeInfo.symbols) return;

    for (const symbolInfo of exchangeInfo.symbols) {
      const symbol = symbolInfo.symbol;

      // Find PRICE_FILTER and LOT_SIZE filters
      const priceFilter = symbolInfo.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');
      const lotSizeFilter = symbolInfo.filters?.find((f: any) => f.filterType === 'LOT_SIZE');

      if (priceFilter && lotSizeFilter) {
        // Calculate precision from tick size and step size
        const pricePrecision = this.getPrecisionFromString(priceFilter.tickSize);
        const quantityPrecision = this.getPrecisionFromString(lotSizeFilter.stepSize);

        this.symbolFilters.set(symbol, {
          symbol,
          pricePrecision,
          quantityPrecision,
          tickSize: priceFilter.tickSize,
          stepSize: lotSizeFilter.stepSize,
        });
      }
    }

    console.log(`SymbolPrecisionManager: Loaded precision for ${this.symbolFilters.size} symbols`);
  }

  // Get decimal places from a string like "0.00100000"
  private getPrecisionFromString(value: string): number {
    if (!value || value === '0') return 0;

    const decimal = value.indexOf('.');
    if (decimal === -1) return 0;

    // Find the position of the last non-zero digit
    let precision = 0;
    for (let i = value.length - 1; i > decimal; i--) {
      if (value[i] !== '0') {
        precision = i - decimal;
        break;
      }
    }

    // If all decimals are zero, count until first 1
    if (precision === 0 && decimal !== -1) {
      for (let i = decimal + 1; i < value.length; i++) {
        if (value[i] !== '0') {
          precision = i - decimal;
          break;
        }
      }
    }

    return precision;
  }

  // Format price according to symbol's tick size
  public formatPrice(symbol: string, price: number): number {
    const filter = this.symbolFilters.get(symbol);
    if (!filter) {
      console.warn(`SymbolPrecisionManager: No precision info for ${symbol}, using raw value`);
      return price;
    }

    // Round to the correct precision
    const multiplier = Math.pow(10, filter.pricePrecision);
    const rounded = Math.round(price * multiplier) / multiplier;

    // Ensure it's aligned with tick size
    const tickSize = parseFloat(filter.tickSize);
    if (tickSize > 0) {
      return Math.round(rounded / tickSize) * tickSize;
    }

    return rounded;
  }

  // Format quantity according to symbol's step size
  public formatQuantity(symbol: string, quantity: number): number {
    const filter = this.symbolFilters.get(symbol);
    if (!filter) {
      console.warn(`SymbolPrecisionManager: No precision info for ${symbol}, using raw value`);
      return quantity;
    }

    // Round to the correct precision
    const multiplier = Math.pow(10, filter.quantityPrecision);
    const rounded = Math.round(quantity * multiplier) / multiplier;

    // Ensure it's aligned with step size
    const stepSize = parseFloat(filter.stepSize);
    if (stepSize > 0) {
      return Math.round(rounded / stepSize) * stepSize;
    }

    return rounded;
  }

  // Get symbol filter
  public getSymbolFilter(symbol: string): SymbolFilter | undefined {
    return this.symbolFilters.get(symbol);
  }

  // Check if we have precision info for a symbol
  public hasSymbol(symbol: string): boolean {
    return this.symbolFilters.has(symbol);
  }
}

// Singleton instance
export const symbolPrecision = new SymbolPrecisionManager();