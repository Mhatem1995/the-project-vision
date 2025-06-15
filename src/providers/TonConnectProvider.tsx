
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { createContext } from "react";

// Official Telegram Wallet App ID/provider id for TON Connect
const TELEGRAM_WALLET_ID = "telegram-wallet";

export const TonConnectContext = createContext(null);

// Just use manifestUrl, do not pass unsupported walletsList
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => (
  <TonConnectUIProvider
    manifestUrl="https://wiliamdrop.netlify.app/tonconnect-manifest.json"
  >
    {children}
  </TonConnectUIProvider>
);

export default TonConnectProvider;

