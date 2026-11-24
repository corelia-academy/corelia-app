import { useState } from "react";
import { ArrowUpRight, List as ListIcon } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Action } from "@/components/ui/action";
import { Button } from "@/components/ui/button";
import { SideDrawer } from "@/components/ui/side-drawer";
import { CourseResourceIcon } from "@/components/courses/CourseResourceIcon";
import { visibleCourseResources } from "@/features/courses/courseResources";
import { groupResourcesBySection } from "@/features/learning/resourceGroups";
import type { CurriculumGroup } from "./LessonCurriculum";

export function LearnResourcesDrawer({ groups, courseResources }: { groups: CurriculumGroup[]; courseResources: unknown }) {
  const { t } = useTranslation(["courses", "common"]);
  const [open, setOpen] = useState(false);
  const shared = visibleCourseResources(courseResources);
  const all = [
    ...(shared.length ? [{ id: "course", title: t("courseResources.title"), items: shared }] : []),
    ...groupResourcesBySection(groups),
  ];
  return (
    <>
      <Button
        type="button"
        variant="cta"
        hierarchy="secondary"
        size="small"
        className="max-sm:size-8 max-sm:px-0"
        trailingIcon={<ListIcon weight="duotone" aria-hidden />}
        onClick={() => setOpen(true)}
      >
        <span className="max-sm:sr-only">{t("learning.resources")}</span>
      </Button>
      <SideDrawer
        open={open}
        onOpenChange={setOpen}
        size="30vw"
        title={t("learning.resources")}
        description={t("learning.resourcesDrawerHint")}
        closeLabel={t("common:actions.close")}
        initialFocus={(type) => type === "keyboard"}
      >
        {all.length ? all.map(group => (
          <section key={group.id}>
            <h3 data-reveal="" className="pb-md text-label-small leading-[1.4] text-foreground-subtle">{group.title}</h3>
            <ul className="flex flex-col gap-md">
              {group.items.map((item, index) => (
                <li key={`${item.url}:${index}`} data-reveal="" className="rounded-xl bg-resource-item-surface">
                  <Action
                    size="large"
                    nativeButton={false}
                    render={<a href={item.url} target="_blank" rel="noopener noreferrer" />}
                    icon={<CourseResourceIcon icon={item.icon} />}
                    label={item.title}
                    trailingGroup={<ArrowUpRight className="size-4" weight="duotone" aria-hidden />}
                  />
                </li>
              ))}
            </ul>
          </section>
        )) : <p className="text-body-small text-foreground-subtle">{t("courseResources.empty")}</p>}
      </SideDrawer>
    </>
  );
}
