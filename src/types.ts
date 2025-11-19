export interface TokenData {
  token_address: string;
  token_name: string;
  token_ticker: string;
  token_image_url?: string;
  price_usd: number;
  market_cap_usd: number;
  volume_24h: number;
  liquidity_usd: number;
  price_change_1h: number;
  price_change_24h: number;
  pair_address: string;
  source: 'Raydium' | 'Orca' | 'Meteora' | 'Unknown' | 'Aggregated';
  transaction_count: number;
  protocol: string;
  last_updated: number; // timestamp
}

export enum SortOption {
  VOLUME = 'VOLUME',
  PRICE_CHANGE = 'PRICE_CHANGE',
  MARKET_CAP = 'MARKET_CAP',
  LIQUIDITY = 'LIQUIDITY'
}

export enum TimeFrame {
  H1 = '1H',
  H24 = '24H',
  D7 = '7D'
}

export interface WebSocketMessage {
  type: 'PRICE_UPDATE' | 'VOLUME_SPIKE';
  data: {
    token_address: string;
    price_usd?: number;
    volume_delta?: number;
  };
}