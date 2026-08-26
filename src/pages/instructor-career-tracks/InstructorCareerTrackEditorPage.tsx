import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Save, Sparkles, Trash2, Youtube } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CareerTrackBlastEmailPanel } from "./CareerTrackBlastEmailPanel";

import { PageContainer, PageSectionCard } from "@/components/layouts/PagePrimitives";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { invokeGenerateDescription } from "@/lib/descriptionGenerator";
import { normalizeYoutubeVideoId } from "@/lib/youtubeVideoId";
import { useAuth } from "@/stores/authStore";
import { getCoursesForManagement } from "@/lib/courses";
import { uploadCareerTrackThumbnail } from "@/lib/storage";
import type {
  Course,
  CoursePartner,
  CoursePartnerBrand,
  CourseSponsor,
} from "@/types/courses";
import type { CareerTrackDetail } from "@/types/career";
import {
  createInstructorCareerTrack,
  getCareerTrackLocaleContent,
  listCareerTracksForInstructor,
  setInstructorCareerTrackCourses,
  setCareerTrackLocaleContent,
  updateInstructorCareerTrack,
  type CareerTrackUpsertInput,
} from "@/lib/careerTracks";
import type { Locale } from "@/types/database";
import type { EntityI18nConfig } from "@/types/entityLocales";

type HeroMediaType = "image" | "youtube";

function normalizeLocale(value: string | null | undefined): Locale {
  return value === "en" ? "en" : "vi";
}

function defaultI18nConfig(): EntityI18nConfig {
  return { supported_locales: ["vi", "en"], primary_content_locale: "vi" };
}

function configSupportedLocales(config: EntityI18nConfig | null | undefined): Locale[] {
  const list = config?.supported_locales;
  const fallback: Locale[] = ["vi", "en"];
  const supported =
    Array.isArray(list) && list.length ? list.map(normalizeLocale) : fallback;
  return Array.from(new Set<Locale>(supported));
}

