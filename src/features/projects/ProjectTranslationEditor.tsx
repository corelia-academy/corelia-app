import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { translateProjectContent } from "@/lib/projectSubmission";
import { projectErrorMessage } from "@/lib/projectErrors";
import type { ProjectContent } from "@/types/projects";
import { primaryProjectContent, type ProjectDraft } from "./projectEditorDraft";

export function ProjectTranslationEditor({ projectId, draft, disabled, onApply }: {
  projectId: string; draft: ProjectDraft; disabled: boolean;
  onApply: (locale: "vi" | "en", content: ProjectContent) => void;
}) {
  const { t } = useTranslation("common");
  const [preview, setPreview] = useState<{ draft: ProjectDraft; content: ProjectContent; target: "vi" | "en" } | null>(null);
  const target = draft.primaryLocale === "vi" ? "en" : "vi";
  const mutation = useMutation({
    mutationFn: async (snapshot: ProjectDraft) => {
      const targetLocale: "vi" | "en" = snapshot.primaryLocale === "vi" ? "en" : "vi";
      return { draft: snapshot, target: targetLocale, content: await translateProjectContent(projectId, snapshot.primaryLocale, targetLocale, primaryProjectContent(snapshot)) };
    },
    onSuccess: setPreview,
  });
  return <div className="space-y-3">
    <Button type="button" variant="outline" disabled={disabled || mutation.isPending || !draft.title.trim()} onClick={() => { setPreview(null); mutation.mutate(draft); }}>
      {t(mutation.isPending ? "projects.translation.translating" : "projects.translation.translate", { target: target.toUpperCase() })}
    </Button>
    <p className="text-xs text-foreground-muted">{t("projects.translation.hint")}</p>
    {mutation.isError ? <p role="alert" className="text-sm text-destructive">{projectErrorMessage(mutation.error, t)}</p> : null}
    {preview ? <section aria-label={t("projects.translation.preview")} className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">{t("projects.translation.preview")} ({preview.target.toUpperCase()})</h3>
      {(["title", "summary", "description", "progress"] as const).map(field => <label className="block text-sm" key={field}>
        {t(field === "title" || field === "summary" ? `projects.form.${field}` : `projects.editor.${field}`)}
        <textarea className="mt-1 min-h-20 w-full rounded-md border border-border bg-background p-2" value={preview.content[field]} maxLength={{title:160,summary:1000,description:20000,progress:10000}[field]} onChange={event => setPreview({ ...preview, content: { ...preview.content, [field]: event.target.value } })} />
      </label>)}
      {draft !== preview.draft ? <p role="status">{t("projects.translation.stale")}</p> : null}
      <p className="text-xs text-foreground-muted">{t("projects.translation.replaceHint")}</p>
      <div className="flex gap-2">
        <Button type="button" disabled={disabled || draft !== preview.draft} onClick={() => { onApply(preview.target, preview.content); setPreview(null); }}>{t("projects.translation.apply")}</Button>
        <Button type="button" variant="ghost" onClick={() => setPreview(null)}>{t("projects.translation.discard")}</Button>
      </div>
    </section> : null}
  </div>;
}
