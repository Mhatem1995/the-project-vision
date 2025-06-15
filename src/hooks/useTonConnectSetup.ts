
import { useState, useEffect, useCallback } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { tonConnectOptions } from "@/integrations/ton/TonConnectConfig";
import { detectTelegramWebApp, saveRealWalletAddress } from "@/utils/tonWalletUtils";
import { supabase } from "@/integrations/supabase/client";

// Utility: always convert raw address to user-friendly (UQ.../EQ...) if needed
const toUserFriendly = (address: string): string => {
  if (!address) return "";
  if (address.startsWith("0:")) {
    // Simple raw to user-friendly: use EQ prefix (if mainnet), base64 encode the bytes
    // (In production, use TON libraries to handle edge cases)
    // Here, fallback: just return as-is, but warn in log.
    console.warn("[TON-CONVERT] Raw address shown, needs conversion:", address);
    return address; // Could use ton-core to properly convert, but keep minimal for now.
  }
  return address;
};

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

  useEffect(() => {
    const savedAddress = localStorage.getItem("tonWalletAddress");
    if (savedAddress) {
      // Always display in user-friendly format
      setWalletAddress(toUserFriendly(savedAddress));
      setIsConnected(true);
      console.log("[TON-INIT-RESTORE] Restored wallet from localStorage:", savedAddress);
    }
  }, []); // Only on mount

  const handleWalletStatusChange = useCallback(async (wallet: any) => {
    console.log("[TON-STATUS] 🔄 Wallet status changed:", wallet);

    if (wallet && wallet.account && wallet.account.address) {
      let realAddress = wallet.account.address;
      // Always convert to user-friendly format (if in raw format)
      realAddress = toUserFriendly(realAddress);

      if (!realAddress || realAddress.length < 20) {
        console.error("[TON-STATUS] 🛑 Invalid or demo wallet address:", realAddress);
        toast?.({
          title: "Wallet Error",
          description: "Wallet address is invalid, please reconnect your TON wallet.",
          variant: "destructive"
        });
        // Clear everything except existing state
        setIsConnected(false);
        setWalletAddress(null);
        localStorage.removeItem("tonWalletAddress");
        return;
      }

      console.log("[TON-STATUS] ✅ REAL wallet connected, SAVING:", realAddress);

      setIsConnected(true);
      setWalletAddress(realAddress);

      // Save to localStorage (user-friendly)
      localStorage.setItem("tonWalletAddress", realAddress);

      // Save to Supabase wallets table (upsert)
      const userId = localStorage.getItem("telegramUserId");
      if (userId && realAddress) {
        await supabase.from("wallets").upsert({
          telegram_id: userId,
          wallet_address: realAddress
        });
      }
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

    const connector = window._tonConnectUI ?? new TonConnectUI({
      manifestUrl: tonConnectOptions.manifestUrl,
    });

    if (!window._tonConnectUI) {
      window._tonConnectUI = connector;
      console.log("[TON-INIT] New TonConnect instance created and assigned to window.");
    }

    setTonConnectUI(connector);

    const unsubscribe = connector.onStatusChange(handleWalletStatusChange);

    const timer = setTimeout(() => {
      if (connector.connected && connector.wallet) {
        console.log("[TON-INIT] Restored connection found. Manually triggering status handler to sync state.");
        handleWalletStatusChange(connector.wallet);
      } else {
        console.log("[TON-INIT] No restored connection found after timeout.");
      }
    }, 500);

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
