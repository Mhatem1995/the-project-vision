import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Get the REAL TON Space wallet address (v4R2) when running in Telegram
 */
async function getRealTonSpaceAddress(wallet: any, tonConnectUI: any): Promise<string | null> {
  try {
    console.log("🔍 [REAL ADDRESS] === STARTING REAL TON SPACE DETECTION ===");
    console.log("🔍 [REAL ADDRESS] Wallet object:", JSON.stringify(wallet, null, 2));
    console.log("🔍 [REAL ADDRESS] TonConnect UI:", !!tonConnectUI);
    
    // Check if we're in Telegram environment
    const isInTelegram = !!(window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
    const telegramUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
    console.log("🔍 [REAL ADDRESS] Running in Telegram:", isInTelegram);
    console.log("🔍 [REAL ADDRESS] Telegram User ID:", telegramUser?.id);
    
    if (!isInTelegram) {
      console.warn("⚠️ [REAL ADDRESS] Not running in Telegram! Cannot get real TON Space address.");
      return null;
    }
    
    // Method 1: Direct wallet account address (most reliable for TON Space in Telegram)
    if (wallet?.account?.address) {
      const rawAddress = wallet.account.address;
      console.log("🔍 [REAL ADDRESS] Method 1 - Direct wallet address:", rawAddress);
      
      // Check if it's already in UQ format
      if (rawAddress.startsWith("UQ")) {
        console.log("✅ [REAL ADDRESS] Found direct UQ address:", rawAddress);
        return rawAddress;
      }
      
      // Try to convert to UQ format
      const converted = convertToUserFriendly(rawAddress);
      if (converted && converted.startsWith("UQ")) {
        console.log("✅ [REAL ADDRESS] Converted to UQ address:", converted);
        return converted;
      }
    }
    
    // Method 2: Check TonConnect UI wallet directly
    if (tonConnectUI?.wallet?.account?.address) {
      const uiAddress = tonConnectUI.wallet.account.address;
      console.log("🔍 [REAL ADDRESS] Method 2 - TonConnect UI wallet address:", uiAddress);
      
      if (uiAddress.startsWith("UQ")) {
        console.log("✅ [REAL ADDRESS] Found direct UQ from UI:", uiAddress);
        return uiAddress;
      }
      
      const converted = convertToUserFriendly(uiAddress);
      if (converted && converted.startsWith("UQ")) {
        console.log("✅ [REAL ADDRESS] Converted UI address to UQ:", converted);
        return converted;
      }
    }
    
    // Method 3: Force extraction from all wallet properties
    console.log("🔍 [REAL ADDRESS] Method 3 - Checking all wallet properties...");
    
    const allPossibleAddresses = [
      wallet?.account?.address,
      wallet?.account?.publicKey,
      wallet?.address,
      wallet?.publicKey,
      tonConnectUI?.account?.address,
      tonConnectUI?.wallet?.account?.address,
      tonConnectUI?.wallet?.address
    ].filter(Boolean);
    
    console.log("🔍 [REAL ADDRESS] All possible addresses found:", allPossibleAddresses);
    
    for (const addr of allPossibleAddresses) {
      if (typeof addr === 'string') {
        if (addr.startsWith("UQ")) {
          console.log("✅ [REAL ADDRESS] Found direct UQ in properties:", addr);
          return addr;
        }
        
        const converted = convertToUserFriendly(addr);
        if (converted && converted.startsWith("UQ")) {
          console.log("✅ [REAL ADDRESS] Converted property to UQ:", converted);
          return converted;
        }
      }
    }
    
    // Method 4: Try to access Telegram WebApp wallet API directly
    if ((window as any)?.Telegram?.WebApp) {
      const webApp = (window as any).Telegram.WebApp;
      console.log("🔍 [REAL ADDRESS] Method 4 - Checking Telegram WebApp for wallet API...");
      
      // Check if WebApp has any wallet-related properties
      if (webApp.tonWallet) {
        console.log("🔍 [REAL ADDRESS] Found tonWallet in WebApp:", webApp.tonWallet);
        if (webApp.tonWallet.address && webApp.tonWallet.address.startsWith("UQ")) {
          console.log("✅ [REAL ADDRESS] Found TON wallet address in WebApp:", webApp.tonWallet.address);
          return webApp.tonWallet.address;
        }
      }
      
      // Check platform info
      console.log("🔍 [REAL ADDRESS] WebApp platform:", webApp.platform);
      console.log("🔍 [REAL ADDRESS] WebApp version:", webApp.version);
    }
    
    console.log("❌ [REAL ADDRESS] No valid TON Space v4R2 address found after all methods");
    return null;
    
  } catch (error) {
    console.error("❌ [REAL ADDRESS] Error getting real address:", error);
    return null;
  }
}

/**
 * Convert any TON address format to user-friendly UQ format
 */
function convertToUserFriendly(address: string): string | null {
  try {
    console.log("🔄 [CONVERT] Converting:", address);
    
    if (!address) return null;
    
    // Already user-friendly
    if (address.startsWith("UQ") || address.startsWith("EQ")) {
      console.log("✅ [CONVERT] Already user-friendly:", address);
      return address;
    }
    
    // Raw format 0:hex
    if (address.startsWith("0:")) {
      const hex = address.substring(2);
      if (hex.length === 64) {
        try {
          // Convert to Uint8Array
          const bytes = new Uint8Array(32);
          for (let i = 0; i < 32; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
          }
          
          // Convert to base64url
          const base64 = btoa(String.fromCharCode(...bytes))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
          
          const converted = `UQ${base64}`;
          console.log("✅ [CONVERT] Converted raw to UQ:", converted);
          return converted;
        } catch (e) {
          console.error("❌ [CONVERT] Conversion failed:", e);
        }
      }
    }
    
    // Try parsing as base64 if it's just hex
    if (/^[a-fA-F0-9]{64}$/.test(address)) {
      try {
        const bytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          bytes[i] = parseInt(address.substr(i * 2, 2), 16);
        }
        
        const base64 = btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        
        const converted = `UQ${base64}`;
        console.log("✅ [CONVERT] Converted hex to UQ:", converted);
        return converted;
      } catch (e) {
        console.error("❌ [CONVERT] Hex conversion failed:", e);
      }
    }
    
    return null;
  } catch (error) {
    console.error("❌ [CONVERT] Conversion error:", error);
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
  isLoading: boolean;
};

export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isConnected = !!wallet && !!walletAddress;

  // Enhanced TON Space wallet address detection
  useEffect(() => {
    const detectRealAddress = async () => {
      if (!wallet || !tonConnectUI) {
        console.log("🔍 [DETECTION] No wallet or UI available");
        setWalletAddress(null);
        return;
      }
      
      console.log("🔍 [DETECTION] === TON SPACE WALLET DETECTION ===");
      console.log("🔍 [DETECTION] Wallet:", wallet);
      console.log("🔍 [DETECTION] Provider:", wallet?.provider);
      console.log("🔍 [DETECTION] Device:", wallet?.device);
      console.log("🔍 [DETECTION] Account:", wallet?.account);
      console.log("🔍 [DETECTION] App Name:", wallet?.device?.appName);
      
      // Check if this is actually a Telegram wallet
      const isTelegramWallet = wallet?.device?.appName === 'telegram-wallet' ||
                              (wallet as any)?.appName === 'telegram-wallet' ||
                              (wallet as any)?.name === 'Telegram Wallet';
      
      console.log("🔍 [DETECTION] Is Telegram Wallet:", isTelegramWallet);
      
      if (!isTelegramWallet) {
        console.warn("⚠️ [DETECTION] Not a Telegram wallet! TON Space addresses require Telegram wallet.");
        setWalletAddress(null);
        return;
      }
      
      setIsLoading(true);
      
      try {
        // Get the real TON Space address (v4R2)
        const realAddress = await getRealTonSpaceAddress(wallet, tonConnectUI);
        
        if (realAddress) {
          // Validate that this is a proper TON Space address (should start with UQDe or similar)
          console.log("✅ [DETECTION] TON Space address detected:", realAddress);
          console.log("🔍 [DETECTION] Address starts with:", realAddress.substring(0, 6));
          console.log("🔍 [DETECTION] Address length:", realAddress.length);
          
          setWalletAddress(realAddress);
          
          // Store with Telegram wallet provider
          localStorage.setItem("tonWalletAddress", realAddress);
          localStorage.setItem("tonWalletProvider", "telegram-wallet");
          
          // Save to Supabase with Telegram user ID
          const telegramUserId = localStorage.getItem("telegramUserId");
          if (telegramUserId) {
            console.log("💾 [DETECTION] Saving TON Space wallet to Supabase:", { telegramUserId, realAddress });
            
            try {
              const { data, error } = await supabase.functions.invoke('database-helper', {
                body: {
                  action: 'save_wallet_connection',
                  params: {
                    telegram_id: telegramUserId,
                    wallet_address: realAddress
                  }
                }
              });
              
              if (error) {
                console.error("❌ [DETECTION] Supabase save failed:", error);
              } else {
                console.log("✅ [DETECTION] TON Space wallet saved to Supabase successfully:", data);
              }
            } catch (saveError) {
              console.error("❌ [DETECTION] Supabase save exception:", saveError);
            }
          } else {
            console.warn("⚠️ [DETECTION] No Telegram user ID found in localStorage");
          }
        } else {
          console.error("❌ [DETECTION] Failed to get real TON Space address");
          setWalletAddress(null);
        }
      } catch (error) {
        console.error("❌ [DETECTION] TON Space address detection failed:", error);
        setWalletAddress(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    detectRealAddress();
  }, [wallet, tonConnectUI]);

  const connect = async () => {
    console.log("🔌 [CONNECT] Starting connection...");
    setIsLoading(true);
    
    try {
      await tonConnectUI?.openModal();
    } catch (error) {
      console.error("❌ [CONNECT] Connection failed:", error);
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    console.log("🔌 [DISCONNECT] Disconnecting...");
    
    // Clear local storage
    localStorage.removeItem("tonWalletAddress");
    localStorage.removeItem("tonWalletProvider");
    
    // Clear state
    setWalletAddress(null);
    
    // Disconnect from TonConnect
    try {
      await tonConnectUI?.disconnect();
    } catch (error) {
      console.error("❌ [DISCONNECT] Disconnect error:", error);
    }
  };

  return {
    tonConnectUI,
    wallet,
    isConnected,
    walletAddress,
    connect,
    disconnect,
    isLoading,
  };
};