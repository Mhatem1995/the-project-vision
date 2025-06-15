
// Only allow Telegram Wallet via walletsList
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { createContext } from "react";

// Official Telegram Wallet App ID/provider id for TON Connect
const TELEGRAM_WALLET_ID = "telegram-wallet"; // make sure this is correct for your manifest

export const TonConnectContext = createContext(null);

// Enforce Telegram Wallet-only connection
export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => (
  <TonConnectUIProvider
    manifestUrl="https://wiliamdrop.netlify.app/tonconnect-manifest.json"
    walletsList={{
      includeWalletIds: [TELEGRAM_WALLET_ID],
      // Not including featured or excluded
    }}
  >
    {children}
  </TonConnectUIProvider>
);

export default TonConnectProvider;
