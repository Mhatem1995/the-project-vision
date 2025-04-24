
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
  const { toast } = useToast();

  useEffect(() => {
    const fetchCookies = async () => {
      const userId = localStorage.getItem("telegramUserId");
      if (!userId) return;

      const { data, error } = await supabase
        .from('users')
        .select('fortune_cookies')
        .eq('id', userId)
        .single();

      if (data) setCookies(data.fortune_cookies || 0);
    };

    fetchCookies();
  }, []);

  const spinWheel = async () => {
    if (spinning) return;  // Only check for spinning, removed cookies check

    setSpinning(true);
    const userId = localStorage.getItem("telegramUserId");
    const prize = selectPrize();

    try {
      // Temporarily comment out cookie deduction
      // await supabase
      //   .from('users')
      //   .update({ fortune_cookies: cookies - 1 })
      //   .eq('id', userId);

      // Log wheel spin
      await supabase.from('wheel_spins').insert({
        user_id: userId,
        prize_type: prize.type,
        prize_amount: prize.amount
      });

      // Update balance if KFC prize
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

      // Temporarily comment out cookie reduction
      // setCookies(cookies - 1);
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
            disabled={spinning}  // Removed cookies check from disabled state
          >
            <CirclePlay className="h-6 w-6 text-primary" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Test Fortune Wheel (Free)</p>  {/* Updated tooltip text */}
        </TooltipContent>
      </Tooltip>
      <h2 className="text-2xl font-bold">Fortune Wheel</h2>
      <p>Fortune Cookies: {cookies}</p>
    </div>
  );
};

export default FortuneWheel;

