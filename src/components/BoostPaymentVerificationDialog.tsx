
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BoostPaymentVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boost: any;
  tonWallet: string;
}

export default function BoostPaymentVerificationDialog({ 
  open, 
  onOpenChange, 
  boost, 
  tonWallet 
}: BoostPaymentVerificationDialogProps) {
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let interval: number | null = null;

    if (open && boost && !verified && !verifying) {
      setVerifying(true);
      interval = window.setInterval(checkPaymentStatus, 10000); // Check every 10 seconds
      checkPaymentStatus(); // Initial check
    }

    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [open, boost, verified]);

  async function checkPaymentStatus() {
    if (!boost || verified) return;
    
    try {
      console.log("Checking payment status for boost:", boost.id);
      
      // Use the TON API key from the environment (previously added via secret form)
      // The key is deployed with the application
      const tonApiKey = process.env.TON_API_KEY || '';
      
      // Fetch recent transactions from TON API
      const response = await fetch(`https://tonapi.io/v2/accounts/${tonWallet}/transactions?limit=20`, {
        headers: {
          'Authorization': `Bearer ${tonApiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch TON transactions');
      }
      
      const data = await response.json();
      const transactions = data.transactions || [];
      
      // Look for a matching transaction with the correct amount
      const matchingTx = transactions.find(tx => 
        tx.value === boost.price && 
        // Check if transaction is recent (within last 30 minutes)
        (Date.now() - new Date(tx.utime * 1000).getTime()) < 30 * 60 * 1000
      );
      
      if (matchingTx) {
        await confirmBoost(matchingTx.hash);
      }
    } catch (err) {
      console.error("Error checking payment status:", err);
      setError("Error verifying payment. Please try again later.");
      setVerifying(false);
    }
  }

  async function confirmBoost(txHash: string) {
    try {
      // Update boost as confirmed in database
      const { error: updateError } = await supabase
        .from("mining_boosts")
        .update({
          status: "confirmed",
          ton_tx: txHash,
          expires_at: new Date(Date.now() + boost.duration * 3600 * 1000).toISOString(),
        })
        .eq("id", boost.id);

      if (updateError) {
        console.error("Database update error:", updateError);
        setError("Failed to update boost status");
        setVerifying(false);
        return;
      }

      setVerified(true);
      setVerifying(false);
      
      toast({
        title: "Boost activated!",
        description: `Your ${boost.multiplier}x boost is now active`,
      });
      
      // Close dialog after successful verification
      setTimeout(() => onOpenChange(false), 2000);
    } catch (err) {
      console.error("Error confirming boost:", err);
      setError("Verification failed. Please try again.");
      setVerifying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Processing</DialogTitle>
          <DialogDescription>
            To activate your {boost?.multiplier}x boost, send <b>{boost?.price} TON</b> to <span className="font-mono break-all">{tonWallet}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-md">
            <p className="text-sm text-center">We're automatically checking for your payment</p>
            {verifying && !verified && (
              <div className="flex justify-center mt-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {error && <div className="text-destructive text-xs mt-2 text-center">{error}</div>}
            {verified && <div className="text-green-600 font-medium text-center mt-2">✅ Payment Verified! Boost activated.</div>}
          </div>
          
          <div className="text-xs text-muted-foreground text-center">
            Payments are typically confirmed within a few minutes.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
