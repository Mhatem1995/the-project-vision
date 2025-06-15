
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

  const clearWalletState = () => {
    console.log("[TON-DEBUG] === CLEARING ALL WALLET STATE ===");
    setIsConnected(false);
    setWalletAddress(null);
    
    // Clear ALL possible storage locations for fake addresses
    localStorage.removeItem("tonWalletAddress");
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("ton_wallet_address");
    
    console.log("[TON-DEBUG] Cleared all wallet connection state and storage");
  };

  const updateWalletState = async (connector: TonConnectUI) => {
    console.log("[TON-DEBUG] === WALLET STATE UPDATE START ===");
    console.log("[TON-DEBUG] TonConnect connected:", connector.connected);
    console.log("[TON-DEBUG] TonConnect wallet:", connector.wallet);
    console.log("[TON-DEBUG] TonConnect account:", connector.wallet?.account);
    console.log("[TON-DEBUG] Raw address from connector:", connector.wallet?.account?.address);
    
    if (connector.connected && connector.wallet?.account?.address) {
      // Get the REAL address directly from TonConnect
      const realAddress = connector.wallet.account.address;
      console.log("[TON-DEBUG] ✅ REAL ADDRESS EXTRACTED:", realAddress);
      console.log("[TON-DEBUG] Address type:", typeof realAddress);
      console.log("[TON-DEBUG] Address length:", realAddress.length);
      
      // Validate the address format
      if (!isValidTonAddress(realAddress)) {
        console.error("[TON-DEBUG] ❌ Invalid TON address format:", realAddress);
        toast({
          title: "Invalid Wallet",
          description: "The wallet address format is not recognized.",
          variant: "destructive"
        });
        clearWalletState();
        return;
      }
      
      console.log("[TON-DEBUG] ✅ Address validation PASSED for:", realAddress);
      
      // FORCE clear any old fake addresses first
      clearWalletState();
      
      // Now set the REAL address
      setIsConnected(true);
      setWalletAddress(realAddress);
      localStorage.setItem("tonWalletAddress", realAddress);
      
      console.log("[TON-DEBUG] ✅ STATE UPDATED WITH REAL ADDRESS:", realAddress);
      console.log("[TON-DEBUG] ✅ STORED IN LOCALSTORAGE:", realAddress);

      // Save to database
      const userId = localStorage.getItem("telegramUserId");
      if (userId) {
        console.log("[TON-DEBUG] Saving REAL wallet to database:", { userId, realAddress });
        
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
            console.error("[TON-DEBUG] ❌ Database error:", error);
          } else {
            console.log("[TON-DEBUG] ✅ Real wallet saved to database:", data);
          }
        } catch (saveError) {
          console.error("[TON-DEBUG] ❌ Exception saving wallet:", saveError);
        }

        toast({
          title: "Real TON Wallet Connected",
          description: `Connected successfully! Address: ${realAddress.substring(0, 10)}...`,
        });
      }
    } else {
      console.log("[TON-DEBUG] ❌ No wallet connected or missing data");
      console.log("[TON-DEBUG] Connected:", connector.connected);
      console.log("[TON-DEBUG] Has wallet:", !!connector.wallet);
      console.log("[TON-DEBUG] Has account:", !!connector.wallet?.account);
      console.log("[TON-DEBUG] Has address:", !!connector.wallet?.account?.address);
      clearWalletState();
    }
    console.log("[TON-DEBUG] === WALLET STATE UPDATE END ===");
  };

  useEffect(() => {
    console.log("[TON-DEBUG] === INITIALIZING TONCONNECT ===");
    
    // Clear any fake addresses on startup
    clearWalletState();
    
    // Check if TonConnect UI already exists
    if (window._tonConnectUI) {
      console.log("[TON-DEBUG] Using existing TonConnect UI instance");
      const existingUI = window._tonConnectUI;
      setTonConnectUI(existingUI);
      updateWalletState(existingUI);
      return;
    }

    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    try {
      const options = {
        manifestUrl: tonConnectOptions.manifestUrl,
        preferredWallets: getPreferredWallets()
      };

      console.log("[TON-DEBUG] Creating new TonConnect with options:", options);
      const connector = new TonConnectUI(options);
      
      // Store globally for access
      window._tonConnectUI = connector;
      setTonConnectUI(connector);

      // Set up status change listener FIRST
      const unsubscribe = connector.onStatusChange((wallet) => {
        console.log("[TON-DEBUG] === WALLET STATUS CHANGED ===");
        console.log("[TON-DEBUG] New wallet status:", wallet);
        
        if (wallet?.account?.address) {
          console.log("[TON-DEBUG] ✅ Wallet connected with real address:", wallet.account.address);
          updateWalletState(connector);
        } else {
          console.log("[TON-DEBUG] ❌ Wallet disconnected or no account");
          clearWalletState();
          toast({
            title: "Wallet Disconnected", 
            description: "You have disconnected your wallet.",
            variant: "destructive"
          });
        }
      });

      // Check initial connection state after a brief delay
      setTimeout(() => {
        console.log("[TON-DEBUG] Checking initial connection state...");
        updateWalletState(connector);
      }, 500);

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error("[TON-DEBUG] ❌ Error initializing TonConnect:", error);
      clearWalletState();
    }
  }, [toast]);

  const connect = () => {
    if (tonConnectUI) {
      console.log("[TON-DEBUG] Opening real TON wallet connection modal");
      // Clear any fake addresses before connecting
      clearWalletState();
      tonConnectUI.openModal();
    } else {
      console.error("[TON-DEBUG] ❌ TonConnect UI not available");
      toast({
        title: "Connection Error",
        description: "Wallet connection service not ready. Please try again.",
        variant: "destructive"
      });
    }
  };

  const disconnect = () => {
    console.log("[TON-DEBUG] Disconnecting real wallet");
    if (tonConnectUI) {
      tonConnectUI.disconnect();
    }
    clearWalletState();
    toast({
      title: "Wallet Disconnected",
      description: "You have disconnected your wallet.",
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
