type WebSocketMessage = {
  type: string;
  data: any;
};

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private url: string;
  private isConnected = false;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  constructor(url: string = 'ws://localhost:8081') {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      console.log('WebSocketService: Connecting to', this.url);
      this.ws = new WebSocket(this.url);

      const onOpen = () => {
        console.log('WebSocketService: Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionChange(true);
        this.ws!.removeEventListener('open', onOpen);
        resolve();
      };

      const onError = () => {
        // WebSocket errors don't provide useful information
        console.log('WebSocketService: Connection failed');
        this.ws!.removeEventListener('open', onOpen);
        this.ws!.removeEventListener('error', onError);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.addEventListener('open', onOpen);
      this.ws.addEventListener('error', onError);

      this.ws.addEventListener('message', (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('WebSocketService: Handler error:', error);
            }
          });
        } catch (error) {
          console.error('WebSocketService: Message parse error:', error);
        }
      });

      this.ws.addEventListener('close', () => {
        console.log('WebSocketService: Connection closed');
        this.isConnected = false;
        this.notifyConnectionChange(false);
        this.attemptReconnect();
      });
    });
  }

  disconnect(): void {
    console.log('WebSocketService: Disconnecting');

    // Mark for disconnection to prevent reconnection attempts
    this.reconnectAttempts = this.maxReconnectAttempts;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      // Remove all listeners before closing
      const ws = this.ws;
      this.ws = null;
      ws.close();
    }

    this.isConnected = false;
    this.notifyConnectionChange(false);
  }

  addMessageHandler(handler: MessageHandler): () => void {
    this.handlers.add(handler);

    // Auto-connect if not already connected
    if (!this.isConnected && !this.ws) {
      // Reset reconnect attempts when adding new handler
      this.reconnectAttempts = 0;
      this.connect().catch(error => {
        console.log('WebSocketService: Auto-connect failed, will retry');
      });
    }

    // Return cleanup function
    return () => {
      this.handlers.delete(handler);

      // If no more handlers, disconnect
      if (this.handlers.size === 0) {
        this.disconnect();
      }
    };
  }

  addConnectionListener(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);

    // Immediately notify of current state
    listener(this.isConnected);

    // Return cleanup function
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('WebSocketService: Connection listener error:', error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.handlers.size === 0) {
      // No handlers left, don't reconnect
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('WebSocketService: Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds

    console.log(`WebSocketService: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        console.error('WebSocketService: Reconnection failed:', error);
      });
    }, delay);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Global instance
const websocketService = new WebSocketService();

export default websocketService;