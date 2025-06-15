
import { useToast } from "@/hooks/use-toast";
import { TonConnectContext } from "@/contexts/TonConnectContext";
import { useTonConnectSetup } from "@/hooks/useTonConnectSetup";

export const TonConnectProvider = ({ children }: { children: React.ReactNode }) => {
  const { toast } = useToast();
  const tonConnectState = useTonConnectSetup(toast);

  return (
    <TonConnectContext.Provider value={tonConnectState}>
      {children}
    </TonConnectContext.Provider>
  );
};

export default TonConnectProvider;
