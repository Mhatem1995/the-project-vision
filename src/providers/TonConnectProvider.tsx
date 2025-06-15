
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

  // Clear ALL fake wallet data - NUCLEAR OPTION
  const clearAllWalletData = () => {
    console.log("[TON-CLEAR] 🧹 NUCLEAR CLEARING ALL WALLET DATA");
    
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

  // Extract and save REAL wallet address from TonConnect - NO FAKES ALLOWED
  const saveRealWalletAddress = async (connector: TonConnectUI) => {
    console.log("[TON-SAVE] === SAVING REAL WALLET ADDRESS - NO FAKES ===");
    console.log("[TON-SAVE] TonConnect connector state:", {
      connected: connector.connected,
      wallet: !!connector.wallet,
      account: !!connector.wallet?.account,
      address: connector.wallet?.account?.address
    });
    
    // STRICT CHECK: Only proceed if we have a REAL, connected wallet
    if (!connector.connected || !connector.wallet?.account?.address) {
      console.log("[TON-SAVE] ❌ NO REAL WALLET CONNECTION - CLEARING ALL DATA");
      clearAllWalletData();
      return;
    }
    
    // Get the REAL address directly from TonConnect - THIS IS THE FIX
    const realWalletAddress = connector.wallet.account.address;
    console.log("[TON-SAVE] 🎯 EXTRACTING REAL ADDRESS FROM TONCONNECT:");
    console.log("[TON-SAVE] 🎯 REAL ADDRESS:", realWalletAddress);
    console.log("[TON-SAVE] 🎯 Address type:", typeof realWalletAddress);
    console.log("[TON-SAVE] 🎯 Address length:", realWalletAddress.length);
    
    // Validate the REAL address format
    if (!isValidTonAddress(realWalletAddress)) {
      console.error("[TON-SAVE] ❌ REAL ADDRESS FAILED VALIDATION:", realWalletAddress);
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
    
    // Set the REAL wallet data in state
    console.log("[TON-SAVE] ✅ SETTING REAL WALLET DATA IN STATE:", realWalletAddress);
    setIsConnected(true);
    setWalletAddress(realWalletAddress);
    localStorage.setItem("tonWalletAddress", realWalletAddress);
    
    // Save REAL address to database
    const userId = localStorage.getItem("telegramUserId");
    if (userId) {
      try {
        console.log("[TON-SAVE] 💾 SAVING REAL ADDRESS TO DATABASE:", { 
          userId, 
          realAddress: realWalletAddress 
        });
        
        const { data, error } = await supabase.functions.invoke('database-helper', {
          body: {
            action: 'save_wallet_connection',
            params: {
              telegram_id: userId,
              wallet_address: realWalletAddress  // REAL ADDRESS FROM TONCONNECT
            }
          }
        });
        
        if (error) {
          console.error("[TON-SAVE] ❌ Database save error:", error);
        } else {
          console.log("[TON-SAVE] ✅ REAL WALLET ADDRESS SAVED TO DATABASE SUCCESSFULLY");
          console.log("[TON-SAVE] ✅ Database response:", data);
        }
      } catch (saveError) {
        console.error("[TON-SAVE] ❌ Database save exception:", saveError);
      }
    }
    
    toast({
      title: "✅ REAL TON Wallet Connected!",
      description: `Real Address: ${realWalletAddress.substring(0, 16)}...`,
    });
    
    console.log("[TON-SAVE] ✅ REAL WALLET SAVE COMPLETE - NO FAKES SAVED");
  };

  useEffect(() => {
    console.log("[TON-INIT] === PROVIDER INITIALIZATION - REAL WALLETS ONLY ===");
    
    // Start with a clean slate - no fakes
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
          console.log("[TON-STATUS] ✅ REAL WALLET CONNECTED - EXTRACTING REAL ADDRESS");
          saveRealWalletAddress(connector);
        } else {
          console.log("[TON-STATUS] ❌ WALLET DISCONNECTED - CLEARING ALL DATA");
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
        console.log("[TON-INIT] Checking initial wallet state for REAL addresses...");
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
      console.log("[TON-CONNECT] Opening wallet connection modal for REAL wallets");
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
    console.log("[TON-DISCONNECT] Disconnecting wallet and clearing all data");
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
