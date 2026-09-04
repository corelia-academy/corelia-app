import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CalendarDays, Camera, Check, CircleDollarSign, FileText, FolderOpen, ImageIcon, Layers3, Loader2, Plus, Save, Settings, Sparkles, Trash2, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProfileCombobox } from "@/components/ui/profile-combobox";
import { PageContainer, PageSectionCard } from "@/components/layouts/PagePrimitives";
import { publicProjectDirectoryQueryOptions } from "@/features/projects/projectQueries";
import { createContest, deleteContest, getContest, getHackathonLocaleContent, notifyHackathonWinnerAwards, setHackathonLocaleContent, updateContest } from "@/lib/hackathons";
import { deleteStorageObjectByPath, uploadContestBanner, uploadContestHostLogo } from "@/lib/storage";
import { invokeGenerateDescription, type DescriptionTranslationBundle, type HackathonTranslationItem } from "@/lib/descriptionGenerator";
import { canonicalizeSlug, normalizeSlugDraft } from "@/lib/slug";
import { cn } from "@/lib/utils";
import type { Contest, ContestI18nContent, ContestLocation, ContestStatus, ContestTrack, HackathonTaxonomyOption, HackathonTimelineItem, HackathonWinnerAward } from "@/types/hackathons";
import { isPrizeAllocationValid } from "@/lib/hackathonContract";
import { isValidHackathonSocialLink, normalizeHackathonSocialLink } from "./utils/socialLinks";

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
  cover_image_path: string;
  mode: ContestLocation;
  host_name: string;
  host_logo_url: string;
  host_logo_path: string;
  host_website_url: string;
  telegram: string;
  x: string;
  facebook: string;
  registration_deadline: string;
  submission_deadline: string;
  prize_amount: string;
  prize_currency: string;
  winner_awards: HackathonWinnerAward[];
  locales: Record<Locale, LocaleDraft>;
};

const SECTIONS = ["overview", "description", "prizes", "timeline", "resources", "taxonomy", "projects", "danger"] as const;
type SectionId = typeof SECTIONS[number];

class EditorValidationError extends Error {
  section: SectionId;
  fieldId?: string;
  constructor(message: string, section: SectionId, fieldId?: string) {
    super(message);
    this.name = "EditorValidationError";
    this.section = section;
    this.fieldId = fieldId;
  }
}

const SECTION_ICONS = {
  overview: Settings,
  description: FileText,
  prizes: CircleDollarSign,
  timeline: CalendarDays,
  resources: FolderOpen,
  taxonomy: Layers3,
  projects: Trophy,
  danger: AlertTriangle,
} as const;
const inputClass = "min-h-11 w-full rounded-md border border-border bg-background px-3 text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15";
const textareaClass = "min-h-32 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15";
const DEFAULT_TAXONOMY = {
  sectors: [
    { id: "sector-ai-engineering", vi: "Kỹ thuật AI & Machine Learning", en: "AI & Machine Learning Engineering" },
    { id: "sector-blockchain-web3", vi: "Blockchain & Web3", en: "Blockchain & Web3" },
    { id: "sector-frontend", vi: "Phát triển Frontend", en: "Frontend Development" },
    { id: "sector-backend", vi: "Phát triển Backend", en: "Backend Development" },
    { id: "sector-fullstack", vi: "Phát triển Full-stack", en: "Full-stack Development" },
    { id: "sector-mobile", vi: "Phát triển Mobile", en: "Mobile Development" },
    { id: "sector-data-engineering", vi: "Kỹ thuật dữ liệu", en: "Data Engineering" },
    { id: "sector-cloud-devops", vi: "Cloud & DevOps", en: "Cloud & DevOps" },
    { id: "sector-cybersecurity", vi: "An toàn thông tin", en: "Cybersecurity" },
    { id: "sector-developer-tools", vi: "Công cụ lập trình & Mã nguồn mở", en: "Developer Tools & Open Source" },
  ],
  tech_stacks: [
    { id: "tech-javascript-typescript", vi: "JavaScript / TypeScript", en: "JavaScript / TypeScript" },
    { id: "tech-python", vi: "Python", en: "Python" },
    { id: "tech-rust", vi: "Rust", en: "Rust" },
    { id: "tech-go", vi: "Go", en: "Go" },
    { id: "tech-react-nextjs", vi: "React / Next.js", en: "React / Next.js" },
    { id: "tech-nodejs", vi: "Node.js", en: "Node.js" },
    { id: "tech-pytorch-tensorflow", vi: "PyTorch / TensorFlow", en: "PyTorch / TensorFlow" },
    { id: "tech-solidity-evm", vi: "Solidity / EVM", en: "Solidity / EVM" },
    { id: "tech-solana", vi: "Solana", en: "Solana" },
    { id: "tech-docker-kubernetes", vi: "Docker / Kubernetes", en: "Docker / Kubernetes" },
  ],
} as const;

function dateInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

function defaultTaxonomy(key: keyof typeof DEFAULT_TAXONOMY, locale: Locale): HackathonTaxonomyOption[] {
  return DEFAULT_TAXONOMY[key].map((option, index) => ({
    id: option.id,
    name: option[locale],
    active: true,
    sort_order: index,
  }));
}

function emptyLocale(locale: Locale): LocaleDraft {
  return { title: "", short_description: "", description_markdown: "", resources_markdown: "", prize_description_markdown: "", tracks: [], sectors: defaultTaxonomy("sectors", locale), tech_stacks: defaultTaxonomy("tech_stacks", locale), timeline: [] };
}

function emptyDraft(): Draft {
  return { slug: "", status: "draft", cover_image_url: "", cover_image_path: "", mode: "online", host_name: "", host_logo_url: "", host_logo_path: "", host_website_url: "", telegram: "", x: "", facebook: "", registration_deadline: "", submission_deadline: "", prize_amount: "0", prize_currency: "VND", winner_awards: [], locales: { vi: emptyLocale("vi"), en: emptyLocale("en") } };
}

function EditorSection({ title, description, children, onSave, saving, saveLabel, secondaryAction }: { title: string; description?: string; children: React.ReactNode; onSave: () => void; saving: boolean; saveLabel: string; secondaryAction?: { label: string; onClick: () => void } }) {
  return (
    <PageSectionCard className="p-5 sm:p-6">
      <div><h2 className="text-lg font-semibold text-foreground">{title}</h2>{description ? <p className="mt-1.5 text-sm leading-6 text-foreground-muted">{description}</p> : null}</div>
      <FieldGroup className="mt-5">{children}</FieldGroup>
      <div className="mt-6 flex flex-wrap gap-3 border-t border-border-subtle pt-5"><Button type="button" className="min-h-11" disabled={saving} onClick={onSave}><Save className="size-4" />{saving ? "…" : saveLabel}</Button>{secondaryAction ? <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={secondaryAction.onClick}>{secondaryAction.label}</Button> : null}</div>
    </PageSectionCard>
  );
}

