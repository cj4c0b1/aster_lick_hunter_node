import { useState, useEffect } from 'react';

export function useWebSocketUrl() {
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    // Fetch configuration to get the WebSocket port
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        const port = data.config?.global?.server?.websocketPort || 8080;
        setWsUrl(`ws://localhost:${port}`);
      })
      .catch(err => {
        console.error('Failed to load WebSocket config:', err);
        // Use default port
        setWsUrl('ws://localhost:8080');
      });
  }, []);

  return wsUrl;
}