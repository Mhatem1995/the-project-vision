
import { supabase } from "@/integrations/supabase/client";
import { tonWalletAddress, TON_API_ENDPOINTS, TRANSACTION_VERIFICATION } from "@/integrations/ton/TonConnectConfig";
import { toast } from "@/hooks/use-toast";

// Verify transaction directly via Supabase function
export const verifyTonTransaction = async (
  userId: string,
  expectedAmount: number,
  taskId: string,
  boostId?: string,
  taskType?: string
): Promise<{ success: boolean; transactionHash?: string; message?: string }> => {
  try {
    // First attempt to use the Supabase edge function
    console.log("Verifying TON payment using edge function...", {
      userId,
      amount: expectedAmount,
      taskId,
      boostId,
      taskType
    });
    
    const { data, error } = await supabase.functions.invoke('verify-ton-payment', {
      body: { 
        userId, 
        amount: expectedAmount, 
        taskId, 
        boostId, 
        taskType,
        // Add the comment to help match the transaction
        comment: taskType === "boost" ? `boost_${boostId}` : taskId ? `task${taskId}` : undefined
      }
    });
    
    if (data?.success) {
      console.log("Payment verified via edge function:", data);
      
      return {
        success: true,
        transactionHash: data.transaction?.hash,
        message: "Transaction verified successfully"
      };
    }
    
    console.warn("Edge function verification failed:", error || data);
    return {
      success: false,
      message: data?.message || error?.message || "Could not verify transaction"
    };
  } catch (err) {
    console.error("Error verifying TON transaction:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unknown verification error"
    };
  }
};

// Poll for transaction completion with better timing
export const pollForTransactionVerification = async (
  userId: string,
  amount: number,
  taskId: string,
  boostId?: string,
  taskType?: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 20; // Increased from default
    const checkDelay = 8000; // Increased to 8 seconds
    
    // Show initial toast
    toast({
      title: "Waiting for payment confirmation",
      description: "This may take up to 2 minutes. Please don't close the app.",
    });
    
    console.log("Starting transaction polling for:", { 
      userId, 
      amount, 
      taskId, 
      boostId, 
      taskType,
      maxAttempts,
      checkDelay
    });
    
    const checkInterval = setInterval(async () => {
      attempts++;
      console.log(`Verification attempt ${attempts}/${maxAttempts}`);
      
      const result = await verifyTonTransaction(userId, amount, taskId, boostId, taskType);
      
      if (result.success) {
        clearInterval(checkInterval);
        console.log("Transaction verified successfully:", result);
        toast({
          title: "Payment confirmed!",
          description: "Your transaction has been verified.",
        });
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.error("Transaction verification timed out after", attempts, "attempts:", result.message);
        toast({
          title: "Verification timeout",
          description: "Please try again or contact support if you've made the payment.",
          variant: "destructive"
        });
        resolve(false);
      } else {
        console.log(`Verification attempt ${attempts} failed, retrying in ${checkDelay/1000}s...`);
        
        // Show progress updates
        if (attempts % 3 === 0) {
          toast({
            title: "Still checking...",
            description: `Attempt ${attempts}/${maxAttempts}. Please wait.`,
          });
        }
      }
    }, checkDelay);
  });
};

// Helper to format wallet address for display
export const formatWalletAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
};

/**
 * Open TON payment in Telegram wallet - Enhanced for mobile Telegram
 */
export const openTonPayment = (amount: number, taskId?: string): void => {
  // Enhanced Telegram detection for mobile
  const isTelegramApp = Boolean(
    typeof window !== 'undefined' && 
    (
      // Check for Telegram object
      (window.Telegram?.WebApp?.initData) ||
      // Check user agent
      navigator.userAgent.includes('Telegram') ||
      // Check stored flag
      localStorage.getItem("inTelegramWebApp") === "true"
    )
  );

  console.log("Opening TON payment with enhanced detection:", {
    isTelegramApp,
    amount,
    taskId,
    userAgent: navigator.userAgent,
    hasTelegramObject: Boolean(window.Telegram?.WebApp),
    hasInitData: Boolean(window.Telegram?.WebApp?.initData),
    storedFlag: localStorage.getItem("inTelegramWebApp")
  });

  if (isTelegramApp) {
    const amountInNano = Math.floor(amount * 1000000000);
    // Use consistent comment format for both tasks and boosts
    const comment = taskId ? (taskId.includes('-') ? `boost_${taskId}` : `task${taskId}`) : '';
    
    // Create multiple payment URL formats to ensure compatibility
    const tonPaymentUrl = `ton://transfer/${tonWalletAddress}?amount=${amountInNano}&text=${encodeURIComponent(comment)}`;
    const httpsPaymentUrl = `https://app.tonkeeper.com/transfer/${tonWalletAddress}?amount=${amountInNano}&text=${encodeURIComponent(comment)}`;
    
    console.log(`Opening TON payment for ${amount} TON`, {
      tonPaymentUrl,
      httpsPaymentUrl,
      walletAddress: tonWalletAddress,
      amountInNano,
      comment,
      taskId
    });
    
    // Try multiple methods to open the payment
    if (window.Telegram?.WebApp?.openLink) {
      console.log("Using Telegram WebApp openLink");
      // Try ton:// protocol first
      try {
        window.Telegram.WebApp.openLink(tonPaymentUrl);
        console.log("Successfully opened ton:// payment URL");
      } catch (error) {
        console.log("ton:// failed, trying https:// fallback");
        try {
          window.Telegram.WebApp.openLink(httpsPaymentUrl);
          console.log("Successfully opened https:// payment URL");
        } catch (fallbackError) {
          console.error("Both payment URL attempts failed:", error, fallbackError);
          toast({
            title: "Payment URL Error",
            description: "Could not open payment. Please try again.",
            variant: "destructive"
          });
        }
      }
    } else {
      console.log("Telegram WebApp openLink not available, using window.open");
      // Fallback to window.open
      try {
        const opened = window.open(tonPaymentUrl, '_blank');
        if (!opened) {
          // If ton:// doesn't work, try https://
          window.open(httpsPaymentUrl, '_blank');
        }
        console.log("Payment URL opened via window.open");
      } catch (error) {
        console.error("window.open failed:", error);
        toast({
          title: "Payment Error", 
          description: "Could not open payment. Please check your wallet app.",
          variant: "destructive"
        });
      }
    }
  } else {
    console.warn("Not in Telegram WebApp environment, cannot open TON payment");
    toast({
      title: "Not in Telegram",
      description: "Please open this app in Telegram to make payments",
      variant: "destructive"
    });
  }
};
