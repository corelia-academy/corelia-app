import { DotsThree } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The footer menus use the Dropdown List row (size small); only the popup width limits live here.
export const LEARN_MENU_CONTENT = "max-w-[calc(100vw-2rem)] overflow-x-hidden";

/** The "…" menu at the end of the lesson footer: move between lessons. */
export function LearnFooterMenu({
  previousLessonId,
  nextLessonId,
  onNavigate,
}: {
  previousLessonId: string | null;
  nextLessonId: string | null;
  onNavigate: (lessonId: string) => void;
}) {
  const { t } = useTranslation("courses");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="cta" hierarchy="tertiary" iconOnly size="small" aria-label={t("learning.moreActions")}>
            <DotsThree weight="bold" className="size-5" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent layout="multiple-list" side="top" align="end" className={cn("w-52", LEARN_MENU_CONTENT)}>
        <DropdownMenuList>
          <DropdownMenuItem size="small" disabled={!previousLessonId} onClick={() => previousLessonId && onNavigate(previousLessonId)}>
            <DropdownMenuItemContent>{t("learning.previous")}</DropdownMenuItemContent>
          </DropdownMenuItem>
          <DropdownMenuItem size="small" disabled={!nextLessonId} onClick={() => nextLessonId && onNavigate(nextLessonId)}>
            <DropdownMenuItemContent>{t("learning.next")}</DropdownMenuItemContent>
          </DropdownMenuItem>
        </DropdownMenuList>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
