
import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";
import { Address } from "@ton/core";

/**
 * Converts a raw TON address (0:...) to its user-friendly, bounceable format (UQ...).
 * @param rawAddress The raw address string.
 * @returns The user-friendly address string.
 */
export const toFriendlyAddress = (rawAddress: string): string => {
  try {
    if (!rawAddress || typeof rawAddress !== 'string') {
      console.warn("toFriendlyAddress received an invalid address:", rawAddress);
      return ""; // Return empty string for invalid input
    }
    if (rawAddress.startsWith('UQ') || rawAddress.startsWith('EQ')) {
      return rawAddress; // Already in friendly format
    }
    return Address.parse(rawAddress).toString({ bounceable: true, urlSafe: true });
  } catch (error) {
    console.error("Failed to convert address to friendly format:", rawAddress, error);
    return rawAddress; // Fallback to raw on error
  }
};

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

// Extract REAL address from TonConnect
export const extractRealTonConnectAddress = (connector: TonConnectUI): string | null => {
  console.log("[TON-EXTRACT] Extracting REAL address from connector");
  
  if (!connector?.wallet?.account?.address) {
    console.log("[TON-EXTRACT] No address found in connector");
    return null;
  }

  // Get the REAL address directly from TonConnect
  const realAddress = connector.wallet.account.address;
  console.log("[TON-EXTRACT] Found REAL address:", realAddress);
  
  if (isValidTonAddress(realAddress)) {
    console.log("[TON-EXTRACT] ✅ REAL address is valid");
    return realAddress;
  } else {
    console.log("[TON-EXTRACT] ❌ REAL address failed validation");
    return null;
  }
};

// Save REAL wallet address
export const saveRealWalletAddress = async (realAddress: string, toast: any) => {
  console.log("[TON-SAVE] Saving FRIENDLY wallet address:", realAddress);
  
  // Set localStorage with FRIENDLY address
  localStorage.setItem("tonWalletAddress", realAddress);
  
  // Save FRIENDLY address to database
  const userId = localStorage.getItem("telegramUserId");
  if (userId) {
    try {
      console.log("[TON-SAVE] Saving FRIENDLY address to database for user:", userId);
      
      const { data, error } = await supabase.functions.invoke('database-helper', {
        body: {
          action: 'save_wallet_connection',
          params: {
            telegram_id: userId,
            wallet_address: realAddress  // Save the FRIENDLY address
          }
        }
      });
      
      if (error) {
        console.error("[TON-SAVE] Database error:", error);
      } else {
        console.log("[TON-SAVE] ✅ FRIENDLY address saved to database successfully");
      }
    } catch (err) {
      console.error("[TON-SAVE] Database exception:", err);
    }
  }
  
  toast({
    title: "✅ TON Wallet Connected!",
    description: `Address: ${realAddress.substring(0, 15)}...`,
  });
  
  console.log("[TON-SAVE] ✅ FRIENDLY wallet save complete");
};
