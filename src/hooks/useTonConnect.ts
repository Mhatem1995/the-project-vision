
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
const TELEGRAM_WALLET_NAME = "Telegram Wallet"; // Adjust if needed

export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const isConnected =
    !!wallet?.account?.address &&
    (wallet?.walletInfo?.name === TELEGRAM_WALLET_NAME ||
      wallet?.walletInfo?.aboutUrl?.includes("t.me") ||
      wallet?.walletInfo?.appName === TELEGRAM_WALLET_NAME ||
      wallet?.walletInfo?.id === TELEGRAM_WALLET_ID);

  const walletAddress =
    isConnected && wallet?.account?.address ? wallet.account.address : null;

  // Save the address and provider in localStorage ONLY if it is Telegram Wallet
  useEffect(() => {
    if (isConnected && walletAddress) {
      localStorage.setItem("tonWalletAddress", walletAddress);
      localStorage.setItem("tonWalletProvider", TELEGRAM_WALLET_ID);
      // Optionally save to DB if needed.
      console.log("[TON-CONNECT] Telegram Wallet connected and saved.");
    } else {
      // Clean up any fake/old value if disconnected
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
    }
  }, [isConnected, walletAddress]);

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
