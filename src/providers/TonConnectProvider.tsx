import { TonConnectUIProvider } from "@tonconnect/ui-react";

// Simple TonConnect configuration for Telegram environment
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  // Get current domain for manifest
  const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'https://a3e79467-7b1e-410a-a3a4-f6b5b48946c1.lovableproject.com';
  const manifestUrl = `${currentDomain}/tonconnect-manifest.json`;
  
  console.log('[TONCONNECT] Using manifest URL:', manifestUrl);
  
  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/WilliamKnifeManBot'
      }}
      uiPreferences={{
        theme: 'DARK' as any
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;