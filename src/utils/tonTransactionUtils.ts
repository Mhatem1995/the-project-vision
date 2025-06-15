import { supabase } from "@/integrations/supabase/client";
import { getConnectedWalletAddress, TON_API_ENDPOINTS, TRANSACTION_VERIFICATION } from "@/integrations/ton/TonConnectConfig";
import { toast } from "@/hooks/use-toast";

// Debug logging function
const debugLog = (message: string, data?: any) => {
  console.log(`🔍 [TON DEBUG] ${message}`, data || "");
};

// Use your Tonkeeper receiving wallet for all payments
export const RECEIVING_WALLET_ADDRESS = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C"; // <-- YOUR TONKEEPER WALLET

// Verify transaction directly via Supabase function
export const verifyTonTransaction = async (
  userId: string,
  expectedAmount: number,
  taskId: string,
  boostId?: string,
  taskType?: string
): Promise<{ success: boolean; transactionHash?: string; message?: string }> => {
  try {
    debugLog("Starting TON payment verification", {
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
    
    debugLog("Supabase function response", { data, error });
    
    if (data?.success) {
      debugLog("✅ Payment verified successfully", data);
      return {
        success: true,
        transactionHash: data.transaction?.hash,
        message: "Transaction verified successfully"
      };
    }
    
    debugLog("❌ Payment verification failed", { error, data });
    return {
      success: false,
      message: data?.message || error?.message || "Could not verify transaction"
    };
  } catch (err) {
    debugLog("❌ Error in verifyTonTransaction", err);
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
    const maxAttempts = 30; // 30 attempts
    const checkDelay = 8000; // 8 seconds between checks
    
    debugLog("Starting transaction polling", { 
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
      description: "Please wait while we verify your transaction. This can take up to 4 minutes.",
    });
    
    const checkInterval = setInterval(async () => {
      attempts++;
      debugLog(`Verification attempt ${attempts}/${maxAttempts}`);
      
      const result = await verifyTonTransaction(userId, amount, taskId, boostId, taskType);
      
      if (result.success) {
        clearInterval(checkInterval);
        debugLog("✅ Transaction verified successfully!");
        
        toast({
          title: "✅ Payment confirmed!",
          description: "Your transaction has been verified successfully.",
        });
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        debugLog(`❌ Transaction verification timed out after ${attempts} attempts`);
        
        toast({
          title: "⏱️ Verification timeout",
          description: "We couldn't find your transaction. Please check the console logs and contact support.",
          variant: "destructive"
        });
        resolve(false);
      } else {
        // Show progress updates every 3 attempts
        if (attempts % 3 === 0) {
          const remainingTime = Math.ceil((maxAttempts - attempts) * checkDelay / 60000);
          debugLog(`Still checking... attempt ${attempts}/${maxAttempts}`);
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

// Enhanced TON payment function - use REAL wallet address and allow custom comment
export const openTonPayment = (
  tonConnectUI: any, // Pass the TonConnectUI object as argument
  amount: number,
  taskId?: string,
  customComment?: string
): void => {
  debugLog("Opening TON payment", { amount, taskId, customComment });

  if (!tonConnectUI) {
    debugLog("❌ TonConnect UI instance not provided");
    toast({
      title: "❌ Wallet not connected",
      description: "TonConnect UI not initialized. Please refresh and try again.",
      variant: "destructive"
    });
    return;
  }

  if (typeof tonConnectUI.sendTransaction !== 'function') {
    debugLog("❌ sendTransaction method not available");
    toast({
      title: "❌ Wallet error",
      description: "sendTransaction method not available. Please reconnect your wallet.",
      variant: "destructive"
    });
    return;
  }

  // ALWAYS get the Telegram Wallet address only from localStorage
  const realWalletAddress = localStorage.getItem("tonWalletAddress");
  const walletProvider = localStorage.getItem("tonWalletProvider");
  if (!realWalletAddress || walletProvider !== "telegram-wallet") {
    debugLog("❌ Only Telegram Wallet allowed!");
    toast({
      title: "Telegram Wallet Required",
      description: "You must connect your Telegram Wallet to make payments.",
      variant: "destructive"
    });
    return;
  }

  const amountInNano = Math.floor(amount * 1000000000);
  const comment = customComment ?? (taskId ? (taskId.includes('-') ? `boost_${taskId}` : `task${taskId}`) : '');
  const receivingWallet = RECEIVING_WALLET_ADDRESS; // Always your Tonkeeper wallet

  // Show payment details as plain text (to prevent TS/JSX error)
  toast({
    title: "TON Payment Details",
    description: `Amount: ${amount} TON\nComment: ${comment || "(none)"}\nTo: ${receivingWallet}`,
    duration: 7000,
  });

  debugLog("[TON PAYMENT] Will send transaction:", { 
    from: realWalletAddress, to: receivingWallet, amountInNano, comment 
  });

  tonConnectUI.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
    messages: [
      {
        address: receivingWallet, // Always send to Tonkeeper wallet
        amount: amountInNano.toString(),
        payload: comment,
      }
    ]
  }).then(() => {
    debugLog("✅ Transaction sent successfully from Telegram wallet");
    toast({
      title: "📤 Transaction sent",
      description: "Please confirm the transaction in your Telegram Wallet.",
    });
  }).catch((error) => {
    debugLog("❌ Transaction failed", error);
    toast({
      title: "❌ Transaction failed",
      description: `Failed to send transaction: ${error?.message || "Unknown error"}`,
      variant: "destructive"
    });
  });
};
