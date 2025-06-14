
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
      console.log("TelegramInitializer: Starting initialization");

      // Make sure we're inside Telegram WebApp
      const hasTelegram = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
      const telegramUser = hasTelegram && window.Telegram.WebApp.initDataUnsafe?.user;

      if (!hasTelegram || !telegramUser) {
        setLoading(false);
        // Show UI-level error
        if (hasTelegram && window.Telegram.WebApp.showAlert) {
          window.Telegram.WebApp.showAlert("Please open this app inside Telegram bot.");
        }
        // Optionally render a UI error here for users outside Telegram (see below)
        return;
      }
      // Set Telegram WebApp status
      localStorage.setItem("inTelegramWebApp", "true");

      // Extract Telegram user data (now using text IDs)
      const telegramUserId = telegramUser.id.toString();
      const telegramUserName = telegramUser.username || telegramUser.first_name || "";
      const firstName = telegramUser.first_name || "";
      const lastName = telegramUser.last_name || "";
      const languageCode = telegramUser.language_code || "";

      // Save user info to localStorage (always text ids)
      localStorage.setItem("telegramUserId", telegramUserId);
      localStorage.setItem("telegramUserName", telegramUserName);

      // Ensure user exists in database with Telegram ID as TEXT
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

      // Initialize Telegram WebApp UI
      try {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      } catch (e) {
        // No-op for safety
      }

      setLoading(false);
    }

    init();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Connecting your Telegram account..." />;
  }

  // Strong UX: Block users outside Telegram with a clear message
  const hasTelegram = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
  const telegramUser = hasTelegram && window.Telegram.WebApp.initDataUnsafe?.user;
  if (!hasTelegram || !telegramUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[30vh] text-center text-lg font-bold text-destructive p-6">
        This app must be opened from inside the Telegram bot via the "Open WebApp" button.<br />
        Please open this site from Telegram.
      </div>
    );
  }

  return null;
};

export default TelegramInitializer;
