import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Wallet, AlertTriangle, Smartphone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskItem } from "@/components/tasks/TaskItem";
import { handleCollabTask, handlePaymentTask } from "@/utils/taskHandlers";
import { supabase } from "@/integrations/supabase/client";
import { useTonConnect } from "@/hooks/useTonConnect";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Task } from "@/types/task";

const Tasks = () => {
  const { toast } = useToast();
  const { isConnected, walletAddress, connect, tonConnectUI } = useTonConnect();
  
  // Check if running in Telegram
  const isInTelegram = !!(window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
  
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

    console.log("[TASKS-DEBUG] Checking daily task status for user:", userId);
    
    const { data, error } = await supabase.rpc('can_do_daily_task', {
      p_user_id: userId,
      p_task_type: 'daily_ton_payment'
    });

    if (error) {
      console.error("[TASKS-DEBUG] Error checking daily task:", error);
    } else {
      console.log("[TASKS-DEBUG] Daily task available:", data);
    }

    setDailyTaskAvailable(!!data);
  };

  const userId = localStorage.getItem("telegramUserId");
  console.log("[TASKS-DEBUG] Current user ID:", userId);
  console.log("[TASKS-DEBUG] Wallet connected:", isConnected);
  console.log("[TASKS-DEBUG] Wallet address:", walletAddress);

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Tasks</h1>
        <p className="text-muted-foreground">Complete tasks to earn KFC</p>
      </div>
      
      {/* Telegram Environment Check */}
      {!isInTelegram && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            <strong>Telegram Required!</strong> TON Space payments only work inside Telegram. 
            Please open this bot in Telegram to access payment tasks.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Wallet Connection Alert */}
      {isInTelegram && !isConnected && (
        <Alert className="border-amber-200 bg-amber-50">
          <Smartphone className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 space-y-3">
            <div>
              <strong>Connect TON Space Wallet</strong><br/>
              Connect your Telegram TON Space wallet to complete payment tasks.
              Your wallet address must start with "UQ" (v4R2 format).
            </div>
            <Button 
              onClick={connect} 
              size="sm" 
              variant="outline" 
              className="bg-amber-100 border-amber-300 hover:bg-amber-200"
            >
              <Wallet className="mr-2 h-4 w-4" /> Connect TON Space Wallet
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Wallet Connected Status */}
      {isInTelegram && isConnected && walletAddress && (
        <Alert className="border-green-200 bg-green-50">
          <Wallet className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            <strong>TON Space Connected!</strong><br/>
            <span className="text-xs font-mono">{walletAddress}</span>
            {walletAddress.startsWith('UQ') ? ' ✅ v4R2' : ' ⚠️ Check format'}
          </AlertDescription>
        </Alert>
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
                onPaymentSubmit={(task) =>
                  handlePaymentTask(task, dailyTaskAvailable, toast, checkDailyTaskStatus, tonConnectUI)
                }
                walletConnected={isConnected}
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
                onPaymentSubmit={
                  !isInTelegram || !isConnected
                    ? undefined
                    : (task) =>
                      handlePaymentTask(task, dailyTaskAvailable, toast, checkDailyTaskStatus, tonConnectUI)
                }
                walletConnected={isInTelegram && isConnected}
              />
            ))
          }
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tasks;
