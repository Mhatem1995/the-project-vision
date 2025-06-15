
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

const TELEGRAM_WALLET_ID = "telegram-wallet";

export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // Only consider the wallet connected if we have an address AND we stored "telegram-wallet" as provider.
  const walletProvider = localStorage.getItem("tonWalletProvider");
  const isTelegramWallet = walletProvider === TELEGRAM_WALLET_ID;
  const isConnected = !!wallet?.account?.address && isTelegramWallet;

  const walletAddress = isConnected && wallet?.account?.address ? wallet.account.address : null;

  // Save the address and provider in localStorage ONLY when a wallet connects, otherwise clear it
  useEffect(() => {
    if (wallet?.account?.address) {
      localStorage.setItem("tonWalletAddress", wallet.account.address);
      localStorage.setItem("tonWalletProvider", TELEGRAM_WALLET_ID);
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

