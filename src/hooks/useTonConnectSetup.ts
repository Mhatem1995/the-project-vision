
import { useState, useEffect } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { tonConnectOptions, getPreferredWallets } from "@/integrations/ton/TonConnectConfig";
import { detectTelegramWebApp, saveRealWalletAddress } from "@/utils/tonWalletUtils";

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

  // Handle wallet status changes - get REAL address from TonConnect
  const handleWalletStatusChange = async (wallet: any) => {
    console.log("[TON-STATUS] 🔄 Wallet status changed:", wallet);
    
    if (wallet && wallet.account && wallet.account.address) {
      // Get the REAL wallet address from TonConnect
      const realAddress = wallet.account.address;
      console.log("[TON-STATUS] ✅ REAL wallet connected:", realAddress);
      
      setIsConnected(true);
      setWalletAddress(realAddress);
      
      // Save the REAL address
      await saveRealWalletAddress(realAddress, toast);
    } else if (wallet === null) {
      console.log("[TON-STATUS] ❌ Wallet disconnected");
      setIsConnected(false);
      setWalletAddress(null);
      localStorage.removeItem("tonWalletAddress");
    }
  };

  useEffect(() => {
    console.log("[TON-INIT] 🚀 Initializing TonConnect");
    
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    // Check for existing instance
    if (window._tonConnectUI) {
      console.log("[TON-INIT] Using existing TonConnect UI");
      const existingUI = window._tonConnectUI;
      setTonConnectUI(existingUI);
      
      // Check if already connected and get REAL address
      if (existingUI.connected && existingUI.wallet?.account?.address) {
        const realAddress = existingUI.wallet.account.address;
        console.log("[TON-INIT] Found existing connection with REAL address:", realAddress);
        setIsConnected(true);
        setWalletAddress(realAddress);
      }
      
      existingUI.onStatusChange(handleWalletStatusChange);
      return;
    }

    // Create new instance
    try {
      const options = {
        manifestUrl: tonConnectOptions.manifestUrl,
        preferredWallets: getPreferredWallets()
      };

      console.log("[TON-INIT] Creating new TonConnect instance");
      const connector = new TonConnectUI(options);
      
      window._tonConnectUI = connector;
      setTonConnectUI(connector);

      connector.onStatusChange(handleWalletStatusChange);

      // Check initial connection after setup and get REAL address
      setTimeout(() => {
        if (connector.connected && connector.wallet?.account?.address) {
          const realAddress = connector.wallet.account.address;
          console.log("[TON-INIT] Initial connection found with REAL address:", realAddress);
          setIsConnected(true);
          setWalletAddress(realAddress);
        }
      }, 1000);

    } catch (error) {
      console.error("[TON-INIT] ❌ Failed to create TonConnect:", error);
    }
  }, [toast]);

  const connect = () => {
    if (tonConnectUI) {
      console.log("[TON-CONNECT] Opening wallet modal");
      tonConnectUI.openModal();
    } else {
      console.error("[TON-CONNECT] TonConnect UI not ready");
      toast({
        title: "Connection Error",
        description: "Wallet service not ready. Please refresh and try again.",
        variant: "destructive"
      });
    }
  };

  const disconnect = () => {
    console.log("[TON-DISCONNECT] Disconnecting wallet");
    if (tonConnectUI) {
      tonConnectUI.disconnect();
    }
    setIsConnected(false);
    setWalletAddress(null);
    localStorage.removeItem("tonWalletAddress");
  };

  return {
    tonConnectUI,
    isConnected,
    walletAddress,
    connect,
    disconnect,
    isTelegramWebApp
  };
};
