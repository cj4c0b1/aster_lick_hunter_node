import crypto from 'crypto';
import { ApiCredentials } from '../types';


// Generate timestamp (milliseconds)
export function getTimestamp(): number {
  return Date.now();
}

// Generate signature for Aster Finance API using HMAC-SHA256
export function getSignedParams(params: Record<string, any>, credentials: ApiCredentials): Record<string, any> {
  const timestamp = getTimestamp();

  // Add required parameters - DO NOT add nonce (not mentioned in Aster docs)
  const finalParams: Record<string, any> = {
    ...params,
    timestamp,
    recvWindow: 5000
  };

  // Convert all values to strings as they will be in the form data
  // This ensures signature matches what we actually send
  const stringParams: Record<string, string> = {};
  Object.keys(finalParams).forEach(key => {
    stringParams[key] = String(finalParams[key]);
  });

  // Create query string from sorted params for signing
  const queryString = Object.keys(stringParams)
    .sort()
    .map(key => `${key}=${stringParams[key]}`)
    .join('&');

  // Debug logging
  console.log('[AUTH DEBUG] Query string for signature:', queryString);
  console.log('[AUTH DEBUG] String params:', stringParams);

  // Sign the query string with secret key
  const hmac = crypto.createHmac('sha256', credentials.secretKey);
  hmac.update(queryString);
  const signature = hmac.digest('hex');

  console.log('[AUTH DEBUG] Generated signature:', signature);

  return {
    ...stringParams,
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
