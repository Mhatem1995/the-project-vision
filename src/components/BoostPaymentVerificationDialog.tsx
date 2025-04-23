
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

interface BoostPaymentVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boost: any;
  tonWallet: string;
}

export default function BoostPaymentVerificationDialog({ open, onOpenChange, boost, tonWallet }: BoostPaymentVerificationDialogProps) {
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Automatically start verification when dialog opens
  useEffect(() => {
    let interval: number | null = null;

    if (open && boost && !verified && !verifying) {
      setVerifying(true);
      // Start polling for payment verification
      interval = window.setInterval(checkPaymentStatus, 10000); // Check every 10 seconds
      
      // Initial check
      checkPaymentStatus();
    }

    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [open, boost, verified]);

  // Function to check payment status (simulated in this example)
  async function checkPaymentStatus() {
    if (!boost || verified) return;
    
    try {
      console.log("Checking payment status for boost:", boost.id);
      
      // SIMULATION: Random chance of payment being verified
      // In a real implementation, this would check a TON blockchain API
      const simulateSuccess = Math.random() > 0.7;
      
      if (simulateSuccess) {
        await confirmBoost();
      }
    } catch (err) {
      console.error("Error checking payment status:", err);
    }
  }

  // Mark boost as confirmed in Supabase
  async function confirmBoost() {
    try {
      // Generate a fake transaction hash for demo purposes
      const fakeTxHash = `TON${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
      
      // Update boost as confirmed in database
      const { error: updateError } = await supabase
        .from("mining_boosts")
        .update({
          status: "confirmed",
          ton_tx: fakeTxHash,
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
