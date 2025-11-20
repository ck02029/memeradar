
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { AggregatorService } from '../backend/services/aggregatorService';
import { http } from '../backend/framework/http';
import { redis } from '../backend/utils/redisClient';
import { TokenData } from '../src/types';
import { fetchDexScreener } from '../backend/services/providerService';

// --- MOCKS ---
jest.mock('../backend/utils/redisClient', () => ({
  redis: {
    get: jest.fn(),
  },
  pubRedis: {
    publish: jest.fn(),
  }
}));

jest.mock('../backend/framework/http', () => ({
  http: {
    get: jest.fn(),
  }
}));

// Sample Mock Data used in tests
const mockTokens: TokenData[] = [
  {
    token_address: 'addr1',
    token_name: 'Bonk',
    token_ticker: 'BONK',
    price_usd: 0.00001,
    market_cap_usd: 1000000,
    volume_24h: 500000,
    liquidity_usd: 200000,
    price_change_1h: 5,
    price_change_24h: 10,
    pair_address: 'pair1',
    source: 'Raydium',
    transaction_count: 100,
    protocol: 'Raydium',
    last_updated: 1234567890
  },
  {
    token_address: 'addr2',
    token_name: 'Wif',
    token_ticker: 'WIF',
    price_usd: 2.5,
    market_cap_usd: 2000000,
    volume_24h: 1000000,
    liquidity_usd: 500000,
    price_change_1h: -2,
    price_change_24h: 20,
    pair_address: 'pair2',
    source: 'Orca',
    transaction_count: 200,
    protocol: 'Orca',
    last_updated: 1234567890
  },
  {
    token_address: 'addr3',
    token_name: 'Popcat',
    token_ticker: 'POPCAT',
    price_usd: 0.5,
    market_cap_usd: 500000,
    volume_24h: 100000,
    liquidity_usd: 50000,
    price_change_1h: 1,
    price_change_24h: -5,
    pair_address: 'pair3',
    source: 'Meteora',
    transaction_count: 50,
    protocol: 'Meteora',
    last_updated: 1234567890
  }
];

describe('Aggregator Service Tests', () => {
  let service: AggregatorService;

  beforeEach(() => {
    service = new AggregatorService();
    jest.clearAllMocks();
    (redis.get as any).mockResolvedValue(JSON.stringify(mockTokens));
  });

  // --- HAPPY PATHS ---

  test('1. Should retrieve all tokens from cache', async () => {
    const result = await service.getAggregatedTokens({});
    expect(redis.get).toHaveBeenCalledWith('aggregated_tokens');
    expect(result.total).toBe(3);
    expect(result.items.length).toBe(3);
  });

  test('2. Should filter tokens by search term (Case Insensitive)', async () => {
    const result = await service.getAggregatedTokens({ search: 'bonk' });
    expect(result.items.length).toBe(1);
    expect(result.items[0].token_name).toBe('Bonk');
  });

  test('3. Should sort tokens by Volume Descending (Default)', async () => {
    const result = await service.getAggregatedTokens({ sortBy: 'VOLUME', sortDir: 'desc' });
    expect(result.items[0].token_ticker).toBe('WIF'); // 1M volume
    expect(result.items[1].token_ticker).toBe('BONK'); // 500k volume
    expect(result.items[2].token_ticker).toBe('POPCAT'); // 100k volume
  });

  test('4. Should sort tokens by Price Change 24H', async () => {
    const result = await service.getAggregatedTokens({ sortBy: 'PRICE_CHANGE', timeFrame: '24H' });
    expect(result.items[0].token_ticker).toBe('WIF'); // +20%
    expect(result.items[2].token_ticker).toBe('POPCAT'); // -5%
  });

  test('5. Should paginate results (Limit 1)', async () => {
    const result = await service.getAggregatedTokens({ limit: 1 });
    expect(result.items.length).toBe(1);
    expect(result.nextCursor).toBeDefined();
    expect(result.nextCursor).toBe(btoa('1')); 
  });

  // --- EDGE CASES ---

  test('6. Should return Cold Start Mock Data when cache is empty', async () => {
    (redis.get as any).mockResolvedValue(null);
    const result = await service.getAggregatedTokens({});
    
    // Expect MOCK_DATA (3 items) because of Cold Start logic
    expect(result.items.length).toBe(3); 
    expect(result.total).toBe(3);
    
    // Optional: Verify it returns the specific mock data (WIF has highest volume in Mock Data)
    expect(result.items[0].token_ticker).toBe('WIF');
  });

  test('7. Should handle invalid search term (No matches)', async () => {
    const result = await service.getAggregatedTokens({ search: 'NON_EXISTENT_TOKEN' });
    expect(result.items.length).toBe(0);
  });

  test('8. Should handle invalid pagination cursor', async () => {
    const result = await service.getAggregatedTokens({ cursor: 'INVALID_CURSOR_STRING' });
    expect(result.items.length).toBe(3); // Should return default page 1
  });

  test('9. Should handle sorting by 1H Price Change', async () => {
    const result = await service.getAggregatedTokens({ sortBy: 'PRICE_CHANGE', timeFrame: '1H' });
    expect(result.items[0].token_ticker).toBe('BONK'); // +5%
    expect(result.items[2].token_ticker).toBe('WIF'); // -2%
  });
});

describe('Provider Service Integration Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('10. Provider should map DexScreener API response to TokenData correctly', async () => {
    const mockApiResponse = {
      status: 200,
      data: {
        pairs: [{
          chainId: 'solana',
          dexId: 'raydium',
          pairAddress: 'pair1',
          baseToken: { address: 'addr1', name: 'Test', symbol: 'TEST' },
          priceUsd: '1.23',
          volume: { h24: 1000 },
          liquidity: { usd: 5000 },
          priceChange: { h1: 1, h24: 2 },
          marketCap: 10000,
          txns: { h24: { buys: 10, sells: 10 } }
        }]
      }
    };

    (http.get as any).mockResolvedValue(mockApiResponse);

    const result = await fetchDexScreener();

    expect(result.length).toBe(1);
    expect(result[0].token_ticker).toBe('TEST');
    expect(result[0].price_usd).toBe(1.23);
  });

  test('11. Provider should handle API failure gracefully (Return empty array)', async () => {
    // 1. Spy on console.error to prevent it from printing to the terminal during this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // 2. Mock a 500 error
    (http.get as any).mockRejectedValue(new Error('API Error'));

    const result = await fetchDexScreener();

    // 3. Verify behavior
    expect(result).toEqual([]);
    
    // 4. Verify that console.error WAS called (proving our catch block ran)
    expect(consoleSpy).toHaveBeenCalled();

    // 5. Restore console.error so other tests can use it
    consoleSpy.mockRestore();
  });

  test('12. Provider should filter out non-Solana chains', async () => {
    const mockApiResponse = {
      status: 200,
      data: {
        pairs: [
          {
            chainId: 'ethereum',
            dexId: 'uniswap',
            baseToken: { address: 'eth1', name: 'EthToken', symbol: 'ETH' }
          },
          {
            chainId: 'solana',
            dexId: 'raydium',
            baseToken: { address: 'sol1', name: 'SolToken', symbol: 'SOL' },
             priceUsd: '1',
          }
        ]
      }
    };

    (http.get as any).mockResolvedValue(mockApiResponse);

    const result = await fetchDexScreener();
    expect(result.length).toBe(1);
    expect(result[0].token_ticker).toBe('SOL');
  });

});
