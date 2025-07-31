
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { createContext } from "react";

export const TonConnectContext = createContext(null);

// Configure TonConnect to ONLY include Telegram Wallet
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => (
  <TonConnectUIProvider
    manifestUrl="https://wiliamdrop.netlify.app/tonconnect-manifest.json"
    walletsListConfiguration={{
      includeWallets: [
        {
          name: "Telegram Wallet",
          appName: "telegram-wallet",
          imageUrl: "https://wallet.tg/images/logo-288.png", 
          aboutUrl: "https://wallet.tg/",
          universalLink: "https://t.me/wallet?attach=wallet",
          bridgeUrl: "https://bridge.tonapi.io/bridge",
          platforms: ["ios", "android", "macos", "windows", "linux"]
        }
      ]
    }}
    actionsConfiguration={{
      twaReturnUrl: 'https://t.me/WilliamKnifeManBot'
    }}
  >
    {children}
  </TonConnectUIProvider>
);

export default TonConnectProvider;

