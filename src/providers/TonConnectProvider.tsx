
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
    setIsConnected(false);
    setWalletAddress(null);
    localStorage.removeItem("tonWalletAddress");
    console.log("[TON-DEBUG] Cleared wallet connection state");
  };

  const updateWalletState = async (connector: TonConnectUI) => {
    console.log("[TON-DEBUG] === WALLET STATE UPDATE ===");
    console.log("[TON-DEBUG] TonConnect connected:", connector.connected);
    console.log("[TON-DEBUG] TonConnect wallet object:", connector.wallet);
    
    if (connector.connected && connector.wallet?.account) {
      // Get the REAL wallet address directly from TonConnect - this is the fix!
      const realWalletAddress = connector.wallet.account.address;
      console.log("[TON-DEBUG] ✅ REAL wallet address from TonConnect:", realWalletAddress);
      console.log("[TON-DEBUG] Address type:", typeof realWalletAddress);
      console.log("[TON-DEBUG] Address length:", realWalletAddress?.length);
      console.log("[TON-DEBUG] Wallet device info:", connector.wallet.device);
      console.log("[TON-DEBUG] Wallet account full object:", JSON.stringify(connector.wallet.account, null, 2));
      
      // Convert to string if needed and validate
      const addressString = realWalletAddress.toString();
      console.log("[TON-DEBUG] Address as string:", addressString);
      
      if (!isValidTonAddress(addressString)) {
        console.error("[TON-DEBUG] ❌ Invalid TON address format:", addressString);
        toast({
          title: "Invalid Wallet",
          description: "The wallet address format is not recognized.",
          variant: "destructive"
        });
        clearWalletState();
        return;
      }
      
      console.log("[TON-DEBUG] ✅ Address validation passed");
      
      // Update state immediately with the REAL address
      setIsConnected(true);
      setWalletAddress(addressString);
      localStorage.setItem("tonWalletAddress", addressString);
      
      console.log("[TON-DEBUG] ✅ State updated with REAL address:", addressString);

      // Save wallet connection in database with REAL address
      const userId = localStorage.getItem("telegramUserId");
      if (userId) {
        console.log("[TON-DEBUG] Saving REAL wallet connection to database:", { userId, realWalletAddress: addressString });
        
        try {
          const { data, error } = await supabase.functions.invoke('database-helper', {
            body: {
              action: 'save_wallet_connection',
              params: {
                telegram_id: userId,
                wallet_address: addressString  // Use the REAL address string
              }
            }
          });
          
          if (error) {
            console.error("[TON-DEBUG] ❌ Error saving wallet connection:", error);
          } else {
            console.log("[TON-DEBUG] ✅ REAL wallet connection saved successfully:", data);
          }
        } catch (saveError) {
          console.error("[TON-DEBUG] ❌ Exception saving wallet:", saveError);
        }

        toast({
          title: "Real TON Wallet Connected",
          description: `Connected to ${connector.wallet?.device.appName || 'TON wallet'} successfully!`,
        });
      }
    } else {
      console.log("[TON-DEBUG] ❌ No wallet connected or missing account data");
      console.log("[TON-DEBUG] Connected:", connector.connected);
      console.log("[TON-DEBUG] Wallet:", connector.wallet);
      clearWalletState();
    }
  };

  useEffect(() => {
    console.log("[TON-DEBUG] === INITIALIZING TONCONNECT ===");
    
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
        console.log("[TON-DEBUG] Wallet account:", wallet?.account);
        console.log("[TON-DEBUG] Wallet device:", wallet?.device);
        
        if (wallet?.account) {
          console.log("[TON-DEBUG] ✅ Wallet connected with account address:", wallet.account.address);
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
