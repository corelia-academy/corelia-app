import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CoraQuotaInfo } from "@/hooks/useCoraAI";
import type { LessonFormat } from "@/types/courses";

export type CoraSidebarMeta = {
  courseTitle?: string;
  courseId?: string | null;
  lessonTitle?: string | null;
  lessonId?: string | null;
  lessonFormat?: LessonFormat | null;
};

export type CoraSelectionAnchor = {
  x: number;
  y: number;
};

export type CoraExplainRequest = {
  text: string;
  lessonId: string | null;
  courseId: string | null;
  requestedAt: number;
};

type CoraStore = {
  quotaInfo: CoraQuotaInfo | null;
  setQuotaInfo: (info: CoraQuotaInfo | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  sidebarMeta: CoraSidebarMeta | null;
  setSidebarMeta: (meta: CoraSidebarMeta | null) => void;
  selectedText: string | null;
  selectionAnchor: CoraSelectionAnchor | null;
  setSelection: (text: string | null, anchor?: CoraSelectionAnchor | null) => void;
  pendingExplainRequest: CoraExplainRequest | null;
  requestExplain: (text: string, lessonId: string | null, courseId: string | null) => void;
  clearExplainRequest: () => void;
};

export const useCoraStore = create<CoraStore>()(
  persist(
    (set) => ({
      quotaInfo: null,
      setQuotaInfo: (info) => set({ quotaInfo: info }),
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      sidebarMeta: null,
      setSidebarMeta: (meta) => set({ sidebarMeta: meta }),
      selectedText: null,
      selectionAnchor: null,
      setSelection: (text, anchor = null) =>
        set({ selectedText: text, selectionAnchor: text ? anchor : null }),
      pendingExplainRequest: null,
      requestExplain: (text, lessonId, courseId) =>
        set({
          pendingExplainRequest: { text, lessonId, courseId, requestedAt: Date.now() },
          selectedText: null,
          selectionAnchor: null,
        }),
      clearExplainRequest: () => set({ pendingExplainRequest: null }),
    }),
    {
      name: "corelia.cora.quota",
      partialize: (s) => ({ quotaInfo: s.quotaInfo, sidebarOpen: s.sidebarOpen }),
    },
  ),
);
