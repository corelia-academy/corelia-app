import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, Plus, Save, Trash2, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicProjectDirectoryQueryOptions } from "@/features/projects/projectQueries";
import { createContest, deleteContest, getContest, getHackathonLocaleContent, setHackathonLocaleContent, updateContest } from "@/lib/hackathons";
import type { Contest, ContestI18nContent, ContestLocation, ContestStatus, ContestTrack, HackathonTaxonomyOption, HackathonTimelineItem, HackathonWinnerAward } from "@/types/hackathons";

type Locale = "vi" | "en";
type LocaleDraft = {
  title: string;
  short_description: string;
  description_markdown: string;
  resources_markdown: string;
  prize_description_markdown: string;
  tracks: ContestTrack[];
  sectors: HackathonTaxonomyOption[];
  tech_stacks: HackathonTaxonomyOption[];
  timeline: HackathonTimelineItem[];
};

type Draft = {
  slug: string;
  status: ContestStatus;
  cover_image_url: string;
  mode: ContestLocation;
  host_name: string;
  host_logo_url: string;
  host_website_url: string;
  telegram: string;
  x: string;
  facebook: string;
  starts_at: string;
  ends_at: string;
  registration_deadline: string;
  submission_deadline: string;
  prize_amount: string;
  prize_currency: string;
  winner_awards: HackathonWinnerAward[];
  locales: Record<Locale, LocaleDraft>;
};

const SECTIONS = ["overview", "description", "prizes", "timeline", "resources", "taxonomy", "projects", "danger"] as const;
const inputClass = "mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3 text-foreground";
const textareaClass = "mt-2 min-h-32 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

