export type FocusCard = {
  id: string;
  title: string;
  format: "online" | "offline";
  progress: number;
  nextStep: string;
  meta: string;
  action: string;
  thumbnailUrl?: string;
  lastAccessedAt?: string;
};

export type PinnedProgramCard = {
  id: string;
  badge: string;
  title: string;
  description: string;
  to: string;
  cta: string;
  meta: string;
};

