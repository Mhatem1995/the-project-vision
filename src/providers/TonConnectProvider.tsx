import { TonConnectUIProvider } from "@tonconnect/ui-react";

// Simplified TonConnect configuration that works in Telegram
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'https://a3e79467-7b1e-410a-a3a4-f6b5b48946c1.lovableproject.com';
  const manifestUrl = `${currentDomain}/tonconnect-manifest.json`;
  
  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      restoreConnection={true}
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/WilliamKnifeManBot'
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;