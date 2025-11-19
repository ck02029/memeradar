import { TokenData } from '../src/types';

export interface CachedMarketData {
  lastUpdated: number;
  data: TokenData[];
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  timeFrame?: string; // 1H, 24H, 7D
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  total: number;
}

export { TokenData };