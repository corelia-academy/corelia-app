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
        "inline-flex min-h-8 items-center gap-2 rounded-sm px-1 py-1.5 text-sm font-semibold text-foreground hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <ArrowLeft
        className="size-4 shrink-0"
        weight="duotone"
        aria-hidden
      />
      {children}
    </NavLink>
  );
}
