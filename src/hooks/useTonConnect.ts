import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";

/**
 * Always pass through or extract the canonical UQ-address (44 base64url, no +/=) as given by Telegram Wallet/TonConnect.
 * No conversion, no string replace or homebrew encoding.
 * If supplied address is not a valid UQ-address, return null.
 */
function getCanonicalUQAddress(address: string | null | undefined): string | null {
  if (!address || typeof address !== "string") return null;
  const base = address.trim();
  // Match canonical Telegram/Ton Space format: UQ, 44 base64-url characters ("-_"), no + or =. (UQ + 44 chars = 46 total)
  if (/^UQ[a-zA-Z0-9\-_]{44}$/.test(base)) return base;
  // Accept 39, 40, or 46 char variants for backwards compat
  if (/^UQ[a-zA-Z0-9\-_]{40,}$/.test(base)) return base;
  // Otherwise, not a user-friendly wallet address that is copy-pasteable. Reject.
  return null;
}

type UseTonConnectReturn = {
  tonConnectUI: any;
  wallet: any;
  isConnected: boolean;
  walletAddress: string | null;
  connect: () => void;
  disconnect: () => void;
};

/**
 * Always use ONLY user-friendly canonical UQ-address as shown by Telegram Wallet/Ton Space.
 * Do NOT try to convert or accept raw/hex/other encodings.
 */
export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // The *true* address as TonConnect gives it—do not mutate
  const rawAccountAddress = wallet?.account?.address;
  const walletAddress = getCanonicalUQAddress(rawAccountAddress);

  // Only connected if address is real, canonical Telegram Wallet address
  const isConnected = !!walletAddress;

  // If localStorage has something invalid, clean it. Only accept canonical UQ-addresses in localStorage.
  useEffect(() => {
    const localStorageAddress = localStorage.getItem("tonWalletAddress");
    const isCanonicalFormat = !!getCanonicalUQAddress(localStorageAddress);

    if (localStorageAddress && !isCanonicalFormat && !walletAddress) {
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
      if (tonConnectUI?.disconnect) {
        tonConnectUI.disconnect();
      }
    }
    // If all is valid, do nothing.
  }, [tonConnectUI, walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      // Save only canonical UQ-address and mark as Telegram wallet
      localStorage.setItem("tonWalletAddress", walletAddress);
      localStorage.setItem("tonWalletProvider", "telegram-wallet");
    } else {
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
    }
  }, [walletAddress]);

  const connect = () => tonConnectUI?.openModal();
  const disconnect = () => tonConnectUI?.disconnect();

  return {
    tonConnectUI,
    wallet,
    isConnected,
    walletAddress,
    connect,
    disconnect,
  };
};
