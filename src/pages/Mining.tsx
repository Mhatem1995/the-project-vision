
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

  // Check if inside Telegram WebApp
  const isInTelegram = typeof window !== 'undefined' && 
                      window.Telegram && 
                      window.Telegram.WebApp;

  useEffect(() => {
    // Check if we already have a saved wallet address
    const savedAddress = localStorage.getItem("tonWalletAddress");
    if (savedAddress) {
      setWalletAddress(savedAddress);
    }
  }, []);

  const handleConnectWallet = async () => {
    setIsConnecting(true);

    if (!isInTelegram) {
      toast({
        title: "Error",
        description: "Please open this app in Telegram",
        variant: "destructive",
      });
      setIsConnecting(false);
      return;
    }

    try {
      // For TON Connect 2.0 inside Telegram Mini Apps
      const walletUrl = "ton://transfer/";
      
      // Open TON wallet app
      window.Telegram.WebApp.openLink(walletUrl);
      
      // Since we can't get a direct response when opening an external app,
      // we'll ask the user to input their wallet address manually after connecting
      setTimeout(() => {
        // This timeout gives users time to go to wallet and come back
        toast({
          title: "Wallet Requested",
          description: "Please check if your wallet opened. If not, please try again.",
        });
        
        // For demo purposes, let's save a placeholder or use saved address
        const userId = localStorage.getItem("telegramUserId");
        
        if (userId) {
          // In a real app, this would verify wallet ownership with signatures
          // For now, we'll just simulate wallet connection by saving to database
          updateUserWalletInDatabase(userId);
        }
        
        setIsConnecting(false);
      }, 2000);
    } catch (error) {
      console.error("Wallet connection error:", error);
      toast({
        title: "Connection Failed",
        description: "There was an error connecting to your wallet. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const updateUserWalletInDatabase = async (userId: string) => {
    // For demo, generate a simulated wallet address
    // In real app, this would come from TON Connect
    const simulatedAddress = `EQ${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
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
        variant: "destructive",
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
              disabled={isConnecting}
              className="w-full max-w-md"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : 'Connect Telegram Wallet'}
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
