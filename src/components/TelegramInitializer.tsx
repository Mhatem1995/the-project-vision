
import { useEffect, useState, createContext, useContext } from "react";
import LoadingSpinner from "./LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";
import { TonConnect } from '@tonconnect/sdk';
import { tonConnectOptions } from "@/integrations/ton/TonConnectConfig";

// Create a context for TonConnect
const TonConnectContext = createContext<{
  connector: TonConnect | null;
  connected: boolean;
  account: any;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isTelegramWebApp: boolean;
} | null>(null);

export const useTonConnect = () => {
  const context = useContext(TonConnectContext);
  if (!context) {
    throw new Error("useTonConnect must be used within TonConnectProvider");
  }
  return context;
};

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          query_id?: string;
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          auth_date?: string;
          hash?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        onEvent: (eventType: string, eventHandler: Function) => void;
        offEvent: (eventType: string, eventHandler: Function) => void;
        sendData: (data: string) => void;
        openLink: (url: string) => void;
        showAlert: (message: string) => void;
        showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
        isExpanded: boolean;
        platform: string;
      };
    };
  }
}

// Wrapper component that provides TON Connect throughout the app
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  const [connector, setConnector] = useState<TonConnect | null>(null);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  
  // Initialize TON Connect instance
  useEffect(() => {
    console.log("Initializing TON Connect...");
    const connectorInstance = new TonConnect({ manifestUrl: tonConnectOptions.manifestUrl });
    
    // Check if there's an existing connection
    const walletConnectionSource = connectorInstance.getWalletConnectionSource();
    if (walletConnectionSource) {
      console.log("Found existing wallet connection source:", walletConnectionSource);
    }
    
    // Set up event listeners
    const unsubscribe = connectorInstance.onStatusChange(walletInfo => {
      console.log("Wallet status changed:", walletInfo ? "connected" : "disconnected");
      
      if (walletInfo) {
        setConnected(true);
        setAccount(walletInfo);
        
        // Save to localStorage
        if (walletInfo.account?.address) {
          const address = walletInfo.account.address.toString();
          localStorage.setItem("tonWalletAddress", address);
          
          // Update user in database
          const userId = localStorage.getItem("telegramUserId");
          if (userId) {
            supabase.from("users")
              .update({ links: address })
              .eq("id", userId)
              .then(({ error }) => {
                if (error) console.error("Error updating user wallet:", error);
                else console.log("Successfully updated wallet address in database");
              });
          }
        }
      } else {
        setConnected(false);
        setAccount(null);
        localStorage.removeItem("tonWalletAddress");
      }
    });
    
    setConnector(connectorInstance);
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Check if we're in Telegram WebApp
  useEffect(() => {
    const isTgWebApp = Boolean(
      typeof window !== 'undefined' &&
      window.Telegram && 
      window.Telegram.WebApp &&
      window.Telegram.WebApp.initData &&
      window.Telegram.WebApp.initData.length > 0
    );
    
    setIsTelegramWebApp(isTgWebApp);
    console.log("Is Telegram WebApp:", isTgWebApp);
    
    if (isTgWebApp) {
      console.log("Telegram WebApp platform:", window.Telegram.WebApp.platform);
    }
  }, []);

  // Connect function that handles different environments
  const connect = async () => {
    if (!connector) return;
    
    try {
      console.log("Connecting to TON wallet...");
      
      // Get available wallets
      const walletsList = await connector.getWallets();
      console.log("Available wallets:", walletsList);
      
      if (isTelegramWebApp) {
        // In Telegram, prefer embedded wallets
        const embeddedWallets = walletsList.filter(wallet => 
          wallet.embedded && ["telegram", "tonkeeper"].includes(wallet.name.toLowerCase())
        );
        
        if (embeddedWallets.length > 0) {
          console.log("Using embedded wallet:", embeddedWallets[0].name);
          await connector.connect({ jsBridgeKey: embeddedWallets[0].jsBridgeKey });
        } else {
          // Universal connection method
          await connector.connect();
        }
      } else {
        // Outside Telegram use standard connection
        await connector.connect();
      }
    } catch (err) {
      console.error("Error connecting to wallet:", err);
      throw err;
    }
  };

  // Disconnect from wallet
  const disconnect = async () => {
    if (!connector) return;
    try {
      await connector.disconnect();
    } catch (err) {
      console.error("Error disconnecting wallet:", err);
      throw err;
    }
  };

  return (
    <TonConnectContext.Provider value={{ 
      connector, 
      connected, 
      account, 
      connect,
      disconnect,
      isTelegramWebApp
    }}>
      {children}
    </TonConnectContext.Provider>
  );
};

const TelegramInitializer = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      console.log("TelegramInitializer: Starting initialization");
      
      // Enhanced Telegram WebApp detection - check multiple properties and verify initData
      const isTelegramWebApp = Boolean(
        typeof window !== 'undefined' &&
        window.Telegram && 
        window.Telegram.WebApp &&
        window.Telegram.WebApp.initData &&
        window.Telegram.WebApp.initData.length > 0
      );
      
      if (isTelegramWebApp) {
        console.log("Running inside Telegram WebApp environment");
        localStorage.setItem("inTelegramWebApp", "true");
        
        // Log platform info for debugging
        if (window.Telegram.WebApp.platform) {
          console.log("Telegram platform:", window.Telegram.WebApp.platform);
          localStorage.setItem("telegramPlatform", window.Telegram.WebApp.platform);
        }
      } else {
        console.log("Not running inside Telegram WebApp environment");
        localStorage.setItem("inTelegramWebApp", "false");
      }

      let telegramUserId = null;
      let telegramUserName = null;

      if (isTelegramWebApp && window.Telegram.WebApp.initDataUnsafe.user) {
        const { id, first_name, last_name, username } = window.Telegram.WebApp.initDataUnsafe.user;
        
        // Store as UUID-compatible string, ensuring it's properly formatted for database
        telegramUserId = id.toString();
        telegramUserName = username || first_name;
        console.log("Telegram user detected:", { id, first_name, last_name, username });
      } else {
        console.log("No Telegram user data found");
        // For development only - use a valid UUID format
        if (process.env.NODE_ENV === "development") {
          telegramUserId = "00000000-0000-0000-0000-000000000000";
          telegramUserName = "DevUser";
          console.log("Using development fallback user");
        }
      }

      // Save to localStorage if we have a user
      if (telegramUserId) {
        localStorage.setItem("telegramUserId", telegramUserId);
        localStorage.setItem("telegramUserName", telegramUserName || "");
        
        // Check for referral
        const urlParams = new URLSearchParams(window.location.search);
        const referrerId = urlParams.get("ref");
        
        if (referrerId) {
          console.log("User referred by:", referrerId);
          localStorage.setItem("referrer", referrerId);
        }

        // Now ensure user exists in Supabase
        try {
          const { data: existingUser, error: fetchError } = await supabase
            .from("users")
            .select("*")
            .eq("id", telegramUserId)
            .maybeSingle();

          if (fetchError) {
            console.error("Error fetching user:", fetchError);
          }

          if (!existingUser) {
            console.log("Creating new user in database");
            // Create new user with basic info
            const { error: insertError } = await supabase.from("users").insert({
              id: telegramUserId,
              username: telegramUserName,
              firstname: window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "",
              lastname: window.Telegram?.WebApp?.initDataUnsafe?.user?.last_name || "",
              languagecode: window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || "",
              last_seen_at: new Date().toISOString(),
              balance: 0
            });

            if (insertError) {
              console.error("Error creating user:", insertError);
            }
          } else {
            console.log("User exists, updating last_seen_at");
            // Update last_seen_at
            const { error: updateError } = await supabase
              .from("users")
              .update({ last_seen_at: new Date().toISOString() })
              .eq("id", telegramUserId);

            if (updateError) {
              console.error("Error updating user:", updateError);
            }

            // Check if we need to reset balance (30+ days inactive)
            const lastSeen = existingUser.last_seen_at ? new Date(existingUser.last_seen_at) : null;
            if (lastSeen && (Date.now() - lastSeen.getTime()) > 30 * 24 * 60 * 60 * 1000) {
              console.log("User inactive for 30+ days, resetting balance");
              await supabase
                .from("users")
                .update({ balance: 0 })
                .eq("id", telegramUserId);
            }
          }
        } catch (err) {
          console.error("Database error:", err);
        }
      }

      // Initialize Telegram WebApp if available
      if (isTelegramWebApp) {
        console.log("Initializing Telegram WebApp");
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      }

      setLoading(false);
    }

    init();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Connecting your Telegram account..." />;
  }

  return null;
};

export default TelegramInitializer;
