
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";

/**
 * Accept any non-empty address provided by TonConnect as 'connected'.
 * No format checks at all!
 */
function isNonEmptyAddress(addr: string | null | undefined): boolean {
  return typeof addr === "string" && addr.length > 0;
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

  // Grab and accept whatever TonConnect gives us—NO FORMAT CHECK
  const rawAccountAddress = wallet?.account?.address;
  const walletAddress =
    isNonEmptyAddress(rawAccountAddress) ? rawAccountAddress : null;

  // Connected if there's a non-empty wallet address
  const isConnected = !!walletAddress;

  // Only save to localStorage if we're actually connected
  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem("tonWalletAddress", walletAddress);
      localStorage.setItem("tonWalletProvider", "telegram-wallet");
    }
    // DO NOT REMOVE FROM LOCALSTORAGE automatically
  }, [walletAddress]);

  // On mount: do nothing except optionally future migration/cleanup (no more force disconnects)
  useEffect(() => {
    // Nothing: Don't clean or validate address anymore
  }, []);

  // User explicit connect/disconnect methods from TonConnect UI
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
