import axios, { AxiosResponse } from 'axios';
import { ApiCredentials, Order } from '../types';
import { getSignedParams, paramsToQuery } from './auth';

const BASE_URL = 'https://fapi.asterdex.com';

// Place a new order (POST)
export async function placeOrder(params: {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  reduceOnly?: boolean;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
}, credentials: ApiCredentials): Promise<Order> {
  const orderParams = {
    timestamp: Date.now(),
    recvWindow: 50000,
    ...params,
  };
  const signedParams = getSignedParams(orderParams, credentials);
  const query = paramsToQuery(signedParams);
  // For Aster, POST with form data (application/x-www-form-urlencoded)
  const formData = new URLSearchParams();
  Object.entries(signedParams).forEach(([key, value]) => formData.append(key, String(value)));

  const response: AxiosResponse = await axios.post(`${BASE_URL}/fapi/v1/order`, formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
}

// Define order params type
type OrderParams = {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  reduceOnly?: boolean;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
};

// Place multiple orders (batch)
export async function placeBatchOrders(orders: Array<Omit<OrderParams, 'positionSide' | 'reduceOnly' | 'stopPrice'>>, credentials: ApiCredentials): Promise<any> {
  // For simplicity, loop and place individually for now
  const results = [];
  for (const order of orders) {
    try {
      const result = await placeOrder(order, credentials);
      results.push(result);
    } catch (error: any) {
      results.push({ error: error.response?.data || error.message });
    }
  }
  return results;
}

// Cancel an order
export async function cancelOrder(params: {
  symbol: string;
  orderId?: number;
  origClientOrderId?: string;
}, credentials: ApiCredentials): Promise<any> {
  const cancelParams = {
    timestamp: Date.now(),
    recvWindow: 50000,
    ...params,
  };
  const signedParams = getSignedParams(cancelParams, credentials);
  const query = paramsToQuery(signedParams);

  const response: AxiosResponse = await axios.delete(`${BASE_URL}/fapi/v1/order?${query}`);
  return response.data;
}

// Cancel all open orders for a symbol
export async function cancelAllOrders(symbol: string, credentials: ApiCredentials): Promise<any> {
  const params = {
    timestamp: Date.now(),
    recvWindow: 50000,
    symbol,
  };
  const signedParams = getSignedParams(params, credentials);
  const query = paramsToQuery(signedParams);

  const response: AxiosResponse = await axios.delete(`${BASE_URL}/fapi/v1/allOpenOrders?${query}`);
  return response.data;
}

// Query a specific order
export async function queryOrder(params: {
  symbol: string;
  orderId?: number;
  origClientOrderId?: string;
}, credentials: ApiCredentials): Promise<Order> {
  const queryParams = {
    timestamp: Date.now(),
    recvWindow: 50000,
    ...params,
  };
  const signedParams = getSignedParams(queryParams, credentials);
  const query = paramsToQuery(signedParams);

  const response: AxiosResponse = await axios.get(`${BASE_URL}/fapi/v1/order?${query}`);
  return response.data;
}

// Get all orders
export async function getAllOrders(symbol: string, credentials: ApiCredentials, startTime?: number, endTime?: number, limit: number = 500): Promise<Order[]> {
  const params: Record<string, any> = {
    symbol,
    limit,
    timestamp: Date.now(),
    recvWindow: 50000,
  };
  if (startTime) params.startTime = startTime;
  if (endTime) params.endTime = endTime;

  const signedParams = getSignedParams(params, credentials);
  const query = paramsToQuery(signedParams);

  const response: AxiosResponse = await axios.get(`${BASE_URL}/fapi/v1/allOrders?${query}`);
  return response.data;
}

// Change leverage
export async function setLeverage(symbol: string, leverage: number, credentials: ApiCredentials): Promise<any> {
  const params = {
    symbol,
    leverage,
    timestamp: Date.now(),
    recvWindow: 50000,
  };
  const signedParams = getSignedParams(params, credentials);
  const formData = new URLSearchParams();
  Object.entries(signedParams).forEach(([key, value]) => formData.append(key, String(value)));

  const response: AxiosResponse = await axios.post(`${BASE_URL}/fapi/v1/leverage`, formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
}

// Note: Endpoints may differ for Aster - adjust based on docs
