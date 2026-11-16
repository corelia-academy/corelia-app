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

// The project's list menu has no plain action row, so this copies the row look of its checkbox rows.
// Shared with AskAiMenu so the two footer menus stay the same size.
export const LEARN_MENU_ITEM =
  "min-h-9 w-full cursor-pointer gap-lg rounded-xl px-lg py-md hover:bg-dropdown-hover focus:bg-dropdown-hover focus:text-dropdown-title [&_[data-slot=dropdown-menu-item-title]]:text-sm";
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
          <DropdownMenuItem className={LEARN_MENU_ITEM} disabled={!previousLessonId} onClick={() => previousLessonId && onNavigate(previousLessonId)}>
            <DropdownMenuItemContent>{t("learning.previous")}</DropdownMenuItemContent>
          </DropdownMenuItem>
          <DropdownMenuItem className={LEARN_MENU_ITEM} disabled={!nextLessonId} onClick={() => nextLessonId && onNavigate(nextLessonId)}>
            <DropdownMenuItemContent>{t("learning.next")}</DropdownMenuItemContent>
          </DropdownMenuItem>
        </DropdownMenuList>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
