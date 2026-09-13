import type { ReactNode } from "react";

import { Tag } from "@/components/ui/tag";

export function SkillTag({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag type="label" size="large" className={className}>
      {children}
    </Tag>
  );
}
