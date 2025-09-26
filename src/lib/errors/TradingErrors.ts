export class TradingError extends Error {
  constructor(
    message: string,
    public code?: number,
    public symbol?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TradingError';
  }
}

export class NotionalError extends TradingError {
  constructor(
    public symbol: string,
    public requiredNotional: number,
    public actualNotional: number,
    public price: number,
    public quantity: number,
    public leverage: number
  ) {
    const message = `Minimum notional not met for ${symbol}: Required ${requiredNotional} USDT, got ${actualNotional.toFixed(2)} USDT (price: ${price}, qty: ${quantity}, leverage: ${leverage}x)`;
    super(message, -4164, symbol, {
      requiredNotional,
      actualNotional,
      price,
      quantity,
      leverage,
      calculatedNotional: price * quantity
    });
    this.name = 'NotionalError';
  }
}

export class InsufficientBalanceError extends TradingError {
  constructor(
    public symbol: string,
    public required: number,
    public available: number
  ) {
    const message = `Insufficient balance for ${symbol}: Required ${required} USDT, available ${available} USDT`;
    super(message, -2019, symbol, { required, available });
    this.name = 'InsufficientBalanceError';
  }
}

export class SymbolNotFoundError extends TradingError {
  constructor(public symbol: string) {
    const message = `Symbol ${symbol} not found or not available for trading`;
    super(message, -1121, symbol);
    this.name = 'SymbolNotFoundError';
  }
}

export function parseExchangeError(error: any, context?: { symbol?: string; quantity?: number; price?: number; leverage?: number }): TradingError {
  const code = error.response?.data?.code;
  const msg = error.response?.data?.msg || error.message;

  switch (code) {
    case -4164:
      // Extract required notional from error message if possible
      const match = msg.match(/no smaller than ([\d.]+)/);
      const requiredNotional = match ? parseFloat(match[1]) : 5.0;
      const actualNotional = (context?.price || 0) * (context?.quantity || 0);

      return new NotionalError(
        context?.symbol || 'UNKNOWN',
        requiredNotional,
        actualNotional,
        context?.price || 0,
        context?.quantity || 0,
        context?.leverage || 1
      );

    case -2019:
      // Insufficient balance
      return new InsufficientBalanceError(
        context?.symbol || 'UNKNOWN',
        0, // Would need to parse from message
        0
      );

    case -1121:
      // Invalid symbol
      return new SymbolNotFoundError(context?.symbol || 'UNKNOWN');

    default:
      return new TradingError(msg, code, context?.symbol);
  }
}