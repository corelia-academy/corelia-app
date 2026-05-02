import { NavLink } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layouts/PagePrimitives";

export function ContestDetailMainLayout({
  showBackLink,
  isManageView,
  translate,
  leftColumn,
  rightColumn,
  afterGrid,
}: {
  showBackLink: boolean;
  isManageView: boolean;
  translate: (key: string, options?: Record<string, unknown>) => string;
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  afterGrid?: ReactNode;
}) {
  return (
    <PageContainer>
      {showBackLink ? (
        <div className="mb-4">
          <Button
            render={
              <NavLink to={isManageView ? "/admin/contests" : "/contests"} />
            }
            nativeButton={false}
            variant="ghost"
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {isManageView
              ? translate("workspace.manage.backToContests")
              : translate("detail.hero.backToContests")}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.9fr)]">
        <div className="min-w-0 space-y-4">{leftColumn}</div>
        <div className="min-w-0 space-y-4">{rightColumn}</div>
      </div>
      {afterGrid}
    </PageContainer>
  );
}
