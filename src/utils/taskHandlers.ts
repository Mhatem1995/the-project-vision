
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/types/task";
import { tonWalletAddress } from "@/integrations/ton/TonConnectConfig";

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
    toast({
      title: "Error",
      description: "User not found. Please refresh the page.",
      variant: "destructive"
    });
    return;
  }
  
  // Check if user has connected wallet
  const walletAddress = localStorage.getItem("tonWalletAddress");
  if (!walletAddress) {
    toast({
      title: "Wallet Not Connected",
      description: "Please connect your TON wallet first to complete this task.",
      variant: "destructive"
    });
    return;
  }

  if (task.isDaily && !dailyTaskAvailable) {
    toast({
      title: "Daily Task Unavailable",
      description: "This task can only be completed once every 24 hours.",
      variant: "destructive"
    });
    return;
  }

  try {
    console.log("Creating payment record for task:", task.id, "user:", userId);
    
    // Create mining boost record
    const { data, error } = await supabase.from("mining_boosts").insert([
      {
        user_id: userId,
        multiplier: 1,
        price: task.tonAmount,
        duration: 0,
        status: "pending",
      },
    ]).select().maybeSingle();

    if (error) {
      console.error("Error creating payment record:", error);
      toast({
        title: "Error",
        description: "Failed to create payment record: " + error.message,
        variant: "destructive"
      });
      return;
    }

    if (!data) {
      toast({
        title: "Error",
        description: "Failed to create payment record - no data returned",
        variant: "destructive"
      });
      return;
    }

    // Get Telegram WebApp detection for apps running in Telegram
    const isInTelegram = typeof window !== 'undefined' && 
                        Boolean(window.Telegram?.WebApp?.initData);

    if (isInTelegram) {
      console.log("Opening TON payment in Telegram");
      const paymentUrl = `ton://transfer/${tonWalletAddress}?amount=${task.tonAmount * 1000000000}`;
      window.Telegram.WebApp.openLink(paymentUrl);

      // Start transaction verification process
      toast({
        title: "Payment Initiated",
        description: "Verifying your payment, please wait...",
      });
      
      // Wait a moment for user to complete payment
      setTimeout(async () => {
        await verifyPayment(userId, task, data.id, toast, onDailyTaskComplete);
      }, 15000);
    } else {
      toast({
        title: "Error",
        description: "Please open this app in Telegram to make payments",
        variant: "destructive"
      });
    }
  } catch (err) {
    console.error("Error in handlePaymentTask:", err);
    toast({
      title: "Error",
      description: "An unexpected error occurred",
      variant: "destructive"
    });
  }
};

const verifyPayment = async (
  userId: string, 
  task: Task, 
  boostId: string, 
  toast: any, 
  onDailyTaskComplete?: () => void
) => {
  if (!task.tonAmount) return;
  
  try {
    const taskType = task.isDaily ? "daily_ton_payment" : undefined;
    
    // Call our verification edge function
    const { data, error } = await supabase.functions.invoke('verify-ton-payment', {
      body: { 
        userId,
        amount: task.tonAmount,
        taskId: task.id,
        boostId,
        taskType
      }
    });
    
    if (error || !data?.success) {
      console.error("Payment verification failed:", error || data);
      toast({
        title: "Payment Not Detected",
        description: "We couldn't verify your payment. If you've sent the TON, please wait a minute and try again.",
        variant: "destructive"
      });
      return;
    }
    
    console.log("Payment verified:", data);
    
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
    
  } catch (err) {
    console.error("Error verifying payment:", err);
    toast({
      title: "Verification Error",
      description: "Failed to verify your payment. Please try again later.",
      variant: "destructive"
    });
  }
};
