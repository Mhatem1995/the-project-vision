
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const useMining = () => {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number>(0);
  const [miningRate, setMiningRate] = useState<number>(10);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeBoost, setActiveBoost] = useState<any>(null);

  const miningDuration = 8 * 60 * 60; // 8 hours in seconds

  const fetchActiveBoost = useCallback(async () => {
    const userId = localStorage.getItem("telegramUserId");
    if (!userId) return;
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("mining_boosts")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gt("expires_at", now)
      .order("expires_at", { ascending: false })
      .maybeSingle();
      
    if (data) {
      setActiveBoost(data);
    } else {
      setActiveBoost(null);
    }
  }, []);

  // Fetch user balance from Supabase
  const fetchUserBalance = useCallback(async () => {
    const userId = localStorage.getItem("telegramUserId");
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from("users")
        .select("balance, links")
        .eq("id", userId)
        .maybeSingle();
        
      if (data) {
        setBalance(data.balance || 0);
        localStorage.setItem("kfcBalance", data.balance?.toString() || "0");
        
        // Also update wallet address if available
        if (data.links) {
          localStorage.setItem("tonWalletAddress", data.links);
          
          // Make sure wallet is also recorded in the wallets table
          // Use RPC function instead of direct wallets table access to avoid type errors
          try {
            await supabase.functions.invoke('database-helper', {
              body: {
                action: 'save_wallet_connection',
                params: {
                  telegram_id: userId,
                  wallet_address: data.links
                }
              }
            });
          } catch (err) {
            console.error("Error saving wallet connection:", err);
          }
        }
      } else {
        const savedBalance = localStorage.getItem("kfcBalance");
        if (savedBalance) {
          setBalance(parseFloat(savedBalance));
        }
      }
    } catch (err) {
      console.error("Error fetching user balance:", err);
      const savedBalance = localStorage.getItem("kfcBalance");
      if (savedBalance) {
        setBalance(parseFloat(savedBalance));
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUserBalance();
      
      const lastMiningTime = localStorage.getItem("lastMiningTime");
      
      if (lastMiningTime) {
        const elapsed = Math.floor((Date.now() - parseInt(lastMiningTime)) / 1000);
        if (elapsed < miningDuration) {
          setTimeRemaining(miningDuration - elapsed);
          setProgress(Math.min((elapsed / miningDuration) * 100, 100));
        } else {
          setTimeRemaining(0);
          setProgress(100);
        }
      } else {
        localStorage.setItem("lastMiningTime", Date.now().toString());
        setTimeRemaining(miningDuration);
        setProgress(0);
      }
      
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [fetchUserBalance]);

  useEffect(() => {
    let interval: number | null = null;
    
    if (timeRemaining !== null && timeRemaining > 0) {
      interval = window.setInterval(() => {
        setTimeRemaining(prev => {
          if (prev && prev > 0) {
            const newTime = prev - 1;
            const newProgress = 100 - (newTime / miningDuration * 100);
            setProgress(newProgress);
            return newTime;
          }
          return 0;
        });
      }, 1000);
    }

    return () => {
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [timeRemaining]);

  useEffect(() => {
    fetchActiveBoost();
    const boostInterval = setInterval(fetchActiveBoost, 30000);
    return () => clearInterval(boostInterval);
  }, [fetchActiveBoost]);

  const effectiveMiningRate = activeBoost
    ? miningRate * activeBoost.multiplier
    : miningRate;

  const handleCollect = async () => {
    const userId = localStorage.getItem("telegramUserId");
    if (!userId) {
      toast({
        title: "Error",
        description: "User not found. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }
    
    // Verify wallet is connected
    const walletAddress = localStorage.getItem("tonWalletAddress");
    if (!walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your TON wallet first to mine KFC.",
        variant: "destructive" 
      });
      return;
    }
    
    const newBalance = balance + effectiveMiningRate;
    
    // Update local state and storage
    setBalance(newBalance);
    localStorage.setItem("kfcBalance", newBalance.toString());
    localStorage.setItem("lastMiningTime", Date.now().toString());
    setTimeRemaining(miningDuration);
    setProgress(0);
    
    // Update balance in database
    try {
      const { error } = await supabase
        .from("users")
        .update({ balance: newBalance })
        .eq("id", userId);
        
      if (error) {
        console.error("Error updating balance in database:", error);
      }
    } catch (err) {
      console.error("Failed to update balance in database:", err);
    }
    
    toast({
      title: "KFC Collected!",
      description: `You earned ${effectiveMiningRate} KFC coins!`,
    });
  };

  return {
    balance,
    timeRemaining,
    progress,
    isLoading,
    activeBoost,
    effectiveMiningRate,
    handleCollect,
  };
};
