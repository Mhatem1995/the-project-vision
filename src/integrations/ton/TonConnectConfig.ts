import { getHttpEndpoint } from '@orbs-network/ton-access';

// App details for TON Connect
export const tonConnectOptions = {
  manifestUrl: 'https://wiliamdrop.netlify.app/tonconnect-manifest.json',
};

// Helper function for initializing TON API endpoints
export const getTonNetwork = async () => {
  const isMainnet = true;
  const network = isMainnet ? 'mainnet' : 'testnet';
  
  try {
    const endpoint = await getHttpEndpoint({ network });
    return { 
      network, 
      endpoint 
    };
  } catch (error) {
    console.error('Failed to get TON HTTP endpoint:', error);
    return {
      network,
      endpoint: `https://${network}-toncenter.com/api/v2/jsonRPC`
    };
  }
};

// Get connected wallet address - ALWAYS use localStorage as the single source of truth.
// The useTonConnectSetup hook is responsible for keeping localStorage updated.
export const getConnectedWalletAddress = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const savedProvider = localStorage.getItem("tonWalletProvider");
  if (savedProvider === "telegram-wallet") {
    const savedAddress = localStorage.getItem("tonWalletAddress");
    if (savedAddress) {
      console.log("[TON-CONFIG] Found Telegram wallet address in localStorage:", savedAddress);
      return savedAddress;
    }
  }
  console.log("[TON-CONFIG] No connected Telegram wallet found in localStorage.");
  return null;
};

// Constants for API access
export const TON_API_ENDPOINTS = {
  TONAPI_IO: "https://tonapi.io",
  TONCENTER: "https://toncenter.com/api/v2"
};

// Transaction verification constants
export const TRANSACTION_VERIFICATION = {
  CHECK_DELAY_MS: 5000,
  MAX_ATTEMPTS: 12,
  EXPIRATION_TIME_MS: 30 * 60 * 1000,
};

// Get preferred wallets for TON Space
export const getPreferredWallets = () => {
  // ONLY Telegram Wallet allowed!
  return ['telegram-wallet'];
};
