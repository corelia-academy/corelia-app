import { useId, useState } from "react";
import { FileSliders, Github, Globe, Mic, Plus, Video, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectDraft } from "./projectEditorDraft";

const resources = [
  { key: "demo", icon: Globe, example: "https://my-project.example.com" },
  { key: "slide", icon: FileSliders, example: "https://docs.google.com/presentation/d/…" },
  { key: "repo", icon: Github, example: "https://github.com/your-team/your-project" },
  { key: "video", icon: Video, example: "https://www.youtube.com/watch?v=…" },
  { key: "pitchVideo", icon: Mic, example: "https://www.loom.com/share/…" },
] as const;
type ResourceKey = typeof resources[number]["key"];

export function ProjectResourcesEditor({ draft, onChange }: {
  draft: Pick<ProjectDraft, ResourceKey>;
  onChange: (key: ResourceKey, value: string) => void;
}) {
  const { t } = useTranslation("common");
  const id = useId();
  const [expanded, setExpanded] = useState<ResourceKey[]>(() => resources.filter(({ key }) => draft[key]).map(({ key }) => key));
  const [focusKey, setFocusKey] = useState<ResourceKey | null>(null);
  const [touched, setTouched] = useState<ResourceKey[]>([]);

  return <section id="project-links" className="scroll-mt-24 rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-heading-medium font-display">{t("projects.editor.links")}</h2>
      <span className="rounded-full bg-surface-raised px-3 py-1 text-label-small text-foreground-muted">{t("projects.editor.optional")}</span>
    </div>
    <p className="mt-2 text-body-medium text-foreground-muted">{t("projects.editor.linksHint")}</p>
    <p className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-body-medium">{t("projects.editor.ideaHint")}</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {resources.map(({ key, icon: Icon, example }) => {
        const visible = expanded.includes(key) || Boolean(draft[key]);
        const inputId = `${id}-${key}`;
        const invalid = touched.includes(key) && Boolean(draft[key].trim()) && !isHttpsResource(draft[key]);
        return <div key={key} className="min-w-0 rounded-xl border border-border bg-background">
          {visible ? <div className="p-4">
            <div className="flex items-center gap-2">
              <Icon className="size-4 shrink-0 text-primary" aria-hidden />
              <label htmlFor={inputId} className="flex-1 text-label-medium">{t(`projects.editor.resourceFields.${key}.label`)}</label>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("projects.editor.removeResource", { resource: t(`projects.editor.resourceFields.${key}.label`) })} onClick={() => {
                onChange(key, "");
                setExpanded(current => current.filter(item => item !== key));
                setTouched(current => current.filter(item => item !== key));
              }}><X className="size-4" aria-hidden /></Button>
            </div>
            <p id={`${inputId}-hint`} className="mt-2 text-body-small text-foreground-muted">{t(`projects.editor.resourceFields.${key}.hint`)}</p>
            <Input autoFocus={focusKey === key} id={inputId} className="mt-3" type="url" inputMode="url" autoComplete="off" spellCheck={false} maxLength={2048} pattern="https://.*" placeholder={example} value={draft[key]} aria-describedby={`${inputId}-hint${invalid ? ` ${inputId}-error` : ""}`} aria-invalid={invalid || undefined} onChange={event => { setExpanded(current => [...new Set([...current, key])]); onChange(key, event.target.value); }} onBlur={() => setTouched(current => [...new Set([...current, key])])} />
            {invalid ? <p id={`${inputId}-error`} className="mt-2 text-body-small text-destructive" role="alert">{t("projects.editor.httpsHint")}</p> : null}
          </div> : <button type="button" aria-label={t("projects.editor.addResource", { resource: t(`projects.editor.resourceFields.${key}.label`) })} className="flex min-h-24 w-full items-start gap-3 rounded-xl p-4 text-left transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary" aria-expanded={false} onClick={() => { setFocusKey(key); setExpanded(current => [...current, key]); }}>
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 break-words"><span className="block text-label-medium">{t("projects.editor.addResource", { resource: t(`projects.editor.resourceFields.${key}.label`) })}</span><span className="mt-2 block text-body-small text-foreground-muted">{t(`projects.editor.resourceFields.${key}.hint`)}</span></span>
            <Plus className="size-4 shrink-0 text-foreground-muted" aria-hidden />
          </button>}
        </div>;
      })}
    </div>
    <p className="mt-4 text-body-small text-foreground-muted">{t("projects.editor.resourceAccessHint")}</p>
  </section>;
}

function isHttpsResource(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch { return false; }
}
