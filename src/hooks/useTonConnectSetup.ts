
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

  // Simplified wallet status handler
  const handleWalletStatusChange = async (wallet: any) => {
    console.log("[TON-STATUS] 🔄 Wallet status changed:", wallet);
    
    if (wallet && wallet.account && wallet.account.address) {
      const address = wallet.account.address;
      console.log("[TON-STATUS] ✅ Wallet connected with address:", address);
      
      setIsConnected(true);
      setWalletAddress(address);
      await saveRealWalletAddress(address, toast);
    } else if (wallet === null) {
      console.log("[TON-STATUS] ❌ Wallet disconnected");
      setIsConnected(false);
      setWalletAddress(null);
      localStorage.removeItem("tonWalletAddress");
    }
    // Don't change state for partial updates
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
      
      // Check if already connected
      if (existingUI.connected && existingUI.wallet?.account?.address) {
        const address = existingUI.wallet.account.address;
        console.log("[TON-INIT] Found existing connection:", address);
        setIsConnected(true);
        setWalletAddress(address);
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

      // Check initial connection after setup
      setTimeout(() => {
        if (connector.connected && connector.wallet?.account?.address) {
          const address = connector.wallet.account.address;
          console.log("[TON-INIT] Initial connection found:", address);
          setIsConnected(true);
          setWalletAddress(address);
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
