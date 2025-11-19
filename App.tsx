
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { TokenTable } from './components/TokenTable';
import { TokenData, SortOption, TimeFrame, WebSocketMessage } from './types';
import { api, socketClient } from './client/api';

interface ApiResponse {
  success: boolean;
  data: TokenData[];
  pagination: {
    nextCursor?: string;
    total: number;
  };
}

function App() {
  // --- MASTER STATE ---
  // 'allTokens' is the source of truth. It contains ALL fetched data.
  // Socket updates mutate this array.
  const [allTokens, setAllTokens] = useState<TokenData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  // --- VIEW STATE ---
  // CHANGE 1: Increased initial display from 20 to 50
  const [displayLimit, setDisplayLimit] = useState(50); 
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>(SortOption.VOLUME);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(TimeFrame.H24);
  const [flashMap, setFlashMap] = useState<Map<string, 'up' | 'down'>>(new Map());
  
  const hasFetchedRef = useRef(false);

  // --- 1. INITIAL DATA FETCH (Snapshot) ---
  useEffect(() => {
    const fetchInitialSnapshot = async () => {
      if (hasFetchedRef.current) return;
      hasFetchedRef.current = true;
      
      try {
        // CLIENT-SIDE APPROACH:
        // CHANGE 2: Increased fetch limit from 200 to 500
        const params = new URLSearchParams({
          limit: '500', 
          sortBy: 'VOLUME',
          sortDir: 'desc'
        });
        
        const response = await api.get<ApiResponse>(`/api/tokens?${params.toString()}`);
        
        if (response && response.success) {
          setAllTokens(response.data);
        }
      } catch (err) {
        console.error("Failed to load initial snapshot:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialSnapshot();
  }, []);

  // --- 2. WEBSOCKET UPDATES ---
  useEffect(() => {
    const handleSocketMessage = (msg: WebSocketMessage) => {
      if (msg.type === 'PRICE_UPDATE' || msg.type === 'VOLUME_SPIKE') {
        setAllTokens(currentTokens => {
          let hasChanges = false;
          
          const newTokens = currentTokens.map(t => {
            if (t.token_address === msg.data.token_address) {
              const oldPrice = t.price_usd;
              const newPrice = msg.data.price_usd ?? t.price_usd;
              const newVolume = t.volume_24h + (msg.data.volume_delta ?? 0);

              // Visual Flash Effect Logic
              if (msg.type === 'PRICE_UPDATE' && newPrice !== oldPrice) {
                hasChanges = true;
                const direction = newPrice > oldPrice ? 'up' : 'down';
                setFlashMap(prev => {
                  const next = new Map(prev);
                  next.set(t.token_address, direction);
                  // Auto-clear flash after animation
                  setTimeout(() => {
                    setFlashMap(curr => {
                      const clean = new Map(curr);
                      clean.delete(t.token_address);
                      return clean;
                    });
                  }, 800);
                  return next;
                });
              } else if (msg.type === 'VOLUME_SPIKE') {
                 hasChanges = true;
              }

              return { ...t, price_usd: newPrice, volume_24h: newVolume };
            }
            return t;
          });
          
          return hasChanges ? newTokens : currentTokens;
        });
      }
    };

    const disconnect = socketClient.connect(handleSocketMessage);
    setIsConnected(true);
    return () => {
      disconnect();
      setIsConnected(false);
    };
  }, []);

  // --- 3. CLIENT-SIDE PROCESSING (Filter & Sort) ---
  // This runs whenever 'allTokens' updates (via Socket) or user changes filters.
  // Because it's client-side, it's instant. No HTTP calls.
  const processedTokens = useMemo(() => {
    let result = [...allTokens];

    // A. Filtering
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.token_name.toLowerCase().includes(lower) || 
        t.token_ticker.toLowerCase().includes(lower) ||
        t.token_address.toLowerCase() === lower
      );
    }

    // B. Sorting
    result.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      switch (sortOption) {
        case SortOption.PRICE_CHANGE:
          // Dynamic TimeFrame selection
          const field = timeFrame === TimeFrame.H1 ? 'price_change_1h' : 'price_change_24h';
          valA = a[field];
          valB = b[field];
          break;
        case SortOption.MARKET_CAP:
          valA = a.market_cap_usd;
          valB = b.market_cap_usd;
          break;
        case SortOption.LIQUIDITY:
          valA = a.liquidity_usd;
          valB = b.liquidity_usd;
          break;
        case SortOption.VOLUME:
        default:
          valA = a.volume_24h;
          valB = b.volume_24h;
          break;
      }

      // Descending Sort
      return valB - valA;
    });

    return result;
  }, [allTokens, searchTerm, sortOption, timeFrame]);

  // --- 4. PAGINATION SLICE ---
  const visibleTokens = processedTokens.slice(0, displayLimit);
  const hasMore = displayLimit < processedTokens.length;

  const handleLoadMore = () => {
    // Instant load - just increase the limit
    setDisplayLimit(prev => prev + 50);
  };

  return (
    <div className="min-h-screen bg-black text-gray-300 selection:bg-brand-400 selection:text-black">
      <Header isConnected={isConnected} itemCount={allTokens.length} />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-850">
                <div className="text-[10px] text-gray-500 font-mono mb-1">24H VOLUME</div>
                <div className="text-xl text-white font-mono">
                    ${(allTokens.reduce((acc, t) => acc + t.volume_24h, 0) / 1000000).toFixed(2)}M
                </div>
            </div>
            <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-850">
                <div className="text-[10px] text-gray-500 font-mono mb-1">LIVE ASSETS</div>
                <div className="text-xl text-white font-mono">{allTokens.length}</div>
            </div>
        </div>

        <div className="mb-6">
          <FilterBar 
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortOption={sortOption}
            setSortOption={setSortOption}
            timeFrame={timeFrame}
            setTimeFrame={setTimeFrame}
          />
        </div>

        <div className="rounded-lg border border-gray-850 bg-gray-900/20 overflow-hidden">
          <TokenTable 
            tokens={visibleTokens}
            timeFrame={timeFrame}
            isLoading={isLoading}
            flashMap={flashMap}
          />
        </div>

        {hasMore && (
          <div className="mt-6 flex justify-center">
            <button 
              onClick={handleLoadMore}
              className="px-4 py-2 text-xs font-mono bg-gray-900 hover:bg-gray-800 text-gray-400 border border-gray-800 hover:border-gray-700 rounded transition-all active:scale-95"
            >
              LOAD MORE ({processedTokens.length - displayLimit} remaining)
            </button>
          </div>
        )}
        
        {!hasMore && processedTokens.length > 0 && (
           <div className="mt-6 text-center text-[10px] text-gray-600 font-mono">
             END OF LIST
           </div>
        )}
        
        {!isLoading && processedTokens.length === 0 && (
           <div className="mt-12 text-center text-gray-500">
             No tokens found matching "{searchTerm}"
           </div>
        )}
      </main>
    </div>
  );
}

export default App;
