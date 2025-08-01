
import { useEffect, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          query_id?: string;
          user?: {
            id: string | number;
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
      let userId: string | null = null;
      let telegramUserName: string | null = null;
      let firstName: string | null = null;
      let lastName: string | null = null;
      let languageCode: string | null = null;

      if (typeof window !== "undefined") {
        // Comprehensive Telegram detection
        const hasTelegramObject = !!(window.Telegram && window.Telegram.WebApp);
        const hasInitData = !!window.Telegram?.WebApp?.initData;
        const hasUser = !!window.Telegram?.WebApp?.initDataUnsafe?.user;
        const isExpanded = window.Telegram?.WebApp?.isExpanded;
        const platform = window.Telegram?.WebApp?.platform;
        
        console.log("[TG-DEBUG] Telegram detection details:", {
          hasTelegramObject,
          hasInitData,
          hasUser,
          isExpanded,
          platform,
          version: window.Telegram?.WebApp?.version
        });

        if (hasTelegramObject) {
          // Initialize Telegram WebApp
          try {
            window.Telegram.WebApp.ready();
            console.log("[TG-DEBUG] Telegram WebApp ready() called");
          } catch (e) {
            console.warn("[TG-DEBUG] WebApp ready() failed:", e);
          }

          const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
          
          if (tgUser && tgUser.id) {
            // Use real Telegram user ID
            userId = tgUser.id.toString();
            telegramUserName = tgUser.username ? tgUser.username : tgUser.first_name || "";
            firstName = tgUser.first_name || "";
            lastName = tgUser.last_name || "";
            languageCode = tgUser.language_code || "";
            
            console.log("[TG-DEBUG] Real Telegram user detected:", {
              userId,
              username: telegramUserName,
              firstName,
              lastName,
              platform
            });
          } else {
            console.warn("[TG-DEBUG] Telegram WebApp detected but no user data available");
            console.warn("[TG-DEBUG] This may be normal during development or if the WebApp is not properly configured");
            // Don't return here - continue with limited functionality
          }
        } else {
          console.warn("[TG-DEBUG] No Telegram WebApp object detected");
          console.warn("[TG-DEBUG] App should be opened through Telegram bot for full functionality");
          // Don't return here - allow basic functionality for testing
        }

        // Store in localStorage (without @ prefix for user ID)
        if (userId) {
          localStorage.setItem("telegramUserId", userId);
          localStorage.setItem("telegramUserName", telegramUserName ?? "");
          console.log("[TG-DEBUG] Stored user data in localStorage:", { userId, telegramUserName });
        }
      }

      // Store user in database - REAL session only
      try {
        if (userId) {
          console.log("[TG-DEBUG] Ensuring user exists:", userId);
          
          const { data, error } = await supabase.functions.invoke("database-helper", {
            body: {
              action: "ensure_user_exists",
              params: {
                user_id: userId,
                username: telegramUserName,
                firstname: firstName,
                lastname: lastName,
                languagecode: languageCode,
              }
            }
          });
          
          if (error) {
            console.error("[TG-DEBUG] Error ensuring user exists:", error);
          } else {
            console.log("[TG-DEBUG] User ensured successfully:", data);
          }
        }
      } catch (err) {
        console.error("[TG-DEBUG] Database operation error:", err);
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
