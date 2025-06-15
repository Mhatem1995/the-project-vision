
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { createContext, useContext } from "react";

export const TonConnectContext = createContext(null);

export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => (
  <TonConnectUIProvider 
    manifestUrl="https://wiliamdrop.netlify.app/tonconnect-manifest.json"
    walletsListConfiguration={{
      includeWallets: [
        { 
          appName: "telegram",
          name: "Telegram Wallet",
          bridgeUrl: "https://bridge.tonapi.io/bridge"
        }
      ]
    }}
  >
    {children}
  </TonConnectUIProvider>
);

export default TonConnectProvider;
