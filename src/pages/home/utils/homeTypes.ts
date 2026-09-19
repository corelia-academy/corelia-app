export type FocusCard = {
  id: string;
  title: string;
  format: "online" | "offline";
  progress: number;
  completed: boolean;
  nextStep: string;
  meta: string;
  action: string;
  thumbnailUrl?: string;
  lastAccessedAt?: string;
};

