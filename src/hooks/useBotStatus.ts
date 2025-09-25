import { useState, useEffect, useRef, useCallback } from 'react';

export interface BotStatus {
  isRunning: boolean;
  paperMode: boolean;
  uptime: number;
  startTime: Date | null;
  lastActivity: Date | null;
  symbols: string[];
  positionsOpen: number;
  totalPnL: number;
  errors: string[];
}

export interface UseBotStatusReturn {
  status: BotStatus | null;
  isConnected: boolean;
  lastMessage: string | null;
  reconnect: () => void;
}

const INITIAL_STATUS: BotStatus = {
  isRunning: false,
  paperMode: true,
  uptime: 0,
  startTime: null,
  lastActivity: null,
  symbols: [],
  positionsOpen: 0,
  totalPnL: 0,
  errors: [],
};

export function useBotStatus(url: string = 'ws://localhost:8081'): UseBotStatusReturn {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      console.log('Connecting to bot WebSocket...');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to bot WebSocket');
        setIsConnected(true);

        // Setup ping interval for keep-alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'status':
              setStatus(message.data);
              break;
            case 'activity':
              setLastMessage(message.data.message);
              setStatus(prev => prev ? {
                ...prev,
                lastActivity: new Date(message.data.timestamp),
              } : null);
              break;
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from bot WebSocket');
        setIsConnected(false);
        setStatus(null);
        wsRef.current = null;

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to connect to bot WebSocket:', error);
      setIsConnected(false);

      // Retry connection after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, [url]);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    status,
    isConnected,
    lastMessage,
    reconnect,
  };
}

// Utility function to format uptime
export function formatUptime(ms: number): string {
  if (ms === 0) return 'N/A';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}