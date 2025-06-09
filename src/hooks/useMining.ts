
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
    
    console.log("=== FETCHING USER BALANCE ===");
    console.log("User ID:", userId);
    
    try {
      const { data, error } = await supabase
        .from("users")
        .select("balance, links")
        .eq("id", userId)
        .maybeSingle();
        
      console.log("Balance fetch result:", { data, error });
        
      if (data) {
        setBalance(data.balance || 0);
        localStorage.setItem("kfcBalance", data.balance?.toString() || "0");
        
        // IMPORTANT: Only set wallet if it actually exists in database
        if (data.links) {
          localStorage.setItem("tonWalletAddress", data.links);
          console.log("Wallet found in database:", data.links);
        } else {
          // Remove any stale wallet data
          localStorage.removeItem("tonWalletAddress");
          console.log("No wallet found in database - cleared localStorage");
        }
      } else {
        console.log("No user data found, starting fresh");
        setBalance(0);
        localStorage.setItem("kfcBalance", "0");
        localStorage.removeItem("tonWalletAddress");
      }
    } catch (err) {
      console.error("Error fetching user balance:", err);
      setBalance(0);
      localStorage.setItem("kfcBalance", "0");
      localStorage.removeItem("tonWalletAddress");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUserBalance();
      
      // Start fresh mining cycle
      localStorage.setItem("lastMiningTime", Date.now().toString());
      setTimeRemaining(miningDuration);
      setProgress(0);
      
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
    
    // Verify wallet is connected by checking BOTH localStorage AND database
    const walletAddress = localStorage.getItem("tonWalletAddress");
    if (!walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your TON wallet first to mine Knife Coin.",
        variant: "destructive" 
      });
      return;
    }
    
    // Double check database has the wallet
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("links")
        .eq("id", userId)
        .single();
        
      if (!userData?.links) {
        toast({
          title: "Wallet Not Found",
          description: "Wallet connection not found in database. Please reconnect your wallet.",
          variant: "destructive"
        });
        return;
      }
    } catch (err) {
      console.error("Error verifying wallet in database:", err);
      toast({
        title: "Database Error",
        description: "Could not verify wallet connection. Please try again.",
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
      } else {
        console.log("Successfully updated balance in database to:", newBalance);
      }
    } catch (err) {
      console.error("Failed to update balance in database:", err);
    }
    
    toast({
      title: "Knife Coin Collected!",
      description: `You earned ${effectiveMiningRate} Knife Coin tokens!`,
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
