
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface BoostPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BoostOption {
  multiplier: number;
  price: number;
  duration: number;
}

const boostOptions: BoostOption[] = [
  { multiplier: 2, price: 2, duration: 24 },
  { multiplier: 3, price: 5, duration: 24 },
  { multiplier: 10, price: 10, duration: 24 },
];

export function BoostPurchaseDialog({ open, onOpenChange }: BoostPurchaseDialogProps) {
  const handlePurchase = (option: BoostOption) => {
    const tonAddress = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C";
    
    // Show confirmation toast
    toast({
      title: `x${option.multiplier} Boost Purchase`,
      description: `Copy the TON wallet address and send ${option.price} TON to complete your purchase.`,
    });

    // Copy address to clipboard
    navigator.clipboard.writeText(tonAddress).then(
      () => {
        toast({
          title: "Address Copied!",
          description: "TON wallet address copied to clipboard.",
        });
      },
      (err) => {
        console.error("Could not copy text: ", err);
      }
    );
    
    // We would typically integrate with TON payments here
    // For now we'll just close the dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Boost Your Mining Speed</DialogTitle>
          <DialogDescription>
            Purchase a mining boost to increase your KFC mining rate for 24 hours.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-4 py-4">
          {boostOptions.map((option, index) => (
            <div key={index} className="flex items-center justify-between bg-card p-4 rounded-lg border">
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
          Send payment to: UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C
        </div>
      </DialogContent>
    </Dialog>
  );
}
