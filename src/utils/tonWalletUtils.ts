
import { TonConnectUI } from "@tonconnect/ui";
import { isValidTonAddress } from "@/integrations/ton/TonConnectConfig";
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

// Extract wallet address ONLY from real TonConnect
export const extractRealTonConnectAddress = (connector: TonConnectUI): string | null => {
  console.log("[TON-EXTRACT] 🔍 === EXTRACTING REAL TONCONNECT ADDRESS ===");
  console.log("[TON-EXTRACT] 🔍 Connector object:", connector);
  console.log("[TON-EXTRACT] 🔍 Connector.connected:", connector?.connected);
  console.log("[TON-EXTRACT] 🔍 Connector.wallet:", connector?.wallet);
  
  // Strict validation - MUST be connected
  if (!connector || !connector.connected) {
    console.log("[TON-EXTRACT] ❌ TonConnect NOT CONNECTED - returning null");
    return null;
  }

  // Strict validation - MUST have wallet object
  if (!connector.wallet) {
    console.log("[TON-EXTRACT] ❌ NO WALLET OBJECT - returning null");
    return null;
  }

  // Strict validation - MUST have account
  if (!connector.wallet.account) {
    console.log("[TON-EXTRACT] ❌ NO ACCOUNT OBJECT - returning null");
    return null;
  }

  // Strict validation - MUST have address
  if (!connector.wallet.account.address) {
    console.log("[TON-EXTRACT] ❌ NO ADDRESS IN ACCOUNT - returning null");
    return null;
  }

  const realAddress = connector.wallet.account.address;
  console.log("[TON-EXTRACT] 🎯 FOUND REAL ADDRESS:", realAddress);
  console.log("[TON-EXTRACT] 🎯 Address type:", typeof realAddress);
  console.log("[TON-EXTRACT] 🎯 Address length:", realAddress?.length);
  
  // STRICT validation of address format
  if (!isValidTonAddress(realAddress)) {
    console.error("[TON-EXTRACT] ❌ INVALID TON ADDRESS FORMAT:", realAddress);
    return null;
  }

  console.log("[TON-EXTRACT] ✅ REAL TONCONNECT ADDRESS EXTRACTED AND VALIDATED:", realAddress);
  return realAddress;
};

// Save ONLY real wallet address
export const saveRealWalletAddress = async (realAddress: string, toast: any) => {
  console.log("[TON-SAVE] 💾 === SAVING REAL WALLET ADDRESS ===");
  console.log("[TON-SAVE] 💾 Real address to save:", realAddress);
  
  // Set localStorage
  localStorage.setItem("tonWalletAddress", realAddress);
  
  console.log("[TON-SAVE] 💾 State updated with REAL address:", realAddress);
  
  // Save to database
  const userId = localStorage.getItem("telegramUserId");
  if (userId) {
    try {
      console.log("[TON-SAVE] 💾 Saving to database:", { userId, realAddress });
      
      const { data, error } = await supabase.functions.invoke('database-helper', {
        body: {
          action: 'save_wallet_connection',
          params: {
            telegram_id: userId,
            wallet_address: realAddress
          }
        }
      });
      
      if (error) {
        console.error("[TON-SAVE] ❌ Database error:", error);
      } else {
        console.log("[TON-SAVE] ✅ Database save successful:", data);
      }
    } catch (err) {
      console.error("[TON-SAVE] ❌ Database exception:", err);
    }
  }
  
  toast({
    title: "✅ Real TON Wallet Connected!",
    description: `Real Address: ${realAddress.substring(0, 15)}...`,
  });
  
  console.log("[TON-SAVE] ✅ REAL WALLET SAVE COMPLETE");
};
