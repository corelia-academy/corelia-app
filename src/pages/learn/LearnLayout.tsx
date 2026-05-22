import { Suspense, lazy, useEffect } from "react";
import { Outlet } from "react-router";
import { useCoraStore } from "@/stores/coraStore";

const GlobalCoraAssistant = lazy(() =>
  import("@/components/course-ai/GlobalCoraAssistant").then((m) => ({
    default: m.GlobalCoraAssistant,
  })),
);

export default function LearnLayout() {
  const setSidebarOpen = useCoraStore((s) => s.setSidebarOpen);

  useEffect(() => {
    setSidebarOpen(true);
    return () => setSidebarOpen(false);
  }, [setSidebarOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
      <Suspense fallback={null}>
        <GlobalCoraAssistant />
      </Suspense>
    </div>
  );
}
