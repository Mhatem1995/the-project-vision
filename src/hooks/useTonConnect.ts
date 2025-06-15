
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";
import { toUserFriendlyTonAddress } from "@/utils/tonAddressFormat";

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
   */
  const isConnected = !!wallet?.account?.address;
  const rawAddress = isConnected ? wallet.account.address : null;
  const userFriendlyAddress = rawAddress ? toUserFriendlyTonAddress(rawAddress) : null;
  const walletAddress = userFriendlyAddress ?? rawAddress;

  useEffect(() => {
    if (wallet?.account?.address) {
      // Save both formats for backend compatibility, but prefer user-friendly (u.../EQ.../UQ...)
      localStorage.setItem("tonWalletAddress", walletAddress || wallet.account.address);
      // For provider tracking (e.g., "telegram-wallet" or "ton-space")
      if (wallet.account.walletStateInit) {
        // Heuristic: TON Space walletStateInit is present
        localStorage.setItem("tonWalletProvider", "ton-space");
      } else {
        localStorage.setItem("tonWalletProvider", "telegram-wallet");
      }
    } else {
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
    }
  }, [wallet?.account?.address, walletAddress]);

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
