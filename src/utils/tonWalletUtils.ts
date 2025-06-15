
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

// Extract wallet address from TonConnect - More permissive
export const extractRealTonConnectAddress = (connector: TonConnectUI): string | null => {
  console.log("[TON-EXTRACT] 🔍 === EXTRACTING TONCONNECT ADDRESS ===");
  console.log("[TON-EXTRACT] 🔍 Connector object:", connector);
  console.log("[TON-EXTRACT] 🔍 Connector.connected:", connector?.connected);
  console.log("[TON-EXTRACT] 🔍 Connector.wallet:", connector?.wallet);
  
  // Check if we have a wallet with account and address
  if (!connector || !connector.wallet || !connector.wallet.account || !connector.wallet.account.address) {
    console.log("[TON-EXTRACT] ❌ Missing wallet/account/address");
    return null;
  }

  const address = connector.wallet.account.address;
  console.log("[TON-EXTRACT] 🎯 FOUND ADDRESS:", address);
  
  // Validate address format
  if (!isValidTonAddress(address)) {
    console.error("[TON-EXTRACT] ❌ INVALID TON ADDRESS FORMAT:", address);
    return null;
  }

  console.log("[TON-EXTRACT] ✅ ADDRESS EXTRACTED AND VALIDATED:", address);
  return address;
};

// Save wallet address
export const saveRealWalletAddress = async (address: string, toast: any) => {
  console.log("[TON-SAVE] 💾 === SAVING WALLET ADDRESS ===");
  console.log("[TON-SAVE] 💾 Address to save:", address);
  
  // Set localStorage
  localStorage.setItem("tonWalletAddress", address);
  
  console.log("[TON-SAVE] 💾 State updated with address:", address);
  
  // Save to database
  const userId = localStorage.getItem("telegramUserId");
  if (userId) {
    try {
      console.log("[TON-SAVE] 💾 Saving to database:", { userId, address });
      
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
        console.error("[TON-SAVE] ❌ Database error:", error);
      } else {
        console.log("[TON-SAVE] ✅ Database save successful:", data);
      }
    } catch (err) {
      console.error("[TON-SAVE] ❌ Database exception:", err);
    }
  }
  
  toast({
    title: "✅ TON Wallet Connected!",
    description: `Address: ${address.substring(0, 15)}...`,
  });
  
  console.log("[TON-SAVE] ✅ WALLET SAVE COMPLETE");
};
