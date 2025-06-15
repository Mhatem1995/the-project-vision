import { TonConnectUI } from "@tonconnect/ui";
import { supabase } from "@/integrations/supabase/client";

/**
 * Convert any TON address to UQ... base64 user-friendly format.
 * Used across all project: only UQ... accepted and saved.
 */
export const toUQFormat = (address: string | null | undefined): string | null => {
  if (!address || typeof address !== "string") return null;
  const base = address.trim();
  if (base.startsWith("UQ")) return base;
  if (base.startsWith("EQ")) return base.replace("EQ", "UQ");
  if (base.startsWith("0:")) {
    try {
      const hex = base.split(":")[1];
      if (!hex || hex.length !== 64) return null;
      const bytes = new Uint8Array(33);
      bytes[0] = 0x11;
      for (let i = 0; i < 32; i++) {
        bytes[i + 1] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
      }
      const base64 = typeof window !== "undefined"
        ? btoa(String.fromCharCode.apply(null, Array.from(bytes)))
        : Buffer.from(bytes).toString("base64");
      return "UQ" + base64.replace(/=*$/, "");
    } catch {
      return null;
    }
  }
  return null;
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

// Accept ONLY valid UQ... address, never 0: or EQ...
export const isValidTonAddress = (address: string): boolean => {
  const uq = toUQFormat(address);
  // Must be 44 chars after "UQ" = 46 total or similar
  return !!uq && /^UQ[A-Za-z0-9_-]{40,}$/.test(uq);
};

// Extract REAL address from TonConnect
export const extractRealTonConnectAddress = (connector: TonConnectUI): string | null => {
  const addr = connector?.wallet?.account?.address;
  const uq = toUQFormat(addr);
  if (!uq) {
    console.log("[TON-EXTRACT] ❌ Could not convert address to UQ format");
    return null;
  }
  if (isValidTonAddress(uq)) {
    return uq;
  } else {
    console.log("[TON-EXTRACT] ❌ UQ-format address failed validation");
    return null;
  }
};

// Save ONLY UQ-format wallet address
export const saveRealWalletAddress = async (address: string, toast: any) => {
  const uq = toUQFormat(address);
  if (!uq) {
    toast({
      title: "Invalid Address",
      description: "Failed to convert your address to the correct format.",
      variant: "destructive"
    });
    return;
  }
  localStorage.setItem("tonWalletAddress", uq);
  const userId = localStorage.getItem("telegramUserId");
  if (userId) {
    try {
      await supabase.functions.invoke('database-helper', {
        body: {
          action: 'save_wallet_connection',
          params: {
            telegram_id: userId,
            wallet_address: uq
          }
        }
      });
    } catch (err) {
      console.error("[TON-SAVE] Database exception:", err);
    }
  }
  toast({
    title: "✅ TON Wallet Connected!",
    description: `Address: ${uq.substring(0, 15)}...`,
  });
};
