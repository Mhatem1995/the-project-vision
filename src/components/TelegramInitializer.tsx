
import { useEffect, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";

// Generates a valid UUID (stub for test/dev)
function getDevUuid() {
  // Example fixed dev UUID for testing - replace as needed
  return "11111111-1111-1111-1111-111111111111";
}

declare global {
  interface Window {
    Telegram: {
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
      console.log("TelegramInitializer: Starting initialization");
      const isDevelopment = process.env.NODE_ENV === "development" || window.location.hostname === "localhost";
      console.log("Development mode:", isDevelopment);

      // Set Telegram WebApp status
      localStorage.setItem("inTelegramWebApp", "true");

      // Clear old IDs for test/dev
      if (isDevelopment) {
        localStorage.removeItem("telegramUserId");
        localStorage.removeItem("telegramUserName");
        localStorage.removeItem("tonWalletAddress");
      }

      let telegramUserId = null;
      let telegramUserName = null;
      let firstName = "";
      let lastName = "";
      let languageCode = "";

      // Check for actual Telegram data first
      const hasTelegramObject =
        typeof window !== "undefined" &&
        window.Telegram &&
        window.Telegram.WebApp;

      if (hasTelegramObject && window.Telegram.WebApp.initDataUnsafe?.user) {
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        telegramUserId = user.id.toString();
        telegramUserName = user.username || user.first_name;
        firstName = user.first_name || "";
        lastName = user.last_name || "";
        languageCode = user.language_code || "";
        console.log("Real Telegram user detected:", user);
      } else if (isDevelopment) {
        // Use dev UUID for test/dev only and warn in console
        telegramUserId = getDevUuid();
        telegramUserName = "DevUser";
        firstName = "Dev";
        lastName = "User";
        languageCode = "en";
        console.warn("USING DEV TEST USER! Replace with real Telegram integration in production!");
      } else {
        // In prod but no Telegram user? Do not proceed!
        setLoading(false);
        window.Telegram?.WebApp?.showAlert?.("Telegram user not found. Please access from Telegram Bot.");
        return;
      }

      // Save user info to localStorage
      if (telegramUserId) {
        localStorage.setItem("telegramUserId", telegramUserId);
        localStorage.setItem("telegramUserName", telegramUserName || "");
      }

      // Ensure user exists in database
      try {
        const { error, data } = await supabase.functions.invoke("database-helper", {
          body: {
            action: "ensure_user_exists",
            params: {
              user_id: telegramUserId,
              username: telegramUserName,
              firstname: firstName,
              lastname: lastName,
              languagecode: languageCode,
            }
          }
        });
        if (error) {
          console.error("Error ensuring user exists:", error);
        } else {
          console.log("User ensured in database successfully", data);
        }
      } catch (err) {
        console.error("Database operation error:", err);
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
