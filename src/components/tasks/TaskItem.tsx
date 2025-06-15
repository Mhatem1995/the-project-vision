
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, Clock, Wallet } from "lucide-react";
import type { Task } from "@/types/task";

interface TaskItemProps {
  task: Task;
  dailyTaskAvailable: boolean;
  onCollabComplete: (taskId: string) => void;
  onPaymentSubmit?: (task: Task) => void;
  walletConnected?: boolean;
}

export const TaskItem = ({ 
  task, 
  dailyTaskAvailable, 
  onCollabComplete, 
  onPaymentSubmit,
  walletConnected = true
}: TaskItemProps) => {
  return (
    <div className="bg-card p-4 rounded-md shadow-sm border">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium">{task.title}</h3>
          <p className="text-sm text-muted-foreground">{task.description}</p>
          <p className="text-sm font-semibold mt-1">Reward: {task.reward} KFC</p>
          {task.tonAmount && (
            <p className="text-xs text-blue-600 mt-1">Amount: {task.tonAmount} TON</p>
          )}
        </div>
        
        <div className="flex flex-col gap-2 ml-4">
          {task.completed ? (
            <div className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded-full p-1 h-8 w-8 flex items-center justify-center">
              <Check className="h-4 w-4" />
            </div>
          ) : (
            <>
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
                    onClick={() => onCollabComplete(task.id)}
                  >
                    Confirm
                  </Button>
                </>
              ) : (
                <Button 
                  size="sm"
                  onClick={() => onPaymentSubmit && onPaymentSubmit(task)}
                  disabled={(task.isDaily && !dailyTaskAvailable) || !walletConnected || !onPaymentSubmit}
                >
                  {task.isDaily && !dailyTaskAvailable ? (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      Cooldown
                    </>
                  ) : !walletConnected ? (
                    <>
                      <Wallet className="mr-2 h-4 w-4" />
                      Connect Wallet
                    </>
                  ) : (
                    `Pay ${task.tonAmount} TON`
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
