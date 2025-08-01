import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const isConnected = !!wallet;

  // Capture real TON Space wallet address directly - NO conversion
  useEffect(() => {
    console.log("🔍 [WALLET] Connection state changed");
    console.log("🔍 [WALLET] Wallet exists:", !!wallet);
    console.log("🔍 [WALLET] TonConnect UI exists:", !!tonConnectUI);
    
    if (wallet?.account?.address) {
      // Get the REAL wallet address exactly as provided by TON Space
      const realAddress = wallet.account.address;
      console.log("🚨 [REAL WALLET] ==========================================");
      console.log("🚨 [REAL WALLET] CAPTURING TON SPACE ADDRESS:");
      console.log("🚨 [REAL WALLET] Raw address from wallet.account.address:", realAddress);
      console.log("🚨 [REAL WALLET] Address type:", typeof realAddress);
      console.log("🚨 [REAL WALLET] Address length:", realAddress.length);
      console.log("🚨 [REAL WALLET] Address starts with:", realAddress.substring(0, 10));
      console.log("🚨 [REAL WALLET] Full wallet object:", JSON.stringify(wallet, null, 2));
      console.log("🚨 [REAL WALLET] ==========================================");
      
      // Use the EXACT address from TON Space - no conversion!
      setWalletAddress(realAddress);
      
      // Store the REAL address in localStorage
      localStorage.setItem("tonWalletAddress", realAddress);
      localStorage.setItem("tonWalletProvider", "telegram-wallet");
      console.log("✅ [REAL WALLET] Stored EXACT address:", realAddress);
      
      // Save the REAL address to database
      const userId = localStorage.getItem("telegramUserId");
      if (userId) {
        console.log("💾 [WALLET] Saving REAL address to database:", { userId, realAddress });
        
        supabase.functions.invoke('database-helper', {
          body: {
            action: 'save_wallet_connection',
            params: {
              telegram_id: userId,
              wallet_address: realAddress
            }
          }
        }).then(({ data, error }) => {
          if (error) {
            console.error("❌ [WALLET] Database save failed:", error);
          } else {
            console.log("✅ [WALLET] REAL address saved to database:", data);
          }
        });
      }
    } else {
      console.log("❌ [WALLET] No wallet address found");
      setWalletAddress(null);
    }
  }, [wallet, tonConnectUI]);

  const connect = async () => {
    console.log("🔌 [CONNECT] Starting wallet connection...");
    
    if (!tonConnectUI) {
      console.error("❌ [CONNECT] TonConnect UI not available");
      return;
    }
    
    try {
      console.log("🔌 [CONNECT] Opening modal...");
      await tonConnectUI.openModal();
    } catch (error) {
      console.error("❌ [CONNECT] Connection failed:", error);
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