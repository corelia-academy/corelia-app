import { useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import { useCoraStore } from "@/stores/coraStore";
import { shouldShowGlobalCoraAssistant } from "./visibility";
import { CoraAssistantCard } from "./GlobalCoraAssistant";
import { CourseAiTutorPanel } from "./CourseAiTutorPanel";

const COURSE_DETAIL_RE = /^\/courses\/[^/]+$/;
const LESSON_RE = /^\/learn\/.+$/;

export function CoraSidebarPanel({
  hideShellHeader,
  onRequestHide,
  variant = "floating",
}: {
  hideShellHeader?: boolean;
  onRequestHide?: () => void;
  variant?: "embedded" | "floating" | "inset";
}) {
  const { user } = useAuth();
  const { sidebarOpen, setSidebarOpen, sidebarMeta } = useCoraStore();
  const location = useLocation();

  const { pathname } = location;
  const isSupported = !!user && shouldShowGlobalCoraAssistant(pathname);
  const isCourseOrLesson = COURSE_DETAIL_RE.test(pathname) || LESSON_RE.test(pathname);
  const isOpen = sidebarOpen && isSupported;
  const handleRequestHide = onRequestHide ?? (() => setSidebarOpen(false));

  const content = isSupported && isCourseOrLesson && sidebarMeta?.courseTitle ? (
    <CourseAiTutorPanel
      courseTitle={sidebarMeta.courseTitle}
      courseId={sidebarMeta.courseId}
      lessonTitle={sidebarMeta.lessonTitle}
      lessonId={sidebarMeta.lessonId}
      lessonFormat={sidebarMeta.lessonFormat}
      className="h-full rounded-none border-0"
      hideShellHeader={hideShellHeader}
      onRequestHide={handleRequestHide}
    />
  ) : isSupported && !isCourseOrLesson ? (
    <CoraAssistantCard
      pathname={pathname}
      shellClassName="h-full rounded-none border-0"
      onRequestHide={handleRequestHide}
    />
  ) : null;

  if (variant === "embedded") {
    if (!isOpen || !content) return null;

    return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface-base">{content}</div>;
  }

  if (variant === "inset") {
    return (
      <aside
        className={cn(
          "hidden xl:flex flex-col shrink-0 border-l border-border-subtle",
          "h-full overflow-hidden",
          "transition-[width] duration-200 ease-in-out",
          isOpen ? "w-[360px]" : "w-0",
        )}
      >
        <div className="flex h-full w-[360px] flex-col">
          {content}
        </div>
      </aside>
    );
  }

  // floating
  return (
    <>
      {isOpen && (
        <div
          className="hidden xl:block fixed inset-0 z-30"
          onClick={handleRequestHide}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "hidden xl:flex flex-col",
          "fixed right-3 top-3 bottom-3 z-40 w-[360px]",
          "overflow-hidden rounded-xl border border-border-subtle shadow-2xl",
          "bg-surface-base",
          "transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-[calc(100%+0.75rem)]",
        )}
      >
        {content}
      </aside>
    </>
  );
}
