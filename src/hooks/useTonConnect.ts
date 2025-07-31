
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Convert raw TON address (0:hex) to user-friendly format (UQ/EQ)
 */
function convertToUserFriendly(rawAddress: string): string | null {
  try {
    if (!rawAddress) return null;
    
    console.log("🔄 Converting address:", rawAddress);
    
    // If already user-friendly, return as-is
    if (rawAddress.startsWith("UQ") || rawAddress.startsWith("EQ")) {
      console.log("✅ Address already user-friendly:", rawAddress);
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
        const converted = `UQ${base64}`;
        console.log("🔄 Converted raw to user-friendly:", rawAddress, "->", converted);
        return converted;
      }
    }
    
    console.log("❌ Unable to convert address:", rawAddress);
    return null;
  } catch (error) {
    console.error("❌ Error converting address:", error);
    return null;
  }
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
  
  // Enhanced debugging
  console.log("🔍 [WALLET DEBUG] === TonConnect State ===");
  console.log("🔍 [WALLET DEBUG] Raw address from TonConnect:", rawAccountAddress);
  console.log("🔍 [WALLET DEBUG] Full wallet object:", wallet);
  console.log("🔍 [WALLET DEBUG] Wallet provider:", wallet?.provider);
  console.log("🔍 [WALLET DEBUG] Wallet device:", wallet?.device);
  console.log("🔍 [WALLET DEBUG] Device platform:", wallet?.device?.platform);
  console.log("🔍 [WALLET DEBUG] Device app name:", wallet?.device?.appName);
  console.log("🔍 [WALLET DEBUG] TonConnect UI instance:", tonConnectUI);
  
  // Convert to user-friendly format if needed
  const walletAddress = rawAccountAddress ? convertToUserFriendly(rawAccountAddress) : null;
  console.log("🔍 [WALLET DEBUG] Final wallet address:", walletAddress);
  
  // Validation
  if (walletAddress) {
    console.log("🔍 [WALLET DEBUG] ✅ WALLET CONNECTION SUCCESS");
    console.log("🔍 [WALLET DEBUG] Connected Address:", walletAddress);
    console.log("🔍 [WALLET DEBUG] Address Length:", walletAddress.length);
    console.log("🔍 [WALLET DEBUG] Address Format:", walletAddress.startsWith("UQ") ? "UQ (non-bounceable)" : walletAddress.startsWith("EQ") ? "EQ (bounceable)" : "Unknown");
    
    // Critical validation - ensure this is a real Telegram wallet
    if (wallet?.device?.appName === "telegram-wallet") {
      console.log("🔍 [WALLET DEBUG] ✅ Confirmed Telegram Wallet connection");
    } else {
      console.warn("🔍 [WALLET DEBUG] ⚠️ WARNING: This might not be a Telegram wallet!");
      console.warn("🔍 [WALLET DEBUG] Provider:", wallet?.provider);
      console.warn("🔍 [WALLET DEBUG] App Name:", wallet?.device?.appName);
      console.warn("🔍 [WALLET DEBUG] Platform:", wallet?.device?.platform);
    }
  } else {
    console.log("🔍 [WALLET DEBUG] ❌ No valid wallet address detected");
  }

  const isConnected = !!walletAddress;

  // Store wallet address when connected
  useEffect(() => {
    if (walletAddress && wallet?.account) {
      console.log("💾 [WALLET DEBUG] Storing wallet connection...");
      console.log("💾 [WALLET DEBUG] Address to store:", walletAddress);
      
      // Clear any old data first
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
      
      // Store new data
      localStorage.setItem("tonWalletAddress", walletAddress);
      localStorage.setItem("tonWalletProvider", "telegram-wallet");
      
      console.log("💾 [WALLET DEBUG] Stored in localStorage");
      
      // Get Telegram user ID and save to Supabase
      const telegramUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      console.log("💾 [WALLET DEBUG] Telegram user data:", telegramUser);
      
      if (telegramUser?.id) {
        const telegramId = telegramUser.id.toString();
        console.log("💾 [WALLET DEBUG] Saving to Supabase for user:", telegramId);
        console.log("💾 [WALLET DEBUG] Wallet address:", walletAddress);
        
        supabase.functions.invoke('database-helper', {
          body: {
            action: 'save_wallet_connection',
            params: {
              telegram_id: telegramId,
              wallet_address: walletAddress
            }
          }
        }).then(result => {
          console.log("💾 [WALLET DEBUG] Supabase save result:", result);
          if (result.error) {
            console.error("💾 [WALLET DEBUG] Supabase save failed:", result.error);
          } else {
            console.log("💾 [WALLET DEBUG] ✅ Wallet saved to Supabase successfully");
          }
        }).catch(error => {
          console.error("💾 [WALLET DEBUG] Supabase save exception:", error);
        });
      } else {
        console.error("💾 [WALLET DEBUG] ❌ No Telegram user ID found - cannot save to Supabase");
      }
    }
  }, [walletAddress, wallet?.account]);

  const connect = () => {
    console.log("🔌 [WALLET DEBUG] Initiating wallet connection...");
    tonConnectUI?.openModal();
  };

  const disconnect = () => {
    console.log("🔌 [WALLET DEBUG] Disconnecting wallet...");
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
