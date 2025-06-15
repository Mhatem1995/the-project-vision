import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";
import { toUserFriendlyAddress } from "./tonAddressUtils";

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
  // ALWAYS convert to user-friendly/base64 address before using/storing!
  const rawAddress = connector.wallet.account.address;
  const realAddress = toUserFriendlyAddress(rawAddress);
  console.log("[TON-EXTRACT] Canonical user-friendly address:", realAddress);
  if (isValidTonAddress(realAddress)) {
    return realAddress;
  }
  console.log("[TON-EXTRACT] ❌ REAL address failed validation");
  return null;
};

// Save REAL wallet address (always user-friendly!)
export const saveRealWalletAddress = async (realAddress: string, toast: any) => {
  const canonicalAddress = toUserFriendlyAddress(realAddress);
  console.log("[TON-SAVE] Saving REAL wallet address (user-friendly):", canonicalAddress);
  localStorage.setItem("tonWalletAddress", canonicalAddress);

  // Save REAL address to database
  const userId = localStorage.getItem("telegramUserId");
  if (userId) {
    try {
      await supabase.functions.invoke('database-helper', {
        body: {
          action: 'save_wallet_connection',
          params: {
            telegram_id: userId,
            wallet_address: canonicalAddress // Always store user-friendly
          }
        }
      });
      console.log("[TON-SAVE] ✅ REAL address saved to database successfully");
    } catch (err) {
      console.error("[TON-SAVE] Database exception:", err);
    }
  }
  toast({
    title: "✅ TON Wallet Connected!",
    description: `Wallet: ${canonicalAddress.substring(0, 15)}...`,
  });
  console.log("[TON-SAVE] ✅ REAL wallet save complete");
};
