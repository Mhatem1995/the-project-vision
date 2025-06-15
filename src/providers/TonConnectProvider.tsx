
import { createContext, useContext, useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { tonConnectOptions, isValidTonAddress, getPreferredWallets, convertToUserFriendlyAddress } from "@/integrations/ton/TonConnectConfig";

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
    if (connector.connected && connector.wallet) {
      const rawAddress = connector.wallet.account.address;
      console.log("[TON-DEBUG] Real wallet connected with raw address:", rawAddress);
      console.log("[TON-DEBUG] Wallet info:", {
        name: connector.wallet.device.appName,
        version: connector.wallet.device.appVersion,
        platform: connector.wallet.device.platform
      });

      if (!isValidTonAddress(rawAddress)) {
        console.error("[TON-DEBUG] Invalid TON address format:", rawAddress);
        toast({
          title: "Invalid Wallet",
          description: "The wallet address format is not recognized.",
          variant: "destructive"
        });
        clearWalletState();
        return;
      }
      
      // Convert to user-friendly format if it's raw
      const userFriendlyAddress = convertToUserFriendlyAddress(rawAddress);
      console.log("[TON-DEBUG] Using user-friendly address:", userFriendlyAddress);
      
      setIsConnected(true);
      setWalletAddress(userFriendlyAddress);
      localStorage.setItem("tonWalletAddress", userFriendlyAddress);

      // Save wallet connection in database
      const userId = localStorage.getItem("telegramUserId");
      if (userId) {
        supabase.functions.invoke('database-helper', {
          body: {
            action: 'save_wallet_connection',
            params: {
              telegram_id: userId,
              wallet_address: userFriendlyAddress
            }
          }
        }).then(({ data, error }) => {
          if (error) {
            console.error("[TON-DEBUG] Error saving wallet connection:", error);
          } else {
            console.log("[TON-DEBUG] Real wallet connection saved successfully:", data);
          }
        });

        toast({
          title: "Real TON Wallet Connected",
          description: `Connected to ${connector.wallet?.device.appName || 'TON wallet'} successfully!`,
        });
      }
    } else {
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
          updateWalletState(connector);
        } else {
          clearWalletState();
          toast({
            title: "Wallet Disconnected",
            description: "You have disconnected your wallet.",
            variant: "destructive"
          });
        }
      });

      // Check initial connection state
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
