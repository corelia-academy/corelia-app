import { GraduationCap, Medal, Star, Trophy } from "lucide-react";

import type { BadgeItem } from "./types";

export const CERT_PLACEHOLDER =
  "https://placehold.co/400x280/1e3a5f/fff?text=Ch%E1%BB%A9ng+ch%E1%BB%89";
export const BADGE_PLACEHOLDER =
  "https://placehold.co/160x160/2d1b4e/fff?text=Huy+hi%E1%BB%87u";

export const BADGE_STYLES: Array<
  Pick<BadgeItem, "icon" | "color" | "bgColor" | "borderColor" | "category">
> = [
  {
    icon: <Trophy className="size-7" aria-hidden />,
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
    category: "milestone",
  },
  {
    icon: <Star className="size-7" aria-hidden />,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    category: "learning",
  },
  {
    icon: <Medal className="size-7" aria-hidden />,
    color: "text-warning",
    bgColor: "bg-warning/10 dark:bg-sky-950/50",
    borderColor: "border-warning/20 dark:border-sky-700/50",
    category: "learning",
  },
  {
    icon: <GraduationCap className="size-7" aria-hidden />,
    color: "text-primary",
    bgColor: "bg-primary-muted",
    borderColor: "border-primary/20",
    category: "milestone",
  },
];
