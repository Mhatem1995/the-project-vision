
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet } from "lucide-react";
import BoostPurchaseDialog from "@/components/BoostPurchaseDialog";
import BalanceCard from "@/components/mining/BalanceCard";
import MiningProgress from "@/components/mining/MiningProgress";
import FortuneWheel from "@/components/FortuneWheel";
import { useMining } from "@/hooks/useMining";
import { useToast } from "@/hooks/use-toast";
import { useTonConnect } from "@/providers/TonConnectProvider";
import { formatWalletAddress } from "@/utils/tonTransactionUtils";

const Mining = () => {
  const { toast } = useToast();
  const [boostDialogOpen, setBoostDialogOpen] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  
  // TON Connect integration using our hook
  const { isConnected, walletAddress, connect, isTelegramWebApp } = useTonConnect();
  
  const {
    balance,
    timeRemaining,
    progress,
    isLoading,
    activeBoost,
    handleCollect,
  } = useMining();

  useEffect(() => {
    console.log("Mining page: Checking if in Telegram:", isTelegramWebApp);
    
    // Debug information for troubleshooting
    if (window.Telegram?.WebApp?.platform) {
      console.log("Telegram platform:", window.Telegram.WebApp.platform);
    }
    
    // Additional debugging for boost button issue
    console.log("Mining page debug info:", {
      isTelegramWebApp,
      isConnected,
      walletAddress,
      userAgent: navigator.userAgent,
      storedTelegramFlag: localStorage.getItem("inTelegramWebApp")
    });
  }, [isTelegramWebApp, isConnected, walletAddress]);

  const handleConnectWallet = async () => {
    console.log("Connect wallet clicked, inTelegram:", isTelegramWebApp);
    
    setIsConnecting(true);

    try {
      connect();
      // Note: Success toast is handled in the TonConnectProvider after successful connection
    } catch (error) {
      console.error("Wallet connection error:", error);
      toast({
        title: "Connection Failed",
        description: "There was an error connecting to your wallet. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Function to check if user can mine (wallet must be connected)
  const canMine = !!walletAddress;

  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Knife Coin Mining</h1>
        <p className="text-muted-foreground">Mine Knife Coin tokens every 8 hours</p>
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

          {!isConnected ? (
            <Button 
              variant="default" 
              onClick={handleConnectWallet}
              disabled={isConnecting}
              className="w-full max-w-md"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : 'Connect TON Wallet'}
            </Button>
          ) : (
            <div className="w-full max-w-md bg-card p-4 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-1">Connected Wallet:</p>
              <p className="text-xs font-mono break-all">{formatWalletAddress(walletAddress || "")}</p>
            </div>
          )}
          
          <FortuneWheel />

          <Button 
            className="w-full max-w-md" 
            size="lg"
            disabled={(timeRemaining !== null && timeRemaining > 0) || !canMine}
            onClick={handleCollect}
          >
            {!canMine 
              ? 'Connect wallet to mine Knife Coin' 
              : (timeRemaining !== null && timeRemaining > 0) 
                ? 'Mining in progress...' 
                : 'Collect Knife Coin'}
          </Button>

          <BoostPurchaseDialog 
            open={boostDialogOpen} 
            onOpenChange={setBoostDialogOpen} 
          />
        </>
      )}
    </div>
  );
};

export default Mining;
