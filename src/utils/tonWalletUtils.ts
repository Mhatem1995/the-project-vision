
import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";

export const detectTelegramWebApp = () => {
  if (typeof window !== "undefined") {
    const hasTelegramObject = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user);
    if (hasTelegramObject) {
      console.log("[TON-DEBUG] Real Telegram WebApp detected");
      return true;
    }
  }
  console.log("[TON-DEBUG] Not running in Telegram WebApp");
  return false;
};

// Simple address validation - accept any reasonable looking TON address
export const isValidTonAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  const cleanAddress = address.trim();
  console.log("[TON-VALIDATION] Validating address:", cleanAddress);
  
  // Basic length and format check - be more permissive
  if (cleanAddress.length < 40) {
    console.log("[TON-VALIDATION] Address too short");
    return false;
  }
  
  // Accept UQ/EQ format or raw 0: format
  const userFriendlyPattern = /^(UQ|EQ)[A-Za-z0-9_-]{40,}$/;
  const rawPattern = /^0:[a-fA-F0-9]{60,}$/;
  
  const isValid = userFriendlyPattern.test(cleanAddress) || rawPattern.test(cleanAddress);
  console.log("[TON-VALIDATION] Address valid:", isValid);
  
  return isValid;
};

// Extract address from TonConnect
export const extractRealTonConnectAddress = (connector: TonConnectUI): string | null => {
  console.log("[TON-EXTRACT] Extracting address from connector");
  
  if (!connector?.wallet?.account?.address) {
    console.log("[TON-EXTRACT] No address found in connector");
    return null;
  }

  const address = connector.wallet.account.address;
  console.log("[TON-EXTRACT] Found address:", address);
  
  if (isValidTonAddress(address)) {
    console.log("[TON-EXTRACT] ✅ Address is valid");
    return address;
  } else {
    console.log("[TON-EXTRACT] ❌ Address failed validation");
    return null;
  }
};

// Save wallet address
export const saveRealWalletAddress = async (address: string, toast: any) => {
  console.log("[TON-SAVE] Saving wallet address:", address);
  
  // Set localStorage
  localStorage.setItem("tonWalletAddress", address);
  
  // Save to database
  const userId = localStorage.getItem("telegramUserId");
  if (userId) {
    try {
      console.log("[TON-SAVE] Saving to database for user:", userId);
      
      const { data, error } = await supabase.functions.invoke('database-helper', {
        body: {
          action: 'save_wallet_connection',
          params: {
            telegram_id: userId,
            wallet_address: address
          }
        }
      });
      
      if (error) {
        console.error("[TON-SAVE] Database error:", error);
      } else {
        console.log("[TON-SAVE] ✅ Database save successful");
      }
    } catch (err) {
      console.error("[TON-SAVE] Database exception:", err);
    }
  }
  
  toast({
    title: "✅ TON Wallet Connected!",
    description: `Address: ${address.substring(0, 15)}...`,
  });
  
  console.log("[TON-SAVE] ✅ Wallet save complete");
};
