
import { Progress } from "@/components/ui/progress";

interface MiningProgressProps {
  progress: number;
  timeRemaining: number | null;
}

const MiningProgress = ({ progress, timeRemaining }: MiningProgressProps) => {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex justify-between mb-2">
        <span>Mining Progress</span>
        {timeRemaining !== null && timeRemaining > 0 ? (
          <span>{formatTime(timeRemaining)}</span>
        ) : (
          <span className="text-primary font-bold">Ready to collect!</span>
        )}
      </div>
      <Progress value={progress} className="h-3" />
    </div>
  );
};

export default MiningProgress;
