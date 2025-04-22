
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  type: "collab" | "payment";
  link?: string;
  completed: boolean;
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
      completed: false
    },
    {
      id: "4",
      title: "Premium TON for KFC",
      description: "Send 1 TON to get 1500 KFC",
      reward: 1500,
      type: "payment",
      completed: false
    }
  ]);

  const tonWalletAddress = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C";

  const handleCollabTask = (taskId: string) => {
    // In a real app, this would verify if user actually completed the task
    // For now, we'll just mark it as complete and add reward
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Address Copied!",
        description: "TON wallet address copied to clipboard.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the address manually.",
        variant: "destructive",
      });
    }
  };

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
          {tasks.filter(task => task.type === "collab").map(task => (
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
                </div>
              )}
            </div>
          ))}
        </TabsContent>
        
        <TabsContent value="payment" className="space-y-4 mt-4">
          <div className="bg-card p-4 rounded-md shadow-sm mb-6">
            <h3 className="font-medium mb-2">TON Wallet Address</h3>
            <div className="flex items-center">
              <p className="text-sm bg-muted p-2 rounded-md mr-2 flex-1 truncate font-mono">
                {tonWalletAddress}
              </p>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(tonWalletAddress)}>
                Copy
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Send TON to this address and confirm below to receive KFC
            </p>
          </div>
          
          {tasks.filter(task => task.type === "payment").map(task => (
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
                <Button 
                  size="sm"
                  onClick={() => {
                    toast({
                      title: "Payment Pending",
                      description: "We'll verify your payment and credit your account soon.",
                    });
                  }}
                >
                  I've Paid
                </Button>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tasks;
