import { useState, useEffect, useCallback } from 'react';

interface SymbolPrecisionInfo {
  symbol: string;
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: string;
  stepSize: string;
}

export function useSymbolPrecision() {
  const [symbolInfo, setSymbolInfo] = useState<Record<string, SymbolPrecisionInfo>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSymbolInfo();
  }, []);

  const loadSymbolInfo = async () => {
    try {
      const response = await fetch('/api/symbol-info');
      if (response.ok) {
        const data = await response.json();
        setSymbolInfo(data);
      }
    } catch (error) {
      console.error('Failed to load symbol info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = useCallback((symbol: string, price: number): string => {
    const info = symbolInfo[symbol];
    if (!info) {
      // Fallback formatting based on price magnitude
      if (price < 0.01) return price.toFixed(6);
      if (price < 1) return price.toFixed(4);
      if (price < 100) return price.toFixed(3);
      if (price < 10000) return price.toFixed(2);
      return price.toFixed(0);
    }

    return price.toFixed(info.pricePrecision);
  }, [symbolInfo]);

  const formatQuantity = useCallback((symbol: string, quantity: number): string => {
    const info = symbolInfo[symbol];
    if (!info) {
      // Fallback formatting
      if (quantity < 1) return quantity.toFixed(6);
      if (quantity < 100) return quantity.toFixed(4);
      return quantity.toFixed(2);
    }

    return quantity.toFixed(info.quantityPrecision);
  }, [symbolInfo]);

  const formatPriceWithCommas = useCallback((symbol: string, price: number): string => {
    const formatted = formatPrice(symbol, price);

    // Add commas for thousands
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return parts.join('.');
  }, [formatPrice]);

  return {
    symbolInfo,
    isLoading,
    formatPrice,
    formatQuantity,
    formatPriceWithCommas,
    reload: loadSymbolInfo,
  };
}