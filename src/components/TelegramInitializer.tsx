
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
      };
    };
  }
}

const TelegramInitializer = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      console.log("TelegramInitializer: Starting initialization");
      
      // Strict check for Telegram WebApp environment
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
        // Store as string to avoid floating-point conversion issues
        telegramUserId = id.toString();
        telegramUserName = username || first_name;
        console.log("Telegram user detected:", { id, first_name, last_name, username });
      } else {
        console.log("No Telegram user data found");
        // For development only
        if (process.env.NODE_ENV === "development") {
          // Use a fixed format UUID string for development
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
