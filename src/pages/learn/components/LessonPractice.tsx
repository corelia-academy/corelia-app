import { MessageSquareText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown/Markdown";
import { useCoraStore } from "@/stores/coraStore";

export function LessonPractice({
  markdown,
  onDiscussWithCora,
}: {
  markdown: string;
  onDiscussWithCora?: () => void;
}) {
  const { t } = useTranslation("courses");
  const setSidebarOpen = useCoraStore((s) => s.setSidebarOpen);

  function handleDiscuss() {
    if (onDiscussWithCora) {
      onDiscussWithCora();
    } else {
      setSidebarOpen(true);
    }
  }

  return (
    <div className="mx-4 mb-8 overflow-hidden rounded-2xl border border-border-subtle shadow-card sm:mx-6">
      <div className="px-6 py-8 text-[15px] leading-[1.7]">
        <Markdown content={markdown} />
      </div>
      <div className="border-t border-border-subtle bg-surface-raised px-6 py-3 flex items-center justify-between gap-3">
        <p className="text-xs text-foreground-muted">
          {t("detail.learn.practice.hint")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={handleDiscuss}
        >
          <MessageSquareText className="size-3.5 mr-1.5" aria-hidden />
          {t("detail.learn.practice.askCora")}
        </Button>
      </div>
    </div>
  );
}
