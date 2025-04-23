
export interface Task {
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
