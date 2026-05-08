import type { ReactNode } from "react";
import { PageContainer } from "@/components/layouts/PagePrimitives";
import { cn } from "@/lib/utils";

export function ContestDetailMainLayout({
  isManageView,
  heroCard,
  leftColumn,
  rightColumn,
  afterGrid,
}: {
  isManageView: boolean;
  heroCard: ReactNode;
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  afterGrid?: ReactNode;
}) {
  return (
    <PageContainer width="default">
      <div className="mb-6 sm:mb-8">{heroCard}</div>
      <div
        className={cn(
          "gap-6",
          isManageView
            ? "flex flex-col"
            : "grid xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] xl:gap-8",
        )}
      >
        <div
          className={cn(
            "min-w-0",
            isManageView ? "space-y-6" : "space-y-6 sm:space-y-8",
          )}
        >
          {leftColumn}
        </div>
        {isManageView ? (
          rightColumn ? (
            <div className="min-w-0 space-y-6 sm:space-y-8">{rightColumn}</div>
          ) : null
        ) : (
          <div className="min-w-0 space-y-6 sm:space-y-8">{rightColumn}</div>
        )}
      </div>
      {afterGrid ? <div className="mt-6">{afterGrid}</div> : null}
    </PageContainer>
  );
}
