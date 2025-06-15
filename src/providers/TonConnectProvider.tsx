
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { createContext } from "react";

export const TonConnectContext = createContext(null);

// Remove the invalid walletsListConfiguration prop
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => (
  <TonConnectUIProvider
    manifestUrl="https://wiliamdrop.netlify.app/tonconnect-manifest.json"
  >
    {children}
  </TonConnectUIProvider>
);

export default TonConnectProvider;
