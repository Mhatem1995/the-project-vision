
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

  // NUCLEAR OPTION: Clear ALL wallet-related data completely
  const nukeAllWalletData = () => {
    console.log("[TON-NUKE] 💥 NUCLEAR CLEARING ALL WALLET DATA");
    
    // Clear React state
    setIsConnected(false);
    setWalletAddress(null);
    
    // NUKE localStorage completely - remove ALL keys that might contain wallet data
    const allKeys = Object.keys(localStorage);
    console.log("[TON-NUKE] All localStorage keys:", allKeys);
    
    allKeys.forEach(key => {
      if (key.toLowerCase().includes('wallet') || 
          key.toLowerCase().includes('ton') || 
          key.toLowerCase().includes('address') ||
          key === 'connectedWallet' ||
          key === 'userWallet' ||
          key === 'links') {
        console.log(`[TON-NUKE] 💥 DESTROYING localStorage key: ${key} = ${localStorage.getItem(key)}`);
        localStorage.removeItem(key);
      }
    });
    
    console.log("[TON-NUKE] 💥 NUCLEAR WALLET DATA DESTRUCTION COMPLETE");
  };

  // Extract wallet address ONLY from real TonConnect
  const extractRealTonConnectAddress = (connector: TonConnectUI): string | null => {
    console.log("[TON-EXTRACT] 🔍 === EXTRACTING REAL TONCONNECT ADDRESS ===");
    console.log("[TON-EXTRACT] 🔍 Connector object:", connector);
    console.log("[TON-EXTRACT] 🔍 Connector.connected:", connector?.connected);
    console.log("[TON-EXTRACT] 🔍 Connector.wallet:", connector?.wallet);
    
    // Strict validation - MUST be connected
    if (!connector || !connector.connected) {
      console.log("[TON-EXTRACT] ❌ TonConnect NOT CONNECTED - returning null");
      return null;
    }

    // Strict validation - MUST have wallet object
    if (!connector.wallet) {
      console.log("[TON-EXTRACT] ❌ NO WALLET OBJECT - returning null");
      return null;
    }

    // Strict validation - MUST have account
    if (!connector.wallet.account) {
      console.log("[TON-EXTRACT] ❌ NO ACCOUNT OBJECT - returning null");
      return null;
    }

    // Strict validation - MUST have address
    if (!connector.wallet.account.address) {
      console.log("[TON-EXTRACT] ❌ NO ADDRESS IN ACCOUNT - returning null");
      return null;
    }

    const realAddress = connector.wallet.account.address;
    console.log("[TON-EXTRACT] 🎯 FOUND REAL ADDRESS:", realAddress);
    console.log("[TON-EXTRACT] 🎯 Address type:", typeof realAddress);
    console.log("[TON-EXTRACT] 🎯 Address length:", realAddress?.length);
    
    // STRICT validation of address format
    if (!isValidTonAddress(realAddress)) {
      console.error("[TON-EXTRACT] ❌ INVALID TON ADDRESS FORMAT:", realAddress);
      return null;
    }

    console.log("[TON-EXTRACT] ✅ REAL TONCONNECT ADDRESS EXTRACTED AND VALIDATED:", realAddress);
    return realAddress;
  };

  // Save ONLY real wallet address
  const saveRealWalletAddress = async (realAddress: string) => {
    console.log("[TON-SAVE] 💾 === SAVING REAL WALLET ADDRESS ===");
    console.log("[TON-SAVE] 💾 Real address to save:", realAddress);
    
    // NUKE all fake data first
    nukeAllWalletData();
    
    // Set ONLY the real data
    setIsConnected(true);
    setWalletAddress(realAddress);
    localStorage.setItem("tonWalletAddress", realAddress);
    
    console.log("[TON-SAVE] 💾 State updated with REAL address:", realAddress);
    
    // Save to database
    const userId = localStorage.getItem("telegramUserId");
    if (userId) {
      try {
        console.log("[TON-SAVE] 💾 Saving to database:", { userId, realAddress });
        
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
          console.error("[TON-SAVE] ❌ Database error:", error);
        } else {
          console.log("[TON-SAVE] ✅ Database save successful:", data);
        }
      } catch (err) {
        console.error("[TON-SAVE] ❌ Database exception:", err);
      }
    }
    
    toast({
      title: "✅ Real TON Wallet Connected!",
      description: `Real Address: ${realAddress.substring(0, 15)}...`,
    });
    
    console.log("[TON-SAVE] ✅ REAL WALLET SAVE COMPLETE");
  };

  // Handle wallet status changes - ONLY accept real connections
  const handleWalletStatusChange = async (wallet: any) => {
    console.log("[TON-STATUS] 🔄 === WALLET STATUS CHANGED ===");
    console.log("[TON-STATUS] 🔄 Wallet object:", wallet);
    console.log("[TON-STATUS] 🔄 Has account:", !!wallet?.account);
    console.log("[TON-STATUS] 🔄 Has address:", !!wallet?.account?.address);
    console.log("[TON-STATUS] 🔄 TonConnectUI available:", !!tonConnectUI);
    
    if (wallet?.account?.address && tonConnectUI && tonConnectUI.connected) {
      console.log("[TON-STATUS] ✅ REAL WALLET CONNECTION DETECTED");
      
      const realAddress = extractRealTonConnectAddress(tonConnectUI);
      if (realAddress) {
        console.log("[TON-STATUS] ✅ REAL ADDRESS EXTRACTED:", realAddress);
        await saveRealWalletAddress(realAddress);
      } else {
        console.log("[TON-STATUS] ❌ FAILED TO EXTRACT REAL ADDRESS");
        nukeAllWalletData();
      }
    } else {
      console.log("[TON-STATUS] ❌ WALLET DISCONNECTED OR INVALID");
      nukeAllWalletData();
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    console.log("[TON-INIT] 🚀 === PROVIDER INITIALIZATION ===");
    
    // Start with nuclear cleaning
    nukeAllWalletData();
    
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    // Check for existing TonConnect UI
    if (window._tonConnectUI) {
      console.log("[TON-INIT] 🔄 Using existing TonConnect UI");
      const existingUI = window._tonConnectUI;
      setTonConnectUI(existingUI);
      
      // Check if it's actually connected with real data
      const realAddress = extractRealTonConnectAddress(existingUI);
      if (realAddress) {
        console.log("[TON-INIT] ✅ Found existing real connection:", realAddress);
        saveRealWalletAddress(realAddress);
      } else {
        console.log("[TON-INIT] ❌ No real connection found in existing UI");
      }
      return;
    }

    // Create new TonConnect UI
    try {
      const options = {
        manifestUrl: tonConnectOptions.manifestUrl,
        preferredWallets: getPreferredWallets()
      };

      console.log("[TON-INIT] 🔧 Creating new TonConnect with options:", options);
      const connector = new TonConnectUI(options);
      
      // Store globally
      window._tonConnectUI = connector;
      setTonConnectUI(connector);

      // Listen for status changes
      const unsubscribe = connector.onStatusChange(handleWalletStatusChange);

      // Check initial state after a delay
      setTimeout(() => {
        console.log("[TON-INIT] 🔍 Checking initial connection state...");
        const realAddress = extractRealTonConnectAddress(connector);
        if (realAddress) {
          console.log("[TON-INIT] ✅ Initial real connection found:", realAddress);
          saveRealWalletAddress(realAddress);
        } else {
          console.log("[TON-INIT] ❌ No initial real connection");
        }
      }, 1000);

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error("[TON-INIT] ❌ TonConnect initialization error:", error);
      nukeAllWalletData();
    }
  }, [toast]);

  const connect = () => {
    if (tonConnectUI) {
      console.log("[TON-CONNECT] 🔗 Opening wallet connection modal");
      nukeAllWalletData(); // Clean slate before connecting
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
    console.log("[TON-DISCONNECT] 🔌 Disconnecting wallet");
    if (tonConnectUI) {
      tonConnectUI.disconnect();
    }
    nukeAllWalletData();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
      variant: "destructive"
    });
  };

  // DEBUG: Log current state
  useEffect(() => {
    console.log("[TON-STATE] 📊 Current provider state:", {
      isConnected,
      walletAddress,
      tonConnectUIConnected: tonConnectUI?.connected,
      tonConnectUIWallet: tonConnectUI?.wallet?.account?.address
    });
  }, [isConnected, walletAddress, tonConnectUI]);

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
