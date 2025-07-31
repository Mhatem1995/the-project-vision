
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Convert raw TON address (0:hex) to user-friendly format (UQ/EQ)
 */
function convertToUserFriendly(rawAddress: string): string | null {
  try {
    if (!rawAddress) return null;
    
    // If already user-friendly, return as-is
    if (rawAddress.startsWith("UQ") || rawAddress.startsWith("EQ")) {
      return rawAddress;
    }
    
    // If raw format (0:hex), convert to UQ format
    if (rawAddress.startsWith("0:")) {
      const hex = rawAddress.substring(2);
      if (hex.length === 64) {
        // Convert hex to base64 and add UQ prefix
        const buffer = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const base64 = btoa(String.fromCharCode(...buffer))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        return `UQ${base64}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error converting address:", error);
    return null;
  }
}

/**
 * Check if address is valid user-friendly format
 */
function isUserFriendlyTonAddress(addr: string | null | undefined): boolean {
  return (
    typeof addr === "string" &&
    (addr.startsWith("UQ") || addr.startsWith("EQ")) &&
    addr.length > 10
  );
}

type UseTonConnectReturn = {
  tonConnectUI: any;
  wallet: any;
  isConnected: boolean;
  walletAddress: string | null;
  connect: () => void;
  disconnect: () => void;
};

export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // Get the REAL wallet address from TonConnect
  const rawAccountAddress = wallet?.account?.address;
  console.log("🔍 [WALLET DEBUG] Raw address from TonConnect:", rawAccountAddress);
  
  // Convert to user-friendly format if needed
  const walletAddress = rawAccountAddress ? convertToUserFriendly(rawAccountAddress) : null;
  console.log("🔍 [WALLET DEBUG] Converted address:", walletAddress);

  // Connected only if we have a valid UQ/EQ address
  const isConnected = !!walletAddress;

  // Store wallet address when connected
  useEffect(() => {
    if (walletAddress && wallet?.account) {
      console.log("✅ [WALLET DEBUG] Storing wallet address:", walletAddress);
      
      // Store in localStorage
      localStorage.setItem("tonWalletAddress", walletAddress);
      localStorage.setItem("tonWalletProvider", "telegram-wallet");
      
      // Store in Supabase - get telegram user ID from window.Telegram
      const telegramUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      if (telegramUser?.id) {
        console.log("📤 [WALLET DEBUG] Saving to Supabase for user:", telegramUser.id);
        supabase.functions.invoke('save-wallet-connection', {
          body: {
            telegramId: telegramUser.id.toString(),
            walletAddress: walletAddress
          }
        }).then(result => {
          console.log("💾 [WALLET DEBUG] Supabase save result:", result);
        }).catch(error => {
          console.error("❌ [WALLET DEBUG] Supabase save error:", error);
        });
      }
    }
  }, [walletAddress, wallet?.account]);

  useEffect(() => {
    // No validation/cleanup—user always decides (only hard rule: must be UQ/EQ)
  }, []);

  const connect = () => tonConnectUI?.openModal();
  const disconnect = () => {
    localStorage.removeItem("tonWalletAddress");
    localStorage.removeItem("tonWalletProvider");
    tonConnectUI?.disconnect();
  };

  return {
    tonConnectUI,
    wallet,
    isConnected,
    walletAddress,
    connect,
    disconnect,
  };
};
