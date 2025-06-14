
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
  
  const formatPrizeText = () => {
    if (prize.amount === 0) return "Try Again";
    return `${prize.amount} ${prize.type}`;
  };

  // Create SVG path for the segment
  const createSegmentPath = () => {
    const centerX = 128;
    const centerY = 128;
    const radius = 120;
    
    const startAngle = -halfSegmentAngle;
    const endAngle = halfSegmentAngle;
    
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);
    
    const largeArcFlag = segmentAngle > 180 ? 1 : 0;
    
    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  return (
    <div 
      className="absolute w-full h-full"
      style={{ 
        transform: `rotate(${rotate}deg)`,
        transformOrigin: 'center center',
      }}
    >
      {/* SVG segment */}
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 256 256"
      >
        <path
          d={createSegmentPath()}
          fill={color}
          stroke="#374151"
          strokeWidth="2"
          className="drop-shadow-sm"
        />
      </svg>
      
      {/* Prize text positioned in the middle of the segment */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ 
          transform: `translateY(-60px)`,
          transformOrigin: 'center center',
        }}
      >
        <div
          className={cn(
            "bg-black/70 text-white font-bold text-center",
            "px-3 py-2 rounded-lg border-2 border-white/30"
          )}
          style={{ 
            textShadow: '2px 2px 4px rgba(0,0,0,1)',
            fontSize: prize.amount === 0 ? '14px' : '16px',
            fontWeight: '800',
            whiteSpace: 'nowrap',
            minWidth: '80px'
          }}
        >
          {formatPrizeText()}
        </div>
      </div>
    </div>
  );
};

export default WheelSegment;
