import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function TranslationSideBySidePanel({
  id,
  title,
  description,
  toolbar,
  primary,
  target,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  toolbar?: ReactNode;
  primary: ReactNode;
  target: ReactNode;
}) {
  return (
    <Card id={id}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-foreground-muted">{description}</p>
            ) : null}
          </div>
          {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
            {primary}
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
            {target}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