function configPrimaryLocale(config: EntityI18nConfig | null | undefined): Locale {
  return normalizeLocale(config?.primary_content_locale);
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function InstructorCareerTrackEditorPage() {
  const { t } = useTranslation("instructor");
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isNew = !id;

  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [track, setTrack] = useState<CareerTrackDetail | null>(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    shortDescription: "",
    whatYoullLearnText: "",
    prerequisitesText: "",
    hasCertificate: false,
    published: false,
    heroMediaType: "image" as HeroMediaType,
    heroYoutubeUrl: "",
    heroYoutubeVideoId: "",
    thumbnailUrl: "" as string,
    thumbnailPath: "" as string,
  });
  const [sponsors, setSponsors] = useState<CourseSponsor[]>([]);
  const [partnerBrand, setPartnerBrand] = useState<CoursePartnerBrand | null>(null);
  const [partners, setPartners] = useState<CoursePartner[]>([]);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [courseToAdd, setCourseToAdd] = useState<string>("");

  // Localization
  const [i18nConfigDraft, setI18nConfigDraft] = useState<EntityI18nConfig>(defaultI18nConfig());
  const [savingI18nConfig, setSavingI18nConfig] = useState(false);
  const [activeContentLocale, setActiveContentLocale] = useState<Locale>("vi");
  const [translationDraft, setTranslationDraft] = useState({
    title: "",
    description: "",
    whatYoullLearnText: "",
    prerequisitesText: "",
  });
  const [savingTranslation, setSavingTranslation] = useState(false);
  const translationInitialRef = useRef<string>("");
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!profile?.id) throw new Error(t("careerTracks.errors.loadFailed"));
        const courses = await getCoursesForManagement(profile.id, false);
        if (cancelled) return;
        setAvailableCourses(courses);

        if (isNew) {
          setTrack(null);
          setCourseIds([]);
          setForm((prev) => ({ ...prev, published: false }));
          return;
        }

        const rows = await listCareerTracksForInstructor();
        const found = rows.find((r) => r.id === id) ?? null;
        if (cancelled) return;
        setTrack(found);
        if (!found) {
          setError(t("careerTracks.errors.notFound"));
          return;
        }
        const config = (found.i18n ?? defaultI18nConfig()) as EntityI18nConfig;
        const normalizedConfig: EntityI18nConfig = {
          supported_locales: configSupportedLocales(config),
          primary_content_locale: configPrimaryLocale(config),
        };
        setI18nConfigDraft(normalizedConfig);
        setActiveContentLocale(configPrimaryLocale(normalizedConfig));

        setForm({
          title: found.title ?? "",
          slug: found.slug ?? "",
          description: found.description ?? "",
          shortDescription: found.short_description ?? "",
          whatYoullLearnText: (found.what_youll_learn ?? []).join("\n"),
          prerequisitesText: (found.prerequisites ?? []).join("\n"),
          hasCertificate: Boolean(found.has_certificate),
          published: Boolean(found.published),
          heroMediaType: found.hero_media_type === "youtube" ? "youtube" : "image",
          heroYoutubeUrl: found.hero_youtube_url ?? "",
          heroYoutubeVideoId: found.hero_youtube_video_id ?? "",
          thumbnailUrl: found.thumbnail_url ?? "",
          thumbnailPath: found.thumbnail_path ?? "",
        });
        setSponsors(Array.isArray(found.sponsors) ? found.sponsors : []);
        setPartnerBrand(found.partner_brand ?? null);
        setPartners(Array.isArray(found.partners) ? found.partners : []);
        setCourseIds(found.includedCourses.map((x) => x.course.id));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t("careerTracks.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, isNew, profile?.id, t]);

  const primaryLocale = useMemo(
    () => configPrimaryLocale(i18nConfigDraft),
    [i18nConfigDraft],
  );
  const supportedLocales = useMemo(
    () => configSupportedLocales(i18nConfigDraft),
    [i18nConfigDraft],
  );
  const isTranslating = activeContentLocale !== primaryLocale;
  const previewYoutubeVideoId = normalizeYoutubeVideoId(form.heroYoutubeUrl);

  // Load translation content when switching to a non-primary locale
  useEffect(() => {
    if (!track?.id || !isTranslating) return;
    let cancelled = false;
    void (async () => {
      try {
        const content = await getCareerTrackLocaleContent(track.id, activeContentLocale);
        if (cancelled) return;
        const next = {
          title: String(content?.title ?? ""),
          description: String(content?.description ?? ""),
          whatYoullLearnText: Array.isArray(content?.what_youll_learn)
            ? (content?.what_youll_learn ?? []).join("\n")
            : "",
          prerequisitesText: Array.isArray(content?.prerequisites)
            ? (content?.prerequisites ?? []).join("\n")
            : "",
        };
        setTranslationDraft(next);
        translationInitialRef.current = JSON.stringify(next);
      } catch {
        // ignore — draft stays empty
      }
    })();
    return () => { cancelled = true; };
  }, [activeContentLocale, isTranslating, track?.id]);

  const availableById = useMemo(() => {
    const map = new Map<string, Course>();
    for (const c of availableCourses) map.set(c.id, c);
    return map;
  }, [availableCourses]);

  const orderedCourses = useMemo(
    () => courseIds.map((courseId) => availableById.get(courseId)).filter(Boolean) as Course[],
    [availableById, courseIds],
  );

  function moveCourse(courseId: string, dir: -1 | 1) {
    setCourseIds((prev) => {
      const idx = prev.indexOf(courseId);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = tmp;
      return copy;
    });
  }

  function removeCourse(courseId: string) {
    setCourseIds((prev) => prev.filter((id) => id !== courseId));
  }

  function addCourse() {
    const id = courseToAdd.trim();
    if (!id) return;
    setCourseIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setCourseToAdd("");
  }

  async function handleSavePrimary() {
    setError(null);
    setSaving(true);
    try {
      const heroMediaType = form.heroMediaType === "youtube" ? "youtube" : "image";
      const heroYoutubeUrl = form.heroYoutubeUrl.trim();
      const heroYoutubeVideoId =
        heroMediaType === "youtube" ? normalizeYoutubeVideoId(heroYoutubeUrl) : null;
      if (heroMediaType === "youtube" && !heroYoutubeVideoId) {
        throw new Error("Link YouTube không hợp lệ.");
      }
      const payload: CareerTrackUpsertInput = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        short_description: form.shortDescription.trim() || null,
        what_youll_learn: splitLines(form.whatYoullLearnText),
        prerequisites: splitLines(form.prerequisitesText),
        has_certificate: form.hasCertificate,
        published: form.published,
        hero_media_type: heroMediaType,
        hero_youtube_url: heroMediaType === "youtube" ? heroYoutubeUrl : null,
        hero_youtube_video_id: heroMediaType === "youtube" ? heroYoutubeVideoId : null,
        thumbnail_url: form.thumbnailUrl || null,
        thumbnail_path: form.thumbnailPath || null,
        sponsors,
        partner_brand: partnerBrand,
        partners,
        i18n: i18nConfigDraft,
      };
      if (!payload.title || !payload.slug) {
        throw new Error(t("careerTracks.errors.missingRequired"));
      }

      let trackId = id ?? "";
      if (isNew) {
        const created = await createInstructorCareerTrack(payload);
        trackId = created.id;
      } else {
        await updateInstructorCareerTrack(trackId, payload);
      }

      await setInstructorCareerTrackCourses(trackId, courseIds);

      navigate(`/instructor/career-tracks/${trackId}/edit`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("careerTracks.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTranslation() {
    if (!track?.id) return;
    setSavingTranslation(true);
    try {
      await setCareerTrackLocaleContent(track.id, activeContentLocale, {
        title: translationDraft.title.trim() || undefined,
        description: translationDraft.description.trim() || undefined,
        what_youll_learn: splitLines(translationDraft.whatYoullLearnText),
        prerequisites: splitLines(translationDraft.prerequisitesText),
      });
      translationInitialRef.current = JSON.stringify(translationDraft);
        toast.success(t("careerTracks.actions.translationSaved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("careerTracks.errors.saveFailed"));
    } finally {
      setSavingTranslation(false);
    }
  }

  function handleSave() {
    if (isTranslating) return void handleSaveTranslation();
    return void handleSavePrimary();
  }

  async function handleTranslateAll() {
    if (!isTranslating || !form.title) return;
    setTranslating(true);
    try {
      const response = await invokeGenerateDescription({
        action: "translate",
        type: "course",
        targetField: "description",
        locale: activeContentLocale,
        sourceLocale: primaryLocale,
        bundleKind: "course_info",
        sourceBundle: {
          title: form.title,
          shortDescription: form.shortDescription,
          description: form.description,
          learningOutcomes: splitLines(form.whatYoullLearnText),
        },
        courseId: id,
      });
      if (!response.bundle) {
        throw new Error(t("courseEdit.descriptionGenerator.errors.noBundle"));
      }
      setTranslationDraft((prev) => ({
        title: response.bundle?.title ?? prev.title,
        description: response.bundle?.description ?? prev.description,
        whatYoullLearnText: response.bundle?.learningOutcomes?.join("\n") ?? prev.whatYoullLearnText,
        prerequisitesText: prev.prerequisitesText,
      }));
      toast.success(t("courseEdit.descriptionGenerator.translateApplied"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("courseEdit.descriptionGenerator.errors.generic"));
    } finally {
      setTranslating(false);
    }
  }

  async function handleSaveLocalizationSettings() {
    if (!id) return;
    setSavingI18nConfig(true);
    setError(null);
    try {
      const normalized: EntityI18nConfig = {
        supported_locales: configSupportedLocales(i18nConfigDraft),
        primary_content_locale: configPrimaryLocale(i18nConfigDraft),
      };
      await updateInstructorCareerTrack(id, { i18n: normalized });
      setI18nConfigDraft(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("careerTracks.errors.saveFailed"));
    } finally {
      setSavingI18nConfig(false);
    }
  }

  async function handleThumbnailUpload(file: File) {
    if (!id) {
      setError(t("courseEdit.careerTracks.saveBeforeUpload"));
      return;
    }
    setUploadingThumbnail(true);
    setError(null);
    try {
      const result = await uploadCareerTrackThumbnail(id, file, form.thumbnailPath || null);
      setForm((p) => ({
        ...p,
        thumbnailUrl: result.url,
        thumbnailPath: result.path,
      }));
      await updateInstructorCareerTrack(id, {
        thumbnail_url: result.url,
        thumbnail_path: result.path,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("courseEdit.careerTracks.uploadFailed"));
    } finally {
      setUploadingThumbnail(false);
    }
  }

  function addSponsor() {
    setSponsors((prev) => [
      ...prev,
      {
        id: `sp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: "",
        website: null,
        description: null,
        logo_url: null,
        logo_path: null,
      },
    ]);
  }

  function updateSponsor(idx: number, patch: Partial<CourseSponsor>) {
    setSponsors((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }

  function removeSponsor(idx: number) {
    setSponsors((prev) => prev.filter((_, i) => i !== idx));
  }

  function addPartner() {
    setPartners((prev) => [
      ...prev,
      {
        id: `pt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: "",
        website: null,
        description: null,
        logo_url: null,
        logo_path: null,
      },
    ]);
  }

  function updatePartner(idx: number, patch: Partial<CoursePartner>) {
    setPartners((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  }

  function removePartner(idx: number) {
    setPartners((prev) => prev.filter((_, i) => i !== idx));
  }

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <div className="text-sm text-foreground-muted">{t("careerTracks.labels.loading")}</div>
      </div>
    );
  }

  return (
    <PageContainer width="default">
      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <PageSectionCard className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground">
              {isNew ? t("careerTracks.editor.newTitle") : t("careerTracks.editor.editTitle")}
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("careerTracks.editor.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Locale switcher */}
            {!isNew && (
              <div className="flex gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1">
                {supportedLocales.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setActiveContentLocale(loc)}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                      activeContentLocale === loc
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground-muted hover:text-foreground",
                    )}
                  >
                    {loc === "vi" ? "🇻🇳" : "🇬🇧"} {loc.toUpperCase()}
                    {loc === primaryLocale && (
                      <span className="rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px] leading-none">P</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              render={<Link to="/instructor/career-tracks" />}
              nativeButton={false}
            >
              {t("careerTracks.actions.back")}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || savingTranslation}
            >
              <Save className="size-4" aria-hidden />
              {saving || savingTranslation ? t("careerTracks.actions.saving") : t("careerTracks.actions.save")}
            </Button>
          </div>
        </div>
      </PageSectionCard>

      {isTranslating && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning/10 px-4 py-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{activeContentLocale.toUpperCase()}</span>
            {" — "}{t("careerTracks.editor.translationModeHint", { locale: activeContentLocale.toUpperCase() })}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={translating || !form.title}
            onClick={() => void handleTranslateAll()}
          >
            <Sparkles className="size-3.5" aria-hidden />
            {translating
              ? t("courseEdit.descriptionGenerator.translating")
              : t("courseEdit.descriptionGenerator.translateTrigger")}
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <PageSectionCard className="lg:col-span-7">
          <FieldGroup>
            <Field>
              <FieldLabel>
                {t("careerTracks.fields.title")}
                <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium uppercase text-foreground-muted">
                  {activeContentLocale}
                </span>
              </FieldLabel>
              <Input
                value={isTranslating ? translationDraft.title : form.title}
                onChange={(e) =>
                  isTranslating
                    ? setTranslationDraft((p) => ({ ...p, title: e.target.value }))
                    : setForm((p) => ({ ...p, title: e.target.value }))
                }
                placeholder={isTranslating ? `Fallback: ${form.title}` : t("careerTracks.placeholders.title")}
              />
            </Field>
            {!isTranslating && (
              <>
                <Field>
                  <FieldLabel>{t("careerTracks.fields.slug")}</FieldLabel>
                  <FieldDescription>{t("careerTracks.hints.slug")}</FieldDescription>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                    placeholder="frontend-engineer"
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("courseEdit.careerTracks.shortDescriptionLabel")}</FieldLabel>
                  <FieldDescription>
                    {t("courseEdit.careerTracks.shortDescriptionDesc")}
                  </FieldDescription>
                  <textarea
                    value={form.shortDescription}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, shortDescription: e.target.value }))
                    }
                    rows={2}
                    maxLength={280}
                    className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    placeholder={t("courseEdit.careerTracks.shortDescriptionPlaceholder")}
                  />
                </Field>
              </>
            )}

            <Field>
              <FieldLabel>
                {t("careerTracks.fields.description")}
                <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium uppercase text-foreground-muted">
                  {activeContentLocale}
                </span>
              </FieldLabel>
              <textarea
                value={isTranslating ? translationDraft.description : form.description}
                onChange={(e) =>
                  isTranslating
                    ? setTranslationDraft((p) => ({ ...p, description: e.target.value }))
                    : setForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={5}
                className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                placeholder={isTranslating ? `Fallback: ${form.description.slice(0, 60)}…` : t("careerTracks.placeholders.description")}
              />
            </Field>

            {!isTranslating && (
              <Field>
                <FieldLabel>Hero media</FieldLabel>
                <FieldDescription>
                  Chọn ảnh bìa hoặc video YouTube cho hero trang chi tiết. Ảnh vẫn được dùng cho danh sách và preview chia sẻ.
                </FieldDescription>
                <div className="inline-flex rounded-md border border-border-subtle bg-surface-raised p-1">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, heroMediaType: "image" }))}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                      form.heroMediaType === "image"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground-muted hover:text-foreground",
                    )}
                  >
                    <ImagePlus className="size-3.5" aria-hidden />
                    Ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, heroMediaType: "youtube" }))}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                      form.heroMediaType === "youtube"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground-muted hover:text-foreground",
                    )}
                  >
                    <Youtube className="size-3.5" aria-hidden />
                    YouTube
                  </button>
                </div>

                {form.heroMediaType === "youtube" ? (
                  <div className="space-y-3">
                    <Input
                      value={form.heroYoutubeUrl}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          heroYoutubeUrl: e.target.value,
                          heroYoutubeVideoId: normalizeYoutubeVideoId(e.target.value) ?? "",
                        }))
                      }
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                    <div className="aspect-video w-full max-w-xl overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
                      {previewYoutubeVideoId ? (
                        <iframe
                          src={`https://www.youtube.com/embed/${previewYoutubeVideoId}?rel=0`}
                          title="Learning track hero video preview"
                          className="size-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : (
                        <div className="grid size-full place-items-center px-4 text-center text-xs text-foreground-subtle">
                          Dán link YouTube hợp lệ để xem preview.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="aspect-video w-40 shrink-0 overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
                      {form.thumbnailUrl ? (
                        <img
                          src={form.thumbnailUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-foreground-subtle">
                          <ImagePlus className="size-6" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingThumbnail || !id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleThumbnailUpload(file);
                          e.target.value = "";
                        }}
                        className="text-xs"
                      />
                      {!id ? (
                        <span className="text-xs text-foreground-muted">
                          Lưu lộ trình trước khi tải ảnh.
                        </span>
                      ) : null}
                      {uploadingThumbnail && (
                        <span className="text-xs text-foreground-muted">{t("courseEdit.careerTracks.uploading")}</span>
                      )}
                      {form.thumbnailUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setForm((p) => ({ ...p, thumbnailUrl: "", thumbnailPath: "" }))
                          }
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Gỡ ảnh
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
              </Field>
            )}

            <FieldSeparator>{t("careerTracks.sections.learning")}</FieldSeparator>

            <Field>
              <FieldLabel>
                {t("careerTracks.fields.whatYoullLearn")}
                <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium uppercase text-foreground-muted">
                  {activeContentLocale}
                </span>
              </FieldLabel>
              <FieldDescription>{t("careerTracks.hints.lines")}</FieldDescription>
              <textarea
                value={isTranslating ? translationDraft.whatYoullLearnText : form.whatYoullLearnText}
                onChange={(e) =>
                  isTranslating
                    ? setTranslationDraft((p) => ({ ...p, whatYoullLearnText: e.target.value }))
                    : setForm((p) => ({ ...p, whatYoullLearnText: e.target.value }))
                }
                rows={6}
                className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                placeholder={t("careerTracks.placeholders.whatYoullLearn")}
              />
            </Field>

            <Field>
              <FieldLabel>
                {t("careerTracks.fields.prerequisites")}
                <span className="ml-1.5 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium uppercase text-foreground-muted">
                  {activeContentLocale}
                </span>
              </FieldLabel>
              <FieldDescription>{t("careerTracks.hints.lines")}</FieldDescription>
              <textarea
                value={isTranslating ? translationDraft.prerequisitesText : form.prerequisitesText}
                onChange={(e) =>
                  isTranslating
                    ? setTranslationDraft((p) => ({ ...p, prerequisitesText: e.target.value }))
                    : setForm((p) => ({ ...p, prerequisitesText: e.target.value }))
                }
                rows={5}
                className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                placeholder={t("careerTracks.placeholders.prerequisites")}
              />
            </Field>
          </FieldGroup>
        </PageSectionCard>

        <PageSectionCard className="lg:col-span-5">
          <FieldGroup>
            <FieldLabel>{t("careerTracks.fields.settings")}</FieldLabel>
            <Field>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.hasCertificate}
                  onChange={(e) => setForm((p) => ({ ...p, hasCertificate: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm font-medium text-foreground">
                  {t("careerTracks.fields.hasCertificate")}
                </span>
              </label>
            </Field>
            <Field>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm font-medium text-foreground">
                  {t("careerTracks.fields.published")}
                </span>
              </label>
            </Field>

            {!isNew && id ? (
              <>
                <FieldSeparator>Localization</FieldSeparator>
                <Field>
                  <FieldLabel>Primary content locale</FieldLabel>
                  <FieldDescription>
                    Used as fallback when a translation is missing.
                  </FieldDescription>
                  <select
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    value={primaryLocale}
                    onChange={(e) =>
                      setI18nConfigDraft((p) => ({
                        ...p,
                        primary_content_locale: normalizeLocale(e.target.value),
                      }))
                    }
                  >
                    <option value="vi">vi</option>
                    <option value="en">en</option>
                  </select>
                </Field>

                <Field>
                  <FieldLabel>Supported locales</FieldLabel>
                  <div className="mt-2 flex flex-wrap gap-3 rounded-md border border-border-subtle bg-surface-raised p-3 text-sm">
                    {(["vi", "en"] as const).map((lng) => (
                      <label key={lng} className="inline-flex items-center gap-2 text-foreground">
                        <input
                          type="checkbox"
                          checked={supportedLocales.includes(lng)}
                          onChange={(e) => {
                            setI18nConfigDraft((prev) => {
                              const next = new Set(configSupportedLocales(prev));
                              if (e.target.checked) next.add(lng);
                              else next.delete(lng);
                              return { ...prev, supported_locales: Array.from(next) };
                            });
                          }}
                        />
                        {lng}
                      </label>
                    ))}
                  </div>
                </Field>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={savingI18nConfig}
                  onClick={() => void handleSaveLocalizationSettings()}
                >
                  {savingI18nConfig
                    ? t("careerTracks.actions.saving")
                    : t("careerTracks.actions.saveLocalizationSettings")}
                </Button>
              </>
            ) : null}

            <FieldSeparator>{t("careerTracks.sections.includedCourses")}</FieldSeparator>

            <Field>
              <FieldLabel>{t("careerTracks.fields.addCourse")}</FieldLabel>
              <div className="flex gap-2">
                <select
                  value={courseToAdd}
                  onChange={(e) => setCourseToAdd(e.target.value)}
                  className="h-9 w-full rounded border border-border bg-surface-base px-3 text-sm"
                >
                  <option value="">{t("careerTracks.placeholders.pickCourse")}</option>
                  {availableCourses
                    .filter((c) => !courseIds.includes(c.id))
                    .map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                </select>
                <Button type="button" variant="outline" onClick={addCourse} disabled={!courseToAdd}>
                  <Plus className="size-4" aria-hidden />
                </Button>
              </div>
            </Field>

            <div className="space-y-2">
              {orderedCourses.length === 0 ? (
                <p className="text-sm text-foreground-muted">
                  {t("careerTracks.labels.noCourses")}
                </p>
              ) : (
                orderedCourses.map((course, idx) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-base shadow-card px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-sm font-medium text-foreground">
                        {idx + 1}. {course.title}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => moveCourse(course.id, -1)}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => moveCourse(course.id, 1)}
                        disabled={idx === orderedCourses.length - 1}
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeCourse(course.id)}
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </FieldGroup>
        </PageSectionCard>
      </div>


      <PageSectionCard className="mt-4">
        <FieldGroup>
          <Field>
            <FieldLabel>Sponsors</FieldLabel>
            <FieldDescription>
              Logo + tên hiển thị ở sidebar trang chi tiết. Để URL logo trống nếu muốn hiển thị tên.
            </FieldDescription>
          </Field>

          <div className="space-y-3">
            {sponsors.map((sp, idx) => (
              <div
                key={sp.id}
                className="rounded-md border border-border-subtle bg-surface-raised p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-medium text-foreground-muted">
                    Sponsor #{idx + 1}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeSponsor(idx)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder={t("courseEdit.careerTracks.namePlaceholder")}
                    value={sp.name ?? ""}
                    onChange={(e) => updateSponsor(idx, { name: e.target.value })}
                  />
                  <Input
                    placeholder="Website (https://…)"
                    value={sp.website ?? ""}
                    onChange={(e) =>
                      updateSponsor(idx, { website: e.target.value || null })
                    }
                  />
                  <Input
                    placeholder="Logo URL (https://…)"
                    value={sp.logo_url ?? ""}
                    onChange={(e) =>
                      updateSponsor(idx, { logo_url: e.target.value || null })
                    }
                  />
                  <Input
                    placeholder={t("courseEdit.careerTracks.shortDescOptionalPlaceholder")}
                    value={sp.description ?? ""}
                    onChange={(e) =>
                      updateSponsor(idx, { description: e.target.value || null })
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSponsor}
            >
              <Plus className="size-3.5" aria-hidden />
              Thêm sponsor
            </Button>
          </div>

          <FieldSeparator>Partner brand</FieldSeparator>

          <div className="space-y-3">
            {partners.map((p, idx) => (
              <div
                key={p.id}
                className="rounded-md border border-border-subtle bg-surface-raised p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-medium text-foreground-muted">
                    Partner #{idx + 1}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removePartner(idx)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder={t("courseEdit.careerTracks.namePlaceholder")}
                    value={p.name ?? ""}
                    onChange={(e) => updatePartner(idx, { name: e.target.value })}
                  />
                  <Input
                    placeholder="Website (https://…)"
                    value={p.website ?? ""}
                    onChange={(e) =>
                      updatePartner(idx, { website: e.target.value || null })
                    }
                  />
                  <Input
                    placeholder="Logo URL (https://…)"
                    value={p.logo_url ?? ""}
                    onChange={(e) =>
                      updatePartner(idx, { logo_url: e.target.value || null })
                    }
                  />
                  <Input
                    placeholder={t("courseEdit.careerTracks.shortDescOptionalPlaceholder")}
                    value={p.description ?? ""}
                    onChange={(e) =>
                      updatePartner(idx, { description: e.target.value || null })
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPartner}
            >
              <Plus className="size-3.5" aria-hidden />
              Thêm partner
            </Button>
          </div>

          <FieldSeparator>Legacy partner brand (single)</FieldSeparator>
          <FieldDescription>
            Hỗ trợ shape cũ — chỉ điền nếu cần. Khuyến nghị dùng &ldquo;Partner&rdquo; ở trên.
          </FieldDescription>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder={t("courseEdit.careerTracks.namePlaceholder")}
              value={partnerBrand?.name ?? ""}
              onChange={(e) =>
                setPartnerBrand((prev) => ({
                  ...(prev ?? { name: "" }),
                  name: e.target.value,
                }))
              }
            />
            <Input
              placeholder="Website (https://…)"
              value={partnerBrand?.website ?? ""}
              onChange={(e) =>
                setPartnerBrand((prev) => ({
                  ...(prev ?? { name: "" }),
                  website: e.target.value || null,
                }))
              }
            />
            <Input
              placeholder="Logo URL (https://…)"
              value={partnerBrand?.logo_url ?? ""}
              onChange={(e) =>
                setPartnerBrand((prev) => ({
                  ...(prev ?? { name: "" }),
                  logo_url: e.target.value || null,
                }))
              }
            />
            <Input
              placeholder={t("courseEdit.careerTracks.shortDescOptionalPlaceholder")}
              value={partnerBrand?.description ?? ""}
              onChange={(e) =>
                setPartnerBrand((prev) => ({
                  ...(prev ?? { name: "" }),
                  description: e.target.value || null,
                }))
              }
            />
          </div>
          {partnerBrand?.name?.trim() ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPartnerBrand(null)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Gỡ legacy partner
            </Button>
          ) : null}
        </FieldGroup>
      </PageSectionCard>

      {!isNew && id ? (
        <PageSectionCard className="mt-4">
          <CareerTrackBlastEmailPanel trackId={id} />
        </PageSectionCard>
      ) : null}
    </PageContainer>
  );
}
