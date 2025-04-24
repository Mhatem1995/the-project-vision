
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CirclePlay } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import WheelSegment from './wheel/WheelSegment';

const PRIZES = [
  { type: 'KFC', amount: 1, probability: 0.4, color: '#FF6B6B' },
  { type: 'KFC', amount: 10, probability: 0.3, color: '#4ECDC4' },
  { type: 'KFC', amount: 50, probability: 0.2, color: '#45B7D1' },
  { type: 'TON', amount: 100, probability: 0.09, color: '#96CEB4' },
  { type: 'TON', amount: 10, probability: 0.01, color: '#FFEEAD' }
];

const FortuneWheel: React.FC = () => {
  const [cookies, setCookies] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [freePinAvailable, setFreePinAvailable] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const { toast } = useToast();
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      const userId = localStorage.getItem("telegramUserId");
      if (!userId) return;

      const { data: userData } = await supabase
        .from('users')
        .select('fortune_cookies')
        .eq('id', userId)
        .single();

      if (userData) setCookies(userData.fortune_cookies || 0);

      const { data: canSpin } = await supabase.rpc('can_free_wheel_spin', {
        p_user_id: userId
      });

      setFreePinAvailable(!!canSpin);
      
      // Count remaining free spins
      const { count } = await supabase
        .from('daily_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('task_type', 'free_wheel_spin')
        .gte('completed_at', new Date(new Date().setHours(0,0,0,0)).toISOString());
      
      setFreeSpinsRemaining(count !== null ? 3 - count : 3);
    };

    fetchInitialData();
  }, []);

  const JackpotBanner = () => {
    return (
      <div className="animate-bounce text-center mb-4">
        <span className="inline-block bg-gradient-to-r from-primary to-purple-600 text-white px-4 py-2 rounded-full font-bold shadow-lg">
          🎯 Spin to Win 100 TON! Biggest Prize Ever! 🎯
        </span>
      </div>
    );
  };

  const selectPrize = () => {
    const randomNumber = Math.random();
    let cumulativeProbability = 0;

    for (const prize of PRIZES) {
      cumulativeProbability += prize.probability;
      if (randomNumber <= cumulativeProbability) {
        return prize;
      }
    }

    return PRIZES[0]; // Default to smallest prize
  };

  const spinWheel = async () => {
    if (spinning) return;
    if (!freePinAvailable && cookies < 1) {
      toast({
        title: "Not enough cookies",
        description: "You need 1 cookie to spin the wheel",
        variant: "destructive"
      });
      return;
    }

    setSpinning(true);
    const userId = localStorage.getItem("telegramUserId");
    const prize = selectPrize();

    const rotations = 5 + Math.floor(Math.random() * 3);
    const prizeIndex = PRIZES.findIndex(p => p.type === prize.type && p.amount === prize.amount);
    const targetDegree = rotations * 360 + (360 / PRIZES.length) * prizeIndex;
    
    setRotationDegrees(targetDegree);

    try {
      if (!freePinAvailable) {
        await supabase
          .from('users')
          .update({ fortune_cookies: cookies - 1 })
          .eq('id', userId);
      } else {
        await supabase
          .from('daily_tasks')
          .insert({
            user_id: userId,
            task_type: 'free_wheel_spin'
          });
          
        // Update remaining free spins count
        setFreeSpinsRemaining(prev => Math.max(0, prev - 1));
      }

      await supabase
        .from('wheel_spins')
        .insert({
          user_id: userId,
          prize_type: prize.type,
          prize_amount: prize.amount
        });

      if (prize.type === 'KFC') {
        const balance = parseFloat(localStorage.getItem("kfcBalance") || "0");
        const newBalance = balance + prize.amount;
        localStorage.setItem("kfcBalance", newBalance.toString());
      }

      setTimeout(() => {
        setSpinning(false);
        toast({
          title: "Fortune Wheel Spin",
          description: prize.type === 'KFC' 
            ? `You won ${prize.amount} KFC!` 
            : `Congratulations! You won ${prize.amount} TON!`
        });
        if (!freePinAvailable) {
          setCookies(cookies - 1);
        }
        
        // Check if there are any free spins left
        supabase.rpc('can_free_wheel_spin', {
          p_user_id: userId
        }).then(({ data }) => {
          setFreePinAvailable(!!data);
        });
      }, 5000);
    } catch (error) {
      setSpinning(false);
      toast({
        title: "Error",
        description: "Something went wrong with the spin",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="relative bg-card p-6 rounded-lg shadow-lg w-full max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Fortune Wheel</h2>
          <p className="text-sm text-muted-foreground">3 free spins every 24 hours!</p>
          <p className="text-lg font-semibold mt-2">Fortune Cookies: {cookies}</p>
          {freeSpinsRemaining > 0 && (
            <p className="text-sm text-green-400">Free spins today: {freeSpinsRemaining}</p>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              className="rounded-full h-12 w-12 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
              onClick={spinWheel} 
              disabled={spinning || (!freePinAvailable && cookies < 1)}
            >
              <CirclePlay className="h-6 w-6 text-white" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{freePinAvailable ? "Free Spin Available!" : "Spin Fortune Wheel (1 Cookie)"}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <JackpotBanner />

      <div className="relative w-64 h-64 mx-auto">
        {/* Outer circle wheel border */}
        <div className="absolute w-full h-full rounded-full border-4 border-gray-800 bg-gray-900 z-0"></div>
        
        {/* Center dot */}
        <div className="absolute left-1/2 top-1/2 w-4 h-4 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 z-20"></div>
        
        <div 
          ref={wheelRef}
          className="absolute w-full h-full transition-transform duration-[5000ms] ease-out rounded-full overflow-hidden"
          style={{ 
            transform: `rotate(${rotationDegrees}deg)`,
            transformOrigin: 'center center',
          }}
        >
          {PRIZES.map((prize, index) => (
            <WheelSegment
              key={`${prize.type}-${prize.amount}`}
              rotate={(360 / PRIZES.length) * index}
              prize={prize}
              color={prize.color}
            />
          ))}
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-0 h-0 border-x-8 border-x-transparent border-b-[16px] border-b-primary z-10" />
      </div>
    </div>
  );
};

export default FortuneWheel;
