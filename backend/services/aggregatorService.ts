import { TokenData, PaginationParams, PaginatedResponse } from '../types';
import { redis } from '../utils/redisClient';

const CACHE_KEY = 'aggregated_tokens';

export class AggregatorService {
  
  async getAggregatedTokens(params: PaginationParams = {}): Promise<PaginatedResponse<TokenData>> {
    const cached = await redis.get(CACHE_KEY);
    let tokens: TokenData[] = cached ? JSON.parse(cached) : [];
    
    if (params.search) {
      const lower = params.search.toLowerCase();
      tokens = tokens.filter(t => 
        t.token_name.toLowerCase().includes(lower) || 
        t.token_ticker.toLowerCase().includes(lower) ||
        t.token_address.toLowerCase() === lower
      );
    }

    let sortKey = 'volume_24h';
    const requestedSort = params.sortBy || 'VOLUME';
    const timeFrame = params.timeFrame || '24H';

    if (requestedSort === 'PRICE_CHANGE') {
        sortKey = timeFrame === '1H' ? 'price_change_1h' : 'price_change_24h'; 
    } else if (requestedSort === 'VOLUME') {
        sortKey = 'volume_24h';
    } else if (requestedSort === 'MARKET_CAP') {
        sortKey = 'market_cap_usd';
    } else if (requestedSort === 'LIQUIDITY') {
        sortKey = 'liquidity_usd';
    } else {
        sortKey = requestedSort;
    }

    const sortDir = params.sortDir || 'desc';

    tokens.sort((a, b) => {
      const valA = (a as any)[sortKey] ?? 0;
      const valB = (b as any)[sortKey] ?? 0;
      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    const limit = Math.min(params.limit || 100, 500); 
    let startIndex = 0;

    if (params.cursor) {
      try {
        startIndex = parseInt(atob(params.cursor), 10);
        if (isNaN(startIndex)) startIndex = 0;
      } catch {
        startIndex = 0;
      }
    }

    const slicedItems = tokens.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;
    const nextCursor = nextIndex < tokens.length ? btoa(String(nextIndex)) : undefined;

    return {
      items: slicedItems,
      nextCursor,
      total: tokens.length
    };
  }
}

export const aggregatorService = new AggregatorService();