import { useCallback, useEffect, useRef } from "react";

import { useCoraStore } from "@/stores/coraStore";

type Props = {
  children: React.ReactNode;
  className?: string;
  lessonId: string | null;
};

const MIN_SELECTION_LENGTH = 8;
const MAX_SELECTION_LENGTH = 2000;

export function SelectableLessonContent({ children, className, lessonId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setSelection = useCoraStore((s) => s.setSelection);
  const currentSelected = useCoraStore((s) => s.selectedText);

  const handleSelectionChange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      if (currentSelected) setSelection(null, null);
      return;
    }
    const text = selection.toString().trim();
    if (text.length < MIN_SELECTION_LENGTH) {
      if (currentSelected) setSelection(null, null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      return;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const anchor = {
      x: rect.left + rect.width / 2 + window.scrollX,
      y: rect.top + window.scrollY,
    };
    setSelection(text.slice(0, MAX_SELECTION_LENGTH), anchor);
  }, [currentSelected, setSelection]);

  useEffect(() => {
    return () => {
      setSelection(null, null);
    };
  }, [lessonId, setSelection]);

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseUp={handleSelectionChange}
      onTouchEnd={handleSelectionChange}
      onKeyUp={(event) => {
        if (event.shiftKey) handleSelectionChange();
      }}
    >
      {children}
    </div>
  );
}
