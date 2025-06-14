
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/types/task";
import { pollForTransactionVerification } from "@/utils/tonTransactionUtils";
import { tonWalletAddress } from "@/integrations/ton/TonConnectConfig";
import { TonConnectUI } from "@tonconnect/ui";

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
  
  console.log("handlePaymentTask: Processing payment for user:", userId);
  
  // Check if user has connected wallet - use fresh check from localStorage
  const walletAddress = localStorage.getItem("tonWalletAddress");
  if (!walletAddress) {
    toast({
      title: "Wallet Not Connected",
      description: "Please connect your TON wallet first to complete this task.",
      variant: "destructive"
    });
    return;
  }

  console.log("Using wallet address for payment:", walletAddress);

  if (task.isDaily && !dailyTaskAvailable) {
    toast({
      title: "Daily Task Unavailable",
      description: "This task can only be completed once every 24 hours.",
      variant: "destructive"
    });
    return;
  }

  try {
    console.log("Creating payment record for task:", task.id, "user:", userId, "wallet:", walletAddress);
    
    // First ensure wallet is saved properly in both tables
    try {
      console.log("Ensuring wallet is saved for user:", userId);
      
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
        console.warn("Failed to save wallet connection:", walletSaveError);
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
        console.warn("Failed to update user with wallet:", userUpdateError);
      }
      
    } catch (walletSaveError) {
      console.warn("Failed to save wallet connection (non-critical):", walletSaveError);
    }
    
    // Record the payment
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
        console.error("Failed to record payment:", error);
        throw new Error(`Failed to record payment: ${error.message}`);
      }
      
      console.log("Payment record created successfully with telegram_id:", userId, "data:", data);
    } catch (paymentError) {
      console.error("Failed to record payment:", paymentError);
      toast({
        title: "Error",
        description: paymentError instanceof Error ? paymentError.message : "Failed to record payment. Please try again.",
        variant: "destructive"
      });
      return;
    }

    // Get TonConnect instance from window
    let tonConnectUI: TonConnectUI | null = null;
    const tonConnectContext = window._tonConnectUI;
    
    if (tonConnectContext && typeof tonConnectContext === 'object') {
      tonConnectUI = tonConnectContext as TonConnectUI;
    }

    if (!tonConnectUI || typeof tonConnectUI.sendTransaction !== 'function') {
      console.error("TonConnect UI not available or missing sendTransaction method");
      toast({
        title: "Wallet Connection Error",
        description: "Unable to open payment wallet. Please try reconnecting your wallet.",
        variant: "destructive"
      });
      return;
    }

    // Use TonConnect to send transaction
    try {
      console.log(`Sending TON payment for ${task.tonAmount} TON using TonConnect`);
      
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // expires in 10 mins
        messages: [
          {
            address: tonWalletAddress,
            amount: (task.tonAmount * 1e9).toString(), // Convert to nanoTON
            payload: `task${task.id}`, // Task ID in payload for traceability
          }
        ]
      });
      
      console.log("TonConnect transaction initiated for task payment");
    } catch (txError) {
      console.error("Error initiating TonConnect transaction:", txError);
      toast({
        title: "Transaction Error",
        description: "Failed to open wallet for payment. Please try again.",
        variant: "destructive"
      });
      return;
    }

    // Start transaction verification process
    toast({
      title: "Payment Initiated",
      description: "Complete the payment in your wallet app. We'll verify your transaction automatically.",
    });
    
    // Wait a moment for user to complete payment then start polling
    setTimeout(async () => {
      const taskType = task.isDaily ? "daily_ton_payment" : undefined;
      console.log("Starting transaction verification for task:", task.id, "type:", taskType, "user:", userId);
      
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
    }, 3000);
  } catch (err) {
    console.error("Error in handlePaymentTask:", err);
    toast({
      title: "Error",
      description: err instanceof Error ? err.message : "An unexpected error occurred",
      variant: "destructive"
    });
  }
};
