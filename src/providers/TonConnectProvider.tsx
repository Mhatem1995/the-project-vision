
import { createContext, useContext, useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { tonConnectOptions } from "@/integrations/ton/TonConnectConfig";

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
  const storedValue = localStorage.getItem("inTelegramWebApp");
  if (storedValue === "true") {
    return true;
  }
  const isTelegramUserAgent = navigator.userAgent.includes('Telegram');
  if (isTelegramUserAgent) {
    localStorage.setItem("inTelegramWebApp", "true");
    return true;
  }
  const hasTelegramObject = Boolean(
    typeof window !== "undefined" &&
    window.Telegram &&
    window.Telegram.WebApp
  );
  const result = hasTelegramObject || process.env.NODE_ENV === "development";
  if (result) {
    localStorage.setItem("inTelegramWebApp", "true");
  }
  return result;
};

export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  const [tonConnectUI, setTonConnectUI] = useState<TonConnectUI | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const { toast } = useToast();

  // Utility to completely clear wallet connection state from localStorage/UI
  const clearWalletState = () => {
    setIsConnected(false);
    setWalletAddress(null);
    localStorage.removeItem("tonWalletAddress");
    console.log("Cleared wallet connection state");
  };

  useEffect(() => {
    // Prevent double initialization
    if (window._tonConnectUI) {
      console.log("TonConnect already initialized, reusing existing instance");
      setTonConnectUI(window._tonConnectUI);

      if (window._tonConnectUI.connected && window._tonConnectUI.wallet) {
        const address = window._tonConnectUI.wallet.account.address;
        setIsConnected(true);
        setWalletAddress(address);
        localStorage.setItem("tonWalletAddress", address);
      } else {
        clearWalletState();
      }
      return;
    }

    console.log("Initializing TonConnect UI...");

    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    try {
      const options = {
        manifestUrl: tonConnectOptions.manifestUrl,
        preferredWallets: isTgWebApp ? ['telegram-wallet', 'tonkeeper'] : []
      };

      const connector = new TonConnectUI(options);
      window._tonConnectUI = connector;
      setTonConnectUI(connector);

      // Listen to wallet status changes
      const unsubscribe = connector.onStatusChange(async (wallet) => {
        if (wallet) {
          // Wallet connected event
          setIsConnected(true);
          const address = wallet.account.address;
          setWalletAddress(address);
          localStorage.setItem("tonWalletAddress", address);

          // Ensure user exists in database
          const userId = localStorage.getItem("telegramUserId");
          if (userId) {
            try {
              const { error: walletError } = await supabase.functions.invoke('database-helper', {
                body: {
                  action: 'save_wallet_connection',
                  params: {
                    telegram_id: userId,
                    wallet_address: address
                  }
                }
              });
              if (walletError) {
                console.error("Error saving wallet connection:", walletError);
              }
              toast({
                title: "Wallet Connected",
                description: "Your TON wallet has been connected successfully.",
              });
            } catch (err) {
              console.error("Error in wallet connection process:", err);
            }
          }
        } else {
          // Wallet disconnected event
          clearWalletState();
          toast({
            title: "Wallet Disconnected",
            description: "You have disconnected your wallet.",
            variant: "destructive"
          });
        }
      });

      // Restore session only if valid
      if (connector.connected && connector.wallet) {
        const address = connector.wallet.account.address;
        setIsConnected(true);
        setWalletAddress(address);
        localStorage.setItem("tonWalletAddress", address);
      } else {
        clearWalletState();
      }

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error("Error initializing TonConnect:", error);
      clearWalletState();
    }
  }, [toast]);

  useEffect(() => {
    setIsTelegramWebApp(detectTelegramWebApp());
  }, []);

  const connect = () => {
    if (tonConnectUI) {
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
    if (tonConnectUI) {
      tonConnectUI.disconnect();
    }
    clearWalletState();
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
