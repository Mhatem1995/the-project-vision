
import { createContext, useContext, useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Create a dedicated interface for our context
interface TonConnectContextType {
  tonConnectUI: TonConnectUI | null;
  isConnected: boolean;
  walletAddress: string | null;
  connect: () => void;
  disconnect: () => void;
  isTelegramWebApp: boolean;
}

// Create context with defaults
const TonConnectContext = createContext<TonConnectContextType>({
  tonConnectUI: null,
  isConnected: false,
  walletAddress: null,
  connect: () => {},
  disconnect: () => {},
  isTelegramWebApp: false
});

// Custom hook to use the context
export const useTonConnect = () => useContext(TonConnectContext);

// Detect if we're in Telegram WebApp
const detectTelegramWebApp = () => {
  return Boolean(
    typeof window !== "undefined" &&
    window.Telegram &&
    window.Telegram.WebApp &&
    window.Telegram.WebApp.initData &&
    window.Telegram.WebApp.initData.length > 0
  );
};

// Provider component
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  const [tonConnectUI, setTonConnectUI] = useState<TonConnectUI | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const { toast } = useToast();

  // Initialize TonConnect
  useEffect(() => {
    console.log("Initializing TonConnect UI...");

    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);
    
    // Options for TonConnectUI
    const options = {
      manifestUrl: 'https://raw.githubusercontent.com/ton-connect/demo-dapp/main/public/tonconnect-manifest.json',
      // Use embedded wallet in Telegram when available
      preferredWallets: isTgWebApp ? ['telegram-wallet', 'tonkeeper'] : []
    };

    const connector = new TonConnectUI(options);
    setTonConnectUI(connector);

    // Set up listener for connection changes
    const unsubscribe = connector.onStatusChange((wallet) => {
      console.log("Wallet status changed:", wallet ? "connected" : "disconnected");
      
      if (wallet) {
        setIsConnected(true);
        
        // Get the wallet address
        const address = wallet.account.address.toString();
        setWalletAddress(address);
        localStorage.setItem("tonWalletAddress", address);
        
        // Update user in database
        const userId = localStorage.getItem("telegramUserId");
        if (userId) {
          supabase.from("users")
            .update({ links: address }) // Using 'links' column as per existing schema
            .eq("id", userId)
            .then(({ error }) => {
              if (error) console.error("Error updating user wallet:", error);
              else console.log("Successfully updated wallet address in database");
            });
        }

        toast({
          title: "Wallet Connected",
          description: "Your TON wallet has been connected successfully.",
        });
      } else {
        setIsConnected(false);
        setWalletAddress(null);
        localStorage.removeItem("tonWalletAddress");
      }
    });

    // Check for existing session on load
    const savedAddress = localStorage.getItem("tonWalletAddress");
    if (savedAddress) {
      setWalletAddress(savedAddress);
      if (connector.connected) {
        setIsConnected(true);
      }
    }

    return () => {
      unsubscribe();
    };
  }, []);

  // Connect function that opens the wallet modal
  const connect = () => {
    if (tonConnectUI) {
      console.log("Opening TON Connect modal...");
      tonConnectUI.openModal();
    } else {
      console.error("TonConnect UI not initialized");
      toast({
        title: "Connection Error",
        description: "Wallet connection service not initialized",
        variant: "destructive"
      });
    }
  };

  // Disconnect function
  const disconnect = () => {
    if (tonConnectUI) {
      console.log("Disconnecting wallet...");
      tonConnectUI.disconnect();
    }
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
