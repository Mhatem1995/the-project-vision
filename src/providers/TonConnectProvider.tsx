
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

  // Clear all fake wallet data
  const clearAllWalletData = () => {
    console.log("[TON-CLEAR] Clearing all wallet data");
    
    setIsConnected(false);
    setWalletAddress(null);
    
    // Clear localStorage
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
        console.log(`[TON-CLEAR] Removing localStorage key: ${key}`);
        localStorage.removeItem(key);
      }
    });
  };

  // Extract and save REAL wallet address from TonConnect
  const saveRealWalletAddress = async (connector: TonConnectUI) => {
    console.log("[TON-SAVE] === SAVING REAL WALLET ADDRESS ===");
    console.log("[TON-SAVE] Connector state:", {
      connected: connector.connected,
      wallet: connector.wallet,
      account: connector.wallet?.account,
      address: connector.wallet?.account?.address
    });
    
    // STRICT CHECK: Only proceed if we have a real, connected wallet
    if (!connector.connected || !connector.wallet?.account?.address) {
      console.log("[TON-SAVE] ❌ No real wallet connection found");
      clearAllWalletData();
      return;
    }
    
    // Get the REAL address directly from TonConnect
    const realAddress = connector.wallet.account.address;
    console.log("[TON-SAVE] 🎯 REAL ADDRESS FROM TONCONNECT:", realAddress);
    console.log("[TON-SAVE] Address type:", typeof realAddress);
    console.log("[TON-SAVE] Address length:", realAddress.length);
    
    // Validate the real address
    if (!isValidTonAddress(realAddress)) {
      console.error("[TON-SAVE] ❌ Real address failed validation:", realAddress);
      clearAllWalletData();
      toast({
        title: "Invalid Wallet Address",
        description: "The wallet address format is invalid. Please try reconnecting.",
        variant: "destructive"
      });
      return;
    }
    
    // Clear any fake data first
    clearAllWalletData();
    
    // Set the REAL wallet data
    console.log("[TON-SAVE] ✅ Setting REAL wallet data:", realAddress);
    setIsConnected(true);
    setWalletAddress(realAddress);
    localStorage.setItem("tonWalletAddress", realAddress);
    
    // Save to database with the REAL address
    const userId = localStorage.getItem("telegramUserId");
    if (userId) {
      try {
        console.log("[TON-SAVE] Saving REAL address to database:", { userId, realAddress });
        
        const { data, error } = await supabase.functions.invoke('database-helper', {
          body: {
            action: 'save_wallet_connection',
            params: {
              telegram_id: userId,
              wallet_address: realAddress  // Use the REAL address
            }
          }
        });
        
        if (error) {
          console.error("[TON-SAVE] Database save error:", error);
        } else {
          console.log("[TON-SAVE] ✅ REAL wallet saved to database successfully");
        }
      } catch (saveError) {
        console.error("[TON-SAVE] Database save exception:", saveError);
      }
    }
    
    toast({
      title: "Real TON Wallet Connected!",
      description: `Address: ${realAddress.substring(0, 16)}...`,
    });
    
    console.log("[TON-SAVE] ✅ REAL WALLET SAVE COMPLETE");
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
      saveRealWalletAddress(existingUI);
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
      const unsubscribe = connector.onStatusChange((wallet) => {
        console.log("[TON-STATUS] === WALLET STATUS CHANGED ===");
        console.log("[TON-STATUS] New wallet state:", wallet);
        
        if (wallet?.account?.address) {
          console.log("[TON-STATUS] ✅ Real wallet connected, saving address");
          saveRealWalletAddress(connector);
        } else {
          console.log("[TON-STATUS] ❌ Wallet disconnected");
          clearAllWalletData();
          toast({
            title: "Wallet Disconnected",
            description: "Your wallet has been disconnected.",
            variant: "destructive"
          });
        }
      });

      // Check initial state
      setTimeout(() => {
        console.log("[TON-INIT] Checking initial wallet state...");
        saveRealWalletAddress(connector);
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
