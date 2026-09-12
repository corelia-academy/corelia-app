import { useLearningTranslation } from "../useLearningTranslation";

type Props = { issues?: string[]; failed: boolean; onOpen(): void; onRetry(): void };
export function LessonReadinessBadge({ issues, failed, onOpen, onRetry }: Props) {
  const { t } = useLearningTranslation();
  if (failed) return <button type="button" onClick={onRetry} className="text-xs text-destructive underline">{t("learning.readinessRetry")}</button>;
  if (!issues) return <span className="text-xs text-foreground-muted">{t("learning.loading")}</span>;
  if (!issues.length) return <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs text-success">{t("learning.ready")}</span>;
  return <button type="button" onClick={onOpen} title={issues.map(code => t(`learning.validation.${code}`, { defaultValue: code })).join("\n")} className="shrink-0 rounded-md bg-warning/15 px-2 py-0.5 text-xs text-warning underline">{t("learning.readinessIssues", { count: issues.length })}</button>;
}
