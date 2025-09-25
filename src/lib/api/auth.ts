import crypto from 'crypto';
import { ApiCredentials } from '../types';

// Standard HMAC SHA256 signing for API key/secret authentication
export function generateSignature(params: Record<string, any>, secretKey: string, timestamp: number): string {
  // Create query string from sorted params
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // For GET requests or signed query, combine timestamp if needed
  // Standard: secretKey + method + path + queryString + timestamp, but Aster may vary
  // Assuming basic: HMAC_SHA256(secret, queryString)
  const message = sortedParams;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  return hmac.digest('hex');
}

// Generate timestamp (milliseconds)
export function getTimestamp(): number {
  return Date.now();
}

// Build signed headers for requests
export function getSignedHeaders(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, params: Record<string, any>, credentials: ApiCredentials): Record<string, string> {
  const timestamp = getTimestamp();

  // Prepare params with timestamp for signing (if needed)
  const signingParams = { ...params }; // include timestamp if required
  const signature = generateSignature(signingParams, credentials.secretKey, timestamp);

  return {
    'X-API-Key': credentials.apiKey,
    'X-Timestamp': timestamp.toString(),
    'X-Signature': signature,
    // Depending on method, add Content-Type for POST
    ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
  };
}

// For Aster specifically, if they use timestamp in query
// Adjust params to include timestamp
export function getSignedParams(params: Record<string, any>, credentials: ApiCredentials): Record<string, any> & { timestamp: number; signature: string } {
  const timestamp = getTimestamp();
  const signingParams = { ...params }; // or include timestamp
  const signature = generateSignature(signingParams, credentials.secretKey, timestamp);

  return {
    ...params,
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
