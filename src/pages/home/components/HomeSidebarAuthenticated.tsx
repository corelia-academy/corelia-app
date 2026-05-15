import { Suspense, lazy } from "react";
import type { Course } from "@/types/courses";

import type { FocusCard } from "../utils/homeTypes";

const DashboardAiAssistantPanel = lazy(() =>
  import("./DashboardAiAssistantPanel").then((module) => ({
    default: module.DashboardAiAssistantPanel,
  })),
);

export function HomeSidebarAuthenticated({
  focusCards,
  courseCatalog,
}: {
  focusCards: FocusCard[];
  courseCatalog: Course[];
}) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
      <Suspense fallback={null}>
        <DashboardAiAssistantPanel
          focusCards={focusCards}
          courseCatalog={courseCatalog}
        />
      </Suspense>
    </aside>
  );
}
