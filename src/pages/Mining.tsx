
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import BoostPurchaseDialog from "@/components/BoostPurchaseDialog";
import BalanceCard from "@/components/mining/BalanceCard";
import MiningProgress from "@/components/mining/MiningProgress";
import FortuneWheel from "@/components/FortuneWheel";
import { WalletDebugComponent } from "@/components/WalletDebugComponent";
import { useMining } from "@/hooks/useMining";
import { useToast } from "@/hooks/use-toast";
import { useTonConnect } from "@/hooks/useTonConnect";

// Helper: guess address type for troubleshooting
function getWalletAddressType(addr: string | null | undefined): string {
  if (!addr) return "none";
  if (addr.match(/^0:[a-fA-F0-9]{64}$/)) return "raw-0:";
  if (addr.match(/^UQ[A-Za-z0-9_\-]{40,}$/)) return "UQ (user-friendly)";
  if (addr.match(/^EQ[A-Za-z0-9_\-]{40,}$/)) return "EQ (user-friendly)";
  if (addr.match(/^[a-fA-F0-9]{64}$/)) return "raw hex";
  return "unknown";
}

const Mining = () => {
  const { toast } = useToast();
  const [boostDialogOpen, setBoostDialogOpen] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Use wallet session only, per official TON Connect guidelines
  const { isConnected, walletAddress, connect, disconnect, wallet, tonConnectUI } = useTonConnect();

  const {
    balance,
    timeRemaining,
    progress,
    isLoading,
    activeBoost,
    handleCollect,
  } = useMining();

  // Debugging info extraction
  const tonWalletRawAddr = wallet?.account?.address ?? null;
  const tonWalletProvider = wallet?.device?.platform ?? "unknown";
  const tonWalletAppName = wallet?.device?.appName ?? "unknown";

  useEffect(() => {
    console.log("Mining page: Wallet connection debug info:", {
      isConnected,
      walletAddress,
      addressLength: walletAddress?.length,
      isValidFormat: walletAddress
        ? /^(UQ|EQ|kq|0:|-)/i.test(walletAddress)
        : false,
      tonWallet: wallet,
      tonWalletProvider,
      tonWalletAppName,
      tonWalletRawAddr,
      rawAddressType: getWalletAddressType(tonWalletRawAddr),
      formattedAddress: walletAddress,
      formattedAddressType: getWalletAddressType(walletAddress)
    });
  }, [
    isConnected, walletAddress, wallet, 
    tonWalletProvider, tonWalletAppName, tonWalletRawAddr
  ]);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      connect();
    } catch (error) {
      console.error("Wallet connection error:", error);
      toast({
        title: "Connection Failed",
        description: "There was an error connecting your TON wallet. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // User can mine only if wallet is connected *and* has valid address in session (per docs)
  const canMine = !!walletAddress && isConnected;

  return (
    <div className="min-h-screen pb-24">
      <div className="flex flex-col items-center justify-start space-y-6 px-4 py-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Knife Coin Mining</h1>
          <p className="text-muted-foreground">Mine Knife Coin tokens every 8 hours with your real TON wallet</p>
        </div>

        {isLoading ? (
          <div className="w-full space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            <BalanceCard
              balance={balance}
              activeBoost={activeBoost}
              onBoostClick={() => setBoostDialogOpen(true)}
            />

            <MiningProgress
              progress={progress}
              timeRemaining={timeRemaining}
            />

            {/* Enhanced wallet connection with debug component */}
            <WalletDebugComponent />

            <Button 
              className="w-full" 
              size="lg"
              disabled={(timeRemaining !== null && timeRemaining > 0) || !canMine}
              onClick={handleCollect}
            >
              {!canMine 
                ? 'Connect TON wallet to mine' 
                : (timeRemaining !== null && timeRemaining > 0) 
                  ? 'Mining in progress...' 
                  : 'Collect Knife Coin'}
            </Button>

            {/* Fortune Wheel with proper spacing */}
            <div className="w-full max-w-md mx-auto mt-8">
              <FortuneWheel />
            </div>

            <BoostPurchaseDialog 
              open={boostDialogOpen} 
              onOpenChange={setBoostDialogOpen} 
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Mining;
