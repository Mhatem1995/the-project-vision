
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
    console.log("🔍 Verifying TON payment:", {
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
        comment: taskType === "boost" ? `boost_${boostId}` : taskId ? `task${taskId}` : undefined
      }
    });
    
    if (data?.success) {
      console.log("✅ Payment verified:", data);
      return {
        success: true,
        transactionHash: data.transaction?.hash,
        message: "Transaction verified successfully"
      };
    }
    
    console.log("❌ Payment verification failed:", error || data);
    return {
      success: false,
      message: data?.message || error?.message || "Could not verify transaction"
    };
  } catch (err) {
    console.error("❌ Error verifying TON transaction:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unknown verification error"
    };
  }
};

// Enhanced polling with better feedback
export const pollForTransactionVerification = async (
  userId: string,
  amount: number,
  taskId: string,
  boostId?: string,
  taskType?: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 40; // 40 attempts
    const checkDelay = 10000; // 10 seconds between checks
    
    console.log(`🔄 Starting transaction polling:`, { 
      userId, 
      amount, 
      taskId, 
      boostId, 
      taskType,
      maxAttempts,
      checkDelay: checkDelay / 1000 + "s"
    });
    
    // Show initial toast
    toast({
      title: "🔍 Checking for payment...",
      description: "Please wait while we verify your transaction. This can take up to 5 minutes.",
    });
    
    const checkInterval = setInterval(async () => {
      attempts++;
      console.log(`🔄 Verification attempt ${attempts}/${maxAttempts}`);
      
      const result = await verifyTonTransaction(userId, amount, taskId, boostId, taskType);
      
      if (result.success) {
        clearInterval(checkInterval);
        console.log("✅ Transaction verified successfully!");
        
        toast({
          title: "✅ Payment confirmed!",
          description: "Your transaction has been verified successfully.",
        });
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.error(`❌ Transaction verification timed out after ${attempts} attempts`);
        
        toast({
          title: "⏱️ Verification timeout",
          description: "We couldn't find your transaction. If you made the payment, please contact support.",
          variant: "destructive"
        });
        resolve(false);
      } else {
        // Show progress updates every 5 attempts
        if (attempts % 5 === 0) {
          const remainingTime = Math.ceil((maxAttempts - attempts) * checkDelay / 60000);
          toast({
            title: `🔍 Still checking... (${attempts}/${maxAttempts})`,
            description: `We'll keep checking for about ${remainingTime} more minutes.`,
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

// Enhanced TON payment function
export const openTonPayment = (amount: number, taskId?: string): void => {
  console.log("💰 Opening TON payment:", { amount, taskId });

  const tonConnectUI = window._tonConnectUI;
  
  if (tonConnectUI && typeof tonConnectUI.sendTransaction === 'function') {
    const amountInNano = Math.floor(amount * 1000000000);
    const comment = taskId ? (taskId.includes('-') ? `boost_${taskId}` : `task${taskId}`) : '';
    
    console.log("📤 Sending transaction:", {
      address: tonWalletAddress,
      amount: amountInNano,
      comment
    });
    
    tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      messages: [
        {
          address: tonWalletAddress,
          amount: amountInNano.toString(),
          payload: comment,
        }
      ]
    }).then(() => {
      console.log("✅ Transaction sent successfully");
      toast({
        title: "📤 Transaction sent",
        description: "Please confirm the transaction in your wallet app.",
      });
    }).catch((error) => {
      console.error("❌ Transaction failed:", error);
      toast({
        title: "❌ Transaction failed",
        description: "Failed to send transaction. Please try again.",
        variant: "destructive"
      });
    });
  } else {
    console.error("❌ TonConnect UI not available");
    toast({
      title: "❌ Wallet not connected",
      description: "Please connect your TON wallet first.",
      variant: "destructive"
    });
  }
};
