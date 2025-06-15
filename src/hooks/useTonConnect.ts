import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";

/**
 * Accept any 'UQ' address of 40+ base64url chars as "real enough for TON Space" for persistence.
 * (No conversion! Trust TonConnect's output, but basic sanity check.)
 */
function isLikelyTonspaceUQ(addr: string | null | undefined): boolean {
  return (
    typeof addr === "string" &&
    addr.startsWith("UQ") &&
    addr.length >= 40 && 
    /^[a-zA-Z0-9\-\._]+$/.test(addr.slice(2)) // base64 url or legacy
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
    } else {
      // Only clear on explicit disconnect, not formatting mismatch
      // (Otherwise, user will get disconnected after page reload for trivial format changes!)
      // Don't wipe localStorage if a wallet used to be there
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
