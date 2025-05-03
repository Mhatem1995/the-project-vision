
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import BoostPaymentVerificationDialog from "./BoostPaymentVerificationDialog";
import { useToast } from "@/hooks/use-toast";

const tonWallet = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C";
const boostOptions = [
  { multiplier: 2, price: 2, duration: 24 },
  { multiplier: 3, price: 5, duration: 24 },
  { multiplier: 10, price: 10, duration: 24 },
];

export interface BoostOption {
  multiplier: number;
  price: number;
  duration: number;
}

interface BoostPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BoostPurchaseDialog({ open, onOpenChange }: BoostPurchaseDialogProps) {
  const [pendingBoost, setPendingBoost] = useState<any>(null);
  const [verifyDialog, setVerifyDialog] = useState(false);
  const { toast } = useToast();

  const handlePurchase = async (option: BoostOption) => {
    // Get logged-in user ID
    const userId = localStorage.getItem("telegramUserId");
    if (!userId) {
      toast({
        title: "Error",
        description: "User not found. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    const walletAddress = localStorage.getItem("tonWalletAddress");
    if (!walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your TON wallet first to purchase a boost.",
        variant: "destructive" 
      });
      return;
    }

    try {
      console.log("Creating boost record with text ID:", userId, "wallet:", walletAddress, "multiplier:", option.multiplier);
      
      // Creating a boost record (status: pending)
      const { data, error } = await supabase.from("mining_boosts").insert([
        {
          user_id: userId,  // Using text ID not UUID
          multiplier: option.multiplier,
          price: option.price,
          duration: option.duration,
          status: "pending",
        }
      ]).select().maybeSingle();

      if (error || !data) {
        console.error("Error creating boost record:", error);
        toast({
          title: "Error",
          description: "Failed to create boost record: " + (error?.message || "Unknown error"),
          variant: "destructive"
        });
        return;
      }

      console.log("Boost record created:", data);

      // Record the pending payment using database-helper
      try {
        // Use the database-helper edge function to insert payment
        const { error: paymentError } = await supabase.functions.invoke('database-helper', {
          body: {
            action: 'insert_payment',
            params: {
              telegram_id: userId,
              wallet_address: walletAddress,
              amount_paid: option.price,
              task_type: "boost",
              transaction_hash: null
            }
          }
        });
        
        if (paymentError) {
          console.error("Failed to record boost payment:", paymentError);
          toast({
            title: "Warning",
            description: "Payment record created, but tracking may be incomplete.",
            variant: "default"
          });
        } else {
          console.log("Payment record created for boost");
        }
      } catch (err) {
        console.warn("Failed to record boost payment (non-critical):", err);
      }

      // Check if running in Telegram WebApp environment
      if (window.Telegram?.WebApp) {
        // Open TON payment in Telegram
        const paymentUrl = `ton://transfer/${tonWallet}?amount=${option.price * 1000000000}`; // Convert TON to nanotons
        console.log("Opening TON payment in Telegram:", paymentUrl);
        window.Telegram.WebApp.openLink(paymentUrl);
      } else {
        // Fallback for non-Telegram environment
        try {
          await navigator.clipboard.writeText(tonWallet);
          toast({
            title: "TON Wallet copied",
            description: `Send ${option.price} TON to activate your ${option.multiplier}x boost`,
          });
        } catch (err) {
          console.error("Failed to copy wallet address", err);
        }
      }

      setPendingBoost(data);
      setVerifyDialog(true);
    } catch (e) {
      console.error("Unexpected error in handlePurchase:", e);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle dialog close: reset states
  const handleDialogChange = (value: boolean) => {
    onOpenChange(value);
    if (!value) {
      setPendingBoost(null);
      setVerifyDialog(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Boost Your Mining Speed</DialogTitle>
            <DialogDescription>
              Purchase a mining boost to increase your KFC mining rate for 24 hours.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col space-y-4 py-4">
            {boostOptions.map((option, idx) => (
              <div key={idx} className="flex items-center justify-between bg-card p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="font-medium flex items-center">
                    <Zap className="w-5 h-5 mr-1 text-yellow-400" />
                    {option.multiplier}x Boost
                  </p>
                  <p className="text-sm text-muted-foreground">For {option.duration} hours</p>
                </div>
                <Button onClick={() => handlePurchase(option)}>
                  Pay {option.price} TON
                </Button>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-2 text-center">
            Send payment to: <span className="font-mono break-all">{tonWallet}</span>
          </div>
        </DialogContent>
      </Dialog>
      {pendingBoost && (
        <BoostPaymentVerificationDialog
          open={verifyDialog}
          onOpenChange={(open) => {
            setVerifyDialog(open);
            if (!open) handleDialogChange(false);
          }}
          boost={pendingBoost}
          tonWallet={tonWallet}
        />
      )}
    </>
  );
}
