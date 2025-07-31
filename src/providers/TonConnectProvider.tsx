
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
          name: "TON Space",
          appName: "tonspace",
          imageUrl: "https://wallet.tg/images/logo.png", 
          aboutUrl: "https://wallet.tg/",
          universalLink: "https://t.me/wallet/start",
          bridgeUrl: "https://bridge.tonapi.io/bridge", 
          platforms: ["ios", "android", "chrome", "firefox"]
        }
      ]
    }}
  >
    {children}
  </TonConnectUIProvider>
);

export default TonConnectProvider;