function dateInput(value: string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function localeFromContest(contest: Contest, localized: ContestI18nContent | null, fallback: boolean): LocaleDraft {
  const source = localized ?? (fallback ? {
    title: contest.title,
    short_description: contest.short_description ?? contest.tagline,
    description_markdown: contest.description_markdown ?? contest.description,
    resources_markdown: contest.resources_markdown,
    prize_description_markdown: contest.prize_pool?.description_markdown,
    tracks: contest.tracks,
    sectors: contest.sectors,
    tech_stacks: contest.tech_stacks,
    timeline: contest.timeline,
  } : {});
  return {
    title: source.title ?? "",
    short_description: source.short_description ?? source.tagline ?? "",
    description_markdown: source.description_markdown ?? source.description ?? "",
    resources_markdown: source.resources_markdown ?? "",
    prize_description_markdown: source.prize_description_markdown ?? "",
    tracks: ((source.tracks ?? contest.tracks ?? []) as ContestTrack[]).map((item, index) => ({ ...item, active: item.active !== false, sort_order: item.sort_order ?? index })),
    sectors: (source.sectors ?? contest.sectors ?? []).map((item, index) => ({ ...item, active: item.active !== false, sort_order: item.sort_order ?? index })),
    tech_stacks: (source.tech_stacks ?? contest.tech_stacks ?? []).map((item, index) => ({ ...item, active: item.active !== false, sort_order: item.sort_order ?? index })),
    timeline: (source.timeline ?? contest.timeline ?? []).map((item, index) => ({ ...item, sort_order: item.sort_order ?? index })),
  };
}

function emptyLocale(): LocaleDraft {
  return { title: "", short_description: "", description_markdown: "", resources_markdown: "", prize_description_markdown: "", tracks: [], sectors: [], tech_stacks: [], timeline: [] };
}

function emptyDraft(): Draft {
  return { slug: "", status: "draft", cover_image_url: "", mode: "online", host_name: "", host_logo_url: "", host_website_url: "", telegram: "", x: "", facebook: "", starts_at: "", ends_at: "", registration_deadline: "", submission_deadline: "", prize_amount: "0", prize_currency: "VND", winner_awards: [], locales: { vi: emptyLocale(), en: emptyLocale() } };
}

function Section({ id, title, description, children, onSave, saving }: { id: string; title: string; description?: string; children: React.ReactNode; onSave: () => void; saving: boolean }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-semibold">{title}</h2>{description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}</div><Button type="button" size="sm" disabled={saving} onClick={onSave}><Save className="size-4" />{saving ? "…" : "Save"}</Button></div>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

export default function AdminHackathonEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [locale, setLocale] = useState<Locale>("vi");
  const [draftState, setDraftState] = useState<Draft | null>(isNew ? emptyDraft() : null);
  const [dirty, setDirty] = useState(false);
  const editorQuery = useQuery({
    queryKey: ["admin", "hackathons", id ?? "new", "editor"],
    queryFn: async () => {
      const contest = await getContest(id!, "vi");
      if (!contest) return null;
      const [vi, en] = await Promise.all([getHackathonLocaleContent(id!, "vi"), getHackathonLocaleContent(id!, "en")]);
      return { contest, vi, en };
    },
    enabled: Boolean(id),
  });
  const loadedDraft = useMemo<Draft | null>(() => {
    const data = editorQuery.data;
    if (!data) return null;
    const contest = data.contest;
    return {
      slug: contest.slug ?? "",
      status: contest.status,
      cover_image_url: contest.cover_image_url ?? "",
      mode: contest.mode ?? contest.location,
      host_name: contest.host?.name ?? "",
      host_logo_url: contest.host?.logo_url ?? "",
      host_website_url: contest.host?.website_url ?? "",
      telegram: contest.social_links?.telegram ?? "",
      x: contest.social_links?.x ?? "",
      facebook: contest.social_links?.facebook ?? "",
      starts_at: dateInput(contest.starts_at),
      ends_at: dateInput(contest.ends_at),
      registration_deadline: dateInput(contest.registration_deadline),
      submission_deadline: dateInput(contest.submission_deadline),
      prize_amount: contest.prize_pool?.amount ?? "0",
      prize_currency: contest.prize_pool?.currency ?? "VND",
      winner_awards: contest.winner_awards ?? [],
      locales: { vi: localeFromContest(contest, data.vi, true), en: localeFromContest(contest, data.en, false) },
    };
  }, [editorQuery.data]);
  const draft = draftState ?? loadedDraft ?? emptyDraft();
  const setDraft = (next: Draft | ((current: Draft) => Draft)) => {
    setDraftState((current) => {
      const base = current ?? loadedDraft ?? emptyDraft();
      return typeof next === "function" ? next(base) : next;
    });
  };
  const initialized = isNew || Boolean(loadedDraft);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const projectsQuery = useInfiniteQuery(publicProjectDirectoryQueryOptions("vi", "hackathon", "newest", { hackathonId: id ?? null, winnerProjectIds: draft.winner_awards.map((award) => award.project_id) }));
  const projects = projectsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const localized = draft.locales[locale];
  const change = (patch: Partial<Draft>) => { setDraft((current) => ({ ...current, ...patch })); setDirty(true); };
  const changeLocale = (patch: Partial<LocaleDraft>) => { setDraft((current) => ({ ...current, locales: { ...current.locales, [locale]: { ...current.locales[locale], ...patch } } })); setDirty(true); };
  const validate = () => {
    if (!draft.locales.vi.title.trim() || !draft.slug.trim()) throw new Error(t("hackathons.editor.validationRequired"));
    if (!/^[A-Z0-9]{2,10}$/.test(draft.prize_currency.trim().toUpperCase())) throw new Error(t("hackathons.editor.validationCurrency"));
    const total = Number(draft.prize_amount || 0);
    const allocated = draft.locales.vi.tracks.reduce((sum, track) => sum + Number(track.prize_amount || 0), 0);
    if (allocated > total) throw new Error(t("hackathons.editor.validationPrize"));
    if (draft.registration_deadline && draft.submission_deadline && draft.registration_deadline > draft.submission_deadline) throw new Error(t("hackathons.editor.validationDeadlines"));
  };
  const localePayload = (target: Locale): ContestI18nContent => ({
    title: draft.locales[target].title,
    short_description: draft.locales[target].short_description,
    description_markdown: draft.locales[target].description_markdown,
    resources_markdown: draft.locales[target].resources_markdown,
    prize_description_markdown: draft.locales[target].prize_description_markdown,
    tracks: draft.locales[target].tracks,
    sectors: draft.locales[target].sectors,
    tech_stacks: draft.locales[target].tech_stacks,
    timeline: draft.locales[target].timeline,
  });
  const payload = () => ({
    slug: draft.slug,
    title: draft.locales.vi.title,
    tagline: draft.locales.vi.short_description,
    short_description: draft.locales.vi.short_description,
    description_markdown: draft.locales.vi.description_markdown,
    resources_markdown: draft.locales.vi.resources_markdown,
    status: draft.status,
    starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
    ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
    registration_deadline: draft.registration_deadline ? new Date(draft.registration_deadline).toISOString() : null,
    submission_deadline: draft.submission_deadline ? new Date(draft.submission_deadline).toISOString() : null,
    location: draft.mode,
    mode: draft.mode,
    cover_image_url: draft.cover_image_url || null,
    host: { name: draft.host_name, logo_url: draft.host_logo_url || null, website_url: draft.host_website_url || null },
    social_links: { telegram: draft.telegram || null, x: draft.x || null, facebook: draft.facebook || null },
    prize_pool: { amount: draft.prize_amount || "0", currency: draft.prize_currency.trim().toUpperCase(), description_markdown: draft.locales.vi.prize_description_markdown },
    tracks: draft.locales.vi.tracks,
    sectors: draft.locales.vi.sectors,
    tech_stacks: draft.locales.vi.tech_stacks,
    timeline: draft.locales.vi.timeline,
    winner_awards: draft.winner_awards,
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      validate();
      if (isNew) {
        const created = await createContest(payload());
        await Promise.all([setHackathonLocaleContent(created.id, "vi", localePayload("vi")), setHackathonLocaleContent(created.id, "en", localePayload("en"))]);
        return created;
      }
      const updated = await updateContest(id!, payload());
      await setHackathonLocaleContent(id!, locale, localePayload(locale));
      return updated;
    },
    onSuccess: async (contest) => { setDirty(false); toast.success(t("hackathons.editor.saved")); await queryClient.invalidateQueries({ queryKey: ["hackathons"] }); if (isNew) navigate(`/admin/hackathons/${contest.id}/edit`, { replace: true }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("hackathons.editor.saveFailed")),
  });
  const save = () => saveMutation.mutate();
  const addTrack = () => {
    const track: ContestTrack = { id: crypto.randomUUID(), name: "", description: "", prize_amount: "0", active: true, sort_order: draft.locales.vi.tracks.length };
    setDraft((current) => ({ ...current, locales: { vi: { ...current.locales.vi, tracks: [...current.locales.vi.tracks, track] }, en: { ...current.locales.en, tracks: [...current.locales.en.tracks, { ...track, name: "", description: "" }] } } })); setDirty(true);
  };
  const removeTrack = (trackId: string) => {
    const isPersisted = loadedDraft?.locales.vi.tracks.some((track) => track.id === trackId) ?? false;
    if (isPersisted && !window.confirm(t("hackathons.editor.removeTrackConfirm"))) return;
    const withoutTrack = (items: ContestTrack[]) => items
      .filter((item) => item.id !== trackId)
      .map((item, sortOrder) => ({ ...item, sort_order: sortOrder }));
    setDraft((current) => ({
      ...current,
      locales: {
        vi: { ...current.locales.vi, tracks: withoutTrack(current.locales.vi.tracks) },
        en: { ...current.locales.en, tracks: withoutTrack(current.locales.en.tracks) },
      },
    }));
    setDirty(true);
  };
  const addTaxonomy = (key: "sectors" | "tech_stacks") => {
    const option: HackathonTaxonomyOption = { id: crypto.randomUUID(), name: "", active: true, sort_order: draft.locales.vi[key].length };
    setDraft((current) => ({ ...current, locales: { vi: { ...current.locales.vi, [key]: [...current.locales.vi[key], option] }, en: { ...current.locales.en, [key]: [...current.locales.en[key], { ...option, name: "" }] } } })); setDirty(true);
  };
  const addTimeline = () => {
    const item: HackathonTimelineItem = { id: crypto.randomUUID(), title: "", starts_at: new Date().toISOString(), ends_at: null, description_markdown: "", sort_order: draft.locales.vi.timeline.length };
    setDraft((current) => ({ ...current, locales: { vi: { ...current.locales.vi, timeline: [...current.locales.vi.timeline, item] }, en: { ...current.locales.en, timeline: [...current.locales.en.timeline, { ...item, title: "" }] } } })); setDirty(true);
  };

  if (!initialized || editorQuery.isPending) return <div className="p-12 text-center text-sm text-foreground-muted">{t("hackathons.loading")}</div>;
  if (!isNew && !editorQuery.data) return <div className="p-12 text-center">{t("hackathons.editor.notFound")}</div>;

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Button variant="ghost" size="sm" render={<NavLink to="/admin/hackathons" />} nativeButton={false}><ArrowLeft className="size-4" />{t("hackathons.editor.back")}</Button><div className="mt-3 flex items-center gap-3"><Trophy className="size-7 text-primary" /><div><h1 className="text-2xl font-semibold">{isNew ? t("hackathons.editor.newTitle") : draft.locales.vi.title || t("hackathons.editor.editTitle")}</h1><p className="text-sm text-foreground-muted">{draft.status} · {editorQuery.data?.contest.participants_count ?? 0} {t("hackathons.editor.participants")}</p></div></div></div><div className="flex items-center gap-2"><div className="flex rounded-md border border-border p-1">{(["vi", "en"] as Locale[]).map((item) => <button type="button" key={item} className={item === locale ? "min-h-9 rounded bg-primary px-3 text-sm font-semibold text-primary-foreground" : "min-h-9 rounded px-3 text-sm text-foreground-muted"} onClick={() => setLocale(item)}>{item.toUpperCase()}</button>)}</div><Button type="button" disabled={saveMutation.isPending} onClick={save}><Save className="size-4" />{t("hackathons.editor.saveAll")}</Button></div></div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-28 lg:self-start"><nav className="flex gap-2 overflow-x-auto rounded-xl border border-border-subtle bg-surface-base p-2 lg:flex-col">{SECTIONS.map((section, index) => <a key={section} href={`#${section}`} className="flex min-h-11 min-w-max items-center gap-2 rounded-md px-3 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground"><span className="text-xs tabular-nums">{index + 1}</span>{t(`hackathons.editor.sections.${section}`)}</a>)}</nav>{dirty ? <div className="mt-3 flex gap-2 rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="size-4 shrink-0" />{t("hackathons.editor.unsaved")}</div> : null}</aside>
        <main className="space-y-6">
          <Section id="overview" title={t("hackathons.editor.sections.overview")} onSave={save} saving={saveMutation.isPending}>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Slug<Input className="mt-2" value={draft.slug} onChange={(event) => change({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></label><label className="text-sm font-medium">Mode<select className={inputClass} value={draft.mode} onChange={(event) => change({ mode: event.target.value as ContestLocation })}><option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">Hybrid</option></select></label></div>
            <label className="block text-sm font-medium">{t("hackathons.editor.fields.title")} ({locale.toUpperCase()})<Input className="mt-2" value={localized.title} onChange={(event) => changeLocale({ title: event.target.value })} /></label>
            <label className="block text-sm font-medium">{t("hackathons.editor.fields.shortDescription")}<textarea className={textareaClass} value={localized.short_description} onChange={(event) => changeLocale({ short_description: event.target.value })} /></label>
            <label className="block text-sm font-medium">Banner URL<Input className="mt-2" type="url" value={draft.cover_image_url} onChange={(event) => change({ cover_image_url: event.target.value })} /></label>
            <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Host<Input className="mt-2" value={draft.host_name} onChange={(event) => change({ host_name: event.target.value })} /></label><label className="text-sm font-medium">Host logo URL<Input className="mt-2" type="url" value={draft.host_logo_url} onChange={(event) => change({ host_logo_url: event.target.value })} /></label><label className="text-sm font-medium">Host website<Input className="mt-2" type="url" value={draft.host_website_url} onChange={(event) => change({ host_website_url: event.target.value })} /></label></div>
            <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Telegram<Input className="mt-2" type="url" value={draft.telegram} onChange={(event) => change({ telegram: event.target.value })} /></label><label className="text-sm font-medium">X<Input className="mt-2" type="url" value={draft.x} onChange={(event) => change({ x: event.target.value })} /></label><label className="text-sm font-medium">Facebook<Input className="mt-2" type="url" value={draft.facebook} onChange={(event) => change({ facebook: event.target.value })} /></label></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{(["starts_at", "ends_at", "registration_deadline", "submission_deadline"] as const).map((key) => <label key={key} className="text-sm font-medium">{t(`hackathons.editor.fields.${key}`)}<Input className="mt-2" type="datetime-local" value={draft[key]} onChange={(event) => change({ [key]: event.target.value })} /></label>)}</div>
          </Section>
          <Section id="description" title={t("hackathons.editor.sections.description")} onSave={save} saving={saveMutation.isPending}><label className="block text-sm font-medium">Markdown ({locale.toUpperCase()})<textarea className={`${textareaClass} min-h-80 font-mono`} value={localized.description_markdown} onChange={(event) => changeLocale({ description_markdown: event.target.value })} /></label></Section>
          <Section id="prizes" title={t("hackathons.editor.sections.prizes")} onSave={save} saving={saveMutation.isPending}>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">{t("hackathons.editor.fields.totalPrize")}<Input className="mt-2" inputMode="decimal" value={draft.prize_amount} onChange={(event) => change({ prize_amount: event.target.value })} /></label><label className="text-sm font-medium">Currency<Input className="mt-2" value={draft.prize_currency} maxLength={10} onChange={(event) => change({ prize_currency: event.target.value.toUpperCase() })} /></label></div>
            <label className="block text-sm font-medium">Description Markdown ({locale.toUpperCase()})<textarea className={textareaClass} value={localized.prize_description_markdown} onChange={(event) => changeLocale({ prize_description_markdown: event.target.value })} /></label>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Tracks</h3><Button type="button" variant="outline" size="sm" onClick={addTrack}><Plus className="size-4" />{t("hackathons.editor.add")}</Button></div>
            {localized.tracks.length === 0 ? <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground-muted">{t("hackathons.editor.noTracks")}</div> : null}
            <div className="space-y-3">
              {localized.tracks.map((track, index) => {
                const prizeAmount = draft.locales.vi.tracks.find((item) => item.id === track.id)?.prize_amount ?? "0";
                return (
                  <div key={track.id} className="rounded-xl border border-border bg-surface-raised/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{t("hackathons.editor.trackNumber", { number: index + 1 })}</span>
                      <Button type="button" variant="ghost" size="icon" className="text-foreground-muted hover:text-destructive" aria-label={t("hackathons.editor.removeTrack")} onClick={() => removeTrack(track.id)}><Trash2 className="size-4" /></Button>
                    </div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <label className="text-sm font-medium">{t("hackathons.editor.trackName")} ({locale.toUpperCase()})<Input className="mt-2" value={track.name} placeholder={t("hackathons.editor.trackNamePlaceholder")} onChange={(event) => changeLocale({ tracks: localized.tracks.map((item) => item.id === track.id ? { ...item, name: event.target.value } : item) })} /></label>
                      <label className="text-sm font-medium">{t("hackathons.editor.trackPrize")}<Input className="mt-2" disabled={locale !== "vi"} inputMode="decimal" value={prizeAmount} onChange={(event) => { const tracks = draft.locales.vi.tracks.map((item) => item.id === track.id ? { ...item, prize_amount: event.target.value } : item); setDraft((current) => ({ ...current, locales: { ...current.locales, vi: { ...current.locales.vi, tracks } } })); setDirty(true); }} /></label>
                    </div>
                    <label className="mt-4 block text-sm font-medium">{t("hackathons.editor.trackDescription")} ({locale.toUpperCase()})<textarea className={`${textareaClass} min-h-24`} value={track.description ?? ""} placeholder={t("hackathons.editor.trackDescriptionPlaceholder")} onChange={(event) => changeLocale({ tracks: localized.tracks.map((item) => item.id === track.id ? { ...item, description: event.target.value } : item) })} /></label>
                  </div>
                );
              })}
            </div>
          </Section>
          <Section id="timeline" title={t("hackathons.editor.sections.timeline")} onSave={save} saving={saveMutation.isPending}><div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={addTimeline}><Plus className="size-4" />{t("hackathons.editor.add")}</Button></div>{localized.timeline.map((item, index) => <div key={item.id} className="space-y-3 rounded-lg border border-border p-4"><Input value={item.title} placeholder="Title" onChange={(event) => changeLocale({ timeline: localized.timeline.map((row) => row.id === item.id ? { ...row, title: event.target.value } : row) })} /><div className="grid gap-3 sm:grid-cols-2"><Input type="datetime-local" disabled={locale !== "vi"} value={dateInput(draft.locales.vi.timeline[index]?.starts_at)} onChange={(event) => { const timeline = draft.locales.vi.timeline.map((row) => row.id === item.id ? { ...row, starts_at: new Date(event.target.value).toISOString() } : row); setDraft((current) => ({ ...current, locales: { ...current.locales, vi: { ...current.locales.vi, timeline } } })); setDirty(true); }} /><Input type="datetime-local" disabled={locale !== "vi"} value={dateInput(draft.locales.vi.timeline[index]?.ends_at)} onChange={(event) => { const timeline = draft.locales.vi.timeline.map((row) => row.id === item.id ? { ...row, ends_at: event.target.value ? new Date(event.target.value).toISOString() : null } : row); setDraft((current) => ({ ...current, locales: { ...current.locales, vi: { ...current.locales.vi, timeline } } })); setDirty(true); }} /></div><textarea className={textareaClass} placeholder="Markdown" value={item.description_markdown ?? ""} onChange={(event) => changeLocale({ timeline: localized.timeline.map((row) => row.id === item.id ? { ...row, description_markdown: event.target.value } : row) })} /></div>)}</Section>
          <Section id="resources" title={t("hackathons.editor.sections.resources")} onSave={save} saving={saveMutation.isPending}><textarea className={`${textareaClass} min-h-80 font-mono`} value={localized.resources_markdown} onChange={(event) => changeLocale({ resources_markdown: event.target.value })} /></Section>
          <Section id="taxonomy" title={t("hackathons.editor.sections.taxonomy")} description={t("hackathons.editor.taxonomyHint")} onSave={save} saving={saveMutation.isPending}>{(["sectors", "tech_stacks"] as const).map((key) => <div key={key}><div className="flex items-center justify-between"><h3 className="font-semibold">{t(`hackathons.editor.fields.${key}`)}</h3><Button type="button" variant="outline" size="sm" onClick={() => addTaxonomy(key)}><Plus className="size-4" />{t("hackathons.editor.add")}</Button></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{localized[key].map((option) => <div key={option.id} className="flex gap-2 rounded-lg border border-border p-3"><Input value={option.name} onChange={(event) => changeLocale({ [key]: localized[key].map((row) => row.id === option.id ? { ...row, name: event.target.value } : row) })} /><Button type="button" variant="outline" size="sm" onClick={() => { const update = (target: Locale) => draft.locales[target][key].map((row) => row.id === option.id ? { ...row, active: row.active === false } : row); setDraft((current) => ({ ...current, locales: { vi: { ...current.locales.vi, [key]: update("vi") }, en: { ...current.locales.en, [key]: update("en") } } })); setDirty(true); }}>{option.active === false ? <Check className="size-4" /> : t("hackathons.editor.archive")}</Button></div>)}</div></div>)}</Section>
          <Section id="projects" title={t("hackathons.editor.sections.projects")} onSave={save} saving={saveMutation.isPending}>{isNew ? <p className="text-sm text-foreground-muted">{t("hackathons.editor.saveBeforeWinners")}</p> : <><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><select id="winner-project" className={inputClass}><option value="">{t("hackathons.editor.selectProject")}</option>{projects.map(({ project }) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><Input id="winner-label" className="mt-2" placeholder={t("hackathons.editor.awardLabel")} /><Button type="button" className="mt-2" onClick={() => { const projectId = (document.getElementById("winner-project") as HTMLSelectElement)?.value; const label = (document.getElementById("winner-label") as HTMLInputElement)?.value.trim(); if (!projectId || !label) return; change({ winner_awards: [...draft.winner_awards, { id: crypto.randomUUID(), project_id: projectId, label, sort_order: draft.winner_awards.length }] }); }}><Plus className="size-4" />{t("hackathons.editor.add")}</Button></div>{draft.winner_awards.map((award, index) => <div key={award.id} className="flex items-center gap-3 rounded-lg border border-border p-3"><span className="text-xs tabular-nums text-foreground-muted">{index + 1}</span><Input value={award.label} onChange={(event) => change({ winner_awards: draft.winner_awards.map((item) => item.id === award.id ? { ...item, label: event.target.value } : item) })} /><span className="min-w-0 flex-1 truncate text-sm text-foreground-muted">{projects.find(({ project }) => project.id === award.project_id)?.project.title ?? award.project_id}</span><Button type="button" variant="ghost" size="icon" aria-label={t("hackathons.editor.remove")} onClick={() => change({ winner_awards: draft.winner_awards.filter((item) => item.id !== award.id).map((item, order) => ({ ...item, sort_order: order })) })}><Trash2 className="size-4" /></Button></div>)}</>}</Section>
          <section id="danger" className="scroll-mt-28 rounded-2xl border border-destructive/30 bg-destructive-muted/20 p-5 sm:p-7"><h2 className="text-lg font-semibold text-destructive">{t("hackathons.editor.sections.danger")}</h2><div className="mt-5 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => change({ status: "published" })}>Publish</Button><Button type="button" variant="outline" onClick={() => change({ status: "ended" })}>End</Button>{!isNew ? <Button type="button" variant="destructive" onClick={async () => { if (!window.confirm(t("hackathons.editor.deleteConfirm"))) return; await deleteContest(id!); navigate("/admin/hackathons"); }}><Trash2 className="size-4" />Delete</Button> : null}<Button type="button" onClick={save}>{t("hackathons.editor.applyStatus")}</Button></div></section>
        </main>
      </div>
    </div>
  );
}
