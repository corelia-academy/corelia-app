import illusAi from "@/assets/illustrations/illus-ai.svg";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { lessonText } from "@/features/learning/lessonCopy";
import { lessonBodyForAi, resolveAskAiAction, type AskAiTarget } from "@/features/learning/askAi";
import type { CourseLesson } from "@/types/courses";

const TARGETS: AskAiTarget[] = ["chatgpt", "claude", "gemini", "copy"];

export function AskAiMenu({ lesson, courseTitle }: { lesson: CourseLesson; courseTitle?: string | null }) {
  const { t } = useTranslation("courses");
  const choose = async (target: AskAiTarget) => {
    const action = resolveAskAiAction(target, { courseTitle, lessonTitle: lessonText(lesson.title), content: lessonBodyForAi(lesson) });
    if (action.kind !== "open") {
      try {
        await navigator.clipboard.writeText(action.text);
        toast.success(t("learning.askAi.copied"));
      } catch {
        toast.error(t("learning.askAi.copyFailed"));
        return;
      }
    }
    if (action.kind !== "copy") window.open(action.url, "_blank", "noopener,noreferrer");
  };
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button type="button" variant="cta" hierarchy="tertiary" size="small" className="px-3 text-[color:var(--accent-yellow-600)] dark:text-[color:var(--accent-yellow-300)]" trailingIcon={<img src={illusAi} alt="" aria-hidden className="size-5" />} />}>
      {t("learning.askAi.trigger")}
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="center" className="w-auto min-w-56">
      {TARGETS.map(target => <DropdownMenuItem key={target} onClick={() => void choose(target)}>{t(`learning.askAi.${target}`)}</DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
