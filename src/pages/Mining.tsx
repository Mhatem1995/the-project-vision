
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
import { useTonConnect } from '@tonconnect/ui-react';

const Mining = () => {
  const { toast } = useToast();
  const [boostDialogOpen, setBoostDialogOpen] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  
  // TON Connect integration
  const { connector, connected, account } = useTonConnect();
  
  const {
    balance,
    timeRemaining,
    progress,
    isLoading,
    activeBoost,
    handleCollect,
  } = useMining();

  // Enhanced Telegram WebApp detection
  const isInTelegram = typeof window !== 'undefined' && 
                      Boolean(window.Telegram?.WebApp?.initData && 
                              window.Telegram?.WebApp?.initData.length > 0);

  useEffect(() => {
    console.log("Mining page: Checking if in Telegram:", isInTelegram);
    
    // Check for already saved wallet address
    const savedAddress = localStorage.getItem("tonWalletAddress");
    if (savedAddress) {
      console.log("Found saved wallet address:", savedAddress);
      setWalletAddress(savedAddress);
    }
    
    // Debug information for troubleshooting
    if (window.Telegram?.WebApp?.platform) {
      console.log("Telegram platform:", window.Telegram.WebApp.platform);
    }
    
    if (window.Telegram?.WebApp) {
      console.log("Telegram WebApp available:", Boolean(window.Telegram.WebApp));
      console.log("Init data available:", Boolean(window.Telegram.WebApp.initData));
      console.log("Init data length:", window.Telegram.WebApp.initData?.length || 0);
    }
  }, [isInTelegram]);

  // Handle TON wallet connection status changes
  useEffect(() => {
    if (connected && account) {
      const address = account.address.toString();
      console.log("TON Connect wallet connected:", address);
      
      setWalletAddress(address);
      localStorage.setItem("tonWalletAddress", address);
      
      // Update wallet address in database
      const userId = localStorage.getItem("telegramUserId");
      if (userId) {
        updateUserWalletInDatabase(userId, address);
      }
    }
  }, [connected, account]);

  const handleConnectWallet = async () => {
    console.log("Connect wallet clicked, inTelegram:", isInTelegram);
    
    setIsConnecting(true);

    try {
      // Open TON Connect modal
      if (connector) {
        console.log("Opening TON Connect modal");
        await connector.openModal();
      } else {
        console.error("TON Connect connector not available");
        toast({
          title: "Error",
          description: "Wallet connection not available, please try again",
          variant: "destructive"
        });
      }
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

  const updateUserWalletInDatabase = async (userId: string, address: string) => {
    console.log("Updating wallet address in database for user:", userId);
    console.log("Wallet address:", address);
    
    try {
      // Update user in database with wallet address (store in links field)
      const { error } = await supabase
        .from("users")
        .update({ links: address })
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
    } catch (err) {
      console.error("Failed to update wallet in database:", err);
      toast({
        title: "Update Failed",
        description: "Could not save wallet address to your profile",
        variant: "destructive"
      });
    }
  };

  // Function to check if user can mine (wallet must be connected)
  const canMine = !!walletAddress;

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
            disabled={(timeRemaining !== null && timeRemaining > 0) || !canMine}
            onClick={handleCollect}
          >
            {!canMine 
              ? 'Connect wallet to mine KFC' 
              : (timeRemaining !== null && timeRemaining > 0) 
                ? 'Mining in progress...' 
                : 'Collect KFC'}
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
