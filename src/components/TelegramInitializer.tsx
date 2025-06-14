
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
      // Add high visibility debug info to window console
      const hasTelegram = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
      const telegramUser = hasTelegram && window.Telegram.WebApp.initDataUnsafe?.user;
      const rawInitData = hasTelegram && window.Telegram.WebApp.initDataUnsafe;
      const initData = hasTelegram && window.Telegram.WebApp.initData;

      const debugInfo = {
        windowTelegramExists: !!window.Telegram,
        webAppExists: !!(window.Telegram && window.Telegram.WebApp),
        initData,
        initDataUnsafe: rawInitData,
        telegramUser,
        userIdType: telegramUser && typeof telegramUser.id,
        userId: telegramUser && telegramUser.id,
      };

      setDebug(debugInfo);
      console.log("[TG-DEBUG] Telegram JS object and context:", debugInfo);

      if (!hasTelegram) {
        setLoading(false);
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showAlert) {
          window.Telegram.WebApp.showAlert("Please open this app inside Telegram bot.");
        }
        return;
      }
      if (!telegramUser) {
        setLoading(false);
        if (window.Telegram.WebApp.showAlert) {
          window.Telegram.WebApp.showAlert(
            "Telegram did not provide user info. Try closing all WebApp tabs and reopening via the Telegram bot's 'Open WebApp' button."
          );
        }
        return;
      }

      localStorage.setItem("inTelegramWebApp", "true");
      const telegramUserId = telegramUser.id.toString();
      const telegramUserName = telegramUser.username || telegramUser.first_name || "";
      const firstName = telegramUser.first_name || "";
      const lastName = telegramUser.last_name || "";
      const languageCode = telegramUser.language_code || "";

      localStorage.setItem("telegramUserId", telegramUserId);
      localStorage.setItem("telegramUserName", telegramUserName);

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
          console.error("[TG-DEBUG] Error ensuring user exists:", error);
        } else {
          console.log("[TG-DEBUG] User ensured in database successfully", data);
        }
      } catch (err) {
        console.error("[TG-DEBUG] Database operation error:", err);
      }

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

  // Strong UX: Block users outside Telegram with a clear message and show debug info if available
  const hasTelegram = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
  const telegramUser = hasTelegram && window.Telegram.WebApp.initDataUnsafe?.user;
  if (!hasTelegram || !telegramUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[30vh] text-center text-lg font-bold text-destructive p-6">
        This app must be opened from inside the Telegram bot via the "Open WebApp" button.
        <br />
        Please open this site from Telegram.<br /><br />
        <span className="text-xs text-muted-foreground break-all">
          [TG-DEBUG] Telegram JS object: <br />
          <pre className="max-w-xs overflow-x-auto text-left bg-neutral-100 p-2 rounded">
            {JSON.stringify(debug, null, 2)}
          </pre>
        </span>
      </div>
    );
  }

  return null;
};

export default TelegramInitializer;