export default function AdminHackathonEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [locale, setLocale] = useState<Locale>("vi");
  const requestedSection = location.hash.slice(1) as SectionId;
  const activeSection = !isNew && SECTIONS.includes(requestedSection) ? requestedSection : "overview";
  const [draftState, setDraftState] = useState<Draft | null>(isNew ? emptyDraft() : null);
  const [dirty, setDirty] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [hostLogoFile, setHostLogoFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [hostLogoPreviewUrl, setHostLogoPreviewUrl] = useState<string | null>(null);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [hostLogoRemoved, setHostLogoRemoved] = useState(false);
  const [winnerProjectId, setWinnerProjectId] = useState("");
  const [winnerLabel, setWinnerLabel] = useState("");
  const [translating, setTranslating] = useState(false);
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
      cover_image_path: contest.cover_image_path ?? "",
      mode: contest.mode ?? contest.location,
      host_name: contest.host?.name ?? "",
      host_logo_url: contest.host?.logo_url ?? "",
      host_logo_path: contest.host?.logo_path ?? "",
      host_website_url: contest.host?.website_url ?? "",
      telegram: contest.social_links?.telegram ?? "",
      x: contest.social_links?.x ?? "",
      facebook: contest.social_links?.facebook ?? "",
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
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => () => { if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl); }, [bannerPreviewUrl]);
  useEffect(() => () => { if (hostLogoPreviewUrl) URL.revokeObjectURL(hostLogoPreviewUrl); }, [hostLogoPreviewUrl]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.hash]);
  useEffect(() => {
    if (!isNew || !location.hash || location.hash === "#overview") return;
    navigate({ pathname: location.pathname, search: location.search, hash: "overview" }, { replace: true });
  }, [isNew, location.hash, location.pathname, location.search, navigate]);

  const projectsQuery = useInfiniteQuery({ ...publicProjectDirectoryQueryOptions("vi", "hackathon", "newest", { hackathonId: id ?? null, winnerProjectIds: draft.winner_awards.map((award) => award.project_id) }), enabled: Boolean(id) });
  const projects = useMemo(() => projectsQuery.data?.pages.flatMap((page) => page.items) ?? [], [projectsQuery.data?.pages]);
  const projectAwardOptions = useMemo(
    () =>
      projects.map(({ project, owner }) => ({
        id: project.id,
        label: project.title,
        description: owner?.username ? `@${owner.username}` : (owner?.full_name ?? null),
      })),
    [projects],
  );
  const localized = draft.locales[locale];
  const change = (patch: Partial<Draft>) => { setDraft((current) => ({ ...current, ...patch })); setDirty(true); };
  const changeLocale = (patch: Partial<LocaleDraft>) => { setDraft((current) => ({ ...current, locales: { ...current.locales, [locale]: { ...current.locales[locale], ...patch } } })); setDirty(true); };
  const validate = () => {
    if (!draft.locales.vi.title.trim()) {
      throw new EditorValidationError(t("hackathons.editor.validationRequired"), "overview", "hackathon-title");
    }
    if (!canonicalizeSlug(draft.slug)) {
      throw new EditorValidationError(t("hackathons.editor.validationRequired"), "overview", "hackathon-slug");
    }
    if (!/^[A-Z0-9]{2,10}$/.test(draft.prize_currency.trim().toUpperCase())) {
      throw new EditorValidationError(t("hackathons.editor.validationCurrency"), "prizes", "hackathon-currency");
    }
    if (!isPrizeAllocationValid(draft.prize_amount, draft.locales.vi.tracks)) {
      throw new EditorValidationError(t("hackathons.editor.validationPrize"), "prizes", "hackathon-prize-amount");
    }
    for (let i = 0; i < draft.locales.vi.tracks.length; i++) {
      const track = draft.locales.vi.tracks[i];
      if (!track.name?.trim()) {
        throw new EditorValidationError(
          t("hackathons.editor.validationTrackNameRequired", { number: i + 1 }),
          "prizes",
          `hackathon-track-name-${track.id}`
        );
      }
    }
    if (draft.registration_deadline && draft.submission_deadline && draft.registration_deadline > draft.submission_deadline) {
      throw new EditorValidationError(t("hackathons.editor.validationDeadlines"), "overview", "hackathon-registration-deadline");
    }
    if (!isValidHackathonSocialLink("telegram", draft.telegram)) {
      throw new EditorValidationError(t("hackathons.editor.validationTelegram"), "overview", "hackathon-telegram");
    }
    if (!isValidHackathonSocialLink("x", draft.x)) {
      throw new EditorValidationError(t("hackathons.editor.validationX"), "overview", "hackathon-x");
    }
    if (!isValidHackathonSocialLink("facebook", draft.facebook)) {
      throw new EditorValidationError(t("hackathons.editor.validationFacebook"), "overview", "hackathon-facebook");
    }
  };
  const localePayload = (target: Locale): ContestI18nContent => ({
    title: draft.locales[target].title,
    short_description: draft.locales[target].short_description,
    description_markdown: draft.locales[target].description_markdown,
    resources_markdown: draft.locales[target].resources_markdown,
    prize_description_markdown: draft.locales[target].prize_description_markdown,
    tracks: draft.locales[target].tracks.filter((track) => {
      const viName = draft.locales.vi.tracks.find((item) => item.id === track.id)?.name?.trim();
      return Boolean(viName || track.name?.trim());
    }),
    sectors: draft.locales[target].sectors,
    tech_stacks: draft.locales[target].tech_stacks,
    timeline: draft.locales[target].timeline,
  });
  const payload = () => ({
    slug: canonicalizeSlug(draft.slug),
    title: draft.locales.vi.title,
    tagline: draft.locales.vi.short_description,
    short_description: draft.locales.vi.short_description,
    description_markdown: draft.locales.vi.description_markdown,
    resources_markdown: draft.locales.vi.resources_markdown,
    status: draft.status,
    registration_deadline: draft.registration_deadline ? new Date(draft.registration_deadline).toISOString() : null,
    submission_deadline: draft.submission_deadline ? new Date(draft.submission_deadline).toISOString() : null,
    location: draft.mode,
    mode: draft.mode,
    cover_image_url: bannerRemoved ? null : draft.cover_image_url || null,
    cover_image_path: bannerRemoved ? null : draft.cover_image_path || null,
    host: { name: draft.host_name, logo_url: hostLogoRemoved ? null : draft.host_logo_url || null, logo_path: hostLogoRemoved ? null : draft.host_logo_path || null, website_url: draft.host_website_url || null },
    social_links: {
      telegram: normalizeHackathonSocialLink("telegram", draft.telegram) || null,
      x: normalizeHackathonSocialLink("x", draft.x) || null,
      facebook: normalizeHackathonSocialLink("facebook", draft.facebook) || null,
    },
    prize_pool: { amount: draft.prize_amount || "0", currency: draft.prize_currency.trim().toUpperCase(), description_markdown: draft.locales.vi.prize_description_markdown },
    tracks: draft.locales.vi.tracks.filter((item) => item.name?.trim()),
    sectors: draft.locales.vi.sectors,
    tech_stacks: draft.locales.vi.tech_stacks,
    timeline: draft.locales.vi.timeline,
    winner_awards: draft.winner_awards,
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      validate();
      let contest: Contest;
      if (isNew) {
        contest = await createContest(payload());
        await Promise.all([setHackathonLocaleContent(contest.id, "vi", localePayload("vi")), setHackathonLocaleContent(contest.id, "en", localePayload("en"))]);
      } else {
        contest = await updateContest(id!, payload());
        await Promise.all([setHackathonLocaleContent(id!, "vi", localePayload("vi")), setHackathonLocaleContent(id!, "en", localePayload("en"))]);
      }

      const [banner, hostLogo] = await Promise.all([
        bannerFile ? uploadContestBanner(contest.id, bannerFile, draft.cover_image_path || null) : Promise.resolve(null),
        hostLogoFile ? uploadContestHostLogo(contest.id, hostLogoFile, draft.host_logo_path || null) : Promise.resolve(null),
      ]);
      if (banner || hostLogo) {
        contest = await updateContest(contest.id, {
          ...(banner ? { cover_image_url: banner.url, cover_image_path: banner.path } : {}),
          ...(hostLogo ? { host: { name: draft.host_name, website_url: draft.host_website_url || null, logo_url: hostLogo.url, logo_path: hostLogo.path } } : {}),
        });
      }
      await Promise.all([
        bannerRemoved && !bannerFile ? deleteStorageObjectByPath(draft.cover_image_path) : Promise.resolve(),
        hostLogoRemoved && !hostLogoFile ? deleteStorageObjectByPath(draft.host_logo_path) : Promise.resolve(),
      ]);
      if (draft.winner_awards.length > 0) {
        try {
          await notifyHackathonWinnerAwards(
            contest.id,
            draft.winner_awards.map((award) => ({
              project_id: award.project_id,
              label: award.label,
            })),
          );
        } catch (awardErr) {
          console.warn("[AdminHackathonEditor] Failed to notify winner awards:", awardErr);
        }
      }
      return { contest, banner, hostLogo };
    },
    onSuccess: async ({ contest, banner, hostLogo }) => {
      setDraft((current) => ({
        ...current,
        cover_image_url: banner?.url ?? (bannerRemoved ? "" : current.cover_image_url),
        cover_image_path: banner?.path ?? (bannerRemoved ? "" : current.cover_image_path),
        host_logo_url: hostLogo?.url ?? (hostLogoRemoved ? "" : current.host_logo_url),
        host_logo_path: hostLogo?.path ?? (hostLogoRemoved ? "" : current.host_logo_path),
      }));
      setBannerFile(null);
      setHostLogoFile(null);
      setBannerPreviewUrl(null);
      setHostLogoPreviewUrl(null);
      setBannerRemoved(false);
      setHostLogoRemoved(false);
      setDirty(false);
      toast.success(t("hackathons.editor.saved"));
      await queryClient.invalidateQueries({ queryKey: ["hackathons"] });
      if (isNew) navigate(`/admin/hackathons/${contest.id}/edit#overview`, { replace: true });
    },
    onError: (error) => {
      if (error instanceof EditorValidationError) {
        selectSection(error.section);
        toast.error(error.message);
        if (error.fieldId) {
          setTimeout(() => {
            const el = document.getElementById(error.fieldId!);
            if (el) {
              el.focus();
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 150);
        }
        return;
      }
      toast.error(error instanceof Error ? error.message : t("hackathons.editor.saveFailed"));
    },
  });
  const save = () => saveMutation.mutate();
  const leaveEditor = () => {
    if (dirty && !window.confirm(t("hackathons.editor.leaveConfirm"))) return;
    navigate("/admin/hackathons");
  };
  const selectSection = (section: SectionId) => {
    if (isNew && section !== "overview") return;
    if (location.hash !== `#${section}`) navigate({ pathname: location.pathname, search: location.search, hash: section });
  };
  const addTrack = () => {
    const track: ContestTrack = { id: crypto.randomUUID(), name: "", description: "", prize_amount: "0", active: true, sort_order: draft.locales.vi.tracks.length };
    setDraft((current) => ({ ...current, locales: { vi: { ...current.locales.vi, tracks: [...current.locales.vi.tracks, track] }, en: { ...current.locales.en, tracks: [...current.locales.en.tracks, { ...track, name: "", description: "" }] } } }));
    setDirty(true);
    toast.success(t("hackathons.editor.trackAdded"));
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
  const removeTimeline = (timelineId: string) => {
    const withoutItem = (items: HackathonTimelineItem[]) => items
      .filter((item) => item.id !== timelineId)
      .map((item, sortOrder) => ({ ...item, sort_order: sortOrder }));
    setDraft((current) => ({
      ...current,
      locales: {
        vi: { ...current.locales.vi, timeline: withoutItem(current.locales.vi.timeline) },
        en: { ...current.locales.en, timeline: withoutItem(current.locales.en.timeline) },
      },
    }));
    setDirty(true);
  };

  const translateAllContent = async () => {
    if (!id || translating) return;
    const sourceLocale: Locale = locale === "vi" ? "en" : "vi";
    const source = draft.locales[sourceLocale];
    const target = draft.locales[locale];
    const hasSource = Boolean(
      source.title.trim() ||
      source.short_description.trim() ||
      source.description_markdown.trim() ||
      source.resources_markdown.trim() ||
      source.prize_description_markdown.trim() ||
      source.tracks.some((item) => item.name.trim() || item.description?.trim()) ||
      source.sectors.some((item) => item.name.trim() || item.description?.trim()) ||
      source.tech_stacks.some((item) => item.name.trim() || item.description?.trim()) ||
      source.timeline.some((item) => item.title.trim() || item.description_markdown?.trim()),
    );
    if (!hasSource) {
      toast.error(t("hackathons.editor.aiTranslation.noSource", { source: sourceLocale.toUpperCase() }));
      return;
    }
    const targetHasContent = Boolean(
      target.title.trim() ||
      target.short_description.trim() ||
      target.description_markdown.trim() ||
      target.resources_markdown.trim() ||
      target.prize_description_markdown.trim() ||
      target.tracks.some((row) => row.name.trim() || row.description?.trim()) ||
      target.sectors.some((row) => row.name.trim() || row.description?.trim()) ||
      target.tech_stacks.some((row) => row.name.trim() || row.description?.trim()) ||
      target.timeline.some((row) => row.title.trim() || row.description_markdown?.trim()),
    );
    if (targetHasContent && !window.confirm(t("hackathons.editor.aiTranslation.overwriteConfirm", { target: locale.toUpperCase() }))) return;

    const item = (value: { id: string; name?: string; title?: string; description?: string | null; description_markdown?: string | null }): HackathonTranslationItem => ({
      id: value.id,
      name: value.name,
      title: value.title,
      description: value.description ?? undefined,
      descriptionMarkdown: value.description_markdown ?? undefined,
    });
    const sourceBundle: DescriptionTranslationBundle = {
      title: source.title,
      shortDescription: source.short_description,
      markdownDescription: source.description_markdown,
      resourcesMarkdown: source.resources_markdown,
      prizeDescriptionMarkdown: source.prize_description_markdown,
      tracks: source.tracks.map(item),
      sectors: source.sectors.map(item),
      techStacks: source.tech_stacks.map(item),
      timeline: source.timeline.map(item),
    };

    setTranslating(true);
    try {
      const response = await invokeGenerateDescription({
        action: "translate",
        type: "hackathon",
        targetField: "description",
        locale,
        sourceLocale,
        bundleKind: "hackathon",
        sourceBundle,
        hackathonId: id,
      });
      const translated = response.bundle;
      if (!translated) throw new Error(t("hackathons.editor.aiTranslation.invalidResponse"));
      const translatedTracks = new Map(translated.tracks?.map((row) => [row.id, row]));
      const translatedSectors = new Map(translated.sectors?.map((row) => [row.id, row]));
      const translatedTechStacks = new Map(translated.techStacks?.map((row) => [row.id, row]));
      const translatedTimeline = new Map(translated.timeline?.map((row) => [row.id, row]));
      setDraft((current) => {
        const currentSource = current.locales[sourceLocale];
        const currentTarget = current.locales[locale];
        const targetTrackById = new Map(currentTarget.tracks.map((row) => [row.id, row]));
        const targetSectorById = new Map(currentTarget.sectors.map((row) => [row.id, row]));
        const targetTechStackById = new Map(currentTarget.tech_stacks.map((row) => [row.id, row]));
        const targetTimelineById = new Map(currentTarget.timeline.map((row) => [row.id, row]));
        const nextLocale: LocaleDraft = {
          ...currentTarget,
          title: translated.title ?? currentTarget.title,
          short_description: translated.shortDescription ?? currentTarget.short_description,
          description_markdown: translated.markdownDescription ?? currentTarget.description_markdown,
          resources_markdown: translated.resourcesMarkdown ?? currentTarget.resources_markdown,
          prize_description_markdown: translated.prizeDescriptionMarkdown ?? currentTarget.prize_description_markdown,
          tracks: currentSource.tracks.map((sourceRow, index) => {
            const currentRow = targetTrackById.get(sourceRow.id) ?? sourceRow;
            const translatedRow = translatedTracks.get(sourceRow.id);
            return { ...currentRow, id: sourceRow.id, name: translatedRow?.name ?? currentRow.name, description: translatedRow?.description ?? currentRow.description, prize_amount: sourceRow.prize_amount, active: sourceRow.active, sort_order: index };
          }),
          sectors: currentSource.sectors.map((sourceRow, index) => {
            const currentRow = targetSectorById.get(sourceRow.id) ?? sourceRow;
            const translatedRow = translatedSectors.get(sourceRow.id);
            return { ...currentRow, id: sourceRow.id, name: translatedRow?.name ?? currentRow.name, description: translatedRow?.description ?? currentRow.description, active: sourceRow.active, sort_order: index };
          }),
          tech_stacks: currentSource.tech_stacks.map((sourceRow, index) => {
            const currentRow = targetTechStackById.get(sourceRow.id) ?? sourceRow;
            const translatedRow = translatedTechStacks.get(sourceRow.id);
            return { ...currentRow, id: sourceRow.id, name: translatedRow?.name ?? currentRow.name, description: translatedRow?.description ?? currentRow.description, active: sourceRow.active, sort_order: index };
          }),
          timeline: currentSource.timeline.map((sourceRow, index) => {
            const currentRow = targetTimelineById.get(sourceRow.id) ?? sourceRow;
            const translatedRow = translatedTimeline.get(sourceRow.id);
            return { ...currentRow, id: sourceRow.id, title: translatedRow?.title ?? currentRow.title, description_markdown: translatedRow?.descriptionMarkdown ?? currentRow.description_markdown, starts_at: sourceRow.starts_at, ends_at: sourceRow.ends_at, sort_order: index };
          }),
        };
        return { ...current, locales: { ...current.locales, [locale]: nextLocale } };
      });
      setDirty(true);
      toast.success(t("hackathons.editor.aiTranslation.applied", { source: sourceLocale.toUpperCase(), target: locale.toUpperCase() }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("hackathons.editor.aiTranslation.failed"));
    } finally {
      setTranslating(false);
    }
  };

  if (!isNew && editorQuery.isPending) return <div className="p-12 text-center text-sm text-foreground-muted">{t("hackathons.loading")}</div>;
  if (!isNew && !editorQuery.data) return <div className="p-12 text-center">{t("hackathons.editor.notFound")}</div>;

  return (
    <PageContainer>
      <PageSectionCard className="mb-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <Button type="button" variant="ghost" size="icon" className="-ml-2 size-11 shrink-0" aria-label={t("hackathons.editor.back")} title={t("hackathons.editor.back")} onClick={leaveEditor}><ArrowLeft className="size-4" /></Button>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Trophy className="size-5" /></div>
            <div className="min-w-0"><h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{isNew ? t("hackathons.editor.newTitle") : draft.locales.vi.title || t("hackathons.editor.editTitle")}</h1><p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-5 text-foreground-muted">{t(isNew ? "hackathons.editor.newIntro" : "hackathons.editor.editIntro")}</p></div>
          </div>

          <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
            <span className="inline-flex min-h-9 items-center rounded-full border border-border-subtle bg-surface-raised px-3 text-xs font-medium text-foreground">{t(`hackathons.editor.status.${draft.status}`)}</span>
            <span className="inline-flex min-h-9 items-center rounded-full border border-border-subtle bg-surface-raised px-3 text-xs font-medium text-foreground">{t(`hackathons.editor.modes.${draft.mode}`)}</span>
            <div className="flex min-h-11 items-center gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1" role="group" aria-label={t("hackathons.editor.editingLanguage")}>
              {(["vi", "en"] as Locale[]).map((item) => <button type="button" key={item} aria-pressed={item === locale} onClick={() => setLocale(item)} className={cn("flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", item === locale ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground-muted hover:bg-background hover:text-foreground")}><span aria-hidden>{item === "vi" ? "🇻🇳" : "🇬🇧"}</span>{item.toUpperCase()}{item === "vi" ? <span className="rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px] leading-none">{t("hackathons.editor.primaryBadge")}</span> : null}</button>)}
            </div>
            {!isNew ? <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={translating} onClick={() => void translateAllContent()}>{translating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{translating ? t("hackathons.editor.aiTranslation.translating") : t("hackathons.editor.aiTranslation.action", { source: locale === "vi" ? "EN" : "VI", target: locale.toUpperCase() })}</Button> : null}
            {dirty ? <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 text-xs font-medium text-warning"><AlertTriangle className="size-3.5 shrink-0" />{t("hackathons.editor.unsaved")}</span> : null}
            <Button type="button" className="min-h-11" disabled={saveMutation.isPending} onClick={save}><Save className="size-4" />{saveMutation.isPending ? "…" : t(isNew ? "hackathons.editor.createDraft" : "hackathons.editor.saveSection")}</Button>
          </div>
        </div>
      </PageSectionCard>

      <div className="flex flex-col gap-4 xl:flex-row">
        <nav aria-label={t("hackathons.editor.sidebarTitle")} className="min-w-0 rounded-xl border border-border-subtle bg-surface-base p-2 shadow-card xl:sticky xl:top-16 xl:w-60 xl:shrink-0 xl:self-start">
          <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("hackathons.editor.sidebarTitle")}</p>
          <ul className="flex gap-1 overflow-x-auto pb-1 xl:grid xl:overflow-visible xl:pb-0">
            {SECTIONS.map((section) => { const Icon = SECTION_ICONS[section]; const locked = isNew && section !== "overview"; return <li key={section} className={cn("shrink-0 xl:shrink", section === "danger" && "border-l border-border-subtle pl-1 xl:mt-1 xl:border-l-0 xl:border-t xl:pl-0 xl:pt-2")}><button type="button" disabled={locked} aria-current={activeSection === section ? "page" : undefined} onClick={() => selectSection(section)} className={cn("flex min-h-11 w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 xl:whitespace-normal", activeSection === section ? section === "danger" ? "bg-destructive/10 font-medium text-destructive" : "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : locked ? "cursor-not-allowed text-foreground-muted opacity-45" : section === "danger" ? "text-foreground-muted hover:bg-destructive/10 hover:text-destructive" : "text-foreground-muted hover:bg-surface-raised hover:text-foreground")}><Icon className="size-4 shrink-0" />{t(`hackathons.editor.sections.${section}`)}</button></li>; })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          {activeSection === "overview" ? <EditorSection title={t("hackathons.editor.sections.overview")} description={t("hackathons.editor.sectionDescriptions.overview")} onSave={save} saving={saveMutation.isPending} saveLabel={t(isNew ? "hackathons.editor.createDraft" : "hackathons.editor.saveSection")} secondaryAction={isNew ? { label: t("hackathons.editor.cancel"), onClick: leaveEditor } : undefined}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="hackathon-title">{t("hackathons.editor.fields.title")} <span className="text-primary">*</span> <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">{locale.toUpperCase()}</span></FieldLabel><Input id="hackathon-title" value={localized.title} onChange={(event) => changeLocale({ title: event.target.value })} onBlur={() => { if (!draft.slug.trim() && localized.title.trim()) change({ slug: canonicalizeSlug(localized.title) }); }} /></Field>
              <Field><FieldLabel htmlFor="hackathon-slug">{t("hackathons.editor.fields.slug")} <span className="text-primary">*</span></FieldLabel><Input id="hackathon-slug" value={draft.slug} onChange={(event) => change({ slug: normalizeSlugDraft(event.target.value) })} onBlur={() => { const slug = canonicalizeSlug(draft.slug); if (slug !== draft.slug) change({ slug }); }} /></Field>
            </div>
            <Field><FieldLabel>{t("hackathons.editor.fields.shortDescription")} <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">{locale.toUpperCase()}</span></FieldLabel><textarea className={textareaClass} value={localized.short_description} onChange={(event) => changeLocale({ short_description: event.target.value })} /></Field>
            <Field><FieldLabel>{t("hackathons.editor.fields.banner")}</FieldLabel><div className="relative flex h-44 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-overlay sm:h-56 2xl:h-64">{bannerPreviewUrl || (!bannerRemoved && draft.cover_image_url) ? <img src={bannerPreviewUrl ?? draft.cover_image_url} alt={t("hackathons.editor.fields.bannerPreviewAlt")} className="absolute inset-0 size-full object-cover" /> : <div className="flex flex-col items-center gap-2 px-6 text-center text-foreground-muted"><ImageIcon className="size-9" /><p className="text-sm font-medium">{t("hackathons.editor.fields.bannerEmpty")}</p><p className="text-xs">{t("hackathons.editor.fields.bannerHint")}</p></div>}<div className="absolute bottom-3 right-3 flex items-center gap-2">{bannerPreviewUrl || (!bannerRemoved && draft.cover_image_url) ? <Button type="button" variant="secondary" size="icon-lg" className="min-h-11 min-w-11 border border-border bg-background/90 shadow-sm backdrop-blur" aria-label={t("hackathons.editor.removeImage")} onClick={() => { setBannerFile(null); setBannerPreviewUrl(null); setBannerRemoved(true); setDirty(true); }}><Trash2 className="size-4" /></Button> : null}<label htmlFor="hackathon-banner-upload" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border bg-background/90 px-4 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background focus-within:ring-2 focus-within:ring-primary/40"><Camera className="size-4" />{bannerPreviewUrl || (!bannerRemoved && draft.cover_image_url) ? t("hackathons.editor.fields.changeBanner") : t("hackathons.editor.fields.uploadBanner")}</label><Input id="hackathon-banner-upload" className="sr-only" type="file" accept="image/*" aria-label={t("hackathons.editor.fields.banner")} onChange={(event) => { const file = event.target.files?.[0] ?? null; setBannerFile(file); setBannerPreviewUrl(file ? URL.createObjectURL(file) : null); setBannerRemoved(false); if (file) setDirty(true); event.target.value = ""; }} /></div></div></Field>
            <div className="grid gap-4 rounded-xl border border-border-subtle bg-surface-raised/60 p-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center"><div><p className="text-sm font-medium">{t("hackathons.editor.fields.hostLogo")}</p><div className="relative mt-2 flex aspect-square w-32 items-center justify-center overflow-hidden rounded-lg border border-border bg-white text-foreground-muted">{hostLogoPreviewUrl || (!hostLogoRemoved && draft.host_logo_url) ? <img src={hostLogoPreviewUrl ?? draft.host_logo_url} alt={t("hackathons.editor.fields.hostLogoPreviewAlt")} className="size-full object-contain p-3" /> : <ImageIcon className="size-8" />}<label htmlFor="hackathon-host-logo-upload" className="absolute bottom-2 right-2 flex size-11 cursor-pointer items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-sm transition-colors hover:bg-surface-raised focus-within:ring-2 focus-within:ring-primary/40" title={t("hackathons.editor.fields.changeHostLogo")}><Camera className="size-4" /></label><Input id="hackathon-host-logo-upload" className="sr-only" type="file" accept="image/*" aria-label={t("hackathons.editor.fields.hostLogo")} onChange={(event) => { const file = event.target.files?.[0] ?? null; setHostLogoFile(file); setHostLogoPreviewUrl(file ? URL.createObjectURL(file) : null); setHostLogoRemoved(false); if (file) setDirty(true); event.target.value = ""; }} /></div><p className="mt-2 text-xs leading-5 text-foreground-muted">{t("hackathons.editor.fields.hostLogoHint")}</p>{hostLogoPreviewUrl || (!hostLogoRemoved && draft.host_logo_url) ? <Button type="button" variant="ghost" size="sm" className="mt-1 text-foreground-muted hover:text-destructive" onClick={() => { setHostLogoFile(null); setHostLogoPreviewUrl(null); setHostLogoRemoved(true); setDirty(true); }}><Trash2 className="size-4" />{t("hackathons.editor.removeImage")}</Button> : null}</div><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>{t("hackathons.editor.fields.host")}</FieldLabel><Input value={draft.host_name} onChange={(event) => change({ host_name: event.target.value })} /></Field><Field><FieldLabel>{t("hackathons.editor.fields.hostWebsite")}</FieldLabel><Input type="url" value={draft.host_website_url} onChange={(event) => change({ host_website_url: event.target.value })} /></Field><Field><FieldLabel>{t("hackathons.editor.fields.mode")}</FieldLabel><select className={inputClass} value={draft.mode} onChange={(event) => change({ mode: event.target.value as ContestLocation })}>{(["online", "offline", "hybrid"] as ContestLocation[]).map((mode) => <option key={mode} value={mode}>{t(`hackathons.editor.modes.${mode}`)}</option>)}</select></Field></div></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="hackathon-telegram">{t("hackathons.editor.fields.telegram")}</FieldLabel>
                <Input id="hackathon-telegram" type="text" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={t("hackathons.editor.fields.telegramPlaceholder")} value={draft.telegram} onChange={(event) => change({ telegram: event.target.value })} onBlur={() => { const telegram = normalizeHackathonSocialLink("telegram", draft.telegram); if (draft.telegram.trim() && !isValidHackathonSocialLink("telegram", draft.telegram)) { toast.error(t("hackathons.editor.validationTelegram")); } else if (telegram !== draft.telegram) { change({ telegram }); } }} />
                <FieldDescription>{t("hackathons.editor.fields.telegramHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="hackathon-x">{t("hackathons.editor.fields.x")}</FieldLabel>
                <Input id="hackathon-x" type="url" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={t("hackathons.editor.fields.xPlaceholder")} value={draft.x} onChange={(event) => change({ x: event.target.value })} onBlur={() => { if (draft.x.trim() && !isValidHackathonSocialLink("x", draft.x)) { toast.error(t("hackathons.editor.validationX")); } }} />
                <FieldDescription>{t("hackathons.editor.fields.fullUrlHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="hackathon-facebook">{t("hackathons.editor.fields.facebook")}</FieldLabel>
                <Input id="hackathon-facebook" type="url" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={t("hackathons.editor.fields.facebookPlaceholder")} value={draft.facebook} onChange={(event) => change({ facebook: event.target.value })} onBlur={() => { if (draft.facebook.trim() && !isValidHackathonSocialLink("facebook", draft.facebook)) { toast.error(t("hackathons.editor.validationFacebook")); } }} />
                <FieldDescription>{t("hackathons.editor.fields.fullUrlHint")}</FieldDescription>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="hackathon-registration-deadline">{t("hackathons.editor.fields.registration_deadline")}</FieldLabel><Input id="hackathon-registration-deadline" type="datetime-local" value={draft.registration_deadline} onChange={(event) => change({ registration_deadline: event.target.value })} /></Field>
              <Field><FieldLabel htmlFor="hackathon-submission-deadline">{t("hackathons.editor.fields.submission_deadline")}</FieldLabel><Input id="hackathon-submission-deadline" type="datetime-local" value={draft.submission_deadline} onChange={(event) => change({ submission_deadline: event.target.value })} /></Field>
            </div>
          </EditorSection> : null}

          {activeSection === "description" && !isNew ? <EditorSection title={t("hackathons.editor.sections.description")} description={t("hackathons.editor.sectionDescriptions.description")} onSave={save} saving={saveMutation.isPending} saveLabel={t("hackathons.editor.saveSection")}><Field><FieldLabel>{t("hackathons.editor.fields.markdown")} <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">{locale.toUpperCase()}</span></FieldLabel><textarea className={`${textareaClass} min-h-80 font-mono leading-6`} value={localized.description_markdown} onChange={(event) => changeLocale({ description_markdown: event.target.value })} /></Field></EditorSection> : null}

          {activeSection === "prizes" && !isNew ? <EditorSection title={t("hackathons.editor.sections.prizes")} description={t("hackathons.editor.sectionDescriptions.prizes")} onSave={save} saving={saveMutation.isPending} saveLabel={t("hackathons.editor.saveSection")}><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="hackathon-prize-amount">{t("hackathons.editor.fields.totalPrize")} <span className="text-primary">*</span></FieldLabel><Input id="hackathon-prize-amount" inputMode="decimal" value={draft.prize_amount} onChange={(event) => change({ prize_amount: event.target.value })} /></Field><Field><FieldLabel htmlFor="hackathon-currency">{t("hackathons.editor.fields.currency")}</FieldLabel><Input id="hackathon-currency" value={draft.prize_currency} maxLength={10} onChange={(event) => change({ prize_currency: event.target.value.toUpperCase() })} /></Field></div><Field><FieldLabel>{t("hackathons.editor.fields.prizeDescription")} <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">{locale.toUpperCase()}</span></FieldLabel><textarea className={textareaClass} value={localized.prize_description_markdown} onChange={(event) => changeLocale({ prize_description_markdown: event.target.value })} /></Field><div><div className="flex items-center justify-between"><h3 className="font-semibold text-foreground">{t("hackathons.editor.fields.tracks")}</h3><Button type="button" variant="outline" size="sm" onClick={addTrack}><Plus className="size-4" />{t("hackathons.editor.add")}</Button></div>{localized.tracks.length === 0 ? <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground-muted">{t("hackathons.editor.noTracks")}</div> : null}<div className="mt-3 space-y-3">{localized.tracks.map((track, index) => { const prizeAmount = draft.locales.vi.tracks.find((item) => item.id === track.id)?.prize_amount ?? "0"; return <div key={track.id} className="rounded-xl border border-border-subtle bg-surface-raised p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{t("hackathons.editor.trackNumber", { number: index + 1 })}</span><Button type="button" variant="ghost" size="icon" className="text-foreground-muted hover:text-destructive" aria-label={t("hackathons.editor.removeTrack")} onClick={() => removeTrack(track.id)}><Trash2 className="size-4" /></Button></div><div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]"><Field><FieldLabel htmlFor={`hackathon-track-name-${track.id}`}>{t("hackathons.editor.trackName")} ({locale.toUpperCase()}) <span className="text-primary">*</span></FieldLabel><Input id={`hackathon-track-name-${track.id}`} value={track.name} placeholder={t("hackathons.editor.trackNamePlaceholder")} onChange={(event) => changeLocale({ tracks: localized.tracks.map((item) => item.id === track.id ? { ...item, name: event.target.value } : item) })} /></Field><Field><FieldLabel>{t("hackathons.editor.trackPrize")}</FieldLabel><Input disabled={locale !== "vi"} inputMode="decimal" value={prizeAmount} onChange={(event) => { const tracks = draft.locales.vi.tracks.map((item) => item.id === track.id ? { ...item, prize_amount: event.target.value } : item); setDraft((current) => ({ ...current, locales: { ...current.locales, vi: { ...current.locales.vi, tracks } } })); setDirty(true); }} /></Field></div><Field className="mt-4"><FieldLabel>{t("hackathons.editor.trackDescription")} ({locale.toUpperCase()})</FieldLabel><textarea className={`${textareaClass} min-h-24`} value={track.description ?? ""} placeholder={t("hackathons.editor.trackDescriptionPlaceholder")} onChange={(event) => changeLocale({ tracks: localized.tracks.map((item) => item.id === track.id ? { ...item, description: event.target.value } : item) })} /></Field></div>; })}</div></div></EditorSection> : null}

          {activeSection === "timeline" && !isNew ? <EditorSection title={t("hackathons.editor.sections.timeline")} description={t("hackathons.editor.sectionDescriptions.timeline")} onSave={save} saving={saveMutation.isPending} saveLabel={t("hackathons.editor.saveSection")}><div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={addTimeline}><Plus className="size-4" />{t("hackathons.editor.add")}</Button></div>{localized.timeline.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-foreground-muted">{t("hackathons.editor.noTimeline")}</div> : null}{localized.timeline.map((item, index) => <div key={item.id} className="rounded-xl border border-border-subtle bg-surface-raised p-4"><div className="flex items-start justify-between gap-3"><span className="text-sm font-semibold">{t("hackathons.editor.timelineNumber", { number: index + 1 })}</span><Button type="button" variant="ghost" size="icon" className="text-foreground-muted hover:text-destructive" aria-label={t("hackathons.editor.removeTimeline")} onClick={() => removeTimeline(item.id)}><Trash2 className="size-4" /></Button></div><Field className="mt-3"><FieldLabel>{t("hackathons.editor.timelineTitle")} ({locale.toUpperCase()})</FieldLabel><Input value={item.title} onChange={(event) => changeLocale({ timeline: localized.timeline.map((row) => row.id === item.id ? { ...row, title: event.target.value } : row) })} /></Field><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field><FieldLabel>{t("hackathons.editor.timelineStarts")}</FieldLabel><Input type="datetime-local" disabled={locale !== "vi"} value={dateInput(draft.locales.vi.timeline[index]?.starts_at)} onChange={(event) => { const timeline = draft.locales.vi.timeline.map((row) => row.id === item.id ? { ...row, starts_at: new Date(event.target.value).toISOString() } : row); setDraft((current) => ({ ...current, locales: { ...current.locales, vi: { ...current.locales.vi, timeline } } })); setDirty(true); }} /></Field><Field><FieldLabel>{t("hackathons.editor.timelineEnds")}</FieldLabel><Input type="datetime-local" disabled={locale !== "vi"} value={dateInput(draft.locales.vi.timeline[index]?.ends_at)} onChange={(event) => { const timeline = draft.locales.vi.timeline.map((row) => row.id === item.id ? { ...row, ends_at: event.target.value ? new Date(event.target.value).toISOString() : null } : row); setDraft((current) => ({ ...current, locales: { ...current.locales, vi: { ...current.locales.vi, timeline } } })); setDirty(true); }} /></Field></div><Field className="mt-4"><FieldLabel>{t("hackathons.editor.fields.timelineDescription")} ({locale.toUpperCase()})</FieldLabel><textarea className={textareaClass} value={item.description_markdown ?? ""} onChange={(event) => changeLocale({ timeline: localized.timeline.map((row) => row.id === item.id ? { ...row, description_markdown: event.target.value } : row) })} /></Field></div>)}</EditorSection> : null}

          {activeSection === "resources" && !isNew ? <EditorSection title={t("hackathons.editor.sections.resources")} description={t("hackathons.editor.sectionDescriptions.resources")} onSave={save} saving={saveMutation.isPending} saveLabel={t("hackathons.editor.saveSection")}><Field><FieldLabel>{t("hackathons.editor.fields.markdown")} <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">{locale.toUpperCase()}</span></FieldLabel><textarea className={`${textareaClass} min-h-80 font-mono leading-6`} value={localized.resources_markdown} onChange={(event) => changeLocale({ resources_markdown: event.target.value })} /></Field></EditorSection> : null}

          {activeSection === "taxonomy" && !isNew ? <EditorSection title={t("hackathons.editor.sections.taxonomy")} description={t("hackathons.editor.taxonomyHint")} onSave={save} saving={saveMutation.isPending} saveLabel={t("hackathons.editor.saveSection")}>{(["sectors", "tech_stacks"] as const).map((key) => <div key={key}><div className="flex items-center justify-between"><h3 className="font-semibold text-foreground">{t(`hackathons.editor.fields.${key}`)}</h3><Button type="button" variant="outline" size="sm" onClick={() => addTaxonomy(key)}><Plus className="size-4" />{t("hackathons.editor.add")}</Button></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{localized[key].map((option) => <div key={option.id} className={cn("flex gap-2 rounded-xl border border-border-subtle bg-surface-raised p-3", option.active === false && "opacity-60")}><Input value={option.name} onChange={(event) => changeLocale({ [key]: localized[key].map((row) => row.id === option.id ? { ...row, name: event.target.value } : row) })} /><Button type="button" variant="outline" size="sm" onClick={() => { const update = (target: Locale) => draft.locales[target][key].map((row) => row.id === option.id ? { ...row, active: row.active === false } : row); setDraft((current) => ({ ...current, locales: { vi: { ...current.locales.vi, [key]: update("vi") }, en: { ...current.locales.en, [key]: update("en") } } })); setDirty(true); }}>{option.active === false ? <><Check className="size-4" />{t("hackathons.editor.restore")}</> : t("hackathons.editor.archive")}</Button></div>)}</div></div>)}</EditorSection> : null}

          {activeSection === "projects" && !isNew ? <EditorSection title={t("hackathons.editor.sections.projects")} description={t("hackathons.editor.sectionDescriptions.projects")} onSave={save} saving={saveMutation.isPending} saveLabel={t("hackathons.editor.saveSection")}><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Field><FieldLabel>{t("hackathons.editor.selectProject")} <span className="text-primary">*</span></FieldLabel><ProfileCombobox title={t("hackathons.editor.selectProject")} description={t("hackathons.editor.selectProjectHint")} options={projectAwardOptions} placeholder={t("hackathons.editor.selectProject")} searchPlaceholder={t("hackathons.editor.searchProjectPlaceholder")} emptyLabel={projectsQuery.isPending ? t("hackathons.editor.loadingProjects") : t("hackathons.editor.noEligibleProjects")} value={winnerProjectId} onChange={(val) => setWinnerProjectId(Array.isArray(val) ? val[0] || "" : val || "")} /></Field><Field><FieldLabel htmlFor="hackathon-winner-award-label">{t("hackathons.editor.awardLabel")} <span className="text-primary">*</span></FieldLabel><Input id="hackathon-winner-award-label" value={winnerLabel} onChange={(event) => setWinnerLabel(event.target.value)} /></Field><Button type="button" className="min-h-11" onClick={() => { const label = winnerLabel.trim(); if (!winnerProjectId || !label) { toast.error(t("hackathons.editor.awardMissingFields")); return; } change({ winner_awards: [...draft.winner_awards, { id: crypto.randomUUID(), project_id: winnerProjectId, label, sort_order: draft.winner_awards.length }] }); setWinnerProjectId(""); setWinnerLabel(""); toast.success(t("hackathons.editor.awardAdded")); }}><Plus className="size-4" />{t("hackathons.editor.add")}</Button></div>{draft.winner_awards.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-foreground-muted">{t("hackathons.editor.noAwards")}</div> : null}{draft.winner_awards.map((award, index) => <div key={award.id} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised p-3"><span className="text-xs tabular-nums text-foreground-muted">{index + 1}</span><Input value={award.label} onChange={(event) => change({ winner_awards: draft.winner_awards.map((item) => item.id === award.id ? { ...item, label: event.target.value } : item) })} /><span className="min-w-0 flex-1 truncate text-sm text-foreground-muted">{projects.find(({ project }) => project.id === award.project_id)?.project.title ?? award.project_id}</span><Button type="button" variant="ghost" size="icon" aria-label={t("hackathons.editor.remove")} onClick={() => change({ winner_awards: draft.winner_awards.filter((item) => item.id !== award.id).map((item, order) => ({ ...item, sort_order: order })) })}><Trash2 className="size-4" /></Button></div>)}</EditorSection> : null}

          {activeSection === "danger" && !isNew ? <PageSectionCard className="border-destructive/30 p-6"><h2 className="text-lg font-medium text-destructive">{t("hackathons.editor.sections.danger")}</h2><p className="mt-2 text-sm text-foreground-muted">{t("hackathons.editor.sectionDescriptions.danger")}</p><div className="mt-6 flex flex-wrap items-center gap-3">{draft.status === "published" ? <Button type="button" className="bg-blue-600 font-medium text-white hover:bg-blue-700 border-0" onClick={() => change({ status: "draft" })}>{t("hackathons.editor.statusPublishedCta")}</Button> : <Button type="button" variant="outline" className="border-border bg-surface-base font-medium text-foreground hover:bg-surface-raised" onClick={() => change({ status: "published" })}>{t("hackathons.editor.statusDraftCta")}</Button>}<Button type="button" variant={draft.status === "ended" ? "default" : "outline"} onClick={() => change({ status: "ended" })}>{t("hackathons.editor.end")}</Button><Button type="button" disabled={saveMutation.isPending} onClick={save}>{t("hackathons.editor.applyStatus")}</Button><Button type="button" variant="destructive" onClick={async () => { if (!window.confirm(t("hackathons.editor.deleteConfirm"))) return; await deleteContest(id!); navigate("/admin/hackathons"); }}><Trash2 className="size-4" />{t("hackathons.editor.delete")}</Button></div></PageSectionCard> : null}
        </main>
      </div>
    </PageContainer>
  );
}
