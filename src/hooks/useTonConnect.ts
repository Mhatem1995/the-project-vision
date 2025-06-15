import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect } from "react";

/**
 * Convert any address to UQ... base64 user-friendly.
 * Returns UQ... if input is 0:..., UQ..., EQ..., else null.
 */
function toUQFormat(address: string | null | undefined): string | null {
  if (!address || typeof address !== "string") return null;
  const base = address.trim();
  if (base.startsWith("UQ")) return base;
  if (base.startsWith("EQ")) return base.replace("EQ", "UQ");
  if (base.startsWith("0:")) {
    // hard minimal conversion: no CRC, just "0:" -> UQ, hex to base64 for 32 bytes
    try {
      const hex = base.split(":")[1];
      if (!hex || hex.length !== 64) return null;
      // Convert hex to Uint8Array
      const bytes = new Uint8Array(33); // 1 tag, 32 address bytes
      // Work for bounceable (base tag is 0x11 for mainnet)
      bytes[0] = 0x11; // bounceable mainnet (UQ...)
      for (let i = 0; i < 32; i++) {
        bytes[i + 1] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
      }
      // Encode to base64
      const base64 = typeof window !== "undefined"
        ? btoa(String.fromCharCode.apply(null, Array.from(bytes)))
        : Buffer.from(bytes).toString("base64");
      return "UQ" + base64.replace(/=*$/, ""); // remove any trailing '='
    } catch {
      return null;
    }
  }
  return null;
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
 * Always use user-friendly UQ... address as source of truth.
 * Only accept Telegram Wallet.
 */
export const useTonConnect = (): UseTonConnectReturn => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // Use always UQ format if available
  const rawAddr = wallet?.account?.address;
  const walletAddress = toUQFormat(rawAddr);

  // Only connected if address in UQ format present
  const isConnected = !!walletAddress;

  // Only force disconnect if non-UQ address found in storage and walletAddress is NOT valid
  useEffect(() => {
    const localStorageAddress = localStorage.getItem("tonWalletAddress");
    const isLocalStorageValid = localStorageAddress && /^UQ[A-Za-z0-9_-]{40,}$/.test(localStorageAddress);

    // Only check/force disconnect if localStorage address exists, is NOT UQ, and walletAddress missing
    if (localStorageAddress && !isLocalStorageValid && !walletAddress) {
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
      if (tonConnectUI?.disconnect) {
        tonConnectUI.disconnect();
      }
    }
    // If everything already valid (wallet connected, correct format), do nothing.
  }, [tonConnectUI, walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      // Save only real TonConnect session as UQ address and mark as Telegram wallet
      localStorage.setItem("tonWalletAddress", walletAddress);
      localStorage.setItem("tonWalletProvider", "telegram-wallet");
    } else {
      localStorage.removeItem("tonWalletAddress");
      localStorage.removeItem("tonWalletProvider");
    }
  }, [walletAddress]);

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
