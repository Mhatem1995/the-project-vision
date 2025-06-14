
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
    
    // Ensure wallet is saved properly in database
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
      } else {
        console.log("Wallet connection saved successfully");
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
      } else {
        console.log("User table updated with wallet address");
      }
      
    } catch (walletSaveError) {
      console.warn("Failed to save wallet connection (non-critical):", walletSaveError);
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
        console.error("Failed to record payment:", error);
        throw new Error(`Failed to record payment: ${error.message}`);
      }
      
      console.log("Payment record created successfully:", data);
    } catch (paymentError) {
      console.error("Failed to record payment:", paymentError);
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
      console.error("TonConnect UI not available");
      toast({
        title: "Wallet Connection Error",
        description: "Unable to connect to wallet. Please reconnect your wallet and try again.",
        variant: "destructive"
      });
      return;
    }

    // Send transaction using TonConnect
    try {
      console.log(`Sending TON payment for ${task.tonAmount} TON using TonConnect`);
      
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
      
      console.log("TonConnect transaction initiated successfully");
      
      toast({
        title: "Payment Initiated",
        description: "Transaction sent! We're verifying your payment...",
      });
      
    } catch (txError) {
      console.error("Error initiating TonConnect transaction:", txError);
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
    }, 2000); // Start verification after 2 seconds
  } catch (err) {
    console.error("Error in handlePaymentTask:", err);
    toast({
      title: "Error",
      description: err instanceof Error ? err.message : "An unexpected error occurred",
      variant: "destructive"
    });
  }
};
