import axios, { AxiosResponse } from 'axios';
import { ApiCredentials, MarkPrice, Kline, LiquidationEvent } from '../types';
import { getSignedParams, paramsToQuery } from './auth';

const BASE_URL = 'https://fapi.asterdex.com';

// Public endpoints (no authentication)
export async function getExchangeInfo(): Promise<any> {
  const response: AxiosResponse = await axios.get(`${BASE_URL}/fapi/v1/exchangeInfo`);
  return response.data;
}

export async function getMarkPrice(symbol?: string): Promise<MarkPrice | MarkPrice[]> {
  const params: Record<string, any> = {};
  if (symbol) params.symbol = symbol;
  const query = paramsToQuery(params);
  const url = query ? `${BASE_URL}/fapi/v1/premiumIndex?${query}` : `${BASE_URL}/fapi/v1/premiumIndex`;
  const response: AxiosResponse = await axios.get(url);
  return response.data;
}

export async function getKlines(symbol: string, interval: string = '1m', limit: number = 500): Promise<Kline[]> {
  const params = { symbol, interval, limit };
  const query = paramsToQuery(params);
  const response: AxiosResponse = await axios.get(`${BASE_URL}/fapi/v1/klines?${query}`);
  // Klines come as [[openTime, open, high, low, close, volume], ...]
  // Convert to Kline array
  const klines = response.data.map((k: any[]) => ({
    openTime: k[0],
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: k[5],
  }));
  return klines as Kline[];
}

export async function getRecentTrades(symbol: string, limit: number = 500): Promise<any[]> {
  const params = { symbol, limit };
  const query = paramsToQuery(params);
  const response: AxiosResponse = await axios.get(`${BASE_URL}/fapi/v1/trades?${query}`);
  return response.data;
}

// Signed endpoints (require authentication)
export async function getBalance(credentials: ApiCredentials): Promise<any> {
  const params = {};
  const signedParams = getSignedParams(params, credentials);
  const query = paramsToQuery(signedParams);
  const response: AxiosResponse = await axios.get(`${BASE_URL}/fapi/v3/balance?${query}`);
  return response.data;
}

export async function getPositionRisk(symbol: string, credentials: ApiCredentials): Promise<any> {
  const params = { symbol };
  const signedParams = getSignedParams(params, credentials);
  const query = paramsToQuery(signedParams);
  const response: AxiosResponse = await axios.get(`${BASE_URL}/fapi/v3/positionRisk?${query}`);
  return response.data;
}

export async function getOpenOrders(symbol: string, credentials: ApiCredentials): Promise<any[]> {
  const params = { symbol };
  const signedParams = getSignedParams(params, credentials);
  const query = paramsToQuery(signedParams);
  const response: AxiosResponse = await axios.get(`${BASE_URL}/fapi/v1/openOrders?${query}`);
  return response.data;
}

// Note: Adjust headers/params based on actual Aster API (may use headers instead of query sig)
