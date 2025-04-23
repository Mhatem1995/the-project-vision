
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import BoostPurchaseDialog from "@/components/BoostPurchaseDialog";
import BalanceCard from "@/components/mining/BalanceCard";
import MiningProgress from "@/components/mining/MiningProgress";
import { useMining } from "@/hooks/useMining";

const Mining = () => {
  const [boostDialogOpen, setBoostDialogOpen] = useState<boolean>(false);
  const {
    balance,
    timeRemaining,
    progress,
    isLoading,
    activeBoost,
    handleCollect,
  } = useMining();

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
