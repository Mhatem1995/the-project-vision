import { useState, useEffect, useCallback } from "react";
import { TonConnectUI } from "@tonconnect/ui";
import { tonConnectOptions, getPreferredWallets } from "@/integrations/ton/TonConnectConfig";
import { detectTelegramWebApp } from "@/utils/tonWalletUtils";
import { supabase } from "@/integrations/supabase/client";

// Only allow Telegram Wallet: wallet id for TonConnect is 'telegram-wallet'
const TELEGRAM_WALLET_ID = 'telegram-wallet';

// Utility to verify address is in user-friendly form (UQ/EQ) or raw (0:) format
const isUserFriendly = (address: string): boolean =>
  address && (address.startsWith("UQ") || address.startsWith("EQ"));

// Utility: convert raw (0:...) to user-friendly format if needed (naive fallback)
const toUserFriendly = (address: string): string => {
  if (!address) return "";
  if (address.startsWith("0:")) {
    // Fallback (should not happen with Telegram Wallet)
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

  // On mount: restore wallet if already in localStorage and if it's Telegram Wallet
  useEffect(() => {
    const savedWalletProvider = localStorage.getItem("tonWalletProvider");
    const savedAddress = localStorage.getItem("tonWalletAddress");

    if (
      savedWalletProvider === TELEGRAM_WALLET_ID &&
      savedAddress &&
      isUserFriendly(savedAddress)
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

  // Only allow Telegram Wallet in the connect modal
  useEffect(() => {
    const isTgWebApp = detectTelegramWebApp();
    setIsTelegramWebApp(isTgWebApp);

    let connector: TonConnectUI;

    if (!window._tonConnectUI) {
      connector = new TonConnectUI({
        manifestUrl: tonConnectOptions.manifestUrl,
        // Remove uiPreferences.wallets - not supported by TonConnect UI
        uiPreferences: {
          // You may add other supported uiPreferences options here
        }
      });
      window._tonConnectUI = connector;
    } else {
      connector = window._tonConnectUI;
    }

    setTonConnectUI(connector);

    // Listen only for Telegram Wallet
    const unsubscribe = connector.onStatusChange(async (wallet: any) => {
      if (
        wallet &&
        wallet.account &&
        wallet.account.address &&
        wallet.device.appName.toLowerCase().includes("telegram")
      ) {
        const address = wallet.account.address;
        // Only allow user-friendly addresses
        if (!isUserFriendly(address)) {
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
      } else {
        setIsConnected(false);
        setWalletAddress(null);
        localStorage.removeItem("tonWalletAddress");
        localStorage.removeItem("tonWalletProvider");
      }
    });

    // If wallet restored but NOT Telegram Wallet, forcibly disconnect
    setTimeout(() => {
      const wallet = connector.wallet;
      if (
        wallet &&
        wallet.device.appName.toLowerCase() !== "telegram"
      ) {
        connector.disconnect();
      }
    }, 500);

    return () => {
      // Fix: do not pass any argument to unsubscribe
      unsubscribe();
    };
  }, [toast]);

  const connect = () => {
    if (tonConnectUI) {
      // Show only Telegram Wallet option if supported, fallback to default openModal
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
