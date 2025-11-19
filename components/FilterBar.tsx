import React from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { SortOption, TimeFrame } from '../types';

interface FilterBarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  sortOption: SortOption;
  setSortOption: (val: SortOption) => void;
  timeFrame: TimeFrame;
  setTimeFrame: (val: TimeFrame) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchTerm,
  setSearchTerm,
  sortOption,
  setSortOption,
  timeFrame,
  setTimeFrame,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
      {/* Search */}
      <div className="lg:col-span-4 relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-500 group-focus-within:text-brand-400 transition-colors" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg leading-5 text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-all"
          placeholder="Search token name or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Controls */}
      <div className="lg:col-span-8 flex flex-wrap items-center gap-3 justify-between lg:justify-end">
        
        {/* Timeframe Selector */}
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
          {Object.values(TimeFrame).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                timeFrame === tf
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-gray-800 mx-1 hidden sm:block"></div>

        {/* Sort Dropdown */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <ArrowUpDown className="h-3 w-3 text-gray-500" />
          </div>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="pl-8 pr-8 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs font-medium text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer appearance-none hover:bg-gray-850 transition-colors"
          >
            <option value={SortOption.VOLUME}>Highest Volume</option>
            <option value={SortOption.PRICE_CHANGE}>Top Gainers</option>
            <option value={SortOption.LIQUIDITY}>Highest Liquidity</option>
            <option value={SortOption.MARKET_CAP}>Market Cap</option>
          </select>
        </div>
      </div>
    </div>
  );
};
