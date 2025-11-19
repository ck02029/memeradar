import { TokenData, WebSocketMessage } from '../../types';
import { DEXSCREENER_API_URL } from '../../constants';

// --- Browser-Compatible Fetching Logic ---

// Shared state for the fallback system to simulate socket updates on existing data
let cachedTokens: TokenData[] = [];

const mapDexIdToSource = (dexId: string): TokenData['source'] => {
  if (!dexId) return 'Unknown';
  const id = dexId.toLowerCase();
  if (id.includes('raydium')) return 'Raydium';
  if (id.includes('orca')) return 'Orca';
  if (id.includes('meteora')) return 'Meteora';
  return 'Unknown';
};

const formatProtocol = (dexId: string, labels?: string[]): string => {
  const name = dexId.charAt(0).toUpperCase() + dexId.slice(1);
  if (labels && labels.length > 0) {
    return `${name} ${labels[0]}`;
  }
  return name;
};

async function fetchDirectDexScreener(): Promise<TokenData[]> {
  try {
    const response = await fetch(DEXSCREENER_API_URL);
    if (!response.ok) return [];
    const data = await response.json();
    
    if (!data.pairs || !Array.isArray(data.pairs)) return [];

    const processed = new Map<string, TokenData>();
    data.pairs.forEach((pair: any) => {
      if (pair.chainId !== 'solana') return;
      const mint = pair.baseToken.address;
      const existing = processed.get(mint);

      const txns = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);

      const newToken: TokenData = {
          token_address: mint,
          token_name: pair.baseToken.name,
          token_ticker: pair.baseToken.symbol,
          price_usd: parseFloat(pair.priceUsd || '0'),
          market_cap_usd: pair.marketCap || 0,
          volume_24h: pair.volume?.h24 || 0,
          liquidity_usd: pair.liquidity?.usd || 0,
          price_change_1h: pair.priceChange?.h1 || 0,
          price_change_24h: pair.priceChange?.h24 || 0,
          pair_address: pair.pairAddress,
          source: mapDexIdToSource(pair.dexId),
          transaction_count: txns,
          protocol: formatProtocol(pair.dexId, pair.labels),
          last_updated: Date.now(),
      };

      if (!existing) {
        processed.set(mint, newToken);
      } else {
        processed.set(mint, {
          ...existing,
          volume_24h: existing.volume_24h + newToken.volume_24h,
          liquidity_usd: Math.max(existing.liquidity_usd, newToken.liquidity_usd),
          price_usd: (existing.price_usd + newToken.price_usd) / 2, // Avg
          transaction_count: Math.max(existing.transaction_count, newToken.transaction_count),
        });
      }
    });
    
    const result = Array.from(processed.values());
    // Update cache for the socket simulator
    cachedTokens = result;
    return result;
  } catch (e) {
    console.error("Fallback DexScreener fetch failed", e);
    return [];
  }
}

// --- Simulated Socket ---

class BrowserSocket {
  private subscribers: ((msg: WebSocketMessage) => void)[] = [];
  private interval: number | null = null;

  connect(onMessage: (msg: WebSocketMessage) => void) {
    this.subscribers.push(onMessage);
    if (!this.interval) this.startSimulation();
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== onMessage);
      if (this.subscribers.length === 0) this.stopSimulation();
    };
  }

  private startSimulation() {
    console.log('[Fallback] Starting Browser Simulation Stream');
    this.interval = window.setInterval(() => {
      if (cachedTokens.length === 0) return;

      // Pick a random token from the loaded list
      const randomIdx = Math.floor(Math.random() * cachedTokens.length);
      const token = cachedTokens[randomIdx];
      
      const isPrice = Math.random() > 0.3;

      if (isPrice) {
        // Simulate Price Move
        const volatility = (Math.random() * 0.02) - 0.01; // +/- 1%
        const newPrice = token.price_usd * (1 + volatility);
        
        // Update local cache so subsequent updates are consistent
        token.price_usd = newPrice;

        const msg: WebSocketMessage = {
           type: 'PRICE_UPDATE',
           data: {
               token_address: token.token_address,
               price_usd: newPrice
           }
        };
        this.broadcast(msg);
      } else {
         // Simulate Volume Spike
         const vol = Math.random() * 5000;
         token.volume_24h += vol;

         const msg: WebSocketMessage = {
            type: 'VOLUME_SPIKE',
            data: {
                token_address: token.token_address,
                volume_delta: vol
            }
         };
         this.broadcast(msg);
      }
      
    }, 1000); // Update every second
  }

  private stopSimulation() {
    if (this.interval) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
  }

  private broadcast(msg: WebSocketMessage) {
      this.subscribers.forEach(cb => cb(msg));
  }
}

export const browserFallback = {
  getTokens: async () => {
    console.info('[System] Backend Unreachable. Using Client-Side Fallback.');
    const items = await fetchDirectDexScreener();
    // Client-side sort by volume desc default
    items.sort((a, b) => b.volume_24h - a.volume_24h);
    return {
      success: true,
      data: items,
      pagination: {
        total: items.length,
        nextCursor: undefined
      }
    };
  },
  socket: new BrowserSocket()
};