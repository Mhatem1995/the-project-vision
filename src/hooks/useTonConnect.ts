
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";

/**
 * Accept ONLY user-friendly TON addresses: must start with "UQ" or "EQ".
 * All other formats—including 0: raw—are NEVER accepted!
 */
function isUserFriendlyTonAddress(addr: string | null | undefined): boolean {
  return (
    typeof addr === "string" &&
    (addr.startsWith("UQ") || addr.startsWith("EQ")) &&
    addr.length > 10 // arbitrary minimum, but must be valid base64
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

export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // Only accept user-friendly wallet address
  const rawAccountAddress = wallet?.account?.address;
  const walletAddress =
    isUserFriendlyTonAddress(rawAccountAddress) ? rawAccountAddress : null;

  // Connected only if base64 (UQ/EQ) address
  const isConnected = !!walletAddress;

  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem("tonWalletAddress", walletAddress);
      localStorage.setItem("tonWalletProvider", "telegram-wallet");
    }
    // DO NOT save bad addresses; don't remove anything if not connected
  }, [walletAddress]);

  useEffect(() => {
    // No validation/cleanup—user always decides (only hard rule: must be UQ/EQ)
  }, []);

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
