import type { Course } from "@/types/courses";

import type { FocusCard } from "../utils/homeTypes";
import { DashboardAiAssistantPanel } from "./DashboardAiAssistantPanel";

export function HomeSidebarAuthenticated({
  focusCards,
  courseCatalog,
}: {
  focusCards: FocusCard[];
  courseCatalog: Course[];
}) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
      <DashboardAiAssistantPanel
        focusCards={focusCards}
        courseCatalog={courseCatalog}
      />
    </aside>
  );
}
