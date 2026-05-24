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

type CoraStore = {
  quotaInfo: CoraQuotaInfo | null;
  setQuotaInfo: (info: CoraQuotaInfo | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  sidebarMeta: CoraSidebarMeta | null;
  setSidebarMeta: (meta: CoraSidebarMeta | null) => void;
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
    }),
    {
      name: "corelia.cora.quota",
      partialize: (s) => ({ quotaInfo: s.quotaInfo, sidebarOpen: s.sidebarOpen }),
    },
  ),
);
