
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

    // Copy wallet address to clipboard
    try {
      await navigator.clipboard.writeText(tonWallet);
      toast({
        title: "TON Wallet copied",
        description: `Send ${option.price} TON to activate your ${option.multiplier}x boost`,
      });
    } catch (err) {
      console.error("Failed to copy wallet address", err);
    }

    // Create boost record (pending)
    const { data, error } = await supabase.from("mining_boosts").insert([
      {
        user_id: userId,
        multiplier: option.multiplier,
        price: option.price,
        duration: option.duration,
        status: "pending",
      },
    ]).select().maybeSingle();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to create boost record",
        variant: "destructive"
      });
      return;
    }

    setPendingBoost(data);
    setVerifyDialog(true);
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
