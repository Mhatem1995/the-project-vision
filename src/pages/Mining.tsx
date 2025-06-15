
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, LogOut } from "lucide-react";
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
  const { isConnected, walletAddress, connect, disconnect, isTelegramWebApp } = useTonConnect();
  
  const {
    balance,
    timeRemaining,
    progress,
    isLoading,
    activeBoost,
    handleCollect,
  } = useMining();

  useEffect(() => {
    console.log("Mining page: Real Telegram WebApp status:", isTelegramWebApp);
    console.log("Mining page: Real wallet connection status:", {
      isConnected,
      walletAddress,
      addressLength: walletAddress?.length,
      isValidFormat: walletAddress ? /^(UQ|EQ)[A-Za-z0-9_-]{46}$/.test(walletAddress) : false
    });
  }, [isTelegramWebApp, isConnected, walletAddress]);

  const handleConnectWallet = async () => {
    console.log("Connect real TON wallet clicked");
    
    setIsConnecting(true);

    try {
      connect();
      // Success toast is handled in the TonConnectProvider after successful connection
    } catch (error) {
      console.error("Real wallet connection error:", error);
      toast({
        title: "Connection Failed",
        description: "There was an error connecting to your real TON wallet. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Function to check if user can mine (real wallet must be connected)
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

            {/* Real wallet connection section */}
            <div className="w-full max-w-md space-y-4">
              {!isConnected ? (
                <Button 
                  variant="default" 
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="w-full"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  {isConnecting ? 'Connecting...' : 'Connect Real TON Wallet'}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <p className="text-sm font-medium text-green-800">Real TON Wallet Connected</p>
                    </div>
                    <p className="text-xs text-green-700 mb-1">Wallet Address:</p>
                    <p className="text-xs font-mono break-all text-green-800 bg-green-100 p-2 rounded">
                      {walletAddress}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Verified real TON address format
                    </p>
                  </div>
                  
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={disconnect}
                    className="w-full"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Disconnect Real Wallet
                  </Button>
                </div>
              )}
              
              <Button 
                className="w-full" 
                size="lg"
                disabled={(timeRemaining !== null && timeRemaining > 0) || !canMine}
                onClick={handleCollect}
              >
                {!canMine 
                  ? 'Connect real TON wallet to mine' 
                  : (timeRemaining !== null && timeRemaining > 0) 
                    ? 'Mining in progress...' 
                    : 'Collect Knife Coin'}
              </Button>
            </div>
            
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
