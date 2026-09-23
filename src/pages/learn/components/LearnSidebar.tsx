import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Tabs } from "@/components/ui/tabs";
import { CourseResources } from "@/components/courses/CourseResources";

export function LearnSidebar({ curriculum, resources }: { curriculum: ReactNode; resources: unknown }) {
  const { t } = useTranslation("courses");
  return (
    <Tabs.Root defaultValue="curriculum" className="flex h-full min-h-0 flex-col">
      <Tabs.List className="grid shrink-0 grid-cols-2 gap-1 border-b border-border-subtle p-2" aria-label={t("courseResources.sidebarTitle")}>
        <Tabs.Tab value="curriculum" className="min-w-0 whitespace-normal px-2 text-xs">{t("detail.learn.curriculumTitle")}</Tabs.Tab>
        <Tabs.Tab value="resources" className="min-w-0 whitespace-normal px-2 text-xs">{t("courseResources.title")}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="curriculum" className="min-h-0 flex-1 overflow-hidden">{curriculum}</Tabs.Panel>
      <Tabs.Panel value="resources" className="min-h-0 flex-1 overflow-y-auto p-3">
        <CourseResources resources={resources} showEmpty />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
