import crypto from 'crypto';
import { ApiCredentials } from '../types';


// Generate timestamp (milliseconds)
export function getTimestamp(): number {
  return Date.now();
}

// Generate signature for Aster Finance API using HMAC-SHA256
export function getSignedParams(params: Record<string, any>, credentials: ApiCredentials): Record<string, any> {
  const timestamp = getTimestamp();
  const nonce = Math.trunc(timestamp * 1000); // Convert to microseconds

  // Add required parameters
  const finalParams = {
    ...params,
    timestamp,
    nonce,
    recvWindow: 5000
  };

  // Create query string from sorted params for signing
  const queryString = Object.keys(finalParams)
    .sort()
    .map(key => `${key}=${finalParams[key as keyof typeof finalParams]}`)
    .join('&');

  // Sign the query string with secret key
  const hmac = crypto.createHmac('sha256', credentials.secretKey);
  hmac.update(queryString);
  const signature = hmac.digest('hex');

  return {
    ...finalParams,
    signature
  };
}

// Utility to encode params for query string (for GET requests)
export function paramsToQuery(params: Record<string, any>): string {
  return Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
}
