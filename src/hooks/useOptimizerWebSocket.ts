import { useCallback, useEffect, useRef } from 'react';

export function useOptimizerWebSocket(jobId: string | null, onMessage: (data: any) => void) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  const onMessageRef = useRef(onMessage);

  // Update the ref when onMessage changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!jobId) return;

    // Close existing connection if any
    if (ws.current) {
      ws.current.close();
    }

    // Use wss:// for HTTPS and ws:// for HTTP
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // Use the current host and port from the browser
    const host = window.location.hostname;
    const port = window.location.port || (protocol === 'wss' ? '443' : '80');
    // Construct WebSocket URL
    const wsUrl = `${protocol}://${host}:${port}/api/optimizer/ws?jobId=${jobId}`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('[Optimizer] WebSocket connected');
      reconnectAttempts.current = 0;
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onclose = () => {
      console.log('[Optimizer] WebSocket disconnected');
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectTimeout.current = setTimeout(() => {
          reconnectAttempts.current++;
          console.log(`[Optimizer] Reconnecting (attempt ${reconnectAttempts.current})...`);
          connect();
        }, delay);
      }
    };

    ws.current.onerror = (error) => {
      console.error('[Optimizer] WebSocket error:', error);
      ws.current?.close();
    };
  }, [jobId, onMessageRef, maxReconnectAttempts]);

  // Connect when jobId changes
  useEffect(() => {
    if (!jobId) return;

    connect();

    // Cleanup function
    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [jobId, connect]);

  return {
    close: () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    },
  };
}
