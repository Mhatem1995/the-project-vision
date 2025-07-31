
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { createContext } from "react";

export const TonConnectContext = createContext(null);

// Configure TonConnect to include TON Space and Tonkeeper
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => (
  <TonConnectUIProvider
    manifestUrl="https://wiliamdrop.netlify.app/tonconnect-manifest.json"
    walletsListConfiguration={{
      includeWallets: [
        {
          name: "Tonkeeper",
          appName: "tonkeeper", 
          imageUrl: "https://tonkeeper.com/assets/tonconnect-icon.png",
          aboutUrl: "https://tonkeeper.com/",
          universalLink: "https://app.tonkeeper.com/ton-connect",
          bridgeUrl: "https://bridge.tonapi.io/bridge",
          platforms: ["ios", "android", "chrome", "firefox"]
        },
        {
          name: "Telegram Wallet",
          appName: "telegram-wallet",
          imageUrl: "https://wallet.tg/images/logo-288.png", 
          aboutUrl: "https://wallet.tg/",
          universalLink: "https://t.me/wallet?attach=wallet",
          bridgeUrl: "https://walletbot.me/tonconnect-bridge/bridge", 
          platforms: ["ios", "android", "macos", "windows", "linux"]
        }
      ]
    }}
  >
    {children}
  </TonConnectUIProvider>
);

export default TonConnectProvider;

