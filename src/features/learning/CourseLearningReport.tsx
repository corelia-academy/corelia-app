import { lessonText } from "@/features/learning/lessonCopy";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { learningReport } from "@/lib/learning";
import { useAuth } from "@/stores/authStore";
import { useLearningTranslation } from "./useLearningTranslation";

/** Mounted inside the existing students panel, under its course permission guard. */
export function CourseLearningReport({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const { t } = useLearningTranslation();
  const query = useQuery({
    queryKey: ["courses", "instructor-editor", "learning-report", courseId, user?.id],
    queryFn: () => learningReport(courseId),
    enabled: Boolean(user),
    refetchOnWindowFocus: true,
  });
  return <section className="mb-6 space-y-4" aria-label={t("learning.reports")}>
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-medium">{t("learning.reports")}</h3>
      <Button type="button" variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("learning.refresh")}</Button>
    </div>
    {query.isPending ? <p role="status">{t("learning.loading")}</p> : query.isError ? <p role="alert">{t("learning.loadError")}</p> : <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["enrolled", "started", "completed", "submitted", "approved"] as const).map(metric => <div key={metric} className="rounded-lg border border-border p-3"><dt className="text-sm text-foreground-muted">{t(`learning.${metric}`)}</dt><dd className="mt-1 text-xl font-semibold">{query.data[metric]}</dd></div>)}
      </dl>
      <p className="text-sm text-foreground-muted">{t("learning.reportHint")}</p>
      <div className="overflow-x-auto rounded-lg border border-border" role="region" aria-label={t("learning.reports")} tabIndex={0}>
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised"><tr>{["title", "format", "started", "completed", "dropoff", "quizPassRate"].map(key => <th scope="col" key={key} className="px-3 py-2">{t(`learning.${key}`)}</th>)}</tr></thead>
          <tbody>{!query.data.lessons.length && <tr><td colSpan={6} className="px-3 py-4 text-foreground-muted">{t("learning.empty")}</td></tr>}{query.data.lessons.map(lesson => <tr key={lesson.id} className="border-t border-border">
            <th scope="row" className="px-3 py-2 font-medium">{lessonText(lesson.title)}</th>
            <td className="px-3 py-2">{t(`learning.formats.${lesson.format}`)}</td>
            <td className="px-3 py-2">{lesson.started}</td>
            <td className="px-3 py-2">{lesson.completed}</td>
            <td className="px-3 py-2">{lesson.dropoff}</td>
            <td className="whitespace-nowrap px-3 py-2">{lesson.quiz_attempts ? `${Math.round(100 * lesson.quiz_passes / lesson.quiz_attempts)}% (${lesson.quiz_passes}/${lesson.quiz_attempts})` : "—"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
