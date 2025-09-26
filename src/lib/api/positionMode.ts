import axios from 'axios';
import { createSignature } from './auth';
import { ApiCredentials } from '../types';

const BASE_URL = 'https://fapi.asterdex.com';

export interface PositionModeResponse {
  dualSidePosition: boolean;
}

export async function getPositionMode(api: ApiCredentials): Promise<boolean> {
  const timestamp = Date.now();
  const params = new URLSearchParams({
    timestamp: timestamp.toString(),
    recvWindow: '5000',
  });

  const signature = createSignature(params.toString(), api.secretKey);
  params.append('signature', signature);

  try {
    const response = await axios.get<PositionModeResponse>(
      `${BASE_URL}/fapi/v1/positionSide/dual?${params.toString()}`,
      {
        headers: {
          'X-MBX-APIKEY': api.apiKey,
        },
      }
    );

    return response.data.dualSidePosition;
  } catch (error) {
    console.error('Failed to get position mode:', error);
    throw error;
  }
}

export async function setPositionMode(dualSidePosition: boolean, api: ApiCredentials): Promise<void> {
  const timestamp = Date.now();
  const params = new URLSearchParams({
    dualSidePosition: dualSidePosition.toString(),
    timestamp: timestamp.toString(),
    recvWindow: '5000',
  });

  const signature = createSignature(params.toString(), api.secretKey);
  params.append('signature', signature);

  try {
    await axios.post(
      `${BASE_URL}/fapi/v1/positionSide/dual`,
      params.toString(),
      {
        headers: {
          'X-MBX-APIKEY': api.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log(`Position mode set to ${dualSidePosition ? 'Hedge Mode' : 'One-way Mode'}`);
  } catch (error) {
    console.error('Failed to set position mode:', error);
    throw error;
  }
}

export function getPositionSide(isHedgeMode: boolean, side: 'BUY' | 'SELL'): string {
  if (!isHedgeMode) {
    return 'BOTH';
  }

  return side === 'BUY' ? 'LONG' : 'SHORT';
}

export function getOppositePositionSide(positionSide: string): string {
  switch (positionSide) {
    case 'LONG':
      return 'SHORT';
    case 'SHORT':
      return 'LONG';
    case 'BOTH':
    default:
      return 'BOTH';
  }
}