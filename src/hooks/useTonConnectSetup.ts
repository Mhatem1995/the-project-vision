
import { useState, useEffect } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { tonConnectOptions, getPreferredWallets } from "@/integrations/ton/TonConnectConfig";
import { detectTelegramWebApp, nukeAllWalletData, extractRealTonConnectAddress, saveRealWalletAddress } from "@/utils/tonWalletUtils";

declare global {
  interface Window {
    _tonConnectUI?: TonConnectUI;
  }
}

export const useTonConnectSetup = (toast: any) => {
  const [tonConnectUI, setTonConnectUI] = useState<TonConnectUI | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);

  // Handle wallet status changes - ONLY accept real connections
  const handleWalletStatusChange = async (wallet: any) => {
    console.log("[TON-STATUS] 🔄 === WALLET STATUS CHANGED ===");
    console.log("[TON-STATUS] 🔄 Wallet object:", wallet);
    console.log("[TON-STATUS] 🔄 Has account:", !!wallet?.account);
    console.log("[TON-STATUS] 🔄 Has address:", !!wallet?.account?.address);
    console.log("[TON-STATUS] 🔄 TonConnectUI available:", !!tonConnectUI);
    
    if (wallet?.account?.address && tonConnectUI && tonConnectUI.connected) {
      console.log("[TON-STATUS] ✅ REAL WALLET CONNECTION DETECTED");
      
      const realAddress = extractRealTonConnectAddress(tonConnectUI);
      if (realAddress) {
        console.log("[TON-STATUS] ✅ REAL ADDRESS EXTRACTED:", realAddress);
        setIsConnected(true);
        setWalletAddress(realAddress);
        await saveRealWalletAddress(realAddress, toast);
      } else {
        console.log("[TON-STATUS] ❌ FAILED TO EXTRACT REAL ADDRESS");
        setIsConnected(false);
        setWalletAddress(null);
        nukeAllWalletData();
      }
    } else {
      console.log("[TON-STATUS] ❌ WALLET DISCONNECTED OR INVALID");
      setIsConnected(false);
      setWalletAddress(null);
      nukeAllWalletData();
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    console.log("[TON-INIT] 🚀 === PROVIDER INITIALIZATION ===");
    
    // Start with nuclear cleaning
    nukeAllWalletData();
    
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    // Check for existing TonConnect UI
    if (window._tonConnectUI) {
      console.log("[TON-INIT] 🔄 Using existing TonConnect UI");
      const existingUI = window._tonConnectUI;
      setTonConnectUI(existingUI);
      
      // Check if it's actually connected with real data
      const realAddress = extractRealTonConnectAddress(existingUI);
      if (realAddress) {
        console.log("[TON-INIT] ✅ Found existing real connection:", realAddress);
        setIsConnected(true);
        setWalletAddress(realAddress);
        saveRealWalletAddress(realAddress, toast);
      } else {
        console.log("[TON-INIT] ❌ No real connection found in existing UI");
      }
      return;
    }

    // Create new TonConnect UI
    try {
      const options = {
        manifestUrl: tonConnectOptions.manifestUrl,
        preferredWallets: getPreferredWallets()
      };

      console.log("[TON-INIT] 🔧 Creating new TonConnect with options:", options);
      const connector = new TonConnectUI(options);
      
      // Store globally
      window._tonConnectUI = connector;
      setTonConnectUI(connector);

      // Listen for status changes
      const unsubscribe = connector.onStatusChange(handleWalletStatusChange);

      // Check initial state after a delay
      setTimeout(() => {
        console.log("[TON-INIT] 🔍 Checking initial connection state...");
        const realAddress = extractRealTonConnectAddress(connector);
        if (realAddress) {
          console.log("[TON-INIT] ✅ Initial real connection found:", realAddress);
          setIsConnected(true);
          setWalletAddress(realAddress);
          saveRealWalletAddress(realAddress, toast);
        } else {
          console.log("[TON-INIT] ❌ No initial real connection");
        }
      }, 1000);

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error("[TON-INIT] ❌ TonConnect initialization error:", error);
      nukeAllWalletData();
    }
  }, [toast]);

  const connect = () => {
    if (tonConnectUI) {
      console.log("[TON-CONNECT] 🔗 Opening wallet connection modal");
      nukeAllWalletData(); // Clean slate before connecting
      setIsConnected(false);
      setWalletAddress(null);
      tonConnectUI.openModal();
    } else {
      console.error("[TON-CONNECT] ❌ TonConnect UI not available");
      toast({
        title: "Connection Error",
        description: "Wallet connection service not ready. Please try again.",
        variant: "destructive"
      });
    }
  };

  const disconnect = () => {
    console.log("[TON-DISCONNECT] 🔌 Disconnecting wallet");
    if (tonConnectUI) {
      tonConnectUI.disconnect();
    }
    setIsConnected(false);
    setWalletAddress(null);
    nukeAllWalletData();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
      variant: "destructive"
    });
  };

  // DEBUG: Log current state
  useEffect(() => {
    console.log("[TON-STATE] 📊 Current provider state:", {
      isConnected,
      walletAddress,
      tonConnectUIConnected: tonConnectUI?.connected,
      tonConnectUIWallet: tonConnectUI?.wallet?.account?.address
    });
  }, [isConnected, walletAddress, tonConnectUI]);

  return {
    tonConnectUI,
    isConnected,
    walletAddress,
    connect,
    disconnect,
    isTelegramWebApp
  };
};
