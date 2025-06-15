
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";

// Custom hook to expose wallet connection state & actions in your app
export const useTonConnect = () => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const isConnected = !!wallet?.account?.address;
  const walletAddress = wallet?.account?.address ?? null;

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
