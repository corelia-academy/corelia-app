import type { ReactNode } from "react";

export function LearnSidebar({ curriculum }: { curriculum: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">{curriculum}</div>
    </div>
  );
}
