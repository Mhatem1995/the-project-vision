
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const Mining = () => {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number>(0);
  const [miningRate, setMiningRate] = useState<number>(10); // KFC per 8 hours
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const miningDuration = 8 * 60 * 60; // 8 hours in seconds

  useEffect(() => {
    // Simulate loading user data
    const timer = setTimeout(() => {
      const lastMiningTime = localStorage.getItem("lastMiningTime");
      const savedBalance = localStorage.getItem("kfcBalance");
      
      if (savedBalance) {
        setBalance(parseFloat(savedBalance));
      }

      if (lastMiningTime) {
        const elapsed = Math.floor((Date.now() - parseInt(lastMiningTime)) / 1000);
        if (elapsed < miningDuration) {
          setTimeRemaining(miningDuration - elapsed);
          setProgress(Math.min((elapsed / miningDuration) * 100, 100));
        } else {
          setTimeRemaining(0);
          setProgress(100);
        }
      } else {
        // First time mining
        localStorage.setItem("lastMiningTime", Date.now().toString());
        setTimeRemaining(miningDuration);
        setProgress(0);
      }
      
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let interval: number | null = null;
    
    if (timeRemaining !== null && timeRemaining > 0) {
      interval = window.setInterval(() => {
        setTimeRemaining(prev => {
          if (prev && prev > 0) {
            const newTime = prev - 1;
            const newProgress = 100 - (newTime / miningDuration * 100);
            setProgress(newProgress);
            return newTime;
          }
          return 0;
        });
      }, 1000);
    }

    return () => {
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [timeRemaining]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCollect = () => {
    // Update balance
    const newBalance = balance + miningRate;
    setBalance(newBalance);
    localStorage.setItem("kfcBalance", newBalance.toString());
    
    // Reset mining timer
    localStorage.setItem("lastMiningTime", Date.now().toString());
    setTimeRemaining(miningDuration);
    setProgress(0);
    
    // Show success toast
    toast({
      title: "KFC Collected!",
      description: `You earned ${miningRate} KFC coins!`,
    });
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
          <div className="bg-card p-6 rounded-lg w-full max-w-md text-center shadow-md">
            <h2 className="text-xl font-semibold mb-2">Your Balance</h2>
            <p className="text-4xl font-bold">{balance.toFixed(2)} KFC</p>
          </div>
          
          <div className="w-full max-w-md">
            <div className="flex justify-between mb-2">
              <span>Mining Progress</span>
              {timeRemaining !== null && timeRemaining > 0 ? (
                <span>{formatTime(timeRemaining)}</span>
              ) : (
                <span className="text-primary font-bold">Ready to collect!</span>
              )}
            </div>
            <Progress value={progress} className="h-3" />
          </div>
          
          <Button 
            className="w-full max-w-md" 
            size="lg"
            disabled={timeRemaining !== null && timeRemaining > 0}
            onClick={handleCollect}
          >
            {timeRemaining !== null && timeRemaining > 0 ? 'Mining in progress...' : 'Collect KFC'}
          </Button>
        </>
      )}
    </div>
  );
};

export default Mining;
