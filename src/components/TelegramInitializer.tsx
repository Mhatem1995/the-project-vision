
import { useEffect, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";

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
        version: string;
      };
    };
  }
}

const TelegramInitializer = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      console.log("TelegramInitializer: Starting initialization");
      
      // FORCE CLEAR ALL WALLET DATA - no exceptions
      console.log("=== FORCE CLEARING ALL WALLET AND CONNECTION DATA ===");
      localStorage.removeItem("kfcBalance");
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("lastMiningTime");
      
      // Also clear any TonConnect stored data
      const tonConnectKeys = Object.keys(localStorage).filter(key => 
        key.includes('ton-connect') || key.includes('tonconnect')
      );
      tonConnectKeys.forEach(key => {
        console.log("Clearing TonConnect key:", key);
        localStorage.removeItem(key);
      });
      
      console.log("=== ALL WALLET DATA CLEARED ===");
      
      // Telegram WebApp detection
      const hasTelegramObject = typeof window !== 'undefined' && 
                               window.Telegram && 
                               window.Telegram.WebApp;
      
      const isTelegramUserAgent = navigator.userAgent.includes('Telegram') || 
                                  navigator.userAgent.includes('TelegramBot');
      
      const isInIframe = window !== window.top;
      
      const urlParams = new URLSearchParams(window.location.search);
      const hasTelegramParams = urlParams.has('tgWebAppStartParam') || 
                               urlParams.has('tgWebAppData') ||
                               window.location.hash.includes('tgWebAppStartParam');
      
      console.log("Telegram detection:", {
        hasTelegramObject,
        isTelegramUserAgent,
        isInIframe,
        hasTelegramParams,
        userAgent: navigator.userAgent,
        platform: hasTelegramObject ? window.Telegram.WebApp.platform : 'none',
        hasInitData: hasTelegramObject && window.Telegram.WebApp.initData?.length > 0
      });
      
      const isTelegramWebApp = Boolean(
        hasTelegramObject && (
          (window.Telegram.WebApp.initData && window.Telegram.WebApp.initData.length > 0) ||
          isTelegramUserAgent ||
          isInIframe ||
          hasTelegramParams ||
          process.env.NODE_ENV === "development"
        )
      );
      
      console.log("Final Telegram WebApp detection result:", isTelegramWebApp);
      
      if (isTelegramWebApp || isTelegramUserAgent) {
        console.log("Detected Telegram environment - setting flag to true");
        localStorage.setItem("inTelegramWebApp", "true");
        
        if (hasTelegramObject) {
          if (window.Telegram.WebApp.platform) {
            localStorage.setItem("telegramPlatform", window.Telegram.WebApp.platform);
          }
          if (window.Telegram.WebApp.version) {
            localStorage.setItem("telegramVersion", window.Telegram.WebApp.version);
          }
        }
      } else {
        console.log("No Telegram environment detected");
        localStorage.setItem("inTelegramWebApp", "false");
        
        if (process.env.NODE_ENV === "development") {
          console.log("Development mode: forcing Telegram WebApp to true");
          localStorage.setItem("inTelegramWebApp", "true");
        }
      }

      let telegramUserId = null;
      let telegramUserName = null;
      let firstName = null;
      let lastName = null;
      let languageCode = null;

      // Get REAL Telegram user data
      if (hasTelegramObject && window.Telegram.WebApp.initDataUnsafe?.user) {
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        
        // Use the ACTUAL Telegram user ID, not a UUID
        telegramUserId = user.id.toString();
        telegramUserName = user.username || user.first_name;
        firstName = user.first_name || "";
        lastName = user.last_name || "";
        languageCode = user.language_code || "";
        
        console.log("REAL Telegram user detected:", { 
          id: telegramUserId, 
          username: telegramUserName,
          first_name: firstName,
          last_name: lastName,
          language_code: languageCode
        });
      } else if (process.env.NODE_ENV === "development") {
        // For development, use a test Telegram ID (not UUID)
        telegramUserId = "123456789"; // Real Telegram ID format
        telegramUserName = "TestUser";
        firstName = "Test";
        lastName = "User";
        languageCode = "en";
        console.log("Using development test user");
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

        // Create user in database with NO wallet connection
        try {
          console.log("=== CREATING USER IN DATABASE WITH NO WALLET ===");
          console.log("Telegram ID:", telegramUserId);
          
          const { data: insertResult, error: insertError } = await supabase
            .from("users")
            .upsert({
              id: telegramUserId,
              username: telegramUserName,
              firstname: firstName,
              lastname: lastName,
              languagecode: languageCode,
              last_seen_at: new Date().toISOString(),
              balance: 0,
              links: null // EXPLICITLY set wallet to null
            }, {
              onConflict: 'id'
            });

          if (insertError) {
            console.error("Error creating/updating user:", insertError);
          } else {
            console.log("Successfully created user with NO wallet:", insertResult);
          }
          
        } catch (err) {
          console.error("Database error:", err);
        }
      } else {
        console.warn("No Telegram user ID found");
      }

      // Initialize Telegram WebApp if available
      if (hasTelegramObject) {
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
