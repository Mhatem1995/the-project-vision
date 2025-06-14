
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

// Poll for transaction completion with better timing and more attempts
export const pollForTransactionVerification = async (
  userId: string,
  amount: number,
  taskId: string,
  boostId?: string,
  taskType?: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 30; // Increased to 30 attempts
    const checkDelay = 6000; // 6 seconds between checks
    
    // Show initial toast
    toast({
      title: "Waiting for payment confirmation",
      description: "This may take up to 3 minutes. Please don't close the app.",
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
        if (attempts % 5 === 0) {
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
 * Open TON payment - Enhanced to work in both Telegram and browser environments
 */
export const openTonPayment = (amount: number, taskId?: string): void => {
  console.log("Opening TON payment for amount:", amount, "taskId:", taskId);

  // Check if we have TonConnect available (works in both environments)
  const tonConnectUI = window._tonConnectUI;
  
  if (tonConnectUI && typeof tonConnectUI.sendTransaction === 'function') {
    console.log("Using TonConnect to send transaction");
    
    // Use TonConnect to send the transaction directly
    const amountInNano = Math.floor(amount * 1000000000);
    const comment = taskId ? (taskId.includes('-') ? `boost_${taskId}` : `task${taskId}`) : '';
    
    try {
      tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // expires in 10 mins
        messages: [
          {
            address: tonWalletAddress,
            amount: amountInNano.toString(),
            payload: comment,
          }
        ]
      }).then(() => {
        console.log("TonConnect transaction sent successfully");
        toast({
          title: "Transaction sent",
          description: "Please confirm the transaction in your wallet",
        });
      }).catch((error) => {
        console.error("TonConnect transaction failed:", error);
        toast({
          title: "Transaction failed",
          description: "Failed to send transaction. Please try again.",
          variant: "destructive"
        });
      });
    } catch (error) {
      console.error("Error sending TonConnect transaction:", error);
      toast({
        title: "Error",
        description: "Failed to initiate transaction",
        variant: "destructive"
      });
    }
  } else {
    // Fallback: Try to open payment URL (for Telegram environments)
    const isTelegramApp = Boolean(
      typeof window !== 'undefined' && 
      (
        (window.Telegram?.WebApp?.initData) ||
        navigator.userAgent.includes('Telegram') ||
        localStorage.getItem("inTelegramWebApp") === "true"
      )
    );

    if (isTelegramApp) {
      const amountInNano = Math.floor(amount * 1000000000);
      const comment = taskId ? (taskId.includes('-') ? `boost_${taskId}` : `task${taskId}`) : '';
      const tonPaymentUrl = `ton://transfer/${tonWalletAddress}?amount=${amountInNano}&text=${encodeURIComponent(comment)}`;
      
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(tonPaymentUrl);
      } else {
        window.open(tonPaymentUrl, '_blank');
      }
    } else {
      toast({
        title: "Wallet not connected",
        description: "Please connect your TON wallet first",
        variant: "destructive"
      });
    }
  }
};
