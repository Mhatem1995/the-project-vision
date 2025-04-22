
import { useEffect } from "react";

// Define the window Telegram WebApp interface
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
  useEffect(() => {
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

  return null; // This component doesn't render anything
};

export default TelegramInitializer;
