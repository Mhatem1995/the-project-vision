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
      };
    };
  }
}

const TelegramInitializer = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // Check if running in Telegram WebApp environment
      const isTelegramWebApp = window.Telegram && window.Telegram.WebApp;

      let telegramUserId = "12345678"; // fallback for dev
      let telegramUserName = "DevUser";

      if (isTelegramWebApp && window.Telegram.WebApp.initDataUnsafe.user) {
        const { id, first_name, last_name, username } = window.Telegram.WebApp.initDataUnsafe.user;
        telegramUserId = id.toString();
        telegramUserName = username || first_name;
        console.log("Telegram user:", { id, first_name, last_name, username });
      }
      localStorage.setItem("telegramUserId", telegramUserId);
      localStorage.setItem("telegramUserName", telegramUserName);

      // Check for referral
      const urlParams = new URLSearchParams(window.location.search);
      const referrerId = urlParams.get("ref");

      if (referrerId) {
        console.log("User referred by:", referrerId);
        localStorage.setItem("referrer", referrerId);

        // In a real app, this would make a backend call to record the referral
      }

      // Now check/create in Supabase
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", telegramUserId)
        .maybeSingle();

      if (!user) {
        // Create new user with basic info
        await supabase.from("users").insert({
          id: telegramUserId,
          username: telegramUserName,
          firstname: window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "",
          lastname: window.Telegram?.WebApp?.initDataUnsafe?.user?.last_name || "",
          languagecode: window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || "",
          last_seen_at: new Date().toISOString(),
        });
      } else {
        // If user hasn't logged in for 30+ days, zero out balance (client-side check)
        const lastSeen = user.last_seen_at ? new Date(user.last_seen_at) : null;
        if (lastSeen && (Date.now() - lastSeen.getTime()) > 30 * 24 * 60 * 60 * 1000) {
          await supabase.from("users").update({
            balance: 0,
            last_seen_at: new Date().toISOString(),
          }).eq("id", telegramUserId);
        } else {
          // Always update last_seen_at to now
          await supabase.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", telegramUserId);
        }
      }
      setLoading(false);
    }

    init();
    // Check if running in Telegram WebApp environment
    const isTelegramWebApp = window.Telegram && window.Telegram.WebApp;
    
    if (isTelegramWebApp) {
      console.log("Telegram WebApp detected");
      
      // Initialize the WebApp
      window.Telegram.WebApp.ready();
      
      // Expand the WebApp to take full height
      window.Telegram.WebApp.expand();
      
      // Check if there's a user
      if (window.Telegram.WebApp.initDataUnsafe.user) {
        const { id, first_name, last_name, username } = window.Telegram.WebApp.initDataUnsafe.user;
        console.log("Telegram user:", { id, first_name, last_name, username });
        
        // Save user ID for future use
        localStorage.setItem("telegramUserId", id.toString());
        localStorage.setItem("telegramUserName", username || first_name);
        
        // Check for referral
        const urlParams = new URLSearchParams(window.location.search);
        const referrerId = urlParams.get("ref");
        
        if (referrerId) {
          console.log("User referred by:", referrerId);
          localStorage.setItem("referrer", referrerId);
          
          // In a real app, this would make a backend call to record the referral
        }
      } else {
        console.log("No Telegram user data available");
      }
    } else {
      console.log("Not running in Telegram WebApp environment");
      
      // For development outside of Telegram
      if (process.env.NODE_ENV === "development") {
        console.log("Using development fallback user");
        localStorage.setItem("telegramUserId", "12345678");
        localStorage.setItem("telegramUserName", "DevUser");
      }
    }
  }, []);

  if (loading) {
    // Loading spinner on first Telegram open
    return <LoadingSpinner text="Connecting your Telegram account..." />;
  }

  return null;
};

export default TelegramInitializer;
