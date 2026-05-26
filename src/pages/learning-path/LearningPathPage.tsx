import { useTranslation } from "react-i18next";
import { Compass, Sparkles } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useLearningPaths } from "@/hooks/useLearningPaths";

import { LearningPathCard } from "./components/LearningPathCard";
import { LearningPathForm } from "./components/LearningPathForm";

export default function LearningPathPage() {
  const { t, i18n } = useTranslation("learningPath");
  const locale: "vi" | "en" = i18n.language?.startsWith("en") ? "en" : "vi";

  const { paths, loading, error, generating, generateError, generate, remove } =
    useLearningPaths();

  return (
    <div className="container-app py-6 sm:py-8">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <Compass className="size-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("page.title", { defaultValue: "Lộ trình học cá nhân" })}
          </h1>
        </div>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("page.subtitle", {
            defaultValue:
              "Nhập mục tiêu — Cora sẽ kết hợp courses và career tracks có sẵn để dựng lộ trình cho bạn.",
          })}
        </p>
      </header>

      <LearningPathForm
        generating={generating}
        error={generateError}
        onSubmit={(goal) => void generate({ goal, locale })}
      />

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
            <Sparkles className="mx-auto size-6 text-primary" aria-hidden />
            <p className="mt-2 text-sm font-medium text-foreground">
              {t("page.emptyTitle", { defaultValue: "Chưa có lộ trình nào." })}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              {t("page.emptyHint", {
                defaultValue: "Điền mục tiêu ở trên để Cora dựng giúp bạn lộ trình đầu tiên.",
              })}
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
