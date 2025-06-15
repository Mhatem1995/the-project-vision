
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/types/task";
import { pollForTransactionVerification } from "@/utils/tonTransactionUtils";
import { tonWalletAddress } from "@/integrations/ton/TonConnectConfig";

const debugLog = (message: string, data?: any) => {
  console.log(`🔍 [TASK DEBUG] ${message}`, data || "");
};

export const handleCollabTask = (
  taskId: string,
  tasks: Task[],
  setTasks: (tasks: Task[]) => void,
  toast: any
) => {
  debugLog("Handling collaboration task", { taskId });
  
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
  if (!task.tonAmount) {
    debugLog("❌ No TON amount specified for task");
    return;
  }

  const userId = localStorage.getItem("telegramUserId");
  if (!userId || !userId.startsWith("@")) {
    debugLog("❌ No valid Telegram user ID found", { userId });
    toast({
      title: "Error",
      description: "No valid Telegram user detected. Please refresh and try again.",
      variant: "destructive"
    });
    return;
  }
  
  debugLog("Processing payment task", { 
    userId, 
    taskId: task.id, 
    amount: task.tonAmount,
    isDaily: task.isDaily,
    dailyTaskAvailable 
  });
  
  const walletAddress = localStorage.getItem("tonWalletAddress");
  if (!walletAddress) {
    debugLog("❌ No wallet address found");
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
    debugLog("Ensuring user exists in database", { userId, walletAddress });
    
    // Ensure user exists
    const { data: userData, error: userError } = await supabase.functions.invoke('database-helper', {
      body: {
        action: 'ensure_user_exists',
        params: {
          user_id: userId,
          username: localStorage.getItem("telegramUserName") || ""
        }
      }
    });
    
    if (userError) {
      debugLog("❌ Error ensuring user exists", userError);
      throw new Error(`Failed to ensure user exists: ${userError.message}`);
    }
    
    debugLog("✅ User ensured in database", userData);
    
    // Save wallet connection
    const { data: walletData, error: walletError } = await supabase.functions.invoke('database-helper', {
      body: {
        action: 'save_wallet_connection',
        params: {
          telegram_id: userId,
          wallet_address: walletAddress
        }
      }
    });
    
    if (walletError) {
      debugLog("❌ Error saving wallet connection", walletError);
    } else {
      debugLog("✅ Wallet connection saved", walletData);
    }
    
    // Record the payment attempt
    const { data: paymentData, error: paymentError } = await supabase.functions.invoke('database-helper', {
      body: {
        action: 'insert_payment',
        params: {
          telegram_id: userId,
          wallet_address: walletAddress,
          amount_paid: task.tonAmount,
          task_type: task.isDaily ? 'daily_ton_payment' : task.id,
          transaction_hash: null
        }
      }
    });
    
    if (paymentError) {
      debugLog("❌ Error recording payment", paymentError);
    } else {
      debugLog("✅ Payment record created", paymentData);
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
      const comment = task.isDaily ? 'daily_ton_payment' : `task${task.id}`;
      
      debugLog("Transaction details", {
        address: tonWalletAddress,
        amountInNano,
        comment,
        originalAmount: task.tonAmount
      });
      
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
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

    // Start transaction verification
    setTimeout(async () => {
      const taskType = task.isDaily ? "daily_ton_payment" : undefined;
      debugLog("Starting transaction verification", { 
        taskId: task.id, 
        taskType, 
        userId,
        amount: task.tonAmount 
      });
      
      const successful = await pollForTransactionVerification(
        userId,
        task.tonAmount,
        task.id,
        undefined,
        taskType
      );
      
      if (successful) {
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
    }, 3000);
    
  } catch (err) {
    debugLog("❌ Error in handlePaymentTask", err);
    toast({
      title: "Error",
      description: err instanceof Error ? err.message : "An unexpected error occurred",
      variant: "destructive"
    });
  }
};
