
import { getHttpEndpoint } from '@orbs-network/ton-access';

// App details for TON Connect - updated with proper manifest
export const tonConnectOptions = {
  manifestUrl: 'https://wiliamdrop.netlify.app/tonconnect-manifest.json',
};

// Helper function for initializing TON API endpoints
export const getTonNetwork = async () => {
  // Use mainnet for production
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
    // Fallback to public endpoint
    return {
      network,
      endpoint: `https://${network}-toncenter.com/api/v2/jsonRPC`
    };
  }
};

// Get the real connected wallet address from TonConnect UI
export const getConnectedWalletAddress = (): string | null => {
  console.log("[TON-CONFIG] Getting connected wallet address...");
  
  // Get from TonConnect UI directly (most reliable)
  if (window._tonConnectUI && window._tonConnectUI.connected && window._tonConnectUI.wallet?.account) {
    const realAddress = window._tonConnectUI.wallet.account.address;
    console.log("[TON-CONFIG] ✅ Getting REAL wallet address from TonConnect UI:", realAddress);
    return realAddress;
  }
  
  // Fallback to localStorage 
  const storedAddress = localStorage.getItem("tonWalletAddress");
  console.log("[TON-CONFIG] Getting wallet address from localStorage:", storedAddress);
  return storedAddress;
};

// Constants for API access
export const TON_API_ENDPOINTS = {
  TONAPI_IO: "https://tonapi.io",
  TONCENTER: "https://toncenter.com/api/v2"
};

// Transaction verification constants
export const TRANSACTION_VERIFICATION = {
  CHECK_DELAY_MS: 5000, // 5 seconds between checks
  MAX_ATTEMPTS: 12, // Try for up to 1 minute (12 * 5000ms)
  EXPIRATION_TIME_MS: 30 * 60 * 1000, // 30 minutes in milliseconds
};

// Updated TON wallet address validation - accepts both raw and user-friendly formats
export const isValidTonAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Remove any whitespace
  const cleanAddress = address.trim();
  
  console.log("[TON-VALIDATION] Validating address:", cleanAddress);
  console.log("[TON-VALIDATION] Length:", cleanAddress.length);
  
  // Check for user-friendly format (UQ/EQ + base64) - more flexible length check
  const userFriendlyPattern = /^(UQ|EQ)[A-Za-z0-9_-]{44,48}$/;
  
  // Check for raw format (0: + 64 hex characters)
  const rawPattern = /^0:[a-fA-F0-9]{64}$/;
  
  const isUserFriendly = userFriendlyPattern.test(cleanAddress);
  const isRaw = rawPattern.test(cleanAddress);
  
  console.log("[TON-VALIDATION] User-friendly pattern match:", isUserFriendly);
  console.log("[TON-VALIDATION] Raw pattern match:", isRaw);
  
  const isValid = isUserFriendly || isRaw;
  console.log("[TON-VALIDATION] Final validation result:", isValid);
  
  return isValid;
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
