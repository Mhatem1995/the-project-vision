
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
      
      // Check for development mode
      const isDevelopment = process.env.NODE_ENV === "development" || window.location.hostname === "localhost";
      console.log("Development mode:", isDevelopment);
      
      // Set Telegram WebApp status
      localStorage.setItem("inTelegramWebApp", "true");
      
      let telegramUserId = null;
      let telegramUserName = null;

      // Check for actual Telegram data first
      const hasTelegramObject = typeof window !== 'undefined' && 
                               window.Telegram && 
                               window.Telegram.WebApp;

      if (hasTelegramObject && window.Telegram.WebApp.initDataUnsafe?.user) {
        const { id, first_name, last_name, username } = window.Telegram.WebApp.initDataUnsafe.user;
        telegramUserId = id.toString();
        telegramUserName = username || first_name;
        console.log("Real Telegram user detected:", { id, first_name, last_name, username });
      } else {
        // Use test user for development/testing - but DON'T simulate wallet connection
        telegramUserId = "test-user-123";
        telegramUserName = "TestUser";
        console.log("Using test user for development");
      }

      // Save user info to localStorage
      if (telegramUserId) {
        localStorage.setItem("telegramUserId", telegramUserId);
        localStorage.setItem("telegramUserName", telegramUserName || "");
        
        console.log("Creating/updating user in database:", telegramUserId);

        // Use the database helper to ensure user exists
        try {
          const { error } = await supabase.functions.invoke('database-helper', {
            body: {
              action: 'ensure_user_exists',
              params: {
                user_id: telegramUserId,
                username: telegramUserName,
                firstname: window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "",
                lastname: window.Telegram?.WebApp?.initDataUnsafe?.user?.last_name || "",
                languagecode: window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || ""
              }
            }
          });

          if (error) {
            console.error("Error ensuring user exists:", error);
          } else {
            console.log("User ensured in database successfully");
          }
        } catch (err) {
          console.error("Database operation error:", err);
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
