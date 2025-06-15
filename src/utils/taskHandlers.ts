import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/types/task";
import { pollForTransactionVerification, openTonPayment } from "@/utils/tonTransactionUtils";
import { getConnectedWalletAddress } from "@/integrations/ton/TonConnectConfig";

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
  if (!userId) {
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
  
  // Get the real connected wallet address using the improved getter
  const walletAddress = getConnectedWalletAddress();
  if (!walletAddress) {
    debugLog("❌ No real wallet address found");
    toast({
      title: "Wallet Not Connected",
      description: "Please connect your real TON wallet first to complete this task.",
      variant: "destructive"
    });
    return;
  }

  debugLog("Using REAL connected wallet address", walletAddress);

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
    debugLog("Ensuring user exists and recording payment attempt in database", { userId, walletAddress });
    
    // Ensure user exists
    await supabase.functions.invoke('database-helper', {
      body: {
        action: 'ensure_user_exists',
        params: { user_id: userId, username: localStorage.getItem("telegramUserName") || "" }
      }
    });
    
    // Save wallet connection with REAL wallet address
    await supabase.functions.invoke('database-helper', {
      body: {
        action: 'save_wallet_connection',
        params: { telegram_id: userId, wallet_address: walletAddress }
      }
    });
    
    // Record the payment attempt with REAL wallet address
    await supabase.functions.invoke('database-helper', {
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

    // REFACTORED: Use the centralized openTonPayment function for correctness
    const comment = task.isDaily ? 'daily_ton_payment' : `task${task.id}`;
    openTonPayment(task.tonAmount, task.id, comment);
    
    debugLog("✅ TonConnect transaction initiated via openTonPayment.");

    // Start transaction verification
    setTimeout(async () => {
      const taskType = task.isDaily ? "daily_ton_payment" : undefined;
      debugLog("Starting transaction verification for REAL wallet", { 
        taskId: task.id, 
        taskType, 
        userId,
        amount: task.tonAmount,
        realWallet: walletAddress
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
