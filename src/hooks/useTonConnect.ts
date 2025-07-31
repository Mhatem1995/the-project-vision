import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Get the REAL TON Space wallet address using multiple methods
 */
async function getRealTonSpaceAddress(wallet: any, tonConnectUI: any): Promise<string | null> {
  try {
    console.log("🔍 [REAL ADDRESS] Starting real address detection...");
    console.log("🔍 [REAL ADDRESS] Wallet object:", wallet);
    
    // Method 1: Try to get from TonConnect UI directly
    if (tonConnectUI && tonConnectUI.account && tonConnectUI.account.address) {
      const uiAddress = tonConnectUI.account.address;
      console.log("🔍 [REAL ADDRESS] Method 1 - TonConnect UI address:", uiAddress);
      if (uiAddress.startsWith("0:") || uiAddress.startsWith("UQ") || uiAddress.startsWith("EQ")) {
        return convertToUserFriendly(uiAddress);
      }
    }
    
    // Method 2: Try wallet.account.address with proper conversion
    if (wallet?.account?.address) {
      const rawAddress = wallet.account.address;
      console.log("🔍 [REAL ADDRESS] Method 2 - Raw wallet address:", rawAddress);
      return convertToUserFriendly(rawAddress);
    }
    
    // Method 3: Try to query the wallet directly for its main address
    if (tonConnectUI && tonConnectUI.connector) {
      try {
        console.log("🔍 [REAL ADDRESS] Method 3 - Querying connector...");
        const connectorState = await tonConnectUI.connector.getWalletInfo();
        console.log("🔍 [REAL ADDRESS] Connector state:", connectorState);
        
        if (connectorState?.account?.address) {
          return convertToUserFriendly(connectorState.account.address);
        }
      } catch (error) {
        console.log("🔍 [REAL ADDRESS] Method 3 failed:", error);
      }
    }
    
    // Method 4: Check if there's wallet info in the connection
    if (wallet && wallet.connectItems) {
      console.log("🔍 [REAL ADDRESS] Method 4 - Connect items:", wallet.connectItems);
      const addressItem = wallet.connectItems.find((item: any) => item.name === 'ton_addr');
      if (addressItem?.address) {
        return convertToUserFriendly(addressItem.address);
      }
    }
    
    console.log("❌ [REAL ADDRESS] All methods failed to get real address");
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

  // Enhanced wallet address detection
  useEffect(() => {
    const detectRealAddress = async () => {
      if (!wallet || !tonConnectUI) {
        console.log("🔍 [DETECTION] No wallet or UI available");
        setWalletAddress(null);
        return;
      }
      
      console.log("🔍 [DETECTION] === WALLET CONNECTION DETECTED ===");
      console.log("🔍 [DETECTION] Wallet:", wallet);
      console.log("🔍 [DETECTION] Provider:", wallet?.provider);
      console.log("🔍 [DETECTION] Device:", wallet?.device);
      console.log("🔍 [DETECTION] Account:", wallet?.account);
      
      setIsLoading(true);
      
      try {
        // Get the real TON Space address
        const realAddress = await getRealTonSpaceAddress(wallet, tonConnectUI);
        
        if (realAddress) {
          console.log("✅ [DETECTION] Real address detected:", realAddress);
          setWalletAddress(realAddress);
          
          // Store immediately
          localStorage.setItem("tonWalletAddress", realAddress);
          localStorage.setItem("tonWalletProvider", "telegram-wallet");
          
          // Save to Supabase
          const telegramUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
          if (telegramUser?.id) {
            const telegramId = telegramUser.id.toString();
            console.log("💾 [DETECTION] Saving to Supabase:", { telegramId, realAddress });
            
            try {
              const { data, error } = await supabase.functions.invoke('database-helper', {
                body: {
                  action: 'save_wallet_connection',
                  params: {
                    telegram_id: telegramId,
                    wallet_address: realAddress
                  }
                }
              });
              
              if (error) {
                console.error("❌ [DETECTION] Supabase save failed:", error);
              } else {
                console.log("✅ [DETECTION] Saved to Supabase successfully:", data);
              }
            } catch (saveError) {
              console.error("❌ [DETECTION] Supabase save exception:", saveError);
            }
          } else {
            console.error("❌ [DETECTION] No Telegram user ID found");
          }
        } else {
          console.error("❌ [DETECTION] Failed to get real address");
          setWalletAddress(null);
        }
      } catch (error) {
        console.error("❌ [DETECTION] Address detection failed:", error);
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