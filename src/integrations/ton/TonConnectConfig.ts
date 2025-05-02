import { getHttpEndpoint } from '@orbs-network/ton-access';

// App details for TON Connect - updated with proper manifest
export const tonConnectOptions = {
  manifestUrl: 'https://raw.githubusercontent.com/ton-connect/demo-dapp/main/public/tonconnect-manifest.json',
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
