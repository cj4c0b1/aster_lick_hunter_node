import { useState, useEffect } from 'react';

export function useWebSocketUrl() {
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    // Fetch configuration to get the WebSocket settings
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        const port = data.config?.global?.server?.websocketPort || 8080;
        const useRemoteWebSocket = data.config?.global?.server?.useRemoteWebSocket || false;
        const configHost = data.config?.global?.server?.websocketHost;

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

        setWsUrl(`ws://${host}:${port}`);
      })
      .catch(err => {
        console.error('Failed to load WebSocket config:', err);
        // Use default
        setWsUrl('ws://localhost:8080');
      });
  }, []);

  return wsUrl;
}