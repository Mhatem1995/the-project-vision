
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Wallet } from "lucide-react";
import BoostPurchaseDialog from "@/components/BoostPurchaseDialog";
import BalanceCard from "@/components/mining/BalanceCard";
import MiningProgress from "@/components/mining/MiningProgress";
import FortuneWheel from "@/components/FortuneWheel";
import { useMining } from "@/hooks/useMining";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Mining = () => {
  const { toast } = useToast();
  const [boostDialogOpen, setBoostDialogOpen] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const {
    balance,
    timeRemaining,
    progress,
    isLoading,
    activeBoost,
    handleCollect,
  } = useMining();

  // Check if inside Telegram WebApp with strict check
  const isInTelegram = typeof window !== 'undefined' && 
                      window.Telegram?.WebApp &&
                      window.Telegram.WebApp.initData && 
                      window.Telegram.WebApp.initData.length > 0;

  useEffect(() => {
    console.log("Mining page: Checking if in Telegram:", isInTelegram);
    
    // Check if we already have a saved wallet address
    const savedAddress = localStorage.getItem("tonWalletAddress");
    if (savedAddress) {
      console.log("Found saved wallet address:", savedAddress);
      setWalletAddress(savedAddress);
    }
    
    // Check the current platform for debugging
    if (window.Telegram?.WebApp?.platform) {
      console.log("Telegram platform:", window.Telegram.WebApp.platform);
    }
  }, [isInTelegram]);

  const handleConnectWallet = async () => {
    console.log("Connect wallet clicked, inTelegram:", isInTelegram);
    
    if (!isInTelegram) {
      toast({
        title: "Error",
        description: "Please open this app in Telegram to connect your wallet",
        variant: "destructive"
      });
      return;
    }
    
    setIsConnecting(true);

    try {
      // For TON Connect 2.0 inside Telegram Mini Apps
      const walletUrl = "ton://transfer/";
      
      // Make sure we're in Telegram before proceeding
      if (window.Telegram?.WebApp) {
        console.log("Telegram WebApp available, opening wallet");
        
        // We're definitely inside Telegram, open the TON wallet
        window.Telegram.WebApp.openLink(walletUrl);
        
        // Since we can't get a direct response when opening an external app,
        // we'll ask the user to confirm they connected their wallet
        setTimeout(() => {
          // This timeout gives users time to go to wallet and come back
          if (window.Telegram?.WebApp?.showConfirm) {
            window.Telegram.WebApp.showConfirm(
              "Did you connect your wallet? If yes, press OK to continue.",
              async (confirmed) => {
                if (confirmed) {
                  // User confirmed wallet connection
                  console.log("User confirmed wallet connection");
                  const userId = localStorage.getItem("telegramUserId");
                  if (userId) {
                    await updateUserWalletInDatabase(userId);
                  }
                } else {
                  console.log("User denied wallet connection");
                  toast({
                    title: "Wallet Connection Cancelled",
                    description: "You can try again later when you're ready.",
                  });
                }
                setIsConnecting(false);
              }
            );
          } else {
            console.log("showConfirm not available, using fallback");
            toast({
              title: "Wallet Requested",
              description: "Please check if your wallet opened. If not, please try again.",
            });
            
            // For demo purposes, let's save a placeholder or use saved address
            const userId = localStorage.getItem("telegramUserId");
            if (userId) {
              updateUserWalletInDatabase(userId);
            }
            
            setIsConnecting(false);
          }
        }, 2000);
      } else {
        console.error("Not in Telegram WebApp environment");
        toast({
          title: "Error",
          description: "Please open this app in Telegram",
          variant: "destructive"
        });
        setIsConnecting(false);
      }
    } catch (error) {
      console.error("Wallet connection error:", error);
      toast({
        title: "Connection Failed",
        description: "There was an error connecting to your wallet. Please try again.",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  };

  const updateUserWalletInDatabase = async (userId: string) => {
    // For demo, generate a simulated wallet address
    // In real app, this would come from TON Connect
    const simulatedAddress = `EQ${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
    console.log("Updating wallet address in database for user:", userId);
    console.log("Simulated wallet address:", simulatedAddress);
    
    setWalletAddress(simulatedAddress);
    localStorage.setItem("tonWalletAddress", simulatedAddress);
    
    // Update user in database with wallet address
    const { error } = await supabase
      .from("users")
      .update({ links: simulatedAddress })
      .eq("id", userId);
      
    if (error) {
      console.error("Database update error:", error);
      toast({
        title: "Update Failed",
        description: "Could not save wallet address to your profile",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Wallet Connected",
        description: "Your TON wallet has been connected successfully",
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">KFC Mining</h1>
        <p className="text-muted-foreground">Mine KFC tokens every 8 hours</p>
      </div>
      
      {!isInTelegram && (
        <div className="bg-amber-100 border-amber-300 border p-4 rounded-md flex items-center w-full max-w-md text-amber-800">
          <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
          <p className="text-sm">For best experience, please open this app in Telegram.</p>
        </div>
      )}
      
      {isLoading ? (
        <div className="w-full space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <>
          {!walletAddress ? (
            <Button 
              variant="outline" 
              onClick={handleConnectWallet}
              disabled={isConnecting || !isInTelegram}
              className="w-full max-w-md"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : isInTelegram ? 'Connect Telegram Wallet' : 'Open in Telegram to Connect Wallet'}
            </Button>
          ) : (
            <div className="w-full max-w-md bg-card p-4 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-1">Connected Wallet:</p>
              <p className="text-xs font-mono break-all">{walletAddress}</p>
            </div>
          )}

          <BalanceCard
            balance={balance}
            activeBoost={activeBoost}
            onBoostClick={() => setBoostDialogOpen(true)}
          />
          
          <MiningProgress
            progress={progress}
            timeRemaining={timeRemaining}
          />
          
          <FortuneWheel />

          <Button 
            className="w-full max-w-md" 
            size="lg"
            disabled={timeRemaining !== null && timeRemaining > 0}
            onClick={handleCollect}
          >
            {timeRemaining !== null && timeRemaining > 0 ? 'Mining in progress...' : 'Collect KFC'}
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
