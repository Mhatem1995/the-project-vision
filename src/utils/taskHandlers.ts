
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
  // --- BEGIN: Refactored to match boost payment flow exactly! ---
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
  
  debugLog("[PAYMENT TASK] Processing TON payment task", { 
    userId, 
    taskId: task.id, 
    amount: task.tonAmount,
    isDaily: task.isDaily,
    dailyTaskAvailable 
  });

  // Detect & use strictly telegram-wallet via localStorage (same as boost)
  const provider = localStorage.getItem("tonWalletProvider");
  const walletAddress = provider === "telegram-wallet"
    ? localStorage.getItem("tonWalletAddress")
    : null;

  if (!walletAddress) {
    debugLog("❌ No real telegram-wallet address found");
    toast({
      title: "Wallet Not Connected",
      description: "Please connect your Telegram Wallet via TonConnect to complete this task.",
      variant: "destructive"
    });
    return;
  }

  debugLog("[PAYMENT TASK] Using REAL connected wallet address (telegram-wallet)", walletAddress);

  if (task.isDaily && !dailyTaskAvailable) {
    debugLog("❌ Daily task not available");
    toast({
      title: "Daily Task Unavailable",
      description: "This task can only be completed once every 24 hours.",
      variant: "destructive"
    });
    return;
  }

  // Ensure user exists and record attempt in Supabase, as in boost
  try {
    debugLog("[PAYMENT TASK] Ensuring user exists and recording payment attempt", { userId, walletAddress });

    // Ensure user exists
    await supabase.functions.invoke('database-helper', {
      body: {
        action: 'ensure_user_exists',
        params: { user_id: userId, username: localStorage.getItem("telegramUserName") || "" }
      }
    });

    // Save wallet connection as per new flow (just in case)
    await supabase.functions.invoke('database-helper', {
      body: {
        action: 'save_wallet_connection',
        params: { telegram_id: userId, wallet_address: walletAddress }
      }
    });

    // Record the payment attempt (same as boost)
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

    // Find the global TonConnect UI from window for compatibility (same method as boost)
    let tonConnectUI = (window as any)._tonConnectUI;

    // Send payment with openTonPayment — exactly matches boost now!
    const comment = task.isDaily ? 'daily_ton_payment' : `task${task.id}`;
    openTonPayment(tonConnectUI, task.tonAmount, task.id, comment);

    debugLog("[PAYMENT TASK] ✅ TonConnect transaction initiated via openTonPayment.");

    // Wait 3s, then poll for verification (identical to boost)
    setTimeout(async () => {
      const taskType = task.isDaily ? "daily_ton_payment" : undefined;
      debugLog("[PAYMENT TASK] Starting transaction verification", { 
        taskId: task.id, 
        taskType, 
        userId,
        amount: task.tonAmount,
        wallet: walletAddress
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
  // --- END: Matched boost logic! ---
};
