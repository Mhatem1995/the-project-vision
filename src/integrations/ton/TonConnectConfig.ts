
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

// Get ONLY real connected wallet address from TonConnect - NO FAKE ADDRESSES
export const getConnectedWalletAddress = (): string | null => {
  console.log("[TON-CONFIG] 🔍 === GETTING REAL WALLET ADDRESS ===");
  
  // STRICT CHECK: TonConnect UI must exist
  if (!window._tonConnectUI) {
    console.log("[TON-CONFIG] ❌ NO TONCONNECT UI FOUND");
    return null;
  }

  // STRICT CHECK: Must be connected
  if (!window._tonConnectUI.connected) {
    console.log("[TON-CONFIG] ❌ TONCONNECT NOT CONNECTED");
    return null;
  }

  // STRICT CHECK: Must have wallet
  if (!window._tonConnectUI.wallet) {
    console.log("[TON-CONFIG] ❌ NO WALLET OBJECT");
    return null;
  }

  // STRICT CHECK: Must have account
  if (!window._tonConnectUI.wallet.account) {
    console.log("[TON-CONFIG] ❌ NO ACCOUNT OBJECT");
    return null;
  }

  // STRICT CHECK: Must have address
  if (!window._tonConnectUI.wallet.account.address) {
    console.log("[TON-CONFIG] ❌ NO ADDRESS IN ACCOUNT");
    return null;
  }

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

// TON wallet address validation - STRICT validation
export const isValidTonAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    console.log("[TON-VALIDATION] ❌ Invalid input - not a string or empty");
    return false;
  }
  
  const cleanAddress = address.trim();
  
  console.log("[TON-VALIDATION] 🔍 Validating address:", cleanAddress);
  console.log("[TON-VALIDATION] 🔍 Length:", cleanAddress.length);
  
  // STRICT CHECK: No fake addresses allowed
  if (cleanAddress.includes('bulgbugbvjlhbvjhlbvljhbv')) {
    console.log("[TON-VALIDATION] ❌ DETECTED FAKE ADDRESS - REJECTING");
    return false;
  }
  
  // Check for user-friendly format (UQ/EQ + base64)
  const userFriendlyPattern = /^(UQ|EQ)[A-Za-z0-9_-]{44,48}$/;
  
  // Check for raw format (0: + 64 hex characters)
  const rawPattern = /^0:[a-fA-F0-9]{64}$/;
  
  const isUserFriendly = userFriendlyPattern.test(cleanAddress);
  const isRaw = rawPattern.test(cleanAddress);
  
  console.log("[TON-VALIDATION] 🔍 User-friendly pattern match:", isUserFriendly);
  console.log("[TON-VALIDATION] 🔍 Raw pattern match:", isRaw);
  
  const isValid = isUserFriendly || isRaw;
  console.log("[TON-VALIDATION] 🔍 Final validation result:", isValid);
  
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
