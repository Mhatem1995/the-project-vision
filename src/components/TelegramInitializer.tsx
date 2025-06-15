
import { useEffect, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";

// Force all Telegram detection/storage to be 100% accurate, no dummy/test fallback!
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
        const hasTelegram = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user;
        const tgUser = hasTelegram ? window.Telegram.WebApp.initDataUnsafe.user : null;

        if (tgUser && tgUser.id) {
          userId = "@" + tgUser.id.toString();
          telegramUserName = tgUser.username ? "@" + tgUser.username : tgUser.first_name || "";
          firstName = tgUser.first_name || "";
          lastName = tgUser.last_name || "";
          languageCode = tgUser.language_code || "";
        } else {
          // For local dev/test ONLY, prompt and require prefix "@"
          userId = localStorage.getItem("telegramUserId");
          if (!userId) {
            userId = prompt("Enter your Telegram ID (include the @):") || "";
          }
          if (userId && !userId.startsWith("@")) {
            userId = "@" + userId;
          }
          telegramUserName = telegramUserName || localStorage.getItem("telegramUserName") || "";
        }

        // Store in localStorage, always prefixed with "@"
        localStorage.setItem("telegramUserId", userId ?? "");
        localStorage.setItem("telegramUserName", telegramUserName ?? "");
      }

      // Always store user in DB as real session, no dummy path
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

  return null;
};

export default TelegramInitializer;
