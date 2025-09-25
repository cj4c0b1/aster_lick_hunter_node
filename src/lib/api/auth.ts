import crypto from 'crypto';
import { ApiCredentials } from '../types';


// Generate timestamp (milliseconds)
export function getTimestamp(): number {
  return Date.now();
}

// Build signed headers for requests
export function getSignedHeaders(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, params: Record<string, any>, credentials: ApiCredentials): Record<string, string> {
  const timestamp = getTimestamp();

  // Prepare params with apiKey and timestamp for signing
  const signingParams = {
    ...params,
    apiKey: credentials.apiKey,
    timestamp
  };

  // Create query string from sorted params
  const queryString = Object.keys(signingParams)
    .sort()
    .map(key => `${key}=${signingParams[key]}`)
    .join('&');

  // Sign the query string
  const hmac = crypto.createHmac('sha256', credentials.secretKey);
  hmac.update(queryString);
  const signature = hmac.digest('hex');

  return {
    'X-API-Key': credentials.apiKey,
    'X-Timestamp': timestamp.toString(),
    'X-Signature': signature,
    // Depending on method, add Content-Type for POST
    ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
  };
}

// For Aster specifically, if they use timestamp in query
// Adjust params to include timestamp and apiKey
export function getSignedParams(params: Record<string, any>, credentials: ApiCredentials): Record<string, any> & { timestamp: number; signature: string; apiKey: string } {
  const timestamp = getTimestamp();
  // Include timestamp and apiKey in params for signing
  const signingParams = {
    ...params,
    apiKey: credentials.apiKey,
    timestamp
  };

  // Create query string from sorted params
  const queryString = Object.keys(signingParams)
    .sort()
    .map(key => `${key}=${signingParams[key]}`)
    .join('&');

  // Sign the query string
  const hmac = crypto.createHmac('sha256', credentials.secretKey);
  hmac.update(queryString);
  const signature = hmac.digest('hex');

  return {
    ...params,
    apiKey: credentials.apiKey,
    timestamp,
    signature,
  };
}

// Utility to encode params for query string (if GET)
export function paramsToQuery(params: Record<string, any>): string {
  return Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
}

// Note: Adapt based on actual Aster API docs. If using ABI encoding, this would be different.
// Since user indicated API key/secret, using HMAC as standard.
