import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { translateProjectContent } from "@/lib/projectSubmission";
import { projectErrorMessage } from "@/lib/projectErrors";
import { CONTENT_LOCALES, LOCALE_META, isContentLocale, type ContentLocale } from "@/lib/locales";
import type { ProjectContent } from "@/types/projects";
import { primaryProjectContent, type ProjectDraft } from "./projectEditorDraft";

function defaultTarget(primary: ContentLocale): ContentLocale {
  return primary === "en" ? "vi" : "en";
}

export function ProjectTranslationEditor({ projectId, draft, disabled, onApply }: {
  projectId: string; draft: ProjectDraft; disabled: boolean;
  onApply: (locale: ContentLocale, content: ProjectContent) => void;
}) {
  const { t } = useTranslation("common");
  const [preview, setPreview] = useState<{ draft: ProjectDraft; content: ProjectContent; target: ContentLocale } | null>(null);
  const [target, setTarget] = useState<ContentLocale>(() => defaultTarget(draft.primaryLocale));
  const effectiveTarget = target === draft.primaryLocale ? defaultTarget(draft.primaryLocale) : target;
  const mutation = useMutation({
    mutationFn: async (snapshot: ProjectDraft) => {
      const targetLocale = effectiveTarget;
      return { draft: snapshot, target: targetLocale, content: await translateProjectContent(projectId, snapshot.primaryLocale, targetLocale, primaryProjectContent(snapshot)) };
    },
    onSuccess: setPreview,
  });
  return <div className="space-y-3">
    <select aria-label={t("projects.translation.languages")} className="h-10 rounded-lg border border-border bg-surface-base px-3 text-sm" value={effectiveTarget} disabled={disabled || mutation.isPending} onChange={event => { if (!isContentLocale(event.target.value)) return; setPreview(null); setTarget(event.target.value); }}>
      {CONTENT_LOCALES.filter(locale => locale !== draft.primaryLocale).map(locale => <option key={locale} value={locale}>{LOCALE_META[locale].endonym}</option>)}
    </select>
    <Button type="button" variant="cta" hierarchy="secondary" disabled={disabled || mutation.isPending || !draft.title.trim()} onClick={() => { setPreview(null); mutation.mutate(draft); }}>
      {t(mutation.isPending ? "projects.translation.translating" : "projects.translation.translate", { target: LOCALE_META[effectiveTarget].endonym })}
    </Button>
    <p className="text-xs text-foreground-muted">{t("projects.translation.hint")}</p>
    {mutation.isError ? <p role="alert" className="text-sm text-destructive">{projectErrorMessage(mutation.error, t)}</p> : null}
    {preview ? <section aria-label={t("projects.translation.preview")} className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">{t("projects.translation.preview")} ({LOCALE_META[preview.target].endonym})</h3>
      {(["title", "summary", "description", "progress"] as const).map(field => <label className="block text-sm" key={field}>
        {t(field === "title" || field === "summary" ? `projects.form.${field}` : `projects.editor.${field}`)}
        <textarea className="mt-1 min-h-20 w-full rounded-md border border-border bg-background p-2" value={preview.content[field]} maxLength={{title:160,summary:1000,description:20000,progress:10000}[field]} onChange={event => setPreview({ ...preview, content: { ...preview.content, [field]: event.target.value } })} />
      </label>)}
      {draft !== preview.draft ? <p role="status">{t("projects.translation.stale")}</p> : null}
      <p className="text-xs text-foreground-muted">{t("projects.translation.replaceHint")}</p>
      <div className="flex gap-2">
        <Button type="button" disabled={disabled || draft !== preview.draft} onClick={() => { onApply(preview.target, preview.content); setPreview(null); }}>{t("projects.translation.apply")}</Button>
        <Button type="button" variant="cta" hierarchy="tertiary" onClick={() => setPreview(null)}>{t("projects.translation.discard")}</Button>
      </div>
    </section> : null}
  </div>;
}
