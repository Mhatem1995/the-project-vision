
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

// Get the real connected wallet address from localStorage
export const getConnectedWalletAddress = (): string | null => {
  return localStorage.getItem("tonWalletAddress");
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

// Convert raw TON address (0:hex) to user-friendly format
export const convertToUserFriendlyAddress = (rawAddress: string): string => {
  console.log("[TON-CONVERT] Converting raw address:", rawAddress);
  
  // If it's already user-friendly (starts with UQ/EQ), return as is
  if (rawAddress.startsWith('UQ') || rawAddress.startsWith('EQ')) {
    console.log("[TON-CONVERT] Already user-friendly format");
    return rawAddress;
  }
  
  // If it's raw format (0: + 64 hex characters), we need to convert it
  if (rawAddress.startsWith('0:')) {
    try {
      // Remove the '0:' prefix and get the hex part
      const hexPart = rawAddress.substring(2);
      
      // Convert hex to bytes
      const bytes = new Uint8Array(hexPart.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
      
      // Add workchain byte (0) at the beginning
      const fullBytes = new Uint8Array([0, ...bytes]);
      
      // Convert to base64url format for user-friendly address
      const base64 = btoa(String.fromCharCode(...fullBytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      const userFriendlyAddress = 'UQ' + base64;
      console.log("[TON-CONVERT] Converted to user-friendly:", userFriendlyAddress);
      return userFriendlyAddress;
    } catch (error) {
      console.error("[TON-CONVERT] Error converting address:", error);
      // Return original if conversion fails
      return rawAddress;
    }
  }
  
  // Return original if format is not recognized
  console.log("[TON-CONVERT] Unknown format, returning original");
  return rawAddress;
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
