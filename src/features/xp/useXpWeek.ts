import { useEffect, useState } from "react";
import { xpWeekStart } from "@/lib/xpRanks";

/** Re-key the weekly query at UTC rollover, including after a sleeping tab resumes. */
export function useXpWeek() {
  const [week, setWeek] = useState(() => xpWeekStart());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      clearTimeout(timer);
      const current = xpWeekStart();
      setWeek(current);
      const next = new Date(current).getTime() + 7 * 86_400_000;
      timer = setTimeout(sync, Math.max(1, next - Date.now()));
    };
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return week;
}
