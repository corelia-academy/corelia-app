import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { NavLink, type NavLinkProps } from "react-router";

import { cn } from "@/lib/utils";

type BackLinkProps = {
  to: NavLinkProps["to"];
  children: ReactNode;
  className?: string;
};

export function BackLink({ to, children, className }: BackLinkProps) {
  return (
    <NavLink
      to={to}
      className={cn(
        "inline-flex min-h-8 items-center gap-1 text-xs font-medium text-foreground hover:text-foreground-muted focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <ArrowLeft
        className="size-3 shrink-0"
        weight="duotone"
        aria-hidden
      />
      {children}
    </NavLink>
  );
}
