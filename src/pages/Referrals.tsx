
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, Users } from "lucide-react";

const Referrals = () => {
  const { toast } = useToast();
  const [referralLink, setReferralLink] = useState<string>("");
  const [referralCount, setReferralCount] = useState<number>(0);
  const [referralEarnings, setReferralEarnings] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Simulate loading referral data
    const timer = setTimeout(() => {
      // In a real app, this would fetch from Supabase or backend
      // For this demo, we'll use localStorage
      const userId = localStorage.getItem("userId") || generateUserId();
      if (!localStorage.getItem("userId")) {
        localStorage.setItem("userId", userId);
      }
      
      const botUsername = "WilliamKnifeManBot"; // Replace with your actual bot username
      const referralUrl = `https://t.me/${botUsername}?start=${userId}`;
      
      setReferralLink(referralUrl);
      setReferralCount(parseInt(localStorage.getItem("referralCount") || "0"));
      setReferralEarnings(parseInt(localStorage.getItem("referralEarnings") || "0"));
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const generateUserId = (): string => {
    return Math.random().toString(36).substring(2, 10);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast({
        title: "Link Copied!",
        description: "Referral link copied to clipboard.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Referrals</h1>
        <p className="text-muted-foreground">Invite friends to earn KFC</p>
      </div>
      
      <div className="bg-card p-6 rounded-lg shadow-md space-y-4">
        <h2 className="text-xl font-semibold">Your Referral Link</h2>
        <p className="text-sm text-muted-foreground">
          Share this link with friends. You'll earn 10 KFC for each friend that joins!
        </p>
        
        <div className="flex items-center gap-2">
          <Input 
            readOnly 
            value={referralLink} 
            className="font-mono text-sm"
          />
          <Button variant="outline" onClick={copyToClipboard}>
            <Link className="mr-2 h-4 w-4" /> Copy
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card p-6 rounded-lg shadow-md text-center">
          <Users className="mx-auto h-8 w-8 mb-2 text-primary" />
          <h3 className="font-medium text-muted-foreground">Total Referrals</h3>
          <p className="text-2xl font-bold">{referralCount}</p>
        </div>
        
        <div className="bg-card p-6 rounded-lg shadow-md text-center">
          <div className="mx-auto h-8 w-8 mb-2 text-primary font-bold">KFC</div>
          <h3 className="font-medium text-muted-foreground">Total Earnings</h3>
          <p className="text-2xl font-bold">{referralEarnings}</p>
        </div>
      </div>
      
      <Button 
        variant="outline" 
        className="w-full"
        onClick={() => {
          // In a real app, this would open the Telegram share dialog
          // For now, we'll just show a toast
          toast({
            title: "Share on Telegram",
            description: "This would open the Telegram share dialog in a real app.",
          });
        }}
      >
        Share on Telegram
      </Button>
    </div>
  );
};

export default Referrals;
