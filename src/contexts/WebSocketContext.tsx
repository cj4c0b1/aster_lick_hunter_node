'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, ReactNode } from 'react';

interface WebSocketContextType {
  subscribe: (jobId: string, callback: (data: any) => void) => () => void;
  isConnected: boolean;
}

const defaultContextValue: WebSocketContextType = {
  subscribe: () => () => {},
  isConnected: false,
};

const WebSocketContext = createContext<WebSocketContextType>(defaultContextValue);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isConnected = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/optimizer/ws`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('[WebSocket] Connected');
      isConnected.current = true;
      reconnectAttempts.current = 0;
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const jobId = data.jobId;
        
        if (jobId && subscribersRef.current.has(jobId)) {
          subscribersRef.current.get(jobId)?.forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error('Error in WebSocket callback:', error);
            }
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    const handleClose = () => {
      console.log('[WebSocket] Disconnected');
      isConnected.current = false;
      
      // Attempt to reconnect with exponential backoff
      if (reconnectAttempts.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          console.log(`[WebSocket] Reconnecting (attempt ${reconnectAttempts.current})...`);
          connect();
        }, delay);
      }
    };

    wsRef.current.onclose = handleClose;
    wsRef.current.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      wsRef.current?.close();
    };

    // No need to return a cleanup function here since we handle cleanup in the effect
  }, []);

  useEffect(() => {
    // Only connect in the browser
    if (typeof window !== 'undefined') {
      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const subscribe = (jobId: string, callback: (data: any) => void) => {
    if (!subscribersRef.current.has(jobId)) {
      subscribersRef.current.set(jobId, new Set());
    }

    const callbacks = subscribersRef.current.get(jobId)!;
    callbacks.add(callback);

    // Connect if not already connected
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      connect();
    }

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        subscribersRef.current.delete(jobId);
      }
    };
  };

  return (
    <WebSocketContext.Provider value={{ subscribe, isConnected: isConnected.current }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
