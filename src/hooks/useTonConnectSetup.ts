
import { useState, useEffect } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { tonConnectOptions, getPreferredWallets } from "@/integrations/ton/TonConnectConfig";
import { detectTelegramWebApp, extractRealTonConnectAddress, saveRealWalletAddress } from "@/utils/tonWalletUtils";

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

  // Handle wallet status changes - More permissive approach
  const handleWalletStatusChange = async (wallet: any) => {
    console.log("[TON-STATUS] 🔄 === WALLET STATUS CHANGED ===");
    console.log("[TON-STATUS] 🔄 Wallet object:", wallet);
    console.log("[TON-STATUS] 🔄 Has account:", !!wallet?.account);
    console.log("[TON-STATUS] 🔄 Has address:", !!wallet?.account?.address);
    
    if (wallet && wallet.account && wallet.account.address) {
      console.log("[TON-STATUS] ✅ WALLET CONNECTION DETECTED");
      const address = wallet.account.address;
      
      console.log("[TON-STATUS] ✅ Setting connection state with address:", address);
      setIsConnected(true);
      setWalletAddress(address);
      await saveRealWalletAddress(address, toast);
    } else if (!wallet) {
      console.log("[TON-STATUS] ❌ WALLET DISCONNECTED");
      setIsConnected(false);
      setWalletAddress(null);
      
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected.",
        variant: "destructive"
      });
    }
    // Don't change state for partial wallet objects - let them remain
  };

  useEffect(() => {
    console.log("[TON-INIT] 🚀 === PROVIDER INITIALIZATION ===");
    
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    // Check for existing TonConnect UI
    if (window._tonConnectUI) {
      console.log("[TON-INIT] 🔄 Using existing TonConnect UI");
      const existingUI = window._tonConnectUI;
      setTonConnectUI(existingUI);
      
      // Check initial state more permissively
      if (existingUI.wallet && existingUI.wallet.account && existingUI.wallet.account.address) {
        const address = existingUI.wallet.account.address;
        console.log("[TON-INIT] ✅ Found existing connection:", address);
        setIsConnected(true);
        setWalletAddress(address);
        saveRealWalletAddress(address, toast);
      }
      
      // Add status change listener to existing UI
      existingUI.onStatusChange(handleWalletStatusChange);
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
        if (connector.wallet && connector.wallet.account && connector.wallet.account.address) {
          const address = connector.wallet.account.address;
          console.log("[TON-INIT] ✅ Initial connection found:", address);
          setIsConnected(true);
          setWalletAddress(address);
          saveRealWalletAddress(address, toast);
        }
      }, 1000);

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error("[TON-INIT] ❌ TonConnect initialization error:", error);
      setIsConnected(false);
      setWalletAddress(null);
    }
  }, [toast]);

  const connect = () => {
    if (tonConnectUI) {
      console.log("[TON-CONNECT] 🔗 Opening wallet connection modal");
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
    localStorage.removeItem("tonWalletAddress");
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
