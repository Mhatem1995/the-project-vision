
import { createContext, useContext, useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { tonConnectOptions } from "@/integrations/ton/TonConnectConfig";

// Add this to window global for access in other components
declare global {
  interface Window {
    _tonConnectUI?: TonConnectUI;
  }
}

// Create a dedicated interface for our context
interface TonConnectContextType {
  tonConnectUI: TonConnectUI | null;
  isConnected: boolean;
  walletAddress: string | null;
  connect: () => void;
  disconnect: () => void;
  isTelegramWebApp: boolean;
}

// Create context with defaults
const TonConnectContext = createContext<TonConnectContextType>({
  tonConnectUI: null,
  isConnected: false,
  walletAddress: null,
  connect: () => {},
  disconnect: () => {},
  isTelegramWebApp: false
});

// Custom hook to use the context
export const useTonConnect = () => useContext(TonConnectContext);

// Simplified and more reliable Telegram WebApp detection
const detectTelegramWebApp = () => {
  // Check localStorage first (set by TelegramInitializer)
  const storedValue = localStorage.getItem("inTelegramWebApp");
  if (storedValue === "true") {
    console.log("TonConnect: Using stored Telegram WebApp detection: true");
    return true;
  }
  
  // Check user agent as a strong indicator
  const isTelegramUserAgent = navigator.userAgent.includes('Telegram');
  if (isTelegramUserAgent) {
    console.log("TonConnect: Detected Telegram via user agent");
    localStorage.setItem("inTelegramWebApp", "true");
    return true;
  }
  
  // Fallback detection
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

// Provider component
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  const [tonConnectUI, setTonConnectUI] = useState<TonConnectUI | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const { toast } = useToast();

  // Initialize TonConnect
  useEffect(() => {
    console.log("Initializing TonConnect UI...");

    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);
    
    // Check for existing wallet address in localStorage
    const existingWallet = localStorage.getItem("tonWalletAddress");
    if (existingWallet) {
      console.log("Found existing wallet in localStorage:", existingWallet);
      setWalletAddress(existingWallet);
      setIsConnected(true);
    }
    
    // Options for TonConnectUI with our custom manifest URL
    const options = {
      manifestUrl: tonConnectOptions.manifestUrl,
      // Use embedded wallet in Telegram when available
      preferredWallets: isTgWebApp ? ['telegram-wallet', 'tonkeeper'] : []
    };

    console.log("TonConnect options:", options);
    const connector = new TonConnectUI(options);
    
    // Make TonConnect instance globally available
    window._tonConnectUI = connector;
    
    setTonConnectUI(connector);

    // Set up listener for connection changes
    const unsubscribe = connector.onStatusChange(async (wallet) => {
      console.log("Wallet status changed:", wallet ? "connected" : "disconnected");
      console.log("Wallet details:", wallet);
      
      if (wallet && wallet.account) {
        setIsConnected(true);
        
        // Get the wallet address
        const address = wallet.account.address.toString();
        console.log("Connected wallet address:", address);
        
        setWalletAddress(address);
        localStorage.setItem("tonWalletAddress", address);
        
        // Save to database
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

    // Check for existing connection after initialization
    setTimeout(() => {
      const currentWallet = connector.wallet;
      if (currentWallet && currentWallet.account) {
        console.log("Found existing wallet connection:", currentWallet);
        const address = currentWallet.account.address.toString();
        setWalletAddress(address);
        setIsConnected(true);
        localStorage.setItem("tonWalletAddress", address);
        saveWalletToDatabase(address);
      }
    }, 1000);

    return () => {
      unsubscribe();
    };
  }, [toast]);

  // Function to save wallet connection to database
  const saveWalletToDatabase = async (address: string) => {
    const userId = localStorage.getItem("telegramUserId");
    console.log("=== SAVING WALLET CONNECTION TO DATABASE ===");
    console.log("User ID:", userId);
    console.log("Wallet Address:", address);
    
    if (!userId) {
      console.warn("No telegram user ID found");
      toast({
        title: "Warning",
        description: "User ID not found, but wallet connected locally",
        variant: "default"
      });
      return;
    }

    try {
      // Save to wallets table
      console.log("Step 1: Saving to wallets table");
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .upsert({
          telegram_id: userId,
          wallet_address: address
        }, {
          onConflict: 'telegram_id,wallet_address',
          ignoreDuplicates: false
        })
        .select();

      if (walletError) {
        console.error("Error saving to wallets table:", walletError);
      } else {
        console.log("Successfully saved wallet connection:", walletData);
      }

      // Update users table with wallet address
      console.log("Step 2: Updating users table");
      const { data: userData, error: userError } = await supabase
        .from("users")
        .update({ links: address })
        .eq("id", userId)
        .select();
        
      if (userError) {
        console.error("Error updating user wallet:", userError);
      } else {
        console.log("Successfully updated user wallet:", userData);
      }
      
    } catch (err) {
      console.error("Database error saving wallet:", err);
    }
  };

  // Simplified detection check - no more polling
  useEffect(() => {
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);
  }, []);

  // Connect function that opens the wallet modal
  const connect = () => {
    if (tonConnectUI) {
      console.log("User clicked connect - opening TON Connect modal...");
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

  // Disconnect function
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
