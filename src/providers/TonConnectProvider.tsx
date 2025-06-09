
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
  // Check localStorage first (set by TelegramInitializer)
  const storedValue = localStorage.getItem("inTelegramWebApp");
  if (storedValue === "true") {
    console.log("TonConnect: Using stored Telegram WebApp detection: true");
    return true;
  }
  
  // Check user agent as a strong indicator
  const isTelegramUserAgent = navigator.userAgent.includes('Telegram');
  if (isTelegramUserAgent) {
    console.log("TonConnect: Detected Telegram via user agent");
    localStorage.setItem("inTelegramWebApp", "true");
    return true;
  }
  
  // Fallback detection
  const hasTelegramObject = Boolean(
    typeof window !== "undefined" &&
    window.Telegram &&
    window.Telegram.WebApp
  );
  
  const result = hasTelegramObject || process.env.NODE_ENV === "development";
  
  console.log("TonConnect: Fallback detection result:", result);
  
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
    console.log("Initializing TonConnect UI...");

    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);
    
    // FORCE CLEAR all existing wallet state
    localStorage.removeItem("tonWalletAddress");
    setWalletAddress(null);
    setIsConnected(false);
    console.log("TonConnect: Forcefully cleared all wallet state");
    
    // Options for TonConnectUI with our custom manifest URL
    const options = {
      manifestUrl: tonConnectOptions.manifestUrl,
      // Use embedded wallet in Telegram when available
      preferredWallets: isTgWebApp ? ['telegram-wallet', 'tonkeeper'] : []
    };

    console.log("TonConnect options:", options);
    const connector = new TonConnectUI(options);
    
    // FORCE DISCONNECT any existing connection
    connector.disconnect().catch(console.error);
    
    // Make TonConnect instance globally available
    window._tonConnectUI = connector;
    
    setTonConnectUI(connector);

    // Set up listener for connection changes
    const unsubscribe = connector.onStatusChange(async (wallet) => {
      console.log("Wallet status changed:", wallet ? "connected" : "disconnected");
      console.log("Wallet details:", wallet);
      
      if (wallet && wallet.account) {
        setIsConnected(true);
        
        // Get the wallet address
        const address = wallet.account.address.toString();
        console.log("Connected wallet address:", address);
        
        setWalletAddress(address);
        localStorage.setItem("tonWalletAddress", address);
        
        // Update user in database
        const userId = localStorage.getItem("telegramUserId");
        console.log("Current telegram user ID:", userId);
        
        if (userId) {
          console.log("Saving wallet connection for user:", userId, "address:", address);
          
          // Save to the wallets table using database-helper
          try {
            console.log("Calling database-helper to save wallet connection");
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
              console.error("Error storing wallet connection:", error);
              toast({
                title: "Warning",
                description: "Connected wallet but failed to save connection: " + error.message,
                variant: "default"
              });
            } else {
              console.log("Successfully stored wallet connection:", data);
            }
          } catch (err) {
            console.error("Error calling save_wallet_connection RPC:", err);
            toast({
              title: "Warning",
              description: "Connected wallet but failed to save connection",
              variant: "default"
            });
          }
          
          // Save to users table (for backward compatibility)
          try {
            console.log("Updating user record with wallet address");
            const { error: userError } = await supabase.from("users")
              .update({ links: address })
              .eq("id", userId);
              
            if (userError) {
              console.error("Error updating user wallet in users table:", userError);
            } else {
              console.log("Successfully updated wallet address in users table");
            }
          } catch (err) {
            console.error("Error updating user wallet in users table:", err);
          }
        } else {
          console.warn("No telegram user ID found in local storage");
          toast({
            title: "Warning",
            description: "Wallet connected but user ID not found",
            variant: "default"
          });
        }

        toast({
          title: "Wallet Connected",
          description: "Your TON wallet has been connected successfully.",
        });
      } else {
        console.log("Wallet disconnected or no account found");
        setIsConnected(false);
        setWalletAddress(null);
        localStorage.removeItem("tonWalletAddress");
      }
    });

    // DO NOT check for existing session - start completely fresh
    console.log("TonConnect initialized - starting with NO existing connections");

    return () => {
      unsubscribe();
    };
  }, [toast]);

  // Simplified detection check - no more polling
  useEffect(() => {
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);
  }, []);

  // Connect function that opens the wallet modal
  const connect = () => {
    if (tonConnectUI) {
      console.log("User clicked connect - opening TON Connect modal...");
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
