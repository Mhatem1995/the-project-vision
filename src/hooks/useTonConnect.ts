
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";

/**
 * Relaxed: Accept any 'UQ' address with 36+ characters after UQ and allow any base64/base64url symbols (including +, /, =, -, _, .)
 * Trust TonConnect's output, but check only for UQ prefix and likely address length.
 */
function isLikelyTonspaceUQ(addr: string | null | undefined): boolean {
  return (
    typeof addr === "string" &&
    addr.startsWith("UQ") &&
    addr.length >= 38 && // UQ + at least 36 chars (was 40+)
    /^[a-zA-Z0-9\-\._\+=\/]+$/.test(addr.slice(2)) // Accept all base64/base64url-safe symbols, +, /, -, _, ., = allowed
  );
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
 * Use the wallet address exactly as given by TonConnect, if it's a UQ-style address.
 */
export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // The *real* address as TonConnect gives it—accept if it's a real UQ address of any valid length (not just 44)
  const rawAccountAddress = wallet?.account?.address;
  const walletAddress =
    isLikelyTonspaceUQ(rawAccountAddress) ? rawAccountAddress : null;

  // Only connected if we have a likely UQ-format address from wallet
  const isConnected = !!walletAddress;

  // On connect: save valid wallet to localStorage!
  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem("tonWalletAddress", walletAddress);
      localStorage.setItem("tonWalletProvider", "telegram-wallet");
    }
  }, [walletAddress]);

  // On mount: if address in localStorage is not valid UQ, nuke it
  useEffect(() => {
    const localAddress = localStorage.getItem("tonWalletAddress");
    if (localAddress && !isLikelyTonspaceUQ(localAddress)) {
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
      // Only disconnect if session wallet is truly missing
      if (!walletAddress && tonConnectUI?.disconnect) {
        tonConnectUI.disconnect();
      }
    }
  }, [tonConnectUI, walletAddress]);

  const connect = () => tonConnectUI?.openModal();
  const disconnect = () => {
    localStorage.removeItem("tonWalletAddress");
    localStorage.removeItem("tonWalletProvider");
    tonConnectUI?.disconnect();
  };

  return {
    tonConnectUI,
    wallet,
    isConnected,
    walletAddress,
    connect,
    disconnect,
  };
};
