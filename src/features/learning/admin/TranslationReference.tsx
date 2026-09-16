import { useLearningTranslation } from "../useLearningTranslation";

/** Source copy is deliberately read-only and never becomes an input value. */
export function TranslationReference({ values }: { values: Array<string | null | undefined> }) {
  const { t } = useLearningTranslation();
  return <details className="my-3 rounded-lg border border-border bg-surface-raised p-3 text-sm">
    <summary className="cursor-pointer font-medium">{t("learning.translationReference")}</summary>
    <div className="mt-2 space-y-2 whitespace-pre-wrap break-words">
      {values.filter(value => typeof value === "string" && value.length > 0).map((value, index) => <p key={index}>{value}</p>)}
    </div>
  </details>;
}
