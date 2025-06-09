
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
      console.log("=== TELEGRAM INITIALIZER STARTING ===");
      
      // Clear only mining data, preserve user and wallet data
      localStorage.removeItem("kfcBalance");
      localStorage.removeItem("lastMiningTime");
      
      // Enhanced Telegram detection
      const hasTelegramObject = typeof window !== 'undefined' && 
                               window.Telegram && 
                               window.Telegram.WebApp;
      
      const isTelegramUserAgent = navigator.userAgent.includes('Telegram') || 
                                  navigator.userAgent.includes('TelegramBot');
      
      const isInIframe = window !== window.top;
      
      const urlParams = new URLSearchParams(window.location.search);
      const hasTelegramParams = urlParams.has('tgWebAppStartParam') || 
                               urlParams.has('tgWebAppData') ||
                               window.location.hash.includes('tgWebAppStartParam');
      
      console.log("=== TELEGRAM DETECTION DEBUG ===", {
        hasTelegramObject,
        isTelegramUserAgent,
        isInIframe,
        hasTelegramParams,
        userAgent: navigator.userAgent,
        platform: hasTelegramObject ? window.Telegram.WebApp.platform : 'none',
        hasInitData: hasTelegramObject && window.Telegram.WebApp.initData?.length > 0,
        initDataUnsafe: hasTelegramObject ? window.Telegram.WebApp.initDataUnsafe : null
      });
      
      // Force Telegram environment to true for now
      const isTelegramWebApp = true;
      console.log("=== FORCING TELEGRAM ENVIRONMENT TO TRUE ===");
      
      localStorage.setItem("inTelegramWebApp", "true");
      
      if (hasTelegramObject) {
        if (window.Telegram.WebApp.platform) {
          localStorage.setItem("telegramPlatform", window.Telegram.WebApp.platform);
        }
        if (window.Telegram.WebApp.version) {
          localStorage.setItem("telegramVersion", window.Telegram.WebApp.version);
        }
      }

      let telegramUserId = null;
      let telegramUserName = null;
      let firstName = null;
      let lastName = null;
      let languageCode = null;

      // Try to get REAL Telegram user data first
      if (hasTelegramObject && window.Telegram.WebApp.initDataUnsafe?.user) {
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        
        telegramUserId = user.id.toString();
        telegramUserName = user.username || user.first_name;
        firstName = user.first_name || "";
        lastName = user.last_name || "";
        languageCode = user.language_code || "";
        
        console.log("=== REAL TELEGRAM USER DETECTED ===", { 
          id: telegramUserId, 
          username: telegramUserName,
          first_name: firstName,
          last_name: lastName,
          language_code: languageCode
        });
      } else {
        // For development or if no real user data, create a test user
        console.log("=== NO REAL TELEGRAM USER - CREATING TEST USER ===");
        telegramUserId = "999999999"; // Use a consistent test ID
        telegramUserName = "TestUser";
        firstName = "Test";
        lastName = "User";
        languageCode = "en";
        console.log("=== USING TEST USER ===", {
          id: telegramUserId,
          username: telegramUserName
        });
      }

      // ALWAYS save user ID to localStorage (this is critical!)
      if (telegramUserId) {
        console.log("=== SAVING USER ID TO LOCALSTORAGE ===", telegramUserId);
        localStorage.setItem("telegramUserId", telegramUserId);
        localStorage.setItem("telegramUserName", telegramUserName || "");
        
        // Check for referral
        const referrerId = urlParams.get("ref");
        if (referrerId) {
          console.log("User referred by:", referrerId);
          localStorage.setItem("referrer", referrerId);
        }

        // Create/update user in database with better error handling
        try {
          console.log("=== CREATING/UPDATING USER IN DATABASE ===");
          console.log("Telegram ID:", telegramUserId);
          
          // Check if user exists first
          const { data: existingUser, error: fetchError } = await supabase
            .from("users")
            .select("id, balance, links")
            .eq("id", telegramUserId)
            .maybeSingle();
            
          if (fetchError) {
            console.error("Error checking existing user:", fetchError);
          }
          
          console.log("Existing user data:", existingUser);
          
          // Prepare user data
          const userData = {
            id: telegramUserId,
            username: telegramUserName,
            firstname: firstName,
            lastname: lastName,
            languagecode: languageCode,
            last_seen_at: new Date().toISOString(),
            balance: existingUser?.balance || 0,
            links: existingUser?.links || null
          };
          
          console.log("User data to save:", userData);

          // Use INSERT ... ON CONFLICT for better reliability
          const { data: insertResult, error: insertError } = await supabase
            .from("users")
            .insert(userData)
            .select()
            .single();

          if (insertError && insertError.code === '23505') {
            // User exists, update instead
            console.log("User exists, updating...");
            const { data: updateResult, error: updateError } = await supabase
              .from("users")
              .update({
                username: telegramUserName,
                firstname: firstName,
                lastname: lastName,
                languagecode: languageCode,
                last_seen_at: new Date().toISOString()
              })
              .eq("id", telegramUserId)
              .select()
              .single();
              
            if (updateError) {
              console.error("Error updating user:", updateError);
            } else {
              console.log("Successfully updated user:", updateResult);
            }
          } else if (insertError) {
            console.error("Error creating user:", insertError);
          } else {
            console.log("Successfully created user:", insertResult);
          }
          
        } catch (err) {
          console.error("Database operation failed:", err);
        }
      } else {
        console.error("=== CRITICAL: NO TELEGRAM USER ID FOUND ===");
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
