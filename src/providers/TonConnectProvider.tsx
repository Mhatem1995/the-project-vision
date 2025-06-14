
import { createContext, useContext, useEffect, useState } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { tonConnectOptions } from "@/integrations/ton/TonConnectConfig";

// Add this to window global for access in other components
declare global {
  interface Window {
    _tonConnectUI?: TonConnectUI;
  }
}

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

// Simplified and more reliable Telegram WebApp detection
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

// Provider component
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  const [tonConnectUI, setTonConnectUI] = useState<TonConnectUI | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const { toast } = useToast();

  // Initialize TonConnect
  useEffect(() => {
    // Prevent double initialization
    if (window._tonConnectUI) {
      console.log("TonConnect already initialized, reusing existing instance");
      setTonConnectUI(window._tonConnectUI);
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

      console.log("TonConnect options:", options);
      const connector = new TonConnectUI(options);
      
      // Make TonConnect instance globally available
      window._tonConnectUI = connector;
      setTonConnectUI(connector);

      // Set up listener for connection changes
      const unsubscribe = connector.onStatusChange(async (wallet) => {
        console.log("Wallet status changed:", wallet ? "connected" : "disconnected");
        
        if (wallet) {
          setIsConnected(true);
          
          const address = wallet.account.address;
          console.log("Connected wallet address:", address);
          
          setWalletAddress(address);
          localStorage.setItem("tonWalletAddress", address);
          
          // Ensure user exists in database first
          const userId = localStorage.getItem("telegramUserId");
          if (userId) {
            console.log("Ensuring user exists and saving wallet for:", userId);
            
            try {
              // First, ensure user exists
              const { error: userError } = await supabase
                .from("users")
                .upsert({ 
                  id: userId,
                  links: address 
                }, { 
                  onConflict: 'id',
                  ignoreDuplicates: false 
                });
                
              if (userError) {
                console.warn("User upsert warning (might be normal):", userError);
              }
              
              // Then save wallet connection
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
              } else {
                console.log("Wallet connection saved successfully");
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
          setIsConnected(false);
          setWalletAddress(null);
          localStorage.removeItem("tonWalletAddress");
          console.log("Wallet disconnected");
        }
      });

      // Check for existing session
      const savedAddress = localStorage.getItem("tonWalletAddress");
      if (savedAddress && connector.connected) {
        console.log("Restoring existing wallet connection:", savedAddress);
        setWalletAddress(savedAddress);
        setIsConnected(true);
      }

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error("Error initializing TonConnect:", error);
    }
  }, [toast]);

  useEffect(() => {
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);
  }, []);

  // Connect function
  const connect = () => {
    if (tonConnectUI) {
      console.log("Opening TON Connect modal...");
      tonConnectUI.openModal();
    } else {
      console.error("TonConnect UI not initialized");
      toast({
        title: "Connection Error",
        description: "Wallet connection service not ready. Please try again.",
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
