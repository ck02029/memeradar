import { fetchDexScreener, fetchGeckoTerminal } from '../services/providerService';
import { redis, pubRedis } from '../utils/redisClient';
import { CACHE_TTL_SECONDS } from '../../src/constants';
import { TokenData, WebSocketMessage } from '../../src/types';
import cron, { ScheduledTask } from 'node-cron';
import { Queue, Worker } from 'bullmq';
import WebSocket from 'ws';

const CACHE_KEY = 'aggregated_tokens';
const CHANNEL_MARKET_DATA = 'market_data_feed';
const QUEUE_NAME = 'token-ingestion';

class MarketStreamPublisher {
  private upstreamWs: WebSocket | null = null;
  private lastSolPrice: number = 0;
  private lastProcessTime: number = 0;
  private spikeInterval: any = null;

  constructor() {
    this.startUpstreamConnection();
    this.startBackgroundSpikes();
  }

  private startUpstreamConnection() {
    if (this.upstreamWs) return;

    console.log('[Worker] Connecting to Upstream Binance Feed...');
    this.upstreamWs = new WebSocket('wss://stream.binance.com:9443/ws/solusdt@trade');
    
    this.upstreamWs.on('open', () => {
      console.log('[Worker] Upstream Feed Connected.');
    });

    this.upstreamWs.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.e === 'trade') {
          this.processTradeTick(parseFloat(msg.p));
        }
      } catch (e) { /* ignore */ }
    });

    this.upstreamWs.on('close', () => {
      console.warn('[Worker] Upstream Feed Disconnected. Reconnecting in 5s...');
      this.upstreamWs = null;
      setTimeout(() => this.startUpstreamConnection(), 5000);
    });

    this.upstreamWs.on('error', (err) => {
        console.error('[Worker] WS Error:', err.message);
    });
  }

  private async getTokensFromCache(): Promise<TokenData[]> {
    const cached = await redis.get(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  }

  private startBackgroundSpikes() {
    if (this.spikeInterval) return;

    this.spikeInterval = setInterval(async () => {
        const tokens = await this.getTokensFromCache();
        if (tokens.length === 0) return;

        const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
        const isVolumeEvent = Math.random() > 0.5;

        if (isVolumeEvent) {
            const vol = Math.random() * 50000;
            this.publishToRedis({
                type: 'VOLUME_SPIKE',
                data: {
                    token_address: randomToken.token_address,
                    volume_delta: vol
                }
            });
        } else {
            const change = (Math.random() * 0.04) - 0.02; 
            this.publishToRedis({
                type: 'PRICE_UPDATE',
                data: {
                    token_address: randomToken.token_address,
                    price_usd: randomToken.price_usd * (1 + change)
                }
            });
        }
    }, 3000);
  }

  private async processTradeTick(solPrice: number) {
     const now = Date.now();
     if (now - this.lastProcessTime < 200) return;
     this.lastProcessTime = now;

     if (this.lastSolPrice === 0) {
        this.lastSolPrice = solPrice;
        return;
     }

     const priceRatio = solPrice / this.lastSolPrice;
     this.lastSolPrice = solPrice;

     if (Math.abs(priceRatio - 1) < 0.0001) return;

     const tokens = await this.getTokensFromCache();
     if (tokens.length === 0) return;

     const affectedCount = Math.max(1, Math.floor(tokens.length * 0.3)); 
     
     for(let i = 0; i < affectedCount; i++) {
        const token = tokens[Math.floor(Math.random() * tokens.length)];
        const beta = 1.0 + (Math.random() * 1.5); 
        const noise = (Math.random() * 0.002) - 0.001; 
        const move = (priceRatio - 1) * beta;
        const newPrice = token.price_usd * (1 + move + noise);

        this.publishToRedis({
            type: 'PRICE_UPDATE',
            data: {
                token_address: token.token_address,
                price_usd: newPrice
            }
        });
     }
  }

  private publishToRedis(msg: WebSocketMessage) {
    pubRedis.publish(CHANNEL_MARKET_DATA, JSON.stringify(msg));
  }
}

export class IngestionWorker {
  private queue: Queue;
  private worker: Worker;
  private cronTask: ScheduledTask | null = null;
  private marketPublisher: MarketStreamPublisher | null = null;

  constructor() {
    this.queue = new Queue(QUEUE_NAME, { connection: redis });

    this.worker = new Worker(QUEUE_NAME, async (job) => {
        await this.performIngestion(job.data.source);
    }, { connection: redis });

    this.worker.on('completed', (job) => {});

    this.worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err);
    });
  }

  start() {
    console.log('[System] Ingestion Worker Process Started');
    
    this.queue.add('fetch-manual', { source: 'manual' });

    this.cronTask = cron.schedule('*/30 * * * * *', () => {
        this.queue.add('fetch-scheduled', { source: 'scheduled' });
    });

    this.marketPublisher = new MarketStreamPublisher();
  }

  async ensureDataAvailable(): Promise<void> {
     return;
  }

  private async performIngestion(source: string) {
    try {
      const [dexData, geckoData] = await Promise.all([
        fetchDexScreener(),
        fetchGeckoTerminal()
      ]);

      const merged = this.mergeDatasets(dexData, geckoData);
      merged.sort((a, b) => b.volume_24h - a.volume_24h);

      await redis.set(CACHE_KEY, JSON.stringify(merged), 'EX', CACHE_TTL_SECONDS + 5);
      
    } catch (err) {
      console.error('[Worker] Ingestion failed:', err);
      throw err;
    }
  }

  private mergeDatasets(...datasets: TokenData[][]): TokenData[] {
    const map = new Map<string, TokenData>();

    for (const dataset of datasets) {
      for (const token of dataset) {
        const existing = map.get(token.token_address);
        
        if (existing) {
          const priceA = existing.price_usd;
          const priceB = token.price_usd;
          
          let finalPrice = priceA;
          if (priceA > 0 && priceB > 0) finalPrice = (priceA + priceB) / 2;
          else if (priceB > 0) finalPrice = priceB;

          const isMoreLiquid = token.liquidity_usd > existing.liquidity_usd;
          
          map.set(token.token_address, {
            ...existing,
            source: 'Aggregated',
            price_usd: finalPrice,
            volume_24h: Math.max(existing.volume_24h, token.volume_24h),
            liquidity_usd: Math.max(existing.liquidity_usd, token.liquidity_usd),
            transaction_count: Math.max(existing.transaction_count, token.transaction_count),
            protocol: isMoreLiquid && token.protocol !== 'Unknown' ? token.protocol : existing.protocol,
            token_image_url: existing.token_image_url || token.token_image_url,
            token_name: existing.token_name || token.token_name
          });
        } else {
          map.set(token.token_address, token);
        }
      }
    }

    return Array.from(map.values());
  }
}

declare const require: any;
declare const module: any;

if (require.main === module) {
    const worker = new IngestionWorker();
    worker.start();
}

export const ingestionWorker = new IngestionWorker();