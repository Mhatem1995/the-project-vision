
import { useState, useEffect, useCallback } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { tonConnectOptions } from "@/integrations/ton/TonConnectConfig";
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

  // This effect will sync state with localStorage on initial component mount.
  useEffect(() => {
    const savedAddress = localStorage.getItem("tonWalletAddress");
    if (savedAddress) {
      setWalletAddress(savedAddress);
      setIsConnected(true);
      console.log("[TON-INIT-RESTORE] Restored wallet from localStorage:", savedAddress);
    }
  }, []); // The empty dependency array ensures this runs only once on mount.

  // Memoized handler for wallet status changes to ensure consistency
  const handleWalletStatusChange = useCallback(async (wallet: any) => {
    console.log("[TON-STATUS] 🔄 Wallet status changed:", wallet);
    
    if (wallet && wallet.account && wallet.account.address) {
      const realAddress = wallet.account.address;
      console.log("[TON-STATUS] ✅ REAL wallet connected, SAVING:", realAddress);
      
      setIsConnected(true);
      setWalletAddress(realAddress);
      
      // Save the REAL address to localStorage and Supabase (which now performs an upsert)
      await saveRealWalletAddress(realAddress, toast);
    } else if (wallet === null) {
      console.log("[TON-STATUS] ❌ Wallet disconnected, clearing local storage and state.");
      setIsConnected(false);
      setWalletAddress(null);
      localStorage.removeItem("tonWalletAddress");
    }
  }, [toast]);

  useEffect(() => {
    console.log("[TON-INIT] 🚀 Initializing TonConnect setup");
    
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    // Use existing instance or create a new one to avoid re-initialization
    const connector = window._tonConnectUI ?? new TonConnectUI({
      manifestUrl: tonConnectOptions.manifestUrl,
    });

    if (!window._tonConnectUI) {
      window._tonConnectUI = connector;
      console.log("[TON-INIT] New TonConnect instance created and assigned to window.");
    }

    setTonConnectUI(connector);

    // Subscribe to status changes. This handles new connections, disconnections, etc.
    const unsubscribe = connector.onStatusChange(handleWalletStatusChange);

    // CRITICAL FIX: Check initial state, as onStatusChange may not fire for a restored session.
    // Give TonConnect a moment to restore the connection from its own storage.
    const timer = setTimeout(() => {
      if (connector.connected && connector.wallet) {
        console.log("[TON-INIT] Restored connection found. Manually triggering status handler to sync state.");
        handleWalletStatusChange(connector.wallet);
      } else {
        console.log("[TON-INIT] No restored connection found after timeout.");
      }
    }, 500);

    // Cleanup on component unmount
    return () => {
      console.log("[TON-CLEANUP] Clearing timer and unsubscribing from status changes.");
      clearTimeout(timer);
      unsubscribe();
    };
    
  }, [toast, handleWalletStatusChange]);

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
    console.log("[TON-DISCONNECT] Disconnecting wallet and clearing data");
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
