import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useDynamicPageTitle } from "@/components/navigation/PageTitle";

const principles = ["outcome", "prior", "model", "retrieve", "space", "feedback", "transfer"] as const;
const sections = ["principles", "example", "formats", "checklist", "sources"] as const;
const formats = ["article", "video", "quiz", "code", "practice", "final"] as const;
const checks = ["outcome", "entry", "accuracy", "practice", "feedback", "review", "access", "pilot"] as const;
const exampleSteps = ["read", "predict", "build", "submit", "revisit"] as const;
const sources = [
  { id: "alignment", url: "https://www.cmu.edu/teaching/assessment/basics/alignment.html" },
  { id: "learning", url: "https://www.cmu.edu/teaching/principles/learning.html" },
  { id: "ies", url: "https://ies.ed.gov/ncee/wwc/PracticeGuide/1" },
] as const;
const evidenceSource = { outcome: "alignment", prior: "learning", model: "ies", retrieve: "ies", space: "ies", feedback: "learning", transfer: "learning" } as const;

export default function LearningPrinciplesPage() {
  const { t } = useTranslation("instructor", { keyPrefix: "learningPrinciples" });
  const [checked, setChecked] = useState<string[]>([]);
  useDynamicPageTitle(t("title"));
  usePageMeta({ title: t("title"), description: t("intro") });

  return (
    <div className="container-app min-w-0 py-6 sm:py-10">
      <header className="max-w-3xl pb-8">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-primary"><BookOpen className="size-4" aria-hidden />{t("eyebrow")}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-4 text-base leading-7 text-foreground-muted">{t("intro")}</p>
        <p className="mt-3 text-xs leading-5 text-foreground-muted">{t("scope")}</p>
      </header>

      <div className="grid min-w-0 gap-8 xl:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label={t("contents")} className="xl:sticky xl:top-24 xl:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">{t("contents")}</p>
          <ol className="flex flex-wrap gap-1 xl:flex-col">
            {sections.map((section, index) => <li key={section}><a className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary" href={`#${section}`}><span className="font-mono text-xs text-foreground-muted">0{index + 1}</span>{t(`sections.${section}`)}</a></li>)}
          </ol>
        </nav>

        <div className="min-w-0 space-y-12">
          <section id="principles" aria-labelledby="principles-title" className="scroll-mt-28">
            <h2 id="principles-title" className="font-display text-2xl font-semibold">{t("sections.principles")}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">{t("evidenceNote")}</p>
            <div className="mt-5 divide-y divide-border-subtle border-y border-border-subtle">
              {principles.map((key, index) => (
                <article key={key} className="grid gap-4 py-6 sm:grid-cols-[40px_minmax(0,1fr)]">
                  <span className="font-mono text-xl text-primary" aria-hidden>0{index + 1}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{t(`principles.${key}.title`)}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground-muted">{t(`principles.${key}.evidence`)} <a className="text-primary underline underline-offset-4" href={`#source-${evidenceSource[key]}`}>{t("sourceLink")}</a></p>
                    <div className="mt-3 rounded-xl bg-surface-raised p-4">
                      <p className="text-xs font-semibold text-primary">{t("application")}</p>
                      <p className="mt-1 text-sm leading-6">{t(`principles.${key}.application`)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground-muted"><strong className="font-medium text-foreground">{t("watchFor")} </strong>{t(`principles.${key}.limit`)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="example" aria-labelledby="example-title" className="scroll-mt-28">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("example.label")}</p>
            <h2 id="example-title" className="mt-2 font-display text-2xl font-semibold">{t("example.title")}</h2>
            <p className="mt-3 text-sm leading-6 text-foreground-muted">{t("example.goal")}</p>
            <ol className="mt-5 space-y-3">
              {exampleSteps.map((key, index) => <li key={key} className="flex gap-4 rounded-xl border border-border-subtle p-4"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span><div><h3 className="font-medium">{t(`example.${key}.title`)}</h3><p className="mt-1 text-sm leading-6 text-foreground-muted">{t(`example.${key}.body`)}</p></div></li>)}
            </ol>
            <div className="mt-5 border-l-2 border-primary pl-5"><h3 className="text-sm font-semibold">{t("example.rubricTitle")}</h3><p className="mt-2 text-sm leading-6 text-foreground-muted">{t("example.rubric")}</p></div>
          </section>

          <section id="formats" aria-labelledby="formats-title" className="scroll-mt-28">
            <h2 id="formats-title" className="font-display text-2xl font-semibold">{t("sections.formats")}</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">{formats.map(key => <article key={key} className="rounded-xl border border-border-subtle p-5"><h3 className="font-semibold">{t(`formats.${key}.title`)}</h3><p className="mt-2 text-sm leading-6 text-foreground-muted">{t(`formats.${key}.body`)}</p></article>)}</div>
            <p className="mt-4 text-sm leading-6 text-foreground-muted">{t("formatsNote")}</p>
          </section>

          <section id="checklist" aria-labelledby="checklist-title" className="scroll-mt-28 rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:p-7">
            <h2 id="checklist-title" className="font-display text-2xl font-semibold">{t("sections.checklist")}</h2>
            <p className="mt-2 text-sm leading-6 text-foreground-muted">{t("checklistNote")}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm font-medium">{t("checked", { count: checked.length, total: checks.length })}</p><Button type="button" variant="outline" size="sm" disabled={!checked.length} onClick={() => setChecked([])}>{t("reset")}</Button></div>
            <ul className="mt-3 divide-y divide-border-subtle">{checks.map(key => <li key={key}><label className="flex cursor-pointer items-start gap-3 py-4 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={checked.includes(key)} onChange={event => setChecked(previous => event.target.checked ? [...previous, key] : previous.filter(item => item !== key))} /><span>{t(`checks.${key}`)}</span></label></li>)}</ul>
          </section>

          <section id="sources" aria-labelledby="sources-title" className="scroll-mt-28 pb-8">
            <h2 id="sources-title" className="font-display text-2xl font-semibold">{t("sections.sources")}</h2>
            <p className="mt-3 text-sm leading-6 text-foreground-muted">{t("sourcesNote")}</p>
            <ol className="mt-5 space-y-5">{sources.map(({ id, url }) => <li key={id} id={`source-${id}`} className="scroll-mt-28"><a href={url} className="inline-flex items-start gap-2 text-sm font-medium text-primary underline underline-offset-4">{t(`sources.${id}.title`)}<ExternalLink className="mt-0.5 size-4 shrink-0" aria-hidden /></a><p className="mt-1 text-sm leading-6 text-foreground-muted">{t(`sources.${id}.description`)}</p></li>)}</ol>
          </section>
        </div>
      </div>
    </div>
  );
}
