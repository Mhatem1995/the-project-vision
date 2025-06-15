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

// Get connected wallet address - check localStorage first, then TonConnect
export const getConnectedWalletAddress = (): string | null => {
  console.log("[TON-CONFIG] Getting connected wallet address");

  // 1. Prioritize localStorage for consistency
  const savedAddress = localStorage.getItem("tonWalletAddress");
  if (savedAddress) {
    console.log("[TON-CONFIG] Found wallet address in localStorage:", savedAddress);
    return savedAddress;
  }
  
  // 2. Fallback to TonConnect UI instance if not in localStorage
  if (window._tonConnectUI?.connected && window._tonConnectUI.wallet?.account?.address) {
    const realAddress = window._tonConnectUI.wallet.account.address;
    console.log("[TON-CONFIG] Found REAL connected address from TonConnect UI, saving to localStorage:", realAddress);
    localStorage.setItem("tonWalletAddress", realAddress); // Persist for next time
    return realAddress;
  }

  console.log("[TON-CONFIG] No connected wallet found");
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
  return [
    'tonkeeper', 
    'telegram-wallet',
    'tonhub',
    'dewallet',
    'xtonwallet',
    'ton-wallet'
  ];
};
