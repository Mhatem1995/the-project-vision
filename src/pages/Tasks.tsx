import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const tonWalletAddress = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C";

interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  type: "collab" | "payment";
  link?: string;
  tonAmount?: number;
  completed: boolean;
  isDaily?: boolean;
}

const Tasks = () => {
  const { toast } = useToast();
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
      description: "Send 10 TON to get 10000 KFC (Resets every 24 hours)",
      reward: 10000,
      type: "payment",
      tonAmount: 10,
      completed: false,
      isDaily: true
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

  const handleCollabTask = (taskId: string) => {
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

  const handlePaymentTask = async (task: Task) => {
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
        setDailyTaskAvailable(false);
        checkDailyTaskStatus();
      }
    }
  };

  const renderTask = (task: Task) => (
    <div key={task.id} className="bg-card p-4 rounded-md shadow-sm flex items-start justify-between">
      <div>
        <h3 className="font-medium">{task.title}</h3>
        <p className="text-sm text-muted-foreground">{task.description}</p>
        <p className="text-sm font-semibold mt-1">Reward: {task.reward} KFC</p>
      </div>
      {task.completed ? (
        <div className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded-full p-1 h-8 w-8 flex items-center justify-center">
          <Check className="h-4 w-4" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {task.type === "collab" ? (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => task.link && window.open(task.link, '_blank')}
              >
                Open <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                size="sm"
                onClick={() => handleCollabTask(task.id)}
              >
                Confirm
              </Button>
            </>
          ) : (
            <Button 
              size="sm"
              onClick={() => handlePaymentTask(task)}
              disabled={task.isDaily && !dailyTaskAvailable}
            >
              {task.isDaily && !dailyTaskAvailable ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Cooldown
                </>
              ) : (
                `Pay ${task.tonAmount} TON`
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Tasks</h1>
        <p className="text-muted-foreground">Complete tasks to earn KFC</p>
      </div>
      
      <Tabs defaultValue="collab" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="collab">Collaborations</TabsTrigger>
          <TabsTrigger value="payment">TON Payment</TabsTrigger>
        </TabsList>
        
        <TabsContent value="collab" className="space-y-4 mt-4">
          {tasks.filter(task => task.type === "collab").map(renderTask)}
        </TabsContent>
        
        <TabsContent value="payment" className="space-y-4 mt-4">
          {tasks.filter(task => task.type === "payment").map(renderTask)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tasks;
