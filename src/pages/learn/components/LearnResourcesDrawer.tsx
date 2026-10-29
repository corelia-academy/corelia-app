import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ArrowUpRight, List as ListIcon, X } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Action } from "@/components/ui/action";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CourseResourceIcon } from "@/components/courses/CourseResourceIcon";
import { visibleCourseResources } from "@/features/courses/courseResources";
import { groupResourcesBySection } from "@/features/learning/resourceGroups";
import type { CurriculumGroup } from "./LessonCurriculum";

/** Reveals the drawer content one piece at a time each time the drawer mounts open. */
function RevealOnMount() {
  const markerRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const popup = markerRef.current?.closest<HTMLElement>('[data-slot="sheet-content"]');
    if (!popup || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = popup.querySelectorAll("[data-reveal]");
    const tween = gsap.from(targets, {
      autoAlpha: 0,
      y: 14,
      duration: 0.38,
      ease: "power3.out",
      delay: 0.06,
      stagger: { each: 0.035, amount: 0.4 },
      clearProps: "opacity,visibility,transform",
    });
    return () => {
      tween.kill();
      gsap.set(targets, { clearProps: "opacity,visibility,transform" });
    };
  }, []);
  return <span ref={markerRef} hidden aria-hidden />;
}

export function LearnResourcesDrawer({ groups, courseResources }: { groups: CurriculumGroup[]; courseResources: unknown }) {
  const { t } = useTranslation(["courses", "common"]);
  const shared = visibleCourseResources(courseResources);
  const all = [
    ...(shared.length ? [{ id: "course", title: t("courseResources.title"), items: shared }] : []),
    ...groupResourcesBySection(groups),
  ];
  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="cta" hierarchy="secondary" size="small" className="max-sm:size-8 max-sm:px-0" trailingIcon={<ListIcon weight="duotone" aria-hidden />} />}>
        <span className="max-sm:sr-only">{t("learning.resources")}</span>
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false} initialFocus={(type) => type === "keyboard"} className="h-dvh min-h-0 w-[min(30rem,100vw)]! max-w-none! gap-2xl bg-background p-0 data-[side=right]:border-border">
        <SheetHeader className="shrink-0 gap-1.5 p-3xl pr-14">
          <SheetTitle data-reveal="" className="font-display text-heading-medium leading-[1.2] text-action-text">{t("learning.resources")}</SheetTitle>
          <SheetDescription data-reveal="" className="text-body-medium leading-[1.4] tracking-[0.02em] text-foreground-subtle">{t("learning.resourcesDrawerHint")}</SheetDescription>
        </SheetHeader>
        <RevealOnMount />
        <SheetClose className="absolute top-6 right-6 inline-flex size-5 cursor-pointer items-center justify-center rounded-sm text-foreground transition-colors after:absolute after:-inset-3 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <X className="size-5" aria-hidden />
          <span className="sr-only">{t("common:actions.close")}</span>
        </SheetClose>
        <div className="scrollbar-design min-h-0 flex-1 space-y-3xl overflow-y-auto px-3xl pb-3xl">
          {all.length ? all.map(group => (
            <section key={group.id}>
              <h3 data-reveal="" className="pb-md text-label-small leading-[1.4] text-foreground-subtle">{group.title}</h3>
              <ul className="space-y-md">
                {group.items.map((item, index) => (
                  <li key={`${item.url}:${index}`} data-reveal="" className="rounded-xl bg-[var(--neutral-800)]">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
