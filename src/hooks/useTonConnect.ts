
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
 * The only secure way to verify a connected user is the session itself as provided by TonConnect.
 * Do not depend on walletInfo, localStorage provider hacks, or any string matching.
 * This follows the official guidelines: https://docs.ton.org/v3/guidelines/ton-connect/guidelines/verifying-signed-in-users
 */
export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  /**
   * The authoritative source of the user is wallet?.account?.address.
   * Do not check any walletInfo, localStorage, ids, etc.
   */
  const isConnected = !!wallet?.account?.address;
  const walletAddress = isConnected ? wallet.account.address : null;

  // Set the connected address in localStorage, but always treat TonConnect session as source of truth
  useEffect(() => {
    if (wallet?.account?.address) {
      localStorage.setItem("tonWalletAddress", wallet.account.address);
    } else {
      localStorage.removeItem("tonWalletAddress");
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
