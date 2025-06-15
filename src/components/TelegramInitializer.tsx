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
  const [debug, setDebug] = useState<any>(null);

  useEffect(() => {
    async function init() {
      // Extract Telegram info clearly and save to localStorage always, not just in Telegram browser
      let userId: string | null = null;
      let telegramUserName: string | null = null;
      let firstName: string | null = null;
      let lastName: string | null = null;
      let languageCode: string | null = null;

      if (typeof window !== "undefined") {
        // Try Telegram context first
        const hasTelegram = window.Telegram && window.Telegram.WebApp;
        const tgUser = hasTelegram ? window.Telegram.WebApp.initDataUnsafe?.user : null;

        if (tgUser && tgUser.id) {
          userId = tgUser.id.toString();
          telegramUserName = tgUser.username || tgUser.first_name || "";
          firstName = tgUser.first_name || "";
          lastName = tgUser.last_name || "";
          languageCode = tgUser.language_code || "";
        }
        // Else fallback: user forced to set in dev or web (simulate)
        if (!userId) {
          // Prompt user just once if missing
          userId = localStorage.getItem("telegramUserId");
          if (!userId) {
            userId = prompt("Enter your Telegram ID (include the @):") || "";
          }
        }
        // If @ not included, autocorrect
        if (userId && !userId.startsWith("@")) {
          userId = "@" + userId;
        }
        telegramUserName = telegramUserName || localStorage.getItem("telegramUserName") || "";
        firstName = firstName || "";
        lastName = lastName || "";
        languageCode = languageCode || "";

        // Save always
        localStorage.setItem("telegramUserId", userId ?? "");
        localStorage.setItem("telegramUserName", telegramUserName ?? "");
      }

      // Always store/ensure user in DB
      try {
        if (userId) {
          await supabase.functions.invoke("database-helper", {
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

  // Always allow the app to render children
  return null;
};

export default TelegramInitializer;
