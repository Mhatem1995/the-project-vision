
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { getHttpEndpoint } from '@orbs-network/ton-access';

// App details for TON Connect
export const tonConnectOptions = {
  manifestUrl: 'https://raw.githubusercontent.com/ton-connect/demo-dapp-with-wallet/main/public/tonconnect-manifest.json',
  // We'll use a demo manifest for now - you should replace this with your own in production
};

// Custom style options for TON Connect UI
export const uiOptions = {
  language: 'en',
  uiPreferences: {
    theme: 'light',
  },
};

// Helper function for initializing TON API endpoints
export const getTonNetwork = async () => {
  // Choose mainnet for production
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

// TON wallet address used for payments
export const tonWalletAddress = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C";
