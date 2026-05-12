import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/layouts/PagePrimitives";

export function ContestDetailMainLayout({
  aboveHero,
  heroCard,
  leftColumn,
  rightColumn,
  afterGrid,
  twoColumnGrid,
}: {
  /** Shown at the top of the page (e.g. workspace access notice on the public surface). */
  aboveHero?: ReactNode;
  heroCard: ReactNode;
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  afterGrid?: ReactNode;
  /**
   * When true (typical public page): main column + right rail (~320–360px) from `xl` up.
   * Below `xl`, stacks as one column with the participant workspace rail first so mobile users see register/submit CTAs before long page content.
   * When false: stack columns so an empty manage rail does not leave a blank sidebar gap.
   */
  twoColumnGrid: boolean;
}) {
  return (
    <PageContainer width="default">
      {aboveHero ? <div className="mb-4 sm:mb-5">{aboveHero}</div> : null}
      <div className="mb-4">{heroCard}</div>
      <div
        className={cn(
          twoColumnGrid &&
            "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] xl:items-start xl:gap-8",
          !twoColumnGrid && "min-w-0 space-y-6 sm:space-y-8",
        )}
      >
        {twoColumnGrid ? (
          <>
            <div className="order-2 min-w-0 space-y-6 sm:space-y-8 xl:order-1">
              {leftColumn}
            </div>
            <div className="order-1 min-w-0 space-y-6 sm:space-y-8 xl:order-2">
              {rightColumn}
            </div>
          </>
        ) : (
          <>
            {leftColumn}
            {rightColumn}
          </>
        )}
      </div>
      {afterGrid ? <div className="mt-6">{afterGrid}</div> : null}
    </PageContainer>
  );
}
