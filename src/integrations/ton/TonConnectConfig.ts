
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

// TON wallet address used for payments - set to your TonKeeper wallet
export const tonWalletAddress = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C";

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

// Updated TON wallet address validation - more flexible for real addresses
export const isValidTonAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Remove any whitespace
  const cleanAddress = address.trim();
  
  // TON addresses can be in different formats:
  // 1. Raw format: 48 characters starting with UQ or EQ
  // 2. User-friendly format: can be longer and contain different characters
  // 3. Bounceable/non-bounceable variants
  
  // Check for basic TON address patterns
  const basicTonPattern = /^(UQ|EQ|kQ)[A-Za-z0-9_-]{44,48}$/;
  const extendedTonPattern = /^[A-Za-z0-9_-]{48,}$/;
  
  // Log for debugging
  console.log("[TON-VALIDATION] Validating address:", cleanAddress);
  console.log("[TON-VALIDATION] Length:", cleanAddress.length);
  console.log("[TON-VALIDATION] Basic pattern match:", basicTonPattern.test(cleanAddress));
  console.log("[TON-VALIDATION] Extended pattern match:", extendedTonPattern.test(cleanAddress));
  
  // Accept if it matches either pattern and has reasonable length
  const isValid = (basicTonPattern.test(cleanAddress) || extendedTonPattern.test(cleanAddress)) && 
                  cleanAddress.length >= 44 && 
                  cleanAddress.length <= 55;
  
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
