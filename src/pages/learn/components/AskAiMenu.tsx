import illusAi from "@/assets/illustrations/illus-ai.svg";
import { useTranslation } from "react-i18next";
import { ArrowSquareOut, Copy } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuItemContent, DropdownMenuList, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LEARN_MENU_CONTENT, LEARN_MENU_ITEM } from "./LearnFooterMenu";
import { lessonText } from "@/features/learning/lessonCopy";
import { lessonBodyForAi, resolveAskAiAction, type AskAiTarget } from "@/features/learning/askAi";
import type { CourseLesson } from "@/types/courses";

const TARGETS: AskAiTarget[] = ["chatgpt", "claude", "gemini", "copy"];

export function AskAiMenu({ lesson, courseTitle, compact = false }: { lesson: CourseLesson; courseTitle?: string | null; compact?: boolean }) {
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
    <DropdownMenuTrigger render={<Button type="button" variant="cta" hierarchy="tertiary" size="small" aria-label={compact ? t("learning.askAi.trigger") : undefined} className="px-3 text-[color:var(--accent-yellow-600)] dark:text-[color:var(--accent-yellow-300)]" trailingIcon={<img src={illusAi} alt="" aria-hidden className="size-5" />} />}>
      {compact
        ? <><span className="max-sm:hidden">{t("learning.askAi.trigger")}</span><span className="sm:hidden">{t("learning.askAi.triggerShort")}</span></>
        : t("learning.askAi.trigger")}
    </DropdownMenuTrigger>
    <DropdownMenuContent layout="multiple-list" side="top" align="center" className={cn("w-auto min-w-52", LEARN_MENU_CONTENT)}>
      <DropdownMenuList>
        {TARGETS.map(target => (
          <DropdownMenuItem key={target} className={LEARN_MENU_ITEM} onClick={() => void choose(target)}>
            <DropdownMenuItemContent trailingIcon={target === "copy" ? <Copy weight="duotone" aria-hidden /> : <ArrowSquareOut weight="duotone" aria-hidden />}>
              {t(`learning.askAi.${target}`)}
            </DropdownMenuItemContent>
          </DropdownMenuItem>
        ))}
      </DropdownMenuList>
    </DropdownMenuContent>
  </DropdownMenu>;
}
