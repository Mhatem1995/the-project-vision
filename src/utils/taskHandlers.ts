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
  debugLog("[PAYMENT TASK] Button click fired", { task, dailyTaskAvailable });

  if (!task.tonAmount) {
    debugLog("❌ No TON amount specified for task");
    toast({
      title: "Error",
      description: "No TON amount specified for this task.",
      variant: "destructive"
    });
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
    debugLog("❌ No real telegram-wallet address found in localStorage.", { provider, walletAddress });
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

  try {
    debugLog("[PAYMENT TASK] Ensuring user exists and recording payment attempt", {
      userId,
      walletAddress
    });

    // Ensure user exists in database
    await supabase.functions.invoke('database-helper', {
      body: {
        action: 'ensure_user_exists',
        params: { user_id: userId, username: localStorage.getItem("telegramUserName") || "" }
      }
    });

    // Save wallet connection as per new flow
    await supabase.functions.invoke('database-helper', {
      body: {
        action: 'save_wallet_connection',
        params: { telegram_id: userId, wallet_address: walletAddress }
      }
    });

    // Record the payment attempt
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

    // Ensure TonConnectUI is available globally
    let tonConnectUI = (window as any)._tonConnectUI;
    if (!tonConnectUI) {
      debugLog("❌ _tonConnectUI not found on window!", { windowKeys: Object.keys(window) });
      toast({
        title: "TonConnect Not Available",
        description: "TonConnect UI not loaded. Please refresh and try again after connecting your wallet.",
        variant: "destructive"
      });
      return;
    }

    // Send payment via TonConnect (identical to boosts)
    const comment = task.isDaily ? "daily_ton_payment" : `task${task.id}`;
    debugLog("[PAYMENT TASK] Calling openTonPayment", { tonConnectUIExists: !!tonConnectUI, amount: task.tonAmount, taskId: task.id, comment });

    openTonPayment(tonConnectUI, task.tonAmount, task.id, comment);

    debugLog("[PAYMENT TASK] ✅ TonConnect transaction initiated via openTonPayment.");

    // Wait for 3 seconds, then start polling for verification EXACTLY like boost
    setTimeout(async () => {
      // For daily we pass taskType; otherwise leave undefined to mimic boost flow
      const taskType = task.isDaily ? "daily_ton_payment" : undefined;
      debugLog("[PAYMENT TASK] Starting transaction verification poll", {
        taskId: task.id,
        userId,
        amount: task.tonAmount,
        wallet: walletAddress,
        taskType
      });

      const successful = await pollForTransactionVerification(
        userId,
        task.tonAmount,
        task.id,
        undefined,
        taskType
      );

      if (successful) {
        // Notify user, match boost toast style
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
      } else {
        debugLog("[PAYMENT TASK] ❌ Transaction verification failed after polling.", { userId, task });
        toast({
          title: "Payment Not Found",
          description: "We couldn't verify your payment. Please double-check and contact support if the issue persists.",
          variant: "destructive"
        });
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
