
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap } from "lucide-react";

interface BalanceCardProps {
  balance: number;
  activeBoost: any;
  onBoostClick: () => void;
}

const BalanceCard = ({ balance, activeBoost, onBoostClick }: BalanceCardProps) => {
  return (
    <div className="bg-card p-6 rounded-lg w-full max-w-md text-center shadow-md relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            className="absolute right-3 top-3 h-10 w-10 rounded-full p-0"
            variant="outline"
            onClick={onBoostClick}
          >
            <Zap className="h-5 w-5 text-yellow-400" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Boost Mining Speed</p>
        </TooltipContent>
      </Tooltip>
      <h2 className="text-xl font-semibold mb-2">Your Balance</h2>
      <p className="text-4xl font-bold">{balance.toFixed(2)} Knife Coin</p>
      {activeBoost && (
        <div className="mt-3 text-green-600 text-xs font-semibold">
          🔥 {activeBoost.multiplier}x BOOST ACTIVE • ends {new Date(activeBoost.expires_at).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default BalanceCard;
