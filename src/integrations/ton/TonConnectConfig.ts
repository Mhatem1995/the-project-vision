
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

// Get connected wallet address - simplified approach
export const getConnectedWalletAddress = (): string | null => {
  console.log("[TON-CONFIG] Getting connected wallet address");
  
  // Check TonConnect UI instance
  if (!window._tonConnectUI) {
    console.log("[TON-CONFIG] No TonConnect UI found");
    return null;
  }

  // Check if connected and has address
  if (window._tonConnectUI.connected && window._tonConnectUI.wallet?.account?.address) {
    const address = window._tonConnectUI.wallet.account.address;
    console.log("[TON-CONFIG] Found connected address:", address);
    return address;
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

// Simple TON wallet address validation
export const isValidTonAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  const cleanAddress = address.trim();
  
  // Basic length check
  if (cleanAddress.length < 40) {
    return false;
  }
  
  // Accept UQ/EQ format or raw 0: format
  const userFriendlyPattern = /^(UQ|EQ)[A-Za-z0-9_-]{40,}$/;
  const rawPattern = /^0:[a-fA-F0-9]{60,}$/;
  
  return userFriendlyPattern.test(cleanAddress) || rawPattern.test(cleanAddress);
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
