
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CirclePlay } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PRIZES = [
  { type: 'KFC', amount: 1, probability: 0.4 },
  { type: 'KFC', amount: 10, probability: 0.3 },
  { type: 'KFC', amount: 50, probability: 0.2 },
  { type: 'KFC', amount: 500, probability: 0.09 },
  { type: 'TON', amount: 10, probability: 0.01 }
];

const FortuneWheel: React.FC = () => {
  const [cookies, setCookies] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [freePinAvailable, setFreePinAvailable] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchInitialData = async () => {
      const userId = localStorage.getItem("telegramUserId");
      if (!userId) return;

      // Fetch cookies
      const { data: userData } = await supabase
        .from('users')
        .select('fortune_cookies')
        .eq('id', userId)
        .single();

      if (userData) setCookies(userData.fortune_cookies || 0);

      // Check if free spin is available
      const { data: canSpin } = await supabase.rpc('can_free_wheel_spin', {
        p_user_id: userId
      });

      setFreePinAvailable(!!canSpin);
    };

    fetchInitialData();
  }, []);

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

    try {
      // If using a cookie (not a free spin)
      if (!freePinAvailable) {
        await supabase
          .from('users')
          .update({ fortune_cookies: cookies - 1 })
          .eq('id', userId);
      } else {
        // Log the free spin usage
        await supabase
          .from('daily_tasks')
          .insert({
            user_id: userId,
            task_type: 'free_wheel_spin'
          });
      }

      // Log wheel spin
      await supabase
        .from('wheel_spins')
        .insert({
          user_id: userId,
          prize_type: prize.type,
          prize_amount: prize.amount
        });

      // Update KFC balance if won
      if (prize.type === 'KFC') {
        const balance = parseFloat(localStorage.getItem("kfcBalance") || "0");
        const newBalance = balance + prize.amount;
        localStorage.setItem("kfcBalance", newBalance.toString());
      }

      toast({
        title: "Fortune Wheel Spin",
        description: prize.type === 'KFC' 
          ? `You won ${prize.amount} KFC!` 
          : `Congratulations! You won ${prize.amount} TON!`
      });

      // Update states
      if (!freePinAvailable) {
        setCookies(cookies - 1);
      }
      setFreePinAvailable(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong with the spin",
        variant: "destructive"
      });
    } finally {
      setSpinning(false);
    }
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

  return (
    <div className="flex flex-col items-center space-y-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            className="rounded-full h-12 w-12 p-0 absolute top-3 right-3"
            variant="outline"
            onClick={spinWheel} 
            disabled={spinning || (!freePinAvailable && cookies < 1)}
          >
            <CirclePlay className="h-6 w-6 text-primary" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{freePinAvailable ? "Free Spin Available!" : "Spin Fortune Wheel (1 Cookie)"}</p>
        </TooltipContent>
      </Tooltip>
      <h2 className="text-2xl font-bold">Fortune Wheel</h2>
      <p className="text-sm text-muted-foreground">One free spin every 24 hours!</p>
      <p>Fortune Cookies: {cookies}</p>
    </div>
  );
};

export default FortuneWheel;
