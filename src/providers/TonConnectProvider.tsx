
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

  const validateAndSetWallet = (address: string) => {
    console.log("[TON-DEBUG] Validating wallet address:", address);
    
    if (!isValidTonAddress(address)) {
      console.error("[TON-DEBUG] Invalid TON address format:", address);
      toast({
        title: "Invalid Wallet",
        description: "The connected wallet address is not a valid TON address format.",
        variant: "destructive"
      });
      clearWalletState();
      return false;
    }

    console.log("[TON-DEBUG] Valid TON address confirmed:", address);
    setIsConnected(true);
    setWalletAddress(address);
    localStorage.setItem("tonWalletAddress", address);
    return true;
  };

  useEffect(() => {
    if (window._tonConnectUI) {
      setTonConnectUI(window._tonConnectUI);

      if (window._tonConnectUI.connected && window._tonConnectUI.wallet) {
        const address = window._tonConnectUI.wallet.account.address;
        validateAndSetWallet(address);
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
        preferredWallets: getPreferredWallets()
      };

      console.log("[TON-DEBUG] Initializing TonConnect with options:", options);
      const connector = new TonConnectUI(options);
      window._tonConnectUI = connector;
      setTonConnectUI(connector);

      const unsubscribe = connector.onStatusChange(async (wallet) => {
        if (wallet) {
          const address = wallet.account.address;
          console.log("[TON-DEBUG] Wallet connected with address:", address);
          console.log("[TON-DEBUG] Wallet info:", {
            name: wallet.device.appName,
            version: wallet.device.appVersion,
            platform: wallet.device.platform
          });

          if (validateAndSetWallet(address)) {
            // Save wallet connection in database only if validation passes
            const userId = localStorage.getItem("telegramUserId");
            if (userId) {
              try {
                console.log("[TON-DEBUG] Saving real wallet connection for user:", userId);
                
                const { data, error } = await supabase.functions.invoke('database-helper', {
                  body: {
                    action: 'save_wallet_connection',
                    params: {
                      telegram_id: userId,
                      wallet_address: address
                    }
                  }
                });
                
                if (error) {
                  console.error("[TON-DEBUG] Error saving wallet connection:", error);
                } else {
                  console.log("[TON-DEBUG] Real wallet connection saved successfully:", data);
                }
                
                toast({
                  title: "Real TON Wallet Connected",
                  description: `Connected to ${wallet.device.appName || 'TON wallet'} successfully.`,
                });
              } catch (err) {
                console.error("[TON-DEBUG] Error in wallet connection process:", err);
              }
            } else {
              toast({
                title: "User Error",
                description: "No Telegram user ID found. Please refresh the app.",
                variant: "destructive"
              });
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

      // Restore session if valid
      if (connector.connected && connector.wallet) {
        const address = connector.wallet.account.address;
        validateAndSetWallet(address);
      } else {
        clearWalletState();
      }

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
