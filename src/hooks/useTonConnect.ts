import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Get Telegram user data from WebApp
 */
function getTelegramUser() {
  const tg = (window as any)?.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;
  return {
    id: user?.id?.toString(),
    username: user?.username,
    firstName: user?.first_name,
    lastName: user?.last_name,
    isAvailable: !!user?.id
  };
}

/**
 * Convert raw TON address (0:hex) to user-friendly format (UQ/EQ)
 */
function convertToUserFriendly(rawAddress: string): string | null {
  try {
    if (!rawAddress) return null;
    
    console.log("🔄 [ADDRESS] Converting:", rawAddress);
    
    // If already user-friendly, return as-is
    if (rawAddress.startsWith("UQ") || rawAddress.startsWith("EQ")) {
      console.log("✅ [ADDRESS] Already user-friendly:", rawAddress);
      return rawAddress;
    }
    
    // If raw format (0:hex), convert to UQ format
    if (rawAddress.startsWith("0:")) {
      const hex = rawAddress.substring(2);
      if (hex.length === 64) {
        // Convert hex to base64 and add UQ prefix for non-bounceable format
        const buffer = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const base64 = btoa(String.fromCharCode(...buffer))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        const converted = `UQ${base64}`;
        console.log("🔄 [ADDRESS] Converted to UQ format:", rawAddress, "->", converted);
        return converted;
      }
    }
    
    console.log("❌ [ADDRESS] Unable to convert:", rawAddress);
    return null;
  } catch (error) {
    console.error("❌ [ADDRESS] Conversion error:", error);
    return null;
  }
}

type UseTonConnectReturn = {
  tonConnectUI: any;
  wallet: any;
  isConnected: boolean;
  walletAddress: string | null;
  connectionState: 'disconnected' | 'connecting' | 'connected';
  telegramUser: ReturnType<typeof getTelegramUser>;
  isTelegramWallet: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Get Telegram user information
  const telegramUser = getTelegramUser();
  
  // Get the wallet address from TonConnect
  const rawAccountAddress = wallet?.account?.address;
  const walletAddress = rawAccountAddress ? convertToUserFriendly(rawAccountAddress) : null;
  
  const isConnected = !!walletAddress;

  // Validate Telegram wallet connection
  const isTelegramWallet = wallet?.device?.appName === "telegram-wallet" || 
                          (wallet?.provider && wallet.provider !== "http" && wallet.provider !== "injected");

  // Enhanced debugging with clear logs
  console.log("🏦 [TON CONNECT] ===============================");
  console.log("🏦 [TON CONNECT] Telegram User Available:", telegramUser.isAvailable);
  console.log("🏦 [TON CONNECT] Telegram User ID:", telegramUser.id);
  console.log("🏦 [TON CONNECT] Wallet Connected:", isConnected);
  console.log("🏦 [TON CONNECT] Raw Address:", rawAccountAddress);
  console.log("🏦 [TON CONNECT] Converted Address:", walletAddress);
  console.log("🏦 [TON CONNECT] Wallet Provider:", wallet?.provider);
  console.log("🏦 [TON CONNECT] Device Info:", wallet?.device);
  console.log("🏦 [TON CONNECT] Is Telegram Wallet:", isTelegramWallet);
  console.log("🏦 [TON CONNECT] ===============================");
  
  if (walletAddress && !isTelegramWallet) {
    console.warn("⚠️ [TON CONNECT] WARNING: Connected wallet may not be Telegram TON Space");
    console.warn("⚠️ [TON CONNECT] Provider:", wallet?.provider);
    console.warn("⚠️ [TON CONNECT] Device:", wallet?.device);
  }

  // Store wallet address and save to Supabase when connected
  useEffect(() => {
    if (walletAddress && telegramUser.isAvailable && telegramUser.id) {
      console.log("💾 [STORAGE] Saving wallet connection...");
      console.log("💾 [STORAGE] User ID:", telegramUser.id);
      console.log("💾 [STORAGE] Wallet Address:", walletAddress);
      console.log("💾 [STORAGE] Is Telegram Wallet:", isTelegramWallet);
      
      // Store in localStorage for immediate access
      localStorage.setItem("tonWalletAddress", walletAddress);
      localStorage.setItem("tonWalletProvider", isTelegramWallet ? "telegram-wallet" : "other");
      localStorage.setItem("telegramUserId", telegramUser.id);
      
      // Save to Supabase database
      const saveToSupabase = async () => {
        try {
          console.log("💾 [SUPABASE] Calling save-wallet-connection function...");
          
          const { data, error } = await supabase.functions.invoke('save-wallet-connection', {
            body: {
              telegramId: telegramUser.id,
              walletAddress: walletAddress
            }
          });

          if (error) {
            console.error("💾 [SUPABASE] Save failed:", error);
          } else {
            console.log("💾 [SUPABASE] ✅ Wallet saved successfully:", data);
          }
        } catch (err) {
          console.error("💾 [SUPABASE] Exception during save:", err);
        }
      };

      saveToSupabase();
      setConnectionState('connected');
    } else if (!walletAddress) {
      setConnectionState('disconnected');
    }
  }, [walletAddress, telegramUser.id, telegramUser.isAvailable, isTelegramWallet]);

  const connect = async () => {
    if (!telegramUser.isAvailable) {
      console.error("🔌 [CONNECT] Cannot connect: Telegram user not available");
      return;
    }
    
    console.log("🔌 [CONNECT] Initiating TON Space wallet connection...");
    console.log("🔌 [CONNECT] For Telegram user:", telegramUser.id);
    
    setConnectionState('connecting');
    
    try {
      await tonConnectUI?.openModal();
      console.log("🔌 [CONNECT] Modal opened successfully");
    } catch (error) {
      console.error("🔌 [CONNECT] Failed to open modal:", error);
      setConnectionState('disconnected');
    }
  };

  const disconnect = async () => {
    console.log("🔌 [DISCONNECT] Disconnecting wallet...");
    
    try {
      await tonConnectUI?.disconnect();
      
      // Clear local storage
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
      localStorage.removeItem("telegramUserId");
      
      setConnectionState('disconnected');
      console.log("🔌 [DISCONNECT] ✅ Disconnected successfully");
    } catch (error) {
      console.error("🔌 [DISCONNECT] Error during disconnect:", error);
    }
  };

  return {
    tonConnectUI,
    wallet,
    isConnected,
    walletAddress,
    connectionState,
    telegramUser,
    isTelegramWallet,
    connect,
    disconnect,
  };
};