import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineProps {
  data: number[]; // Array of price points
  color: string;
  isPositive: boolean;
}

const Sparkline: React.FC<SparklineProps> = ({ data, color, isPositive }) => {
  // Format data for Recharts
  const chartData = data.map((val, idx) => ({ i: idx, v: val }));
  
  const strokeColor = isPositive ? '#4ade80' : '#f43f5e';

  return (
    <div className="h-12 w-28 opacity-80 hover:opacity-100 transition-opacity">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
           <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line 
            type="monotone" 
            dataKey="v" 
            stroke={strokeColor} 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false} // Performance optimization for many rows
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(Sparkline);
