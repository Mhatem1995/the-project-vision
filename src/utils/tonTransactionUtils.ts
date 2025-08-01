import { supabase } from "@/integrations/supabase/client";

export const RECEIVING_WALLET_ADDRESS = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C";

/**
 * Open TON payment using TonConnect
 */
export const openTonPayment = async (tonConnectUI: any, amount: number, taskId: string) => {
  if (!tonConnectUI) {
    console.error("❌ [PAYMENT] TonConnect UI not available");
    return;
  }

  try {
    console.log(`💰 [PAYMENT] Opening payment for ${amount} TON, task: ${taskId}`);
    
    const amountNano = Math.floor(amount * 1000000000);
    const comment = `task${taskId}`;
    
    console.log(`💰 [PAYMENT] Payment details:`, {
      to: RECEIVING_WALLET_ADDRESS,
      amount: amountNano,
      comment
    });

    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
      messages: [
        {
          address: RECEIVING_WALLET_ADDRESS,
          amount: amountNano.toString(),
          payload: comment
        }
      ]
    };

    await tonConnectUI.sendTransaction(transaction);
    console.log("✅ [PAYMENT] Transaction sent successfully");
    
  } catch (error) {
    console.error("❌ [PAYMENT] Transaction failed:", error);
    throw error;
  }
};

/**
 * Poll for transaction verification
 */
export const pollForTransactionVerification = async (
  userId: string,
  amount: number,
  taskId: string,
  boostId?: string,
  taskType?: string
): Promise<boolean> => {
  console.log(`🔍 [POLL] Starting verification poll for user ${userId}`);
  console.log(`🔍 [POLL] Parameters:`, { userId, amount, taskId, boostId, taskType });

  const maxAttempts = 40; // 2 minutes of polling
  const pollInterval = 3000; // 3 seconds
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`🔍 [POLL] Attempt ${attempt}/${maxAttempts}`);
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-ton-payment', {
        body: {
          userId,
          amount,
          taskId,
          boostId,
          taskType,
          comment: boostId ? `boost_${boostId}` : `task${taskId}`
        }
      });

      console.log(`🔍 [POLL] Verification response:`, { data, error });

      if (error) {
        console.error(`❌ [POLL] Verification error:`, error);
        
        // If it's a wallet not found error, fail immediately
        if (error.message?.includes('wallet not found') || error.message?.includes('WALLET_NOT_FOUND')) {
          console.error(`❌ [POLL] Wallet not found - stopping verification`);
          return false;
        }
        
        // For other errors, continue polling
        if (attempt === maxAttempts) {
          console.error(`❌ [POLL] Max attempts reached, giving up`);
          return false;
        }
      } else if (data?.success) {
        console.log(`✅ [POLL] Transaction verified successfully!`);
        return true;
      }

      // Wait before next poll
      if (attempt < maxAttempts) {
        console.log(`⏳ [POLL] Waiting ${pollInterval}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
    } catch (err) {
      console.error(`❌ [POLL] Poll attempt ${attempt} failed:`, err);
      
      if (attempt === maxAttempts) {
        console.error(`❌ [POLL] All attempts failed`);
        return false;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  console.error(`❌ [POLL] Verification timeout after ${maxAttempts} attempts`);
  return false;
};

/**
 * Get connected wallet address from localStorage
 */
export const getConnectedWalletAddress = (): string | null => {
  const address = localStorage.getItem("tonWalletAddress");
  const provider = localStorage.getItem("tonWalletProvider");
  
  console.log(`🔍 [WALLET] Getting connected wallet:`, { address, provider });
  
  if (address && address.startsWith("UQ")) {
    console.log(`✅ [WALLET] Found valid UQ wallet address: ${address}`);
    return address;
  }
  
  console.log(`❌ [WALLET] No valid UQ wallet address found`);
  return null;
};

/**
 * Validate wallet address format
 */
export const isValidTonAddress = (address: string): boolean => {
  if (!address) return false;
  
  // Check user-friendly format (UQ or EQ + base64url)
  if (address.match(/^(UQ|EQ)[A-Za-z0-9_-]{40,}$/)) {
    return true;
  }
  
  // Check raw format (0: + 64 hex chars)
  if (address.match(/^0:[a-fA-F0-9]{64}$/)) {
    return true;
  }
  
  return false;
};