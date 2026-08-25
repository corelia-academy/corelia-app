import { useTranslation } from "react-i18next";
import { Compass } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useLearningPaths } from "@/hooks/useLearningPaths";

import { LearningPathCard } from "./components/LearningPathCard";

export default function LearningPathPage() {
  const { t } = useTranslation("learningPath");

  const { paths, loading, error, remove } = useLearningPaths();

  return (
    <div className="container-app py-6 sm:py-8">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <Compass className="size-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("page.title", { defaultValue: "Lộ trình học cá nhân" })}
          </h1>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {t("page.savedTitle", { defaultValue: "Lộ trình đã lưu" })}
        </h2>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : paths.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-base p-8 text-center">
            <Compass className="mx-auto size-6 text-foreground-muted" aria-hidden />
            <p className="mt-2 text-sm font-medium text-foreground">
              {t("page.emptyTitle", { defaultValue: "Chưa có lộ trình nào." })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paths.map((path) => (
              <LearningPathCard key={path.id} path={path} onDelete={(id) => void remove(id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
