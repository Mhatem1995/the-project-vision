
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
import { useTonConnect } from "@/hooks/useTonConnect";
import { getConnectedWalletAddress } from "@/integrations/ton/TonConnectConfig";
import { openTonPayment, RECEIVING_WALLET_ADDRESS } from "@/utils/tonTransactionUtils";

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
  const { isConnected, tonConnectUI } = useTonConnect(); // get tonConnectUI

  const handlePurchase = async (option: BoostOption) => {
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
    const walletAddress = localStorage.getItem("tonWalletAddress");
    if (!walletAddress || !isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your TON wallet first to purchase a boost.",
        variant: "destructive" 
      });
      return;
    }
    try {
      const { data, error } = await supabase.from("mining_boosts").insert({
        user_id: userId,
        multiplier: option.multiplier,
        price: option.price,
        duration: option.duration,
        status: "pending",
        expires_at: new Date(Date.now() + option.duration * 60 * 60 * 1000).toISOString()
      }).select().maybeSingle();

      if (error || !data) {
        console.error("Error creating boost record:", error);
        toast({
          title: "Error",
          description: "Failed to create boost record: " + (error?.message || "Unknown error"),
          variant: "destructive"
        });
        return;
      }

      console.log("Boost record created with ID:", data.id, "for user:", userId);

      try {
        await supabase.functions.invoke('database-helper', {
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
      } catch (err) {
        console.warn("Failed to record boost payment (non-critical):", err);
      }

      setPendingBoost(data);
      setVerifyDialog(true);
      onOpenChange(false);

      setTimeout(() => {
        openTonPayment(tonConnectUI, option.price, data.id); // Pass tonConnectUI and correct id type (string)
      }, 500);
    } catch (e) {
      console.error("Unexpected error in handlePurchase:", e);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDialogChange = (value: boolean) => {
    onOpenChange(value);
    if (!value) {
      setPendingBoost(null);
      setVerifyDialog(false);
    }
  };

  // Directly get wallet from localStorage with enforced provider type
  const connectedWalletAddress = (() => {
    const provider = localStorage.getItem("tonWalletProvider");
    if (provider === "telegram-wallet") {
      return localStorage.getItem("tonWalletAddress");
    }
    return null;
  })();

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
                  disabled={!isConnected}
                >
                  Pay {option.price} TON
                </Button>
              </div>
            ))}
          </div>
          {connectedWalletAddress && (
            <div className="text-xs text-muted-foreground mt-2 text-center">
              <>Send payment to: <span className="font-mono break-all">{RECEIVING_WALLET_ADDRESS}</span></>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {pendingBoost && connectedWalletAddress && (
        <BoostPaymentVerificationDialog
          open={verifyDialog}
          onOpenChange={(open) => {
            setVerifyDialog(open);
            if (!open) {
              setPendingBoost(null);
            }
          }}
          boost={pendingBoost}
          tonWallet={connectedWalletAddress}
        />
      )}
    </>
  );
}
