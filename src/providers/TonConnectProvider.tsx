
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

  // NUCLEAR OPTION: Clear all possible fake wallet data
  const nukeAllFakeWalletData = () => {
    console.log("[TON-NUKE] === NUKING ALL FAKE WALLET DATA ===");
    
    // Clear from state
    setIsConnected(false);
    setWalletAddress(null);
    
    // Clear ALL possible localStorage keys that could contain fake addresses
    const keysToNuke = [
      "tonWalletAddress",
      "walletAddress", 
      "ton_wallet_address",
      "wallet_address",
      "kfcWalletAddress",
      "connectedWallet",
      "ton_connect_wallet",
      "userWallet"
    ];
    
    keysToNuke.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`[TON-NUKE] Removing fake data from localStorage key: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    console.log("[TON-NUKE] All fake wallet data nuked!");
  };

  // ONLY set wallet data if we have a REAL connection
  const setRealWalletData = async (connector: TonConnectUI) => {
    console.log("[TON-REAL] === CHECKING FOR REAL WALLET ===");
    console.log("[TON-REAL] Connector connected:", connector.connected);
    console.log("[TON-REAL] Connector wallet:", connector.wallet);
    
    // STRICT CHECK: Only proceed if we have a real, connected wallet
    if (connector.connected && connector.wallet?.account?.address) {
      const realAddress = connector.wallet.account.address;
      
      console.log("[TON-REAL] ✅ REAL WALLET FOUND!");
      console.log("[TON-REAL] Real address:", realAddress);
      console.log("[TON-REAL] Address type:", typeof realAddress);
      
      // Validate the real address
      if (!isValidTonAddress(realAddress)) {
        console.error("[TON-REAL] ❌ Real address failed validation:", realAddress);
        nukeAllFakeWalletData();
        return;
      }
      
      // First nuke all fake data, then set real data
      nukeAllFakeWalletData();
      
      // Set REAL wallet data
      setIsConnected(true);
      setWalletAddress(realAddress);
      localStorage.setItem("tonWalletAddress", realAddress);
      
      console.log("[TON-REAL] ✅ REAL WALLET SET:", realAddress);
      
      // Save to database
      const userId = localStorage.getItem("telegramUserId");
      if (userId) {
        try {
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
            console.error("[TON-REAL] Database save error:", error);
          } else {
            console.log("[TON-REAL] Real wallet saved to database");
          }
        } catch (saveError) {
          console.error("[TON-REAL] Database save exception:", saveError);
        }
      }
      
      toast({
        title: "Real TON Wallet Connected!",
        description: `Address: ${realAddress.substring(0, 16)}...`,
      });
    } else {
      console.log("[TON-REAL] ❌ NO REAL WALLET CONNECTION");
      console.log("[TON-REAL] Connected:", connector.connected);
      console.log("[TON-REAL] Has wallet:", !!connector.wallet);
      console.log("[TON-REAL] Has account:", !!connector.wallet?.account);
      console.log("[TON-REAL] Has address:", !!connector.wallet?.account?.address);
      
      // No real wallet, nuke everything
      nukeAllFakeWalletData();
    }
  };

  useEffect(() => {
    console.log("[TON-INIT] === PROVIDER INITIALIZATION ===");
    
    // ALWAYS start by nuking fake data
    nukeAllFakeWalletData();
    
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    // Check if TonConnect UI already exists
    if (window._tonConnectUI) {
      console.log("[TON-INIT] Using existing TonConnect UI");
      const existingUI = window._tonConnectUI;
      setTonConnectUI(existingUI);
      setRealWalletData(existingUI);
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

      // Listen for wallet status changes - ONLY accept real connections
      const unsubscribe = connector.onStatusChange((wallet) => {
        console.log("[TON-STATUS] === WALLET STATUS CHANGED ===");
        console.log("[TON-STATUS] New wallet:", wallet);
        
        if (wallet?.account?.address) {
          console.log("[TON-STATUS] ✅ Real wallet connected");
          setRealWalletData(connector);
        } else {
          console.log("[TON-STATUS] ❌ Wallet disconnected or fake");
          nukeAllFakeWalletData();
          toast({
            title: "Wallet Disconnected",
            description: "Your wallet has been disconnected.",
            variant: "destructive"
          });
        }
      });

      // Check initial state after delay
      setTimeout(() => {
        console.log("[TON-INIT] Checking initial wallet state...");
        setRealWalletData(connector);
      }, 1000);

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error("[TON-INIT] ❌ TonConnect initialization error:", error);
      nukeAllFakeWalletData();
    }
  }, [toast]);

  const connect = () => {
    if (tonConnectUI) {
      console.log("[TON-CONNECT] Opening wallet connection modal");
      // Nuke fake data before attempting real connection
      nukeAllFakeWalletData();
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
    nukeAllFakeWalletData();
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
