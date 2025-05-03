
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
        comment: taskId ? `task${taskId}` : undefined
      }
    });
    
    if (data?.success) {
      console.log("Payment verified via edge function:", data);
      
      // Since tasks_completed is handled in the edge function, we don't need to update it here
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

// Poll for transaction completion
export const pollForTransactionVerification = async (
  userId: string,
  amount: number,
  taskId: string,
  boostId?: string,
  taskType?: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    let attempts = 0;
    
    // Show initial toast
    toast({
      title: "Waiting for payment confirmation",
      description: "This may take a moment...",
    });
    
    console.log("Starting transaction polling for:", { 
      userId, 
      amount, 
      taskId, 
      boostId, 
      taskType,
      maxAttempts: TRANSACTION_VERIFICATION.MAX_ATTEMPTS,
      checkDelay: TRANSACTION_VERIFICATION.CHECK_DELAY_MS
    });
    
    const checkInterval = setInterval(async () => {
      attempts++;
      console.log(`Attempt ${attempts}/${TRANSACTION_VERIFICATION.MAX_ATTEMPTS} to verify transaction`);
      
      const result = await verifyTonTransaction(userId, amount, taskId, boostId, taskType);
      
      if (result.success) {
        clearInterval(checkInterval);
        console.log("Transaction verified successfully:", result);
        toast({
          title: "Payment confirmed!",
          description: "Your transaction has been verified.",
        });
        resolve(true);
      } else if (attempts >= TRANSACTION_VERIFICATION.MAX_ATTEMPTS) {
        clearInterval(checkInterval);
        console.error("Transaction verification timed out after", attempts, "attempts:", result.message);
        toast({
          title: "Verification timeout",
          description: "Please try again or contact support if you've made the payment.",
          variant: "destructive"
        });
        resolve(false);
      } else {
        console.log(`Verification attempt ${attempts} failed, retrying...`);
      }
    }, TRANSACTION_VERIFICATION.CHECK_DELAY_MS);
  });
};

// Helper to format wallet address for display
export const formatWalletAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
};

/**
 * @deprecated Use TonConnect's sendTransaction method instead for a better user experience
 */
export const openTonPayment = (amount: number, taskId?: string): void => {
  const isInTelegram = typeof window !== 'undefined' && 
                      Boolean(window.Telegram?.WebApp?.initData);

  if (isInTelegram) {
    const amountInNano = amount * 1000000000;
    const comment = taskId ? `task${taskId}` : '';
    const paymentUrl = `ton://transfer/${tonWalletAddress}?amount=${amountInNano}&text=${comment}`;
    
    console.log(`Opening TON payment in Telegram for ${amount} TON`, {
      paymentUrl,
      walletAddress: tonWalletAddress,
      amountInNano,
      comment
    });
    
    window.Telegram.WebApp.openLink(paymentUrl);
  } else {
    console.warn("Not in Telegram WebApp environment, cannot open TON payment");
    toast({
      title: "Not in Telegram",
      description: "Please open this app in Telegram to make payments",
      variant: "destructive"
    });
  }
};
