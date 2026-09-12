import { PracticeProjectLink } from "./PracticeProject";
import { PracticeHackathonLink } from "./PracticeHackathon";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Markdown } from "@/components/markdown/Markdown";
import { useAuth } from "@/stores/authStore";
import { validArtifact } from "./validation";
import { readPracticeDraft } from "./practiceDraft";
import { readArtifactDraft } from "./artifactDraft";
import type { ArtifactField, LessonRendererProps } from "./types";

export function PracticeLesson(props: LessonRendererProps) {
  const { user } = useAuth();
  return <Practice key={`${props.courseId}:${props.lesson.id}:${props.lesson.practice_config?.revision}:${props.mode}:${user?.id}`} {...props} userId={user?.id} />;
}
function Practice({ lesson, mode, courseId, userId, onAction, onComplete, contentLocale }: LessonRendererProps & { userId?: string }) {
  const { t } = useLearningTranslation();
  const config = useMemo(() => lesson.practice_config ?? { mode: "instruction" as const }, [lesson.practice_config]);
  const key = mode === "learner" && userId ? `corelia:practice:${userId}:${courseId}:${lesson.id}:${config.revision ?? 1}` : null;
  const [initial] = useState(() => readPracticeDraft(key));
  const [checked, setChecked] = useState<Record<string, boolean>>(initial.checked ?? {});
  const [artifacts, setArtifacts] = useState<Partial<Record<ArtifactField,string>>>(initial.artifacts ?? {});
  const [saved, setSaved] = useState(true);
  const [artifactSaved, setArtifactSaved] = useState(true);
  const steps = useMemo(() => config.mode === "checklist" ? (config.checklist_items ?? []).map(i => ({ id: i.id, title: i.label, instructions_markdown: "" })) : config.mode === "guided_project" ? [...config.project_steps ?? []].sort((a,b) => a.order-b.order) : [], [config]);
  const fields = useMemo(() => config.submission_fields ?? [], [config.submission_fields]);
  const ready = steps.every(s => checked[s.id] === true) && fields.every(f => validArtifact(f, artifacts[f] ?? ""));
  const complete = useCallback(async () => {
    if (!ready) return;
    if (key && fields.length) {
      const artifactKey = `corelia:final-artifacts:${userId}:${courseId}`;
      const patch = Object.fromEntries(fields.map(field => [field, artifacts[field] ?? ""]));
      try { localStorage.setItem(artifactKey, JSON.stringify({ ...readArtifactDraft(artifactKey), ...patch })); setArtifactSaved(true); }
      catch { setArtifactSaved(false); }
      // Keep the live handoff available even when browser storage is denied.
      // Other lessons' persisted fields must not overwrite edits in the final form.
      window.dispatchEvent(new CustomEvent("learning:final-artifacts", { detail: { userId, courseId, artifacts: patch } }));
    }
    if (mode === "learner") await onComplete();
  }, [ready, key, fields, userId, courseId, artifacts, mode, onComplete]);
  useEffect(() => { onAction({ label: t("learning.completeContinue"), disabled: !ready, run: complete }); return () => onAction(null); }, [onAction, ready, complete, t]);
  useEffect(() => {
    if (!key) return;
    const persist = () => { try { localStorage.setItem(key, JSON.stringify({ checked, artifacts })); return true; } catch { return false; } };
    const timer = setTimeout(() => setSaved(persist()), 350);
    window.addEventListener("pagehide", persist);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
      // Flush the latest draft when navigating before the debounce expires.
      persist();
    };
  }, [key, checked, artifacts]);
  return <div className="space-y-5">
    <Markdown content={lesson.description_markdown ?? ""} />
    {config.related_project_id && <PracticeProjectLink id={config.related_project_id} locale={contentLocale} />}
    {config.related_hackathon_id && <PracticeHackathonLink id={config.related_hackathon_id} locale={contentLocale} />}
    {steps.map(step => <div key={step.id} className="rounded-xl border border-border p-4"><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={checked[step.id] === true} onChange={e => setChecked(c => ({ ...c, [step.id]: e.target.checked }))} /><span>{step.title}</span></label>{step.instructions_markdown && <Markdown content={step.instructions_markdown} />}</div>)}
    {fields.map(field => <label key={field} className="block space-y-2 text-sm"><span>{t(`learning.artifacts.${field}`)} *</span><input value={artifacts[field] ?? ""} onChange={e => setArtifacts(a => ({ ...a, [field]: e.target.value }))} className="min-h-11 w-full rounded-lg border border-border bg-surface-base px-3" /></label>)}
    {(fields.length > 0 || config.mode === "submission") && <a href="#final-assignment" className="text-primary underline">{t("learning.finalAssignmentLink")}</a>}
    {mode === "learner" && config.mode === "guided_project" && <div className="space-y-2 text-sm"><p>{t("learning.portfolioOptional")}</p><div className="flex flex-wrap gap-4"><a href="/projects/new" className="text-primary underline">{t("learning.createPortfolioProject")}</a><a href="/account/profile" className="text-primary underline">{t("learning.openProfile")}</a></div></div>}
    {(!saved || !artifactSaved) && <p role="status" className="text-sm text-foreground-muted">{t("learning.draftUnavailable")}</p>}
  </div>;
}
