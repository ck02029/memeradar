import { DEXSCREENER_API_URL, GECKOTERMINAL_API_URL } from '../../src/constants';
import { TokenData } from '../../src/types';
import { http } from '../framework/http';

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string; };
  priceUsd: string;
  volume: { h24: number; };
  liquidity: { usd: number; };
  priceChange: { h1: number; h24: number; };
  marketCap: number;
  txns?: { h24: { buys: number; sells: number; } };
  labels?: string[];
  info?: { imageUrl?: string; };
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[];
}

interface GeckoTerminalPool {
  attributes: {
    address: string;
    name: string;
    base_token_price_usd: string;
    volume_usd: { h24: string; };
    reserve_in_usd: string;
    price_change_percentage: { h1: string; h24: string; };
    transactions: { h24: { buys: number; sells: number; } };
  };
  relationships: {
    base_token: { data: { id: string; } };
    dex: { data: { id: string; } };
  };
}

interface GeckoTerminalResponse {
  data: GeckoTerminalPool[];
}

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

export const fetchDexScreener = async (): Promise<TokenData[]> => {
  try {
    const response = await http.get<DexScreenerResponse>(DEXSCREENER_API_URL);

    if (response.status !== 200 || !response.data.pairs) {
      return [];
    }

    return response.data.pairs
      .filter(pair => pair.chainId === 'solana')
      .map(pair => ({
        token_address: pair.baseToken.address,
        token_name: pair.baseToken.name,
        token_ticker: pair.baseToken.symbol,
        token_image_url: pair.info?.imageUrl,
        price_usd: parseFloat(pair.priceUsd || '0'),
        market_cap_usd: pair.marketCap || 0,
        volume_24h: pair.volume?.h24 || 0,
        liquidity_usd: pair.liquidity?.usd || 0,
        price_change_1h: pair.priceChange?.h1 || 0,
        price_change_24h: pair.priceChange?.h24 || 0,
        pair_address: pair.pairAddress,
        source: mapDexIdToSource(pair.dexId),
        transaction_count: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
        protocol: formatProtocol(pair.dexId, pair.labels),
        last_updated: Date.now(),
      }));
  } catch (e) {
    console.error("[Provider] DexScreener Failed:", e);
    return [];
  }
};

export const fetchGeckoTerminal = async (): Promise<TokenData[]> => {
  try {
    const response = await http.get<GeckoTerminalResponse>(GECKOTERMINAL_API_URL, {
        headers: {
            'Accept': 'application/json;version=20230302'
        }
    });

    if (response.status !== 200 || !response.data.data) {
      return [];
    }

    return response.data.data.map((pool: any): TokenData | null => {
      const mint = pool.relationships?.base_token?.data?.id?.replace('solana_', '');
      if (!mint) return null;
      
      const dexId = pool.relationships?.dex?.data?.id || 'unknown';
      const txns = pool.attributes.transactions?.h24;
      const totalTxns = (txns?.buys || 0) + (txns?.sells || 0);

      return {
        token_address: mint,
        token_name: pool.attributes.name.split('/')[0].trim(),
        token_ticker: pool.attributes.name.split('/')[0].trim().toUpperCase().slice(0, 6),
        price_usd: parseFloat(pool.attributes.base_token_price_usd || '0'),
        market_cap_usd: 0,
        volume_24h: parseFloat(pool.attributes.volume_usd?.h24 || '0'),
        liquidity_usd: parseFloat(pool.attributes.reserve_in_usd || '0'),
        price_change_1h: parseFloat(pool.attributes.price_change_percentage?.h1 || '0'),
        price_change_24h: parseFloat(pool.attributes.price_change_percentage?.h24 || '0'),
        pair_address: pool.attributes.address,
        source: mapDexIdToSource(dexId),
        transaction_count: totalTxns,
        protocol: dexId.charAt(0).toUpperCase() + dexId.slice(1),
        last_updated: Date.now(),
      };
    }).filter((t: any) => t !== null) as TokenData[];
  } catch (e) {
    console.error("[Provider] GeckoTerminal Failed:", e);
    return [];
  }
};