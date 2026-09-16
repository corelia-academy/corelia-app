import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { NavLink } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ComponentShowcaseLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  embedded?: boolean;
};

type ShowcaseSectionProps = {
  title: string;
  criterion: string;
  children: ReactNode;
};

export function ComponentShowcaseLayout({
  title,
  description,
  children,
  embedded = false,
}: ComponentShowcaseLayoutProps) {
  const { resolvedTheme, setTheme } = useTheme();

  if (embedded) {
    return <>{children}</>;
  }

  return (
    <main className="container-app select-none space-y-8 py-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <NavLink
            to="/components"
            className="text-body-small text-foreground-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Back to components
          </NavLink>
          <div className="flex gap-2">
            {(["light", "dark"] as const).map((theme) => (
              <Button
                key={theme}
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={resolvedTheme === theme}
                onClick={() => setTheme(theme)}
              >
                {theme === "light" ? "Light" : "Dark"}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <h1 className="text-heading-large font-display">{title}</h1>
          <p className="mt-2 max-w-3xl text-body-medium text-foreground-muted">
            {description}
          </p>
        </div>
      </header>
      <div className="space-y-6">{children}</div>
    </main>
  );
}

export function ShowcaseSection({
  title,
  criterion,
  children,
}: ShowcaseSectionProps) {
  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-heading-small font-display">{title}</h2>
            <p className="mt-1 max-w-3xl text-body-small text-foreground-muted">
              {criterion}
            </p>
          </div>
          <Badge color="warning" size="small" variant="outline">
            Token review
          </Badge>
        </div>
        <Separator />
        <div className="space-y-5">{children}</div>
      </CardContent>
    </Card>
  );
}
