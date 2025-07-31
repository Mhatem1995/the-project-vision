
import { TonConnectUIProvider, THEME } from "@tonconnect/ui-react";
import { createContext } from "react";

export const TonConnectContext = createContext(null);

// Configure TonConnect specifically for Telegram TON Space wallet
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  console.log("🚀 [TON PROVIDER] Initializing TonConnect for Telegram TON Space");
  
  return (
    <TonConnectUIProvider
      manifestUrl="https://wiliamdrop.netlify.app/tonconnect-manifest.json"
      walletsListConfiguration={{
        includeWallets: [
          {
            name: "TON Space",
            appName: "telegram-wallet",
            imageUrl: "https://wallet.tg/images/logo-288.png",
            aboutUrl: "https://wallet.tg/",
            universalLink: "https://t.me/wallet/start",
            bridgeUrl: "https://bridge.tonapi.io/bridge",
            platforms: ["ios", "android", "macos", "windows", "linux"]
          }
        ]
      }}
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/WilliamKnifeManBot'
      }}
      uiPreferences={{
        theme: THEME.DARK
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;

