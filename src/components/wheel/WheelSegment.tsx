
import React from 'react';
import { cn } from "@/lib/utils";

interface WheelSegmentProps {
  rotate: number;
  prize: { type: string; amount: number };
  color: string;
}

const WheelSegment: React.FC<WheelSegmentProps> = ({ rotate, prize, color }) => {
  return (
    <div 
      className="absolute w-full h-full"
      style={{ 
        transform: `rotate(${rotate}deg)`,
        clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 50%, 50% 50%)', // Updated for circle slice
        transformOrigin: 'center',
      }}
    >
      <div 
        className={cn(
          "absolute w-full h-full flex items-center justify-center",
          "bg-gradient-to-r from-opacity-80 to-opacity-100 shadow-inner",
          "border-r-2 border-gray-800" // Adding a border to separate segments
        )}
        style={{ backgroundColor: color }}
      >
        <span 
          className="absolute text-white font-bold text-sm drop-shadow-lg"
          style={{ 
            transform: 'rotate(-90deg) translateY(-80px)',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            fontFamily: 'system-ui'
          }}
        >
          {prize.amount} {prize.type}
        </span>
      </div>
    </div>
  );
};

export default WheelSegment;
