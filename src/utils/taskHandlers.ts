
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/types/task";
import { pollForTransactionVerification } from "@/utils/tonTransactionUtils";
import { tonWalletAddress } from "@/integrations/ton/TonConnectConfig";

// Debug logging function
const debugLog = (message: string, data?: any) => {
  console.log(`🔍 [TASK DEBUG] ${message}`, data || "");
};

export const handleCollabTask = (
  taskId: string,
  tasks: Task[],
  setTasks: (tasks: Task[]) => void,
  toast: any
) => {
  setTasks(tasks.map(task => 
    task.id === taskId ? {...task, completed: true} : task
  ));
  
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    const currentBalance = parseFloat(localStorage.getItem("kfcBalance") || "0");
    const newBalance = currentBalance + task.reward;
    localStorage.setItem("kfcBalance", newBalance.toString());
    
    toast({
      title: "Task Completed!",
      description: `You earned ${task.reward} KFC coins!`,
    });
  }
};

export const handlePaymentTask = async (
  task: Task,
  dailyTaskAvailable: boolean,
  toast: any,
  onDailyTaskComplete?: () => void
) => {
  if (!task.tonAmount) return;

  const userId = localStorage.getItem("telegramUserId");
  if (!userId) {
    debugLog("❌ No user ID found in localStorage");
    toast({
      title: "Error",
      description: "User not found. Please refresh the page.",
      variant: "destructive"
    });
    return;
  }
  
  debugLog("Processing payment task", { userId, taskId: task.id, amount: task.tonAmount });
  
  // Check if user has connected wallet
  const walletAddress = localStorage.getItem("tonWalletAddress");
  if (!walletAddress) {
    debugLog("❌ No wallet address found in localStorage");
    toast({
      title: "Wallet Not Connected",
      description: "Please connect your TON wallet first to complete this task.",
      variant: "destructive"
    });
    return;
  }

  debugLog("Using wallet address", walletAddress);

  if (task.isDaily && !dailyTaskAvailable) {
    debugLog("❌ Daily task not available");
    toast({
      title: "Daily Task Unavailable",
      description: "This task can only be completed once every 24 hours.",
      variant: "destructive"
    });
    return;
  }

  try {
    debugLog("Creating payment record", { taskId: task.id, userId, walletAddress });
    
    // Ensure wallet is saved properly in database
    try {
      debugLog("Saving wallet connection for user", userId);
      
      // Save to wallets table
      const { error: walletSaveError } = await supabase.functions.invoke('database-helper', {
        body: {
          action: 'save_wallet_connection',
          params: {
            telegram_id: userId,
            wallet_address: walletAddress
          }
        }
      });
      
      if (walletSaveError) {
        debugLog("⚠️ Failed to save wallet connection", walletSaveError);
      } else {
        debugLog("✅ Wallet connection saved successfully");
      }

      // Also update users table
      const { error: userUpdateError } = await supabase
        .from("users")
        .upsert({ 
          id: userId, 
          links: walletAddress 
        }, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
        
      if (userUpdateError) {
        debugLog("⚠️ Failed to update user with wallet", userUpdateError);
      } else {
        debugLog("✅ User table updated with wallet address");
      }
      
    } catch (walletSaveError) {
      debugLog("⚠️ Wallet save error (non-critical)", walletSaveError);
    }
    
    // Record the payment before transaction
    try {
      const { data, error } = await supabase.functions.invoke('database-helper', {
        body: {
          action: 'insert_payment',
          params: {
            telegram_id: userId,
            wallet_address: walletAddress,
            amount_paid: task.tonAmount,
            task_type: task.id,
            transaction_hash: null
          }
        }
      });
      
      if (error) {
        debugLog("❌ Failed to record payment", error);
        throw new Error(`Failed to record payment: ${error.message}`);
      }
      
      debugLog("✅ Payment record created successfully", data);
    } catch (paymentError) {
      debugLog("❌ Payment record error", paymentError);
      toast({
        title: "Error",
        description: paymentError instanceof Error ? paymentError.message : "Failed to record payment. Please try again.",
        variant: "destructive"
      });
      return;
    }

    // Get TonConnect instance
    const tonConnectUI = window._tonConnectUI;

    if (!tonConnectUI || typeof tonConnectUI.sendTransaction !== 'function') {
      debugLog("❌ TonConnect UI not available", {
        tonConnectUIExists: !!tonConnectUI,
        sendTransactionExists: tonConnectUI ? typeof tonConnectUI.sendTransaction : 'n/a'
      });
      toast({
        title: "Wallet Connection Error",
        description: "Unable to connect to wallet. Please reconnect your wallet and try again.",
        variant: "destructive"
      });
      return;
    }

    // Send transaction using TonConnect
    try {
      debugLog(`Sending TON payment for ${task.tonAmount} TON using TonConnect`);
      
      const amountInNano = Math.floor(task.tonAmount * 1000000000);
      const comment = `task${task.id}`;
      
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // expires in 10 mins
        messages: [
          {
            address: tonWalletAddress,
            amount: amountInNano.toString(),
            payload: comment,
          }
        ]
      });
      
      debugLog("✅ TonConnect transaction initiated successfully");
      
      toast({
        title: "Payment Initiated",
        description: "Transaction sent! We're verifying your payment...",
      });
      
    } catch (txError) {
      debugLog("❌ Error initiating TonConnect transaction", txError);
      toast({
        title: "Transaction Error", 
        description: "Failed to send transaction. Please try again.",
        variant: "destructive"
      });
      return;
    }

    // Start transaction verification immediately
    setTimeout(async () => {
      const taskType = task.isDaily ? "daily_ton_payment" : undefined;
      debugLog("Starting transaction verification", { taskId: task.id, taskType, userId });
      
      const successful = await pollForTransactionVerification(
        userId,
        task.tonAmount,
        task.id,
        undefined, // No boost ID for regular payments
        taskType
      );
      
      if (successful) {
        // Special handling for fortune cookie task
        if (task.id === "6") {
          toast({
            title: "Fortune Cookies Added!",
            description: "10 fortune cookies have been added to your account.",
          });
        } else {
          toast({
            title: "Payment Confirmed!",
            description: `You earned ${task.reward} KFC coins!`,
          });
        }
        
        if (task.isDaily && onDailyTaskComplete) {
          onDailyTaskComplete();
        }
      }
    }, 2000); // Start verification after 2 seconds
  } catch (err) {
    debugLog("❌ Error in handlePaymentTask", err);
    toast({
      title: "Error",
      description: err instanceof Error ? err.message : "An unexpected error occurred",
      variant: "destructive"
    });
  }
};
