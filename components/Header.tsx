
import React from 'react';
import { Activity, Radio, Zap } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  itemCount: number;
}

export const Header: React.FC<HeaderProps> = ({ isConnected, itemCount }) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-850 bg-black/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="relative">
             <Zap className="text-brand-400 h-5 w-5 group-hover:text-white transition-colors" fill="currentColor" />
             <div className="absolute inset-0 bg-brand-400 blur-lg opacity-20"></div>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            AXIOM<span className="text-gray-500 font-light">LITE</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-gray-900 border border-gray-800 text-[10px] font-mono text-gray-400">
            <span className="text-gray-500">INDEX</span>
            <span className="text-brand-400">{itemCount}</span>
          </div>

          <div className={`flex items-center gap-2 text-[10px] font-mono font-medium transition-colors duration-300 ${
            isConnected 
              ? 'text-brand-400' 
              : 'text-red-500'
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-brand-400 animate-pulse' : 'bg-red-500'}`}></div>
            {isConnected ? 'CONNECTED' : 'OFFLINE'}
          </div>
        </div>
      </div>
    </header>
  );
};
