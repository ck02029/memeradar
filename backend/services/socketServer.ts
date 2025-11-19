import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketMessage } from '../../src/types';
import { subRedis } from '../utils/redisClient';

const CHANNEL_MARKET_DATA = 'market_data_feed';
const WS_PORT = 8080;

class RealSocketServer {
  private wss: WebSocketServer;

  constructor() {
    this.wss = new WebSocketServer({ port: WS_PORT });
    
    console.log(`[System] WebSocket Gateway listening on port ${WS_PORT}`);

    this.wss.on('connection', (ws) => {
    });

    this.setupSubscription();
  }

  private setupSubscription() {
    subRedis.subscribe(CHANNEL_MARKET_DATA, (err) => {
        if (err) console.error('Failed to subscribe to market data:', err);
    });
    
    subRedis.on('message', (channel, message) => {
      if (channel === CHANNEL_MARKET_DATA) {
        this.broadcast(message);
      }
    });
  }

  private broadcast(messageStr: string) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}

export const wss = new RealSocketServer();