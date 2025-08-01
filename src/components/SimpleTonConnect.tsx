import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export const SimpleTonConnect = () => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const { toast } = useToast();

  const handleConnect = async () => {
    console.log("🔌 [SIMPLE] Starting connection...");
    console.log("🔌 [SIMPLE] TonConnect UI available:", !!tonConnectUI);
    console.log("🔌 [SIMPLE] Current wallet:", wallet);
    
    if (!tonConnectUI) {
      console.error("❌ [SIMPLE] TonConnect UI not available");
      toast({
        title: "Connection Error",
        description: "TonConnect UI not initialized. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("🔌 [SIMPLE] Opening wallet connection modal...");
      await tonConnectUI.openModal();
      console.log("✅ [SIMPLE] Modal opened");
    } catch (error) {
      console.error("❌ [SIMPLE] Connection failed:", error);
      toast({
        title: "Connection Failed",
        description: "Failed to open wallet connection. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDisconnect = async () => {
    console.log("🔌 [SIMPLE] Disconnecting wallet...");
    try {
      await tonConnectUI?.disconnect();
      console.log("✅ [SIMPLE] Disconnected");
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected.",
      });
    } catch (error) {
      console.error("❌ [SIMPLE] Disconnect failed:", error);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="font-semibold">Simple TON Connect Test</h3>
      
      <div className="space-y-2 text-sm">
        <p><strong>TonConnect UI:</strong> {!!tonConnectUI ? "✅ Available" : "❌ Not available"}</p>
        <p><strong>Wallet Connected:</strong> {!!wallet ? "✅ Connected" : "❌ Not connected"}</p>
        {wallet && (
          <div className="text-xs bg-gray-100 p-2 rounded">
            <p><strong>Wallet Info:</strong></p>
            <pre>{JSON.stringify(wallet, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!wallet ? (
          <Button onClick={handleConnect} variant="default">
            Connect Wallet
          </Button>
        ) : (
          <Button onClick={handleDisconnect} variant="outline">
            Disconnect Wallet
          </Button>
        )}
      </div>
    </div>
  );
};