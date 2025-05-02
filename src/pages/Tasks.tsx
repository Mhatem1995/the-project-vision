import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskItem } from "@/components/tasks/TaskItem";
import { handleCollabTask, handlePaymentTask } from "@/utils/taskHandlers";
import { supabase } from "@/integrations/supabase/client";
import { useTonConnect } from "@/providers/TonConnectProvider";
import type { Task } from "@/types/task";

const Tasks = () => {
  const { toast } = useToast();
  const { isConnected, walletAddress } = useTonConnect();
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      title: "Join KFC Telegram",
      description: "Join our main Telegram group",
      reward: 25,
      type: "collab",
      link: "https://t.me/KFCcoin",
      completed: false
    },
    {
      id: "2",
      title: "Follow Twitter",
      description: "Follow KFC coin on Twitter",
      reward: 15,
      type: "collab",
      link: "https://twitter.com/kfcmemecoin",
      completed: false
    },
    {
      id: "3",
      title: "Buy TON for KFC",
      description: "Send 0.1 TON to get 100 KFC",
      reward: 100,
      type: "payment",
      tonAmount: 0.1,
      completed: false
    },
    {
      id: "4",
      title: "Premium TON for KFC",
      description: "Send 1 TON to get 1500 KFC",
      reward: 1500,
      type: "payment",
      tonAmount: 1,
      completed: false
    },
    {
      id: "5",
      title: "Daily TON Task",
      description: "Send 10 TON to get 30000 KFC (Resets every 24 hours)",
      reward: 30000,
      type: "payment",
      tonAmount: 10,
      completed: false,
      isDaily: true
    },
    {
      id: "6",
      title: "Fortune Cookies Pack",
      description: "Buy 10 Fortune Cookies for 5 TON",
      reward: 10,
      type: "payment",
      tonAmount: 5,
      completed: false,
      isDaily: false
    }
  ]);
  
  const [dailyTaskAvailable, setDailyTaskAvailable] = useState(true);

  useEffect(() => {
    checkDailyTaskStatus();
  }, []);

  const checkDailyTaskStatus = async () => {
    const userId = localStorage.getItem("telegramUserId");
    if (!userId) return;

    const { data, error } = await supabase.rpc('can_do_daily_task', {
      p_user_id: userId,
      p_task_type: 'daily_ton_payment'
    });

    setDailyTaskAvailable(!!data);
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Tasks</h1>
        <p className="text-muted-foreground">Complete tasks to earn KFC</p>
      </div>
      
      {!isConnected && (
        <div className="bg-amber-100 border-amber-300 border p-4 rounded-md flex items-center w-full text-amber-800 mb-4">
          <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
          <p className="text-sm">Connect your TON wallet to complete payment tasks.</p>
        </div>
      )}
      
      <Tabs defaultValue="collab" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="collab">Collaborations</TabsTrigger>
          <TabsTrigger value="payment">TON Payment</TabsTrigger>
        </TabsList>
        
        <TabsContent value="collab" className="space-y-4 mt-4">
          {tasks
            .filter(task => task.type === "collab")
            .map(task => (
              <TaskItem
                key={task.id}
                task={task}
                dailyTaskAvailable={dailyTaskAvailable}
                onCollabComplete={(taskId) => handleCollabTask(taskId, tasks, setTasks, toast)}
                onPaymentSubmit={(task) => handlePaymentTask(task, dailyTaskAvailable, toast, checkDailyTaskStatus)}
              />
            ))
          }
        </TabsContent>
        
        <TabsContent value="payment" className="space-y-4 mt-4">
          {tasks
            .filter(task => task.type === "payment")
            .map(task => (
              <TaskItem
                key={task.id}
                task={task}
                dailyTaskAvailable={dailyTaskAvailable}
                onCollabComplete={(taskId) => handleCollabTask(taskId, tasks, setTasks, toast)}
                onPaymentSubmit={(task) => handlePaymentTask(task, dailyTaskAvailable, toast, checkDailyTaskStatus)}
              />
            ))
          }
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tasks;
