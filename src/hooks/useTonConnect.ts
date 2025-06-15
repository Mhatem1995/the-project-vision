
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";
import { toUserFriendlyAddress } from "@/utils/tonAddressUtils";

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
  // Always convert to user-friendly! (base64/UQ/EQ)
  const walletAddress = isConnected
    ? toUserFriendlyAddress(wallet.account.address)
    : null;

  useEffect(() => {
    if (wallet?.account?.address) {
      const userFriendly = toUserFriendlyAddress(wallet.account.address);
      localStorage.setItem("tonWalletAddress", userFriendly);
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
