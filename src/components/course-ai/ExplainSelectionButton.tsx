import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { useCoraStore } from "@/stores/coraStore";

export function ExplainSelectionButton() {
  const { t } = useTranslation("common");
  const selectedText = useCoraStore((s) => s.selectedText);
  const selectionAnchor = useCoraStore((s) => s.selectionAnchor);
  const sidebarMeta = useCoraStore((s) => s.sidebarMeta);
  const setSidebarOpen = useCoraStore((s) => s.setSidebarOpen);
  const requestExplain = useCoraStore((s) => s.requestExplain);
  const setSelection = useCoraStore((s) => s.setSelection);

  useEffect(() => {
    if (!selectedText) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(null, null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedText, setSelection]);

  if (!selectedText || !selectionAnchor) return null;

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    requestExplain(
      selectedText,
      sidebarMeta?.lessonId ?? null,
      sidebarMeta?.courseId ?? null,
    );
    setSidebarOpen(true);
    // Clear native selection
    window.getSelection()?.removeAllRanges();
  };

  const top = Math.max(8, selectionAnchor.y - 44);
  const left = selectionAnchor.x;

  return createPortal(
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={handleClick}
      className="fixed z-50 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 py-1.5 text-xs font-medium shadow-card hover:opacity-90 transition-opacity"
      style={{ top, left }}
    >
      <Sparkles className="w-3.5 h-3.5" aria-hidden />
      {t("coraWidget.explainButtonLabel", { defaultValue: "Explain with Cora" })}
    </button>,
    document.body,
  );
}
