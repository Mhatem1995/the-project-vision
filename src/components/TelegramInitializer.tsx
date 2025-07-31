
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
        const hasTelegram = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user;
        const tgUser = hasTelegram ? window.Telegram.WebApp.initDataUnsafe.user : null;

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
            lastName
          });
        } else {
          console.error("[TG-DEBUG] No Telegram WebApp environment detected. This app must be run inside Telegram.");
          // For development/testing, use a fallback user ID
          userId = "@11111111-1111-1111-1111-111111111111";
          telegramUserName = "TestUser";
          firstName = "Test";
          lastName = "User";
          languageCode = "en";
        }

        // Store in localStorage without @ prefix for real users
        localStorage.setItem("telegramUserId", userId ?? "");
        localStorage.setItem("telegramUserName", telegramUserName ?? "");
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
