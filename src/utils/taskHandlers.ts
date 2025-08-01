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
  onDailyTaskComplete?: () => void,
  tonConnectUI?: any
) => {
  debugLog("[PAYMENT TASK] Button click fired", { task, dailyTaskAvailable });

  // Check if running in Telegram first
  const isInTelegram = !!(window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
  debugLog("[PAYMENT TASK] Telegram environment check", { isInTelegram });

  if (!isInTelegram) {
    debugLog("❌ App not running in Telegram - TON Space wallet unavailable");
    toast({
      title: "Telegram Required",
      description: "TON Space payments only work inside Telegram. Please open this bot in Telegram.",
      variant: "destructive"
    });
    return;
  }

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
    debugLog("❌ No user ID found in localStorage");
    toast({
      title: "Error", 
      description: "User not found. Please refresh the page.",
      variant: "destructive"
    });
    return;
  }

  debugLog("[PAYMENT TASK] Processing TON Space payment task", {
    userId, 
    taskId: task.id, 
    amount: task.tonAmount,
    isDaily: task.isDaily,
    dailyTaskAvailable 
  });

  // Get TonConnect UI first
  const _tonConnectUI = tonConnectUI || (window as any)._tonConnectUI;
  
  // Check for real TON Space wallet connection
  const provider = localStorage.getItem("tonWalletProvider");
  const walletAddress = localStorage.getItem("tonWalletAddress");

  debugLog("[PAYMENT TASK] Wallet status check", { provider, walletAddress, hasAddress: !!walletAddress });

  if (!walletAddress) {
    debugLog("❌ No wallet address found, trying to get from TonConnect");
    
    // Get the REAL wallet address directly from TonConnect - NO CONVERSION!
    if (_tonConnectUI && _tonConnectUI.wallet && _tonConnectUI.wallet.account?.address) {
      const realAddress = _tonConnectUI.wallet.account.address;
      debugLog("🔍 Getting REAL TON Space address directly:", realAddress);
      debugLog("🔍 Real address type:", typeof realAddress);
      debugLog("🔍 Real address length:", realAddress.length);
      
      // Store the REAL address exactly as provided by TON Space
      localStorage.setItem("tonWalletAddress", realAddress);
      localStorage.setItem("tonWalletProvider", "telegram-wallet");
      debugLog("✅ Stored REAL TON Space address:", realAddress);
    }
    
    // Check if we have a real wallet address stored
    const storedAddress = localStorage.getItem("tonWalletAddress");
    debugLog("📝 Final stored wallet address:", storedAddress);
    if (!storedAddress) {
      toast({
        title: "TON Space Wallet Required",
        description: "Please connect your Telegram TON Space wallet first.",
        variant: "destructive"
      });
      return;
    }
  }
  if (!_tonConnectUI) {
    debugLog("❌ TonConnect UI not available");
    toast({
      title: "TonConnect Not Available",
      description: "TonConnect UI not loaded. Please refresh and try again.",
      variant: "destructive"
    });
    return;
  }

  // Check if wallet is actually connected to TonConnect
  const isWalletConnected = _tonConnectUI.connected || _tonConnectUI.wallet;
  debugLog("[PAYMENT TASK] TonConnect connection status", { 
    isConnected: isWalletConnected,
    wallet: _tonConnectUI.wallet,
    connected: _tonConnectUI.connected 
  });

  if (!isWalletConnected) {
    debugLog("❌ TonConnect wallet not connected, opening modal");
    toast({
      title: "Connect TON Space Wallet",
      description: "Please connect your Telegram TON Space wallet to continue.",
      variant: "destructive"
    });
    _tonConnectUI.openModal();
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

    // REUSE boost payment logic: trigger modal & send
    const comment = task.isDaily ? "daily_ton_payment" : `task${task.id}`;
    debugLog("[PAYMENT TASK] Calling openTonPayment", { tonConnectUIExists: !!_tonConnectUI, amount: task.tonAmount, taskId: task.id, comment });
    openTonPayment(_tonConnectUI, task.tonAmount, task.id);

    debugLog("[PAYMENT TASK] ✅ TonConnect transaction initiated via openTonPayment.");

    // Wait for 3 seconds, then start polling for verification (same as boost)
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
