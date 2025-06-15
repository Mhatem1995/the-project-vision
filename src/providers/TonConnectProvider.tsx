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
  // Only enable Telegram WebApp detection if we're truly inside Telegram
  const storedValue = localStorage.getItem("inTelegramWebApp");
  if (storedValue === "true") {
    return true;
  }
  if (typeof window !== "undefined") {
    const hasTelegramObject = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user);
    if (hasTelegramObject) {
      localStorage.setItem("inTelegramWebApp", "true");
      return true;
    }
  }
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
    console.log("Cleared wallet connection state");
  };

  useEffect(() => {
    // No more dev/test fallback - only real connection logic
    if (window._tonConnectUI) {
      setTonConnectUI(window._tonConnectUI);

      // Only set connection if REAL wallet is connected
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
          setIsConnected(true);
          const address = wallet.account.address;
          setWalletAddress(address);
          localStorage.setItem("tonWalletAddress", address);

          // Persist wallet to DB for this real user's Telegram ID (as TEXT)
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
              // Only show wallet connected toast if newly connected
              toast({
                title: "Wallet Connected",
                description: "Your TON wallet has been connected successfully.",
              });
            } catch (err) {
              console.error("Error in wallet connection process:", err);
            }
          }
        } else {
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
