
import React from 'react';
import { TokenData, TimeFrame } from '../types';
import Sparkline from './Sparkline';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TokenTableProps {
  tokens: TokenData[];
  timeFrame: TimeFrame;
  isLoading: boolean;
  flashMap: Map<string, 'up' | 'down'>;
}

const formatNumber = (num: number) => {
  if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  return num.toFixed(2);
};

const formatPrice = (price: number) => {
  if (price < 0.000001) return price.toExponential(4);
  if (price < 0.01) return price.toFixed(6);
  return price.toFixed(4);
};

export const TokenTable: React.FC<TokenTableProps> = ({ tokens, timeFrame, isLoading, flashMap }) => {
  if (isLoading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center text-gray-600 gap-4">
         <div className="h-1 w-24 bg-gray-800 overflow-hidden rounded-full">
            <div className="h-full bg-brand-400 w-1/2 animate-[shimmer_1s_infinite]"></div>
         </div>
         <span className="text-xs font-mono">ESTABLISHING FEED...</span>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-[10px] font-mono text-gray-500 border-b border-gray-800">
            <th className="px-4 py-3 font-normal w-64">ASSET</th>
            <th className="px-4 py-3 font-normal text-right">PRICE</th>
            <th className="px-4 py-3 font-normal text-right">24H CHG</th>
            <th className="px-4 py-3 font-normal text-right hidden md:table-cell">VOL 24H</th>
            <th className="px-4 py-3 font-normal text-right hidden lg:table-cell">LIQUIDITY</th>
            <th className="px-4 py-3 font-normal text-right hidden xl:table-cell">MCAP</th>
            <th className="px-4 py-3 font-normal text-center hidden xl:table-cell w-32">CHART</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-900">
          {tokens.map((token) => {
            const flash = flashMap.get(token.token_address);
            const rowClass = flash === 'up' 
              ? 'animate-flash-green' 
              : flash === 'down' 
              ? 'animate-flash-red' 
              : 'hover:bg-gray-900 transition-colors';

            const changeValue = token.price_change_24h;
            const isPositive = changeValue >= 0;

            return (
              <tr key={token.token_address} className={`group ${rowClass}`}>
                
                {/* Asset */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-gray-800 overflow-hidden relative shrink-0">
                      {token.token_image_url ? (
                        <img src={token.token_image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[9px] text-gray-500 font-mono">
                          {token.token_ticker.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">
                        {token.token_ticker}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-500 truncate max-w-[100px]">
                          {token.token_name}
                        </span>
                        {token.source === 'Aggregated' && (
                           <span className="h-1 w-1 rounded-full bg-brand-400" title="Aggregated Source"></span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Price */}
                <td className="px-4 py-3 text-right font-mono text-sm text-gray-300 group-hover:text-white">
                  ${formatPrice(token.price_usd)}
                </td>

                {/* Change */}
                <td className="px-4 py-3 text-right font-mono text-sm">
                  <span className={`flex items-center justify-end gap-1 ${isPositive ? 'text-brand-400' : 'text-rose-500'}`}>
                    {isPositive ? '+' : ''}{changeValue.toFixed(2)}%
                  </span>
                </td>

                {/* Volume */}
                <td className="px-4 py-3 text-right font-mono text-sm text-gray-400 hidden md:table-cell">
                  {formatNumber(token.volume_24h)}
                </td>

                {/* Liquidity */}
                <td className="px-4 py-3 text-right font-mono text-sm text-gray-500 hidden lg:table-cell">
                  {formatNumber(token.liquidity_usd)}
                </td>

                {/* Mcap */}
                 <td className="px-4 py-3 text-right font-mono text-sm text-gray-500 hidden xl:table-cell">
                  {formatNumber(token.market_cap_usd)}
                </td>

                {/* Sparkline */}
                <td className="px-4 py-1 text-center hidden xl:table-cell opacity-60 group-hover:opacity-100 transition-opacity">
                  <Sparkline 
                    isPositive={isPositive}
                    color={isPositive ? '#ccff00' : '#f43f5e'}
                    data={[
                        token.price_usd * 0.9, 
                        token.price_usd * 0.95, 
                        token.price_usd * (isPositive ? 1.05 : 0.85), 
                        token.price_usd * (isPositive ? 0.98 : 0.92),
                        token.price_usd
                    ]} 
                  />
                </td>

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
