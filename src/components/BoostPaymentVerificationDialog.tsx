
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { pollForTransactionVerification } from "@/utils/tonTransactionUtils";

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
    if (open && boost && !verified && !verifying) {
      setVerifying(true);
      
      // Get user ID from localStorage
      const userId = localStorage.getItem("telegramUserId");
      if (!userId) {
        setError("User ID not found. Please refresh the page.");
        setVerifying(false);
        return;
      }
      
      // Start transaction verification using the same logic as TON payment task
      const verifyTransaction = async () => {
        try {
          console.log("Starting verification for boost:", boost.id, "user:", userId);
          const success = await pollForTransactionVerification(
            userId,
            boost.price,
            boost.id, // Use boost ID as the task identifier
            boost.id, // Also pass as boost ID
            "boost" // Type of transaction
          );
          
          if (success) {
            console.log("Boost payment verified successfully");
            setVerified(true);
            toast({
              title: "Boost activated!",
              description: `Your ${boost.multiplier}x boost is now active for 24 hours`,
            });
            // Close dialog after successful verification
            setTimeout(() => onOpenChange(false), 2000);
          } else {
            console.error("Boost payment verification failed");
            setError("Verification failed. Please try again or contact support if you made the payment.");
          }
        } catch (err) {
          console.error("Error verifying boost payment:", err);
          setError("Error verifying payment. Please try again later.");
        } finally {
          setVerifying(false);
        }
      };
      
      // Start verification process
      verifyTransaction();
    }
  }, [open, boost, verified, verifying, onOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Processing</DialogTitle>
          <DialogDescription>
            Waiting for confirmation of your {boost?.price} TON payment for {boost?.multiplier}x boost.
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
