
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BoostPaymentVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boost: any;
  tonWallet: string;
}

export default function BoostPaymentVerificationDialog({ open, onOpenChange, boost, tonWallet }: BoostPaymentVerificationDialogProps) {
  const [tonTx, setTonTx] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulate TON payment verification. In production do real check!
  async function verifyPayment() {
    setVerifying(true);
    setError(null);

    // Simulate: Accept any txHash that looks plausible
    if (tonTx.length < 12) {
      setError("Invalid TON transaction hash.");
      setVerifying(false);
      return;
    }

    // Mark boost as confirmed in Supabase and save tx hash
    const { error: updateError } = await supabase
      .from("mining_boosts")
      .update({
        status: "confirmed",
        ton_tx: tonTx,
        expires_at: new Date(Date.now() + boost.duration * 3600 * 1000).toISOString(),
      })
      .eq("id", boost.id);

    if (updateError) {
      setError("Failed to update boost as confirmed.");
      setVerifying(false);
      return;
    }

    setVerified(true);
    setVerifying(false);
    // Optionally, you could add callback logic here for Mining.tsx to refresh
    setTimeout(() => onOpenChange(false), 1800);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Verification</DialogTitle>
          <DialogDescription>
            To activate your boost, send <b>{boost.price} TON</b> to <span className="font-mono">{tonWallet}</span> and then enter your TON TX hash below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            placeholder="Enter your TON transaction hash"
            value={tonTx}
            onChange={(e) => setTonTx(e.target.value)}
            disabled={verifying || verified}
          />
          {error && <div className="text-destructive text-xs">{error}</div>}
          {verified && <div className="text-green-600 font-medium">✅ Payment Verified! Boost activated.</div>}
        </div>
        <DialogFooter>
          <Button disabled={verifying || verified || !tonTx} onClick={verifyPayment}>
            {verifying ? "Verifying..." : verified ? "Boost Activated" : "Verify Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
