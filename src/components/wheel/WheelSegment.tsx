
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
        clipPath: 'polygon(50% 50%, 100% 0, 100% 33%, 50% 50%)',
      }}
    >
      <div 
        className={cn(
          "absolute w-full h-full flex items-center justify-center",
          "bg-gradient-to-r from-opacity-80 to-opacity-100 shadow-inner"
        )}
        style={{ backgroundColor: color }}
      >
        <span 
          className="absolute text-white font-bold text-sm transform -rotate-[60deg] translate-x-20 drop-shadow-lg"
          style={{ 
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
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
