
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
      
      // More comprehensive Telegram WebApp detection
      const hasTelegramObject = typeof window !== 'undefined' && 
                               window.Telegram && 
                               window.Telegram.WebApp;
      
      console.log("Telegram detection details:", {
        hasTelegramObject,
        hasInitData: hasTelegramObject && window.Telegram.WebApp.initData,
        initDataLength: hasTelegramObject ? window.Telegram.WebApp.initData?.length : 0,
        platform: hasTelegramObject ? window.Telegram.WebApp.platform : 'none',
        version: hasTelegramObject ? window.Telegram.WebApp.version : 'none',
        userAgent: navigator.userAgent
      });
      
      // Enhanced detection - check for Telegram in user agent as fallback
      const isTelegramUserAgent = navigator.userAgent.includes('Telegram');
      
      const isTelegramWebApp = Boolean(
        hasTelegramObject && (
          // Primary check: has initData
          (window.Telegram.WebApp.initData && window.Telegram.WebApp.initData.length > 0) ||
          // Fallback: check for Telegram in user agent and has Telegram object
          isTelegramUserAgent
        )
      );
      
      console.log("Final Telegram WebApp detection:", {
        isTelegramWebApp,
        isTelegramUserAgent,
        finalResult: isTelegramWebApp
      });
      
      if (isTelegramWebApp) {
        console.log("Running inside Telegram WebApp environment");
        localStorage.setItem("inTelegramWebApp", "true");
        
        // Log platform info for debugging
        if (window.Telegram.WebApp.platform) {
          console.log("Telegram platform:", window.Telegram.WebApp.platform);
          localStorage.setItem("telegramPlatform", window.Telegram.WebApp.platform);
        }
        
        // Store version info
        if (window.Telegram.WebApp.version) {
          console.log("Telegram WebApp version:", window.Telegram.WebApp.version);
          localStorage.setItem("telegramVersion", window.Telegram.WebApp.version);
        }
      } else {
        console.log("Not running inside Telegram WebApp environment");
        localStorage.setItem("inTelegramWebApp", "false");
        
        // Force true in development for testing
        if (process.env.NODE_ENV === "development") {
          console.log("Development mode: forcing Telegram WebApp to true");
          localStorage.setItem("inTelegramWebApp", "true");
        }
      }

      let telegramUserId = null;
      let telegramUserName = null;

      if (hasTelegramObject && window.Telegram.WebApp.initDataUnsafe?.user) {
        const { id, first_name, last_name, username } = window.Telegram.WebApp.initDataUnsafe.user;
        
        // Store as string for compatibility
        telegramUserId = id.toString();
        telegramUserName = username || first_name;
        console.log("Telegram user detected:", { id, first_name, last_name, username });
      } else {
        console.log("No Telegram user data found");
        // For development only - use a test user ID
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
