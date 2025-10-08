import { WebSocket as WS, WebSocketServer as WSWebSocketServer } from 'ws';
import { IncomingMessage, Server as HttpServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as NetServer } from 'net';
import { getOptimizerJobStatus, updateOptimizerJobStatus } from '@/lib/optimizer';

// Extend the Node.js HTTP server type
declare module 'http' {
  interface Server {
    wsServer?: WebSocketServer;
  }
}

type WebSocketServer = InstanceType<typeof WSWebSocketServer>;

// In-memory store for active connections
const connections = new Map<string, Set<WS>>();

// Helper function to broadcast messages to all clients for a specific job
export function broadcastToJob(jobId: string, message: any) {
  const jobConnections = connections.get(jobId);
  if (!jobConnections) return;

  const messageString = JSON.stringify(message);
  
  jobConnections.forEach((ws) => {
    if (ws.readyState === 1) { // 1 = OPEN
      ws.send(messageString);
    }
  });
}

// Extend Next.js types
type NextApiResponseWithSocket = NextApiResponse & {
  socket: NetServer & {
    server: HttpServer & {
      wsServer?: WebSocketServer;
    };
  };
};

// Handle WebSocket connections for optimizer progress updates
export default function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { upgrade, connection } = req.headers;
  
  if (upgrade?.toLowerCase() !== 'websocket' || connection?.toLowerCase() !== 'upgrade') {
    res.status(400).json({ error: 'Expected Upgrade: WebSocket' });
    return;
  }

  if (!res.socket.server.wsServer) {
    const wss = new WSWebSocketServer({ noServer: true });
    
    wss.on('connection', (ws: WS, request: IncomingMessage) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const jobId = url.searchParams.get('jobId');
      
      if (!jobId) {
        console.error('No jobId provided for WebSocket connection');
        ws.close(1008, 'No jobId provided');
        return;
      }

      // Add WebSocket to the connections map
      if (!connections.has(jobId)) {
        connections.set(jobId, new Set());
      }
      connections.get(jobId)?.add(ws);

      // Send current status when a client connects
      getOptimizerJobStatus(jobId).then((status) => {
        if (status) {
          ws.send(JSON.stringify({
            type: 'status',
            data: status
          }));
        }
      }).catch(console.error);

      // Clean up on close
      ws.on('close', () => {
        const jobConnections = connections.get(jobId);
        if (jobConnections) {
          jobConnections.delete(ws);
          if (jobConnections.size === 0) {
            connections.delete(jobId);
            // Update the job status to 'completed' when the last client disconnects
            try {
              updateOptimizerJobStatus(jobId, { status: 'completed' });
            } catch (error) {
              console.error('Error updating job status:', error);
            }
          }
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    // Store the WebSocket server instance for future use
    res.socket.server.wsServer = wss;
  }

  // Handle the WebSocket upgrade
  const wsServer = res.socket.server.wsServer;
  if (!wsServer) {
    res.status(500).json({ error: 'WebSocket server not initialized' });
    return;
  }

  // Handle the upgrade
  const { socket } = res;
  if (socket) {
    wsServer.handleUpgrade(
      req,
      socket,
      Buffer.alloc(0),
      (ws: WS) => {
        wsServer.emit('connection', ws, req);
      }
    );
  } else {
    res.status(500).json({ error: 'Socket not available' });
  }
}
