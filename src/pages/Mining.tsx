import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Send } from "lucide-react"; // Correct import for Telegram-like icon
import BoostPurchaseDialog from "@/components/BoostPurchaseDialog";
import BalanceCard from "@/components/mining/BalanceCard";
import MiningProgress from "@/components/mining/MiningProgress";
import { useMining } from "@/hooks/useMining";
import { useToast } from "@/hooks/use-toast";

const Mining = () => {
  const { toast } = useToast();
  const [boostDialogOpen, setBoostDialogOpen] = useState<boolean>(false);
  const {
    balance,
    timeRemaining,
    progress,
    isLoading,
    activeBoost,
    handleCollect,
  } = useMining();

  const handleConnectWallet = () => {
    if (!window.Telegram?.WebApp) {
      toast({
        title: "Error",
        description: "Please open this app in Telegram",
        variant: "destructive",
      });
      return;
    }

    // Telegram Wallet deep link
    const walletUrl = "ton://connect/";
    window.Telegram.WebApp.openLink(walletUrl);
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
          <Button 
            variant="outline" 
            onClick={handleConnectWallet}
            className="w-full max-w-md"
          >
            <Send className="mr-2 h-4 w-4" /> {/* Changed from Telegram to Send */}
            Connect Telegram Wallet
          </Button>

          <BalanceCard
            balance={balance}
            activeBoost={activeBoost}
            onBoostClick={() => setBoostDialogOpen(true)}
          />
          
          <MiningProgress
            progress={progress}
            timeRemaining={timeRemaining}
          />
          
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
