'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import websocketService from '@/lib/services/websocketService';

interface WebSocketContextType {
  wsPort: number;
  wsUrl: string;
}

const WebSocketContext = createContext<WebSocketContextType>({
  wsPort: 8080,
  wsUrl: 'ws://localhost:8080'
});

export const useWebSocketConfig = () => useContext(WebSocketContext);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [wsPort, setWsPort] = useState(8080);
  const [wsHost, setWsHost] = useState('localhost');

  useEffect(() => {
    // Fetch configuration to get the WebSocket settings
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        const port = data.config?.global?.server?.websocketPort || 8080;
        const useRemoteWebSocket = data.config?.global?.server?.useRemoteWebSocket || false;
        const configHost = data.config?.global?.server?.websocketHost;

        setWsPort(port);

        // Determine the host based on configuration
        let host = 'localhost'; // default

        // Check for environment variable override first
        if (process.env.NEXT_PUBLIC_WS_HOST) {
          host = process.env.NEXT_PUBLIC_WS_HOST;
        } else if (useRemoteWebSocket) {
          // If remote WebSocket is enabled
          if (configHost) {
            // Use the configured host if specified
            host = configHost;
          } else if (typeof window !== 'undefined') {
            // Auto-detect from browser location
            host = window.location.hostname;
          }
        }

        setWsHost(host);
        const url = `ws://${host}:${port}`;
        websocketService.setUrl(url);
      })
      .catch(err => {
        console.error('Failed to load WebSocket config:', err);
        // Use default
        websocketService.setUrl('ws://localhost:8080');
      });
  }, []);

  const wsUrl = `ws://${wsHost}:${wsPort}`;

  return (
    <WebSocketContext.Provider value={{ wsPort, wsUrl }}>
      {children}
    </WebSocketContext.Provider>
  );
}