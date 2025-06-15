import { useState, useEffect } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { tonConnectOptions } from "@/integrations/ton/TonConnectConfig";
import { detectTelegramWebApp } from "@/utils/tonWalletUtils";
import { supabase } from "@/integrations/supabase/client";

// Only allow Telegram Wallet: wallet id for TonConnect is 'telegram-wallet'
const TELEGRAM_WALLET_ID = 'telegram-wallet';

// Utility functions
const isUserFriendly = (address: string): boolean =>
  address && (address.startsWith("UQ") || address.startsWith("EQ"));
const isRawTonAddress = (address: string): boolean =>
  address && address.startsWith("0:");

const toUserFriendly = (address: string): string => {
  if (!address) return "";
  if (address.startsWith("0:")) {
    return address;
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
    const savedWalletProvider = localStorage.getItem("tonWalletProvider");
    const savedAddress = localStorage.getItem("tonWalletAddress");

    if (
      savedWalletProvider === TELEGRAM_WALLET_ID &&
      savedAddress &&
      (isUserFriendly(savedAddress) || isRawTonAddress(savedAddress))
    ) {
      setWalletAddress(savedAddress);
      setIsConnected(true);
      console.log("[TON-INIT-RESTORE] Telegram Wallet restored from localStorage:", savedAddress);
    } else {
      setWalletAddress(null);
      setIsConnected(false);
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
    }
  }, []);

  useEffect(() => {
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    let connector: TonConnectUI;

    if (!window._tonConnectUI) {
      connector = new TonConnectUI({
        manifestUrl: tonConnectOptions.manifestUrl,
        uiPreferences: {
          // Other uiPreferences can go here
        }
      });
      window._tonConnectUI = connector;
    } else {
      connector = window._tonConnectUI;
    }

    setTonConnectUI(connector);

    // Listen for wallet connections
    const unsubscribe = connector.onStatusChange(async (wallet: any) => {
      console.log("[TON-CONNECT-DEBUG] status change event:", wallet);

      // Robust check: appName includes 'telegram' (any case/position)
      const appName = wallet?.device?.appName?.toLowerCase() ?? "";
      const isTelegramWallet = appName.includes("telegram");

      if (
        wallet &&
        wallet.account &&
        wallet.account.address &&
        isTelegramWallet
      ) {
        const address = wallet.account.address;
        console.log('[TON-CONNECT-DEBUG] Wallet Address:', address);

        // Accept UQ/EQ or 0:... raw addresses
        if (!isUserFriendly(address) && !isRawTonAddress(address)) {
          toast?.({
            title: "Wallet Error",
            description: "Please connect your Telegram Wallet. Only Telegram Wallet is supported.",
            variant: "destructive"
          });
          setIsConnected(false);
          setWalletAddress(null);
          localStorage.removeItem("tonWalletAddress");
          localStorage.removeItem("tonWalletProvider");
          return;
        }

        setIsConnected(true);
        setWalletAddress(address);
        localStorage.setItem("tonWalletAddress", address);
        localStorage.setItem("tonWalletProvider", TELEGRAM_WALLET_ID);

        // Save to Supabase wallets table
        const userId = localStorage.getItem("telegramUserId");
        if (userId) {
          await supabase.from("wallets").upsert({
            telegram_id: userId,
            wallet_address: address
          });
        }

        // Warn if raw (0:) used
        if (isRawTonAddress(address)) {
          toast?.({
            title: "Raw wallet address",
            description: "Connected with raw TON address (0:...). If you experience issues, re-install/update Telegram Wallet.",
            variant: "default"
          });
        }

      } else {
        setIsConnected(false);
        setWalletAddress(null);
        localStorage.removeItem("tonWalletAddress");
        localStorage.removeItem("tonWalletProvider");
        toast?.({
          title: "Only Telegram Wallet is supported",
          description: "Please use your Telegram Wallet to connect.",
          variant: "destructive"
        });
      }
    });

    setTimeout(() => {
      const wallet = connector.wallet;
      if (
        wallet &&
        !((wallet.device.appName?.toLowerCase() ?? "").includes("telegram"))
      ) {
        connector.disconnect();
      }
    }, 500);

    return () => {
      unsubscribe();
    };
  }, [toast]);

  const connect = () => {
    if (tonConnectUI) {
      tonConnectUI.openModal();
    } else {
      toast({
        title: "Connection Error",
        description: "Wallet service not ready. Please refresh and try again.",
        variant: "destructive"
      });
    }
  };

  const disconnect = () => {
    if (tonConnectUI) {
      tonConnectUI.disconnect();
    }
    setIsConnected(false);
    setWalletAddress(null);
    localStorage.removeItem("tonWalletAddress");
    localStorage.removeItem("tonWalletProvider");
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
