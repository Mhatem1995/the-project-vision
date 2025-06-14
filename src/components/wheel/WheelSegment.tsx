
import React from 'react';
import { cn } from "@/lib/utils";

interface WheelSegmentProps {
  rotate: number;
  prize: { type: string; amount: number };
  color: string;
  totalSegments: number;
  index: number;
}

const WheelSegment: React.FC<WheelSegmentProps> = ({ 
  rotate, 
  prize, 
  color, 
  totalSegments,
  index 
}) => {
  const segmentAngle = 360 / totalSegments;
  const halfSegmentAngle = segmentAngle / 2;
  
  // Create the clip path for the segment slice
  const createClipPath = () => {
    const startAngle = 0;
    const endAngle = segmentAngle;
    
    // Convert angles to radians for calculations
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Calculate points for the slice
    const centerX = 50;
    const centerY = 50;
    const radius = 50;
    
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    return `polygon(${centerX}% ${centerY}%, ${x1}% ${y1}%, ${x2}% ${y2}%)`;
  };

  const formatPrizeText = () => {
    if (prize.amount === 0) return "Try Again";
    return `${prize.amount} ${prize.type}`;
  };

  return (
    <div 
      className="absolute w-full h-full"
      style={{ 
        transform: `rotate(${rotate}deg)`,
        clipPath: createClipPath(),
        transformOrigin: 'center center',
      }}
    >
      <div 
        className={cn(
          "absolute w-full h-full flex items-center justify-center",
          "shadow-inner border-r border-gray-700/50"
        )}
        style={{ 
          background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
        }}
      >
        {/* Prize text positioned along the segment */}
        <div 
          className="absolute flex items-center justify-center"
          style={{ 
            transform: `rotate(${halfSegmentAngle}deg) translateY(-70px)`,
            transformOrigin: 'center center',
            width: '120px',
            height: '40px',
          }}
        >
          <span 
            className={cn(
              "text-white font-bold text-xs text-center leading-tight",
              "drop-shadow-lg"
            )}
            style={{ 
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              transform: `rotate(-${halfSegmentAngle}deg)`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {formatPrizeText()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default WheelSegment;
