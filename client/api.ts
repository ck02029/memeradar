
import { TokenData, WebSocketMessage } from '../types';
import { browserFallback } from './services/browserFallback';

const API_BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:8080';

// State to track if we should use the backend or fallback
let useFallback = false;

export const api = {
  get: async <T>(path: string): Promise<T | null> => {
    // 1. If already in fallback mode, skip fetch
    if (useFallback) {
      return browserFallback.getTokens() as unknown as T;
    }

    try {
      // 2. Try connecting to Real Backend
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
         throw new Error(`HTTP Error ${response.status}`);
      }

      return await response.json() as T;
    } catch (err) {
      // 3. Connection Failed - Switch to Fallback
      console.warn(`[API] Backend not responding (${API_BASE_URL}). Activating Fallback Mode.`);
      useFallback = true;
      return browserFallback.getTokens() as unknown as T;
    }
  }
};

export const socketClient = {
  connect: (onMessage: (msg: WebSocketMessage) => void) => {
    // If HTTP already failed, go straight to fallback
    if (useFallback) {
        return browserFallback.socket.connect(onMessage);
    }

    console.log(`Connecting to WS: ${WS_URL}`);
    
    let ws: WebSocket | null = new WebSocket(WS_URL);
    let isFallbackActive = false;
    let fallbackCleanup: (() => void) | null = null;

    const switchToFallback = () => {
        if (isFallbackActive) return;
        isFallbackActive = true;
        console.warn('[WS] Socket failed. Switching to Fallback Simulation.');
        fallbackCleanup = browserFallback.socket.connect(onMessage);
    };

    ws.onopen = () => {
      console.log('Connected to Market Data Stream');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch (e) {
        console.error('WS Parse Error:', e);
      }
    };

    ws.onerror = (err) => {
        // Connection refused or error
        switchToFallback();
    };

    ws.onclose = () => {
        // If closed unexpectedly (and not simulating), switch
        if (!isFallbackActive) {
             switchToFallback();
        }
    };

    // Return cleanup function
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      if (fallbackCleanup) fallbackCleanup();
    };
  }
};
