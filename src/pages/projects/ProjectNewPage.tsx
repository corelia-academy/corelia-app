import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getContestBySlug, getMyContestRegistration, upsertContestSubmission } from "@/lib/hackathons";
import { generateCanonicalProjectSlug } from "@/lib/hackathonContract";
import { normalizeSlugDraft } from "@/lib/slug";
import { useAuth } from "@/stores/authStore";
import type { HackathonTaxonomyOption } from "@/types/hackathons";

function Choices({ label, options, value, onChange }: { label: string; options: Array<Pick<HackathonTaxonomyOption, "id" | "name"> & { active?: boolean }>; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.filter((option) => option.active !== false).map((option) => (
          <label key={option.id} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm">
            <input type="checkbox" checked={value.includes(option.id)} onChange={() => onChange(value.includes(option.id) ? value.filter((id) => id !== option.id) : [...value, option.id])} />
            {option.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ProjectNewPage() {
  const { t, i18n } = useTranslation("common");
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const hackathonSlug = params.get("hackathon") ?? "";
  const contestQuery = useQuery({ queryKey: ["hackathons", "project-new", hackathonSlug, locale], queryFn: () => getContestBySlug(hackathonSlug, locale), enabled: Boolean(hackathonSlug) });
  const contest = contestQuery.data ?? null;
  const registrationQuery = useQuery({ queryKey: ["hackathons", contest?.id, "my-registration", user?.id], queryFn: () => getMyContestRegistration(contest!.id, user), enabled: Boolean(contest && user) });
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [tracks, setTracks] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [tech, setTech] = useState<string[]>([]);
  const effectiveSlug = useMemo(() => generateCanonicalProjectSlug(slug || title), [slug, title]);
  const mutation = useMutation({
    mutationFn: () => upsertContestSubmission(contest!.id, { title, slug: effectiveSlug, summary, demo_url: demoUrl, repo_url: repoUrl, track_ids: tracks, sector_ids: sectors, tech_stack_ids: tech }),
    onSuccess: (submission) => {
      toast.success(t("projects.form.created"));
      navigate(`/projects/${effectiveSlug || submission.project_id}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("projects.form.saveFailed")),
  });

  if (contestQuery.isPending || registrationQuery.isPending) return <div className="container-app py-16 text-center text-sm text-foreground-muted">{t("projects.loading")}</div>;
  if (!contest || !registrationQuery.data) return <div className="container-app py-16 text-center"><Package className="mx-auto size-8 text-foreground-subtle" /><h1 className="mt-3 font-semibold">{t("projects.form.notEligible")}</h1><p className="mt-1 text-sm text-foreground-muted">{t("projects.form.notEligibleDescription")}</p><Button className="mt-4" render={<NavLink to={contest ? `/hackathons/${contest.slug}/overview` : "/hackathons"} />} nativeButton={false}>{t("projects.detail.goBack")}</Button></div>;

  return (
    <div className="container-app max-w-4xl py-6 sm:py-8">
      <Button variant="ghost" render={<NavLink to={`/hackathons/${contest.slug}/projects`} />} nativeButton={false}><ArrowLeft className="size-4" />{t("projects.form.back")}</Button>
      <header className="mt-4"><h1 className="text-2xl font-semibold text-foreground">{t("projects.form.createTitle")}</h1><p className="mt-1 text-sm text-foreground-muted">{contest.title}</p></header>
      <form className="mt-6 space-y-6 rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card sm:p-7" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">{t("projects.form.title")}<Input className="mt-2" required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="text-sm font-medium">{t("projects.form.slug")}<Input className="mt-2" required value={slug || effectiveSlug} onChange={(event) => setSlug(normalizeSlugDraft(event.target.value))} onBlur={() => setSlug((current) => current ? generateCanonicalProjectSlug(current) : current)} /></label>
        </div>
        <label className="block text-sm font-medium">{t("projects.form.summary")}<textarea className="mt-2 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2" rows={5} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">{t("projects.form.demoUrl")}<Input className="mt-2" type="url" value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} /></label><label className="text-sm font-medium">{t("projects.form.repoUrl")}<Input className="mt-2" type="url" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} /></label></div>
        <Choices label={t("projects.filters.tracks")} options={contest.tracks ?? []} value={tracks} onChange={setTracks} />
        <Choices label={t("projects.filters.sectors")} options={contest.sectors ?? []} value={sectors} onChange={setSectors} />
        <Choices label={t("projects.filters.techStacks")} options={contest.tech_stacks ?? []} value={tech} onChange={setTech} />
        <div className="flex justify-end"><Button type="submit" disabled={mutation.isPending || !title.trim() || !effectiveSlug || !tracks.length || !sectors.length || !tech.length}>{mutation.isPending ? t("projects.form.saving") : t("projects.form.create")}</Button></div>
      </form>
    </div>
  );
}
