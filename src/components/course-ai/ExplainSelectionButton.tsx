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
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium shadow-lg ring-1 ring-black/10 hover:opacity-90 transition-opacity"
      style={{
        position: "fixed",
        top,
        left,
        transform: "translateX(-50%)",
        zIndex: 50,
        backgroundColor: "#0F172A",
        color: "#FFFFFF",
      }}
    >
      <Sparkles size={14} aria-hidden />
      <span>
        {t("coraWidget.explainButtonLabel", { defaultValue: "Explain with Cora" })}
      </span>
    </button>,
    document.body,
  );
}
