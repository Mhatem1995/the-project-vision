
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";

type UseTonConnectReturn = {
  tonConnectUI: any;
  wallet: any;
  isConnected: boolean;
  walletAddress: string | null;
  connect: () => void;
  disconnect: () => void;
};

/**
 * Always use wallet.account.address from TonConnect session as source of truth.
 * Only accept Telegram Wallet.
 */
export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // Only connected if true session with address present
  const isConnected = !!wallet?.account?.address;
  const walletAddress = isConnected ? wallet.account.address : null;

  useEffect(() => {
    if (wallet?.account?.address) {
      // Save only real TonConnect session address and mark as Telegram wallet
      localStorage.setItem("tonWalletAddress", wallet.account.address);
      localStorage.setItem("tonWalletProvider", "telegram-wallet");
    } else {
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
    }
  }, [wallet?.account?.address]);

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
