
import React from 'react';

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
        className="absolute w-full h-full flex items-center justify-center"
        style={{ backgroundColor: color }}
      >
        <span 
          className="absolute text-white font-bold text-sm transform -rotate-[60deg] translate-x-20"
        >
          {prize.amount} {prize.type}
        </span>
      </div>
    </div>
  );
};

export default WheelSegment;
