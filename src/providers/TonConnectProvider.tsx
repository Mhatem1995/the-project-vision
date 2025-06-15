
import { createContext, useContext, useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { tonConnectOptions, isValidTonAddress, getPreferredWallets } from "@/integrations/ton/TonConnectConfig";

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
  if (typeof window !== "undefined") {
    const hasTelegramObject = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user);
    if (hasTelegramObject) {
      console.log("[TON-DEBUG] Real Telegram WebApp detected");
      return true;
    }
  }
  console.log("[TON-DEBUG] Not running in Telegram WebApp");
  return false;
};

export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  const [tonConnectUI, setTonConnectUI] = useState<TonConnectUI | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const { toast } = useToast();

  // Clear ALL fake wallet data
  const clearAllWalletData = () => {
    console.log("[TON-CLEAR] 🧹 CLEARING ALL WALLET DATA");
    
    setIsConnected(false);
    setWalletAddress(null);
    
    // Clear localStorage completely
    const keysToRemove = [
      "tonWalletAddress",
      "walletAddress", 
      "ton_wallet_address",
      "wallet_address",
      "connectedWallet",
      "ton_connect_wallet",
      "userWallet"
    ];
    
    keysToRemove.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`[TON-CLEAR] 🗑️ Removing localStorage key: ${key}`);
        localStorage.removeItem(key);
      }
    });
  };

  // Extract ONLY the real wallet address from TonConnect
  const extractRealWalletAddress = (connector: TonConnectUI) => {
    console.log("[TON-EXTRACT] === EXTRACTING REAL WALLET ADDRESS ===");
    
    // Check if wallet is actually connected
    if (!connector.connected) {
      console.log("[TON-EXTRACT] ❌ TonConnect not connected");
      return null;
    }

    if (!connector.wallet) {
      console.log("[TON-EXTRACT] ❌ No wallet object");
      return null;
    }

    if (!connector.wallet.account) {
      console.log("[TON-EXTRACT] ❌ No account object");
      return null;
    }

    if (!connector.wallet.account.address) {
      console.log("[TON-EXTRACT] ❌ No address in account");
      return null;
    }

    // Get the RAW address directly from TonConnect
    const rawAddress = connector.wallet.account.address;
    console.log("[TON-EXTRACT] 🎯 RAW ADDRESS FROM TONCONNECT:", rawAddress);
    console.log("[TON-EXTRACT] 🎯 Address type:", typeof rawAddress);
    console.log("[TON-EXTRACT] 🎯 Address length:", rawAddress.length);
    
    // Validate the address format
    if (!isValidTonAddress(rawAddress)) {
      console.error("[TON-EXTRACT] ❌ INVALID ADDRESS FORMAT:", rawAddress);
      return null;
    }

    console.log("[TON-EXTRACT] ✅ REAL ADDRESS EXTRACTED:", rawAddress);
    return rawAddress;
  };

  // Save the REAL wallet address
  const saveRealWalletAddress = async (realAddress: string) => {
    console.log("[TON-SAVE] === SAVING REAL WALLET ADDRESS ===");
    console.log("[TON-SAVE] 🎯 REAL ADDRESS TO SAVE:", realAddress);
    
    // Clear any fake data first
    clearAllWalletData();
    
    // Set the REAL wallet data in state
    setIsConnected(true);
    setWalletAddress(realAddress);
    localStorage.setItem("tonWalletAddress", realAddress);
    
    // Save REAL address to database
    const userId = localStorage.getItem("telegramUserId");
    if (userId) {
      try {
        console.log("[TON-SAVE] 💾 SAVING TO DATABASE:", { 
          userId, 
          realAddress 
        });
        
        const { data, error } = await supabase.functions.invoke('database-helper', {
          body: {
            action: 'save_wallet_connection',
            params: {
              telegram_id: userId,
              wallet_address: realAddress
            }
          }
        });
        
        if (error) {
          console.error("[TON-SAVE] ❌ Database save error:", error);
        } else {
          console.log("[TON-SAVE] ✅ SAVED TO DATABASE SUCCESSFULLY");
          console.log("[TON-SAVE] ✅ Database response:", data);
        }
      } catch (saveError) {
        console.error("[TON-SAVE] ❌ Database save exception:", saveError);
      }
    }
    
    toast({
      title: "✅ TON Wallet Connected!",
      description: `Address: ${realAddress.substring(0, 20)}...`,
    });
    
    console.log("[TON-SAVE] ✅ REAL WALLET SAVE COMPLETE");
  };

  // Handle wallet status changes
  const handleWalletStatusChange = async (wallet: any) => {
    console.log("[TON-STATUS] === WALLET STATUS CHANGED ===");
    console.log("[TON-STATUS] Wallet object:", wallet);
    console.log("[TON-STATUS] Has account:", !!wallet?.account);
    console.log("[TON-STATUS] Has address:", !!wallet?.account?.address);
    
    if (wallet?.account?.address && tonConnectUI) {
      console.log("[TON-STATUS] ✅ WALLET CONNECTED - EXTRACTING REAL ADDRESS");
      
      const realAddress = extractRealWalletAddress(tonConnectUI);
      if (realAddress) {
        await saveRealWalletAddress(realAddress);
      } else {
        console.log("[TON-STATUS] ❌ FAILED TO EXTRACT REAL ADDRESS");
        clearAllWalletData();
      }
    } else {
      console.log("[TON-STATUS] ❌ WALLET DISCONNECTED");
      clearAllWalletData();
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    console.log("[TON-INIT] === PROVIDER INITIALIZATION ===");
    
    // Start clean
    clearAllWalletData();
    
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    // Check if TonConnect UI already exists
    if (window._tonConnectUI) {
      console.log("[TON-INIT] Using existing TonConnect UI");
      const existingUI = window._tonConnectUI;
      setTonConnectUI(existingUI);
      
      // Check current connection status
      const realAddress = extractRealWalletAddress(existingUI);
      if (realAddress) {
        saveRealWalletAddress(realAddress);
      }
      return;
    }

    try {
      const options = {
        manifestUrl: tonConnectOptions.manifestUrl,
        preferredWallets: getPreferredWallets()
      };

      console.log("[TON-INIT] Creating new TonConnect with options:", options);
      const connector = new TonConnectUI(options);
      
      // Store globally
      window._tonConnectUI = connector;
      setTonConnectUI(connector);

      // Listen for wallet status changes
      const unsubscribe = connector.onStatusChange(handleWalletStatusChange);

      // Check initial state
      setTimeout(() => {
        console.log("[TON-INIT] Checking initial wallet state...");
        const realAddress = extractRealWalletAddress(connector);
        if (realAddress) {
          saveRealWalletAddress(realAddress);
        }
      }, 1000);

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error("[TON-INIT] ❌ TonConnect initialization error:", error);
      clearAllWalletData();
    }
  }, [toast]);

  const connect = () => {
    if (tonConnectUI) {
      console.log("[TON-CONNECT] Opening wallet connection modal");
      clearAllWalletData();
      tonConnectUI.openModal();
    } else {
      console.error("[TON-CONNECT] ❌ TonConnect UI not available");
      toast({
        title: "Connection Error",
        description: "Wallet connection service not ready. Please try again.",
        variant: "destructive"
      });
    }
  };

  const disconnect = () => {
    console.log("[TON-DISCONNECT] Disconnecting wallet");
    if (tonConnectUI) {
      tonConnectUI.disconnect();
    }
    clearAllWalletData();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
      variant: "destructive"
    });
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
