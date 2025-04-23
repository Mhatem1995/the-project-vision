
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

  const { data, error } = await supabase.from("mining_boosts").insert([
    {
      user_id: userId,
      multiplier: 1,
      price: task.tonAmount,
      duration: 0,
      status: "pending",
    },
  ]).select().maybeSingle();

  if (error || !data) {
    toast({
      title: "Error",
      description: "Failed to create payment record",
      variant: "destructive"
    });
    return;
  }

  if (window.Telegram?.WebApp) {
    const paymentUrl = `ton://transfer/${tonWalletAddress}?amount=${task.tonAmount * 1000000000}`;
    window.Telegram.WebApp.openLink(paymentUrl);

    if (task.isDaily) {
      await supabase.from("daily_tasks").insert([
        {
          user_id: userId,
          task_type: "daily_ton_payment"
        }
      ]);
      onDailyTaskComplete?.();
    }
  }
};
