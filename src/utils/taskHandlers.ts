
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/types/task";

export const tonWalletAddress = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C";

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
    
    // Ensure the ID is valid for database operations
    if (typeof userId !== 'string' || userId.length < 1) {
      toast({
        title: "Error",
        description: "Invalid user ID. Please refresh the app.",
        variant: "destructive"
      });
      return;
    }
    
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

    // Check if running in Telegram WebApp
    const isInTelegram = typeof window !== 'undefined' && 
                        window.Telegram?.WebApp &&
                        window.Telegram.WebApp.initData && 
                        window.Telegram.WebApp.initData.length > 0;

    if (isInTelegram) {
      console.log("Opening TON payment in Telegram");
      const paymentUrl = `ton://transfer/${tonWalletAddress}?amount=${task.tonAmount * 1000000000}`;
      window.Telegram.WebApp.openLink(paymentUrl);

      // Special handling for fortune cookie task
      if (task.id === "6") {
        console.log("Adding fortune cookies for user:", userId);
        const { error: cookieError } = await supabase.rpc('add_fortune_cookies', { 
          p_user_id: userId, 
          p_cookie_count: 10 
        });

        if (cookieError) {
          console.error("Failed to add fortune cookies:", cookieError);
          toast({
            title: "Error",
            description: "Failed to add fortune cookies",
            variant: "destructive"
          });
        }
      }

      if (task.isDaily) {
        console.log("Logging daily task completion");
        await supabase.from("daily_tasks").insert([
          {
            user_id: userId,
            task_type: "daily_ton_payment"
          }
        ]);
        onDailyTaskComplete?.();
      }
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
