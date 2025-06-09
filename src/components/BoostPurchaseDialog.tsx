
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
import { useTonConnect } from "@/providers/TonConnectProvider";
import { tonWalletAddress } from "@/integrations/ton/TonConnectConfig";
import { openTonPayment } from "@/utils/tonTransactionUtils";

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
  const { isConnected, isTelegramWebApp } = useTonConnect();

  const handlePurchase = async (option: BoostOption) => {
    // Get Telegram user ID - same as TON payment tasks
    const userId = localStorage.getItem("telegramUserId");
    if (!userId) {
      console.error("No Telegram user ID found in localStorage");
      toast({
        title: "Error",
        description: "User not found. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    console.log("Processing boost purchase for user:", userId);

    // Ensure wallet is connected
    const walletAddress = localStorage.getItem("tonWalletAddress");
    if (!walletAddress || !isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your TON wallet first to purchase a boost.",
        variant: "destructive" 
      });
      return;
    }

    // Check if we're in Telegram WebApp environment
    if (!isTelegramWebApp) {
      toast({
        title: "Telegram Required",
        description: "Please open this app in Telegram to make payments.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Creating boost record for user:", userId, "multiplier:", option.multiplier);
      
      // Create a boost record (status: pending) - let Supabase auto-generate the UUID
      const { data, error } = await supabase.from("mining_boosts").insert({
        user_id: userId, // Telegram ID as string
        multiplier: option.multiplier,
        price: option.price,
        duration: option.duration,
        status: "pending",
        expires_at: new Date(Date.now() + option.duration * 60 * 60 * 1000).toISOString()
      }).select().single();

      if (error || !data) {
        console.error("Error creating boost record:", error);
        toast({
          title: "Error",
          description: "Failed to create boost record: " + (error?.message || "Unknown error"),
          variant: "destructive"
        });
        return;
      }

      console.log("Boost record created with ID:", data.id);

      // Record the pending payment - same as TON payment tasks
      try {
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
        } else {
          console.log("Payment record created for boost");
        }
      } catch (err) {
        console.warn("Failed to record boost payment (non-critical):", err);
      }

      // Open Telegram wallet - EXACTLY like TON payment tasks
      console.log(`Opening TON payment for ${option.price} TON boost with ID: ${data.id}`);
      openTonPayment(option.price, data.id); // Use the UUID boost ID

      // Set up verification dialog
      setPendingBoost(data);
      setVerifyDialog(true);
      
      // Close the purchase dialog to show only the verification dialog
      onOpenChange(false);
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
                <Button 
                  onClick={() => handlePurchase(option)}
                  disabled={!isConnected || !isTelegramWebApp}
                >
                  Pay {option.price} TON
                </Button>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-2 text-center">
            {!isTelegramWebApp ? (
              <span className="text-amber-600">⚠️ Open in Telegram to make payments</span>
            ) : (
              <>Send payment to: <span className="font-mono break-all">{tonWalletAddress}</span></>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {pendingBoost && (
        <BoostPaymentVerificationDialog
          open={verifyDialog}
          onOpenChange={(open) => {
            setVerifyDialog(open);
            if (!open) {
              setPendingBoost(null);
            }
          }}
          boost={pendingBoost}
          tonWallet={tonWalletAddress}
        />
      )}
    </>
  );
}
