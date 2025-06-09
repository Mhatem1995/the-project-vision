
import { createContext, useContext, useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { tonConnectOptions } from "@/integrations/ton/TonConnectConfig";

declare global {
  interface Window {
    _tonConnectUI?: TonConnectUI;
  }
}

interface TonConnectContextType {
  tonConnectUI: TonConnectUI | null;
  isConnected: boolean;
  walletAddress: string | null;
  connect: () => void;
  disconnect: () => void;
  isTelegramWebApp: boolean;
}

const TonConnectContext = createContext<TonConnectContextType>({
  tonConnectUI: null,
  isConnected: false,
  walletAddress: null,
  connect: () => {},
  disconnect: () => {},
  isTelegramWebApp: false
});

export const useTonConnect = () => useContext(TonConnectContext);

const detectTelegramWebApp = () => {
  const storedValue = localStorage.getItem("inTelegramWebApp");
  if (storedValue === "true") {
    console.log("TonConnect: Using stored Telegram WebApp detection: true");
    return true;
  }
  
  const isTelegramUserAgent = navigator.userAgent.includes('Telegram');
  if (isTelegramUserAgent) {
    console.log("TonConnect: Detected Telegram via user agent");
    localStorage.setItem("inTelegramWebApp", "true");
    return true;
  }
  
  const hasTelegramObject = Boolean(
    typeof window !== "undefined" &&
    window.Telegram &&
    window.Telegram.WebApp
  );
  
  const result = hasTelegramObject || process.env.NODE_ENV === "development";
  
  console.log("TonConnect: Fallback detection result:", result);
  
  if (result) {
    localStorage.setItem("inTelegramWebApp", "true");
  }
  
  return result;
};

export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  const [tonConnectUI, setTonConnectUI] = useState<TonConnectUI | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log("=== TONCONNECT PROVIDER INITIALIZING ===");

    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);
    
    // Don't auto-restore wallet connection - let user explicitly connect
    console.log("=== NOT AUTO-RESTORING WALLET CONNECTION ===");
    
    const options = {
      manifestUrl: tonConnectOptions.manifestUrl,
      preferredWallets: isTgWebApp ? ['telegram-wallet', 'tonkeeper'] : []
    };

    console.log("TonConnect options:", options);
    const connector = new TonConnectUI(options);
    
    window._tonConnectUI = connector;
    setTonConnectUI(connector);

    // Set up listener for connection changes
    const unsubscribe = connector.onStatusChange(async (wallet) => {
      console.log("=== WALLET STATUS CHANGED ===");
      console.log("Wallet details:", wallet);
      
      if (wallet && wallet.account) {
        const address = wallet.account.address.toString();
        console.log("Connected wallet address:", address);
        
        setIsConnected(true);
        setWalletAddress(address);
        localStorage.setItem("tonWalletAddress", address);
        
        // Save to database with better error handling
        await saveWalletToDatabase(address);
        
        toast({
          title: "Wallet Connected",
          description: "Your TON wallet has been connected successfully.",
        });
      } else {
        console.log("Wallet disconnected");
        setIsConnected(false);
        setWalletAddress(null);
        localStorage.removeItem("tonWalletAddress");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [toast]);

  const saveWalletToDatabase = async (address: string) => {
    const userId = localStorage.getItem("telegramUserId");
    console.log("=== SAVING WALLET TO DATABASE ===");
    console.log("User ID from localStorage:", userId);
    console.log("Wallet Address:", address);
    
    if (!userId) {
      console.error("=== CRITICAL: NO USER ID FOUND IN LOCALSTORAGE ===");
      toast({
        title: "Error",
        description: "User ID not found, but wallet connected locally",
        variant: "destructive"
      });
      return;
    }

    try {
      // First, save to wallets table
      console.log("Step 1: Saving to wallets table");
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .insert({
          telegram_id: userId,
          wallet_address: address
        })
        .select()
        .single();

      if (walletError && walletError.code !== '23505') {
        // If error is not duplicate key, log it
        console.error("Error saving to wallets table:", walletError);
      } else if (walletError && walletError.code === '23505') {
        console.log("Wallet already exists in wallets table");
      } else {
        console.log("Successfully saved wallet connection:", walletData);
      }

      // Second, update users table with wallet address
      console.log("Step 2: Updating users table");
      const { data: userData, error: userError } = await supabase
        .from("users")
        .update({ links: address })
        .eq("id", userId)
        .select()
        .single();
        
      if (userError) {
        console.error("Error updating user wallet:", userError);
        toast({
          title: "Warning", 
          description: "Wallet connected but failed to update user record",
          variant: "destructive"
        });
      } else {
        console.log("Successfully updated user wallet:", userData);
        toast({
          title: "Success",
          description: "Wallet connected and saved to database",
        });
      }
      
    } catch (err) {
      console.error("Database error saving wallet:", err);
      toast({
        title: "Database Error",
        description: "Failed to save wallet to database",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);
  }, []);

  const connect = () => {
    const userId = localStorage.getItem("telegramUserId");
    console.log("=== CONNECT BUTTON CLICKED ===");
    console.log("User ID check:", userId);
    
    if (!userId) {
      console.error("=== NO USER ID FOUND - CANNOT CONNECT WALLET ===");
      toast({
        title: "Error",
        description: "User ID not found. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }
    
    if (tonConnectUI) {
      console.log("Opening TON Connect modal...");
      tonConnectUI.openModal();
    } else {
      console.error("TonConnect UI not initialized");
      toast({
        title: "Connection Error",
        description: "Wallet connection service not initialized",
        variant: "destructive"
      });
    }
  };

  const disconnect = () => {
    if (tonConnectUI) {
      console.log("Disconnecting wallet...");
      tonConnectUI.disconnect();
    }
  };

  return (
    <TonConnectContext.Provider value={{
      tonConnectUI,
      isConnected,
      walletAddress,
      connect,
      disconnect,
      isTelegramWebApp
    }}>
      {children}
    </TonConnectContext.Provider>
  );
};

export default TonConnectProvider;
