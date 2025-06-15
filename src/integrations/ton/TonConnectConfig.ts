
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

// Get ONLY real connected wallet address from TonConnect
export const getConnectedWalletAddress = (): string | null => {
  console.log("[TON-CONFIG] === GETTING REAL WALLET ADDRESS ===");
  
  // Check TonConnect UI
  if (window._tonConnectUI?.connected && window._tonConnectUI?.wallet?.account?.address) {
    const realAddress = window._tonConnectUI.wallet.account.address;
    console.log("[TON-CONFIG] 🎯 FOUND REAL ADDRESS FROM TONCONNECT:", realAddress);
    
    // Validate it's a proper TON address
    if (isValidTonAddress(realAddress)) {
      console.log("[TON-CONFIG] ✅ REAL ADDRESS VALIDATION PASSED");
      return realAddress;
    } else {
      console.log("[TON-CONFIG] ❌ REAL ADDRESS FAILED VALIDATION");
      return null;
    }
  }
  
  console.log("[TON-CONFIG] ❌ NO REAL WALLET CONNECTION FOUND");
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

// TON wallet address validation
export const isValidTonAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    console.log("[TON-VALIDATION] ❌ Invalid input - not a string or empty");
    return false;
  }
  
  const cleanAddress = address.trim();
  
  console.log("[TON-VALIDATION] Validating address:", cleanAddress);
  console.log("[TON-VALIDATION] Length:", cleanAddress.length);
  
  // Check for user-friendly format (UQ/EQ + base64)
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
