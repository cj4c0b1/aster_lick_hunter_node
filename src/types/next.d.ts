import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { WebSocketServer } from 'ws';

declare module 'http' {
  interface Server {
    wsServer?: WebSocketServer;
  }
}

declare module 'https' {
  interface Server {
    wsServer?: WebSocketServer;
  }
}

export interface NextApiResponseWithSocket extends NextApiResponse {
  socket: {
    server: HttpServer | HttpsServer & {
      wsServer?: WebSocketServer;
    };
  };
}
