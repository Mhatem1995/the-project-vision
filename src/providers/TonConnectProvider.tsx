
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

  const updateWalletState = (connector: TonConnectUI) => {
    console.log("[TON-DEBUG] Updating wallet state, connector:", connector);
    console.log("[TON-DEBUG] Connector connected:", connector.connected);
    console.log("[TON-DEBUG] Connector wallet:", connector.wallet);
    
    if (connector.connected && connector.wallet) {
      // Get the REAL wallet address from the connector
      const realWalletAddress = connector.wallet.account.address;
      console.log("[TON-DEBUG] REAL wallet address from connector:", realWalletAddress);
      console.log("[TON-DEBUG] Wallet device info:", connector.wallet.device);
      
      if (!isValidTonAddress(realWalletAddress)) {
        console.error("[TON-DEBUG] Invalid TON address format:", realWalletAddress);
        toast({
          title: "Invalid Wallet",
          description: "The wallet address format is not recognized.",
          variant: "destructive"
        });
        clearWalletState();
        return;
      }
      
      setIsConnected(true);
      setWalletAddress(realWalletAddress);
      localStorage.setItem("tonWalletAddress", realWalletAddress);

      // Save wallet connection in database with REAL address
      const userId = localStorage.getItem("telegramUserId");
      if (userId) {
        supabase.functions.invoke('database-helper', {
          body: {
            action: 'save_wallet_connection',
            params: {
              telegram_id: userId,
              wallet_address: realWalletAddress
            }
          }
        }).then(({ data, error }) => {
          if (error) {
            console.error("[TON-DEBUG] Error saving wallet connection:", error);
          } else {
            console.log("[TON-DEBUG] REAL wallet connection saved successfully:", data);
          }
        });

        toast({
          title: "Real TON Wallet Connected",
          description: `Connected to ${connector.wallet?.device.appName || 'TON wallet'} successfully!`,
        });
      }
    } else {
      console.log("[TON-DEBUG] No wallet connected or wallet data missing");
      clearWalletState();
    }
  };

  useEffect(() => {
    // Check if TonConnect UI already exists
    if (window._tonConnectUI) {
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

      console.log("[TON-DEBUG] Initializing TonConnect with options:", options);
      const connector = new TonConnectUI(options);
      window._tonConnectUI = connector;
      setTonConnectUI(connector);

      // Set up status change listener
      const unsubscribe = connector.onStatusChange((wallet) => {
        console.log("[TON-DEBUG] Wallet status changed:", wallet);
        if (wallet) {
          console.log("[TON-DEBUG] Wallet connected, account:", wallet.account);
          updateWalletState(connector);
        } else {
          console.log("[TON-DEBUG] Wallet disconnected");
          clearWalletState();
          toast({
            title: "Wallet Disconnected",
            description: "You have disconnected your wallet.",
            variant: "destructive"
          });
        }
      });

      // Check initial connection state
      console.log("[TON-DEBUG] Checking initial connection state");
      updateWalletState(connector);

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error("[TON-DEBUG] Error initializing TonConnect:", error);
      clearWalletState();
    }
  }, [toast]);

  useEffect(() => {
    setIsTelegramWebApp(detectTelegramWebApp());
  }, []);

  const connect = () => {
    if (tonConnectUI) {
      console.log("[TON-DEBUG] Opening real TON wallet connection modal");
      tonConnectUI.openModal();
    } else {
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
