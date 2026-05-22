import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowDown, ArrowUp, Copy, Plus, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CareerTrackBlastEmailPanel } from "./CareerTrackBlastEmailPanel";

import { PageContainer, PageSectionCard } from "@/components/layouts/PagePrimitives";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/stores/authStore";
import { getCoursesForManagement } from "@/lib/courses";
import type { Course } from "@/types/courses";
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
    whatYoullLearnText: "",
    prerequisitesText: "",
    hasCertificate: false,
    published: false,
  });
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [courseToAdd, setCourseToAdd] = useState<string>("");

  // Localization settings (phase 2)
  const [i18nConfigDraft, setI18nConfigDraft] = useState<EntityI18nConfig>(defaultI18nConfig());
  const [savingI18nConfig, setSavingI18nConfig] = useState(false);
  const [targetLocale, setTargetLocale] = useState<Locale>("en");
  const [translationDraft, setTranslationDraft] = useState({
    title: "",
    description: "",
    whatYoullLearnText: "",
    prerequisitesText: "",
  });
  const [translationLoadedAt, setTranslationLoadedAt] = useState<string | null>(null);
  const [savingTranslation, setSavingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const translationInitialRef = useRef<string>("");
  const [translationDirty, setTranslationDirty] = useState(false);

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
        const primary = configPrimaryLocale(normalizedConfig);
        setTargetLocale(primary === "vi" ? "en" : "vi");

        setForm({
          title: found.title ?? "",
          slug: found.slug ?? "",
          description: found.description ?? "",
          whatYoullLearnText: (found.what_youll_learn ?? []).join("\n"),
          prerequisitesText: (found.prerequisites ?? []).join("\n"),
          hasCertificate: Boolean(found.has_certificate),
          published: Boolean(found.published),
        });
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
  const targetSupported = supportedLocales.includes(targetLocale);

  const primarySnapshot = useMemo(() => {
    // For instructor-owned tracks, the base columns act as the primary content.
    return {
      title: form.title,
      description: form.description,
      whatYoullLearnText: form.whatYoullLearnText,
      prerequisitesText: form.prerequisitesText,
    };
  }, [form]);

  useEffect(() => {
    if (!track?.id) return;
    if (targetLocale === primaryLocale) {
      // Editing primary content already happens in the main form.
      setTranslationDraft({
        title: primarySnapshot.title,
        description: primarySnapshot.description,
        whatYoullLearnText: primarySnapshot.whatYoullLearnText,
        prerequisitesText: primarySnapshot.prerequisitesText,
      });
      setTranslationLoadedAt(null);
      translationInitialRef.current = JSON.stringify({
        title: primarySnapshot.title,
        description: primarySnapshot.description,
        whatYoullLearnText: primarySnapshot.whatYoullLearnText,
        prerequisitesText: primarySnapshot.prerequisitesText,
      });
      setTranslationDirty(false);
      setTranslationError(null);
      return;
    }

    let cancelled = false;
    setTranslationError(null);
    setTranslationDirty(false);
    void (async () => {
      try {
        const content = await getCareerTrackLocaleContent(track.id, targetLocale);
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
        setTranslationLoadedAt((content as { updated_at?: string } | null)?.updated_at ?? null);
      } catch (e) {
        if (!cancelled) {
          setTranslationError(e instanceof Error ? e.message : t("careerTracks.errors.loadFailed"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryLocale, primarySnapshot, t, targetLocale, track?.id]);

  useEffect(() => {
    const next = JSON.stringify(translationDraft);
    setTranslationDirty(next !== translationInitialRef.current);
  }, [translationDraft]);

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

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const payload: CareerTrackUpsertInput = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        what_youll_learn: splitLines(form.whatYoullLearnText),
        prerequisites: splitLines(form.prerequisitesText),
        has_certificate: form.hasCertificate,
        published: form.published,
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

  async function handleSaveTranslation() {
    if (!track?.id) return;
    if (!targetSupported) return;
    if (targetLocale === primaryLocale) return;
    setSavingTranslation(true);
    setTranslationError(null);
    try {
      await setCareerTrackLocaleContent(track.id, targetLocale, {
        title: translationDraft.title.trim() || undefined,
        description: translationDraft.description.trim() || undefined,
        what_youll_learn: splitLines(translationDraft.whatYoullLearnText),
        prerequisites: splitLines(translationDraft.prerequisitesText),
      });
      translationInitialRef.current = JSON.stringify(translationDraft);
      setTranslationDirty(false);
      setTranslationLoadedAt(new Date().toISOString());
    } catch (e) {
      setTranslationError(e instanceof Error ? e.message : t("careerTracks.errors.saveFailed"));
    } finally {
      setSavingTranslation(false);
    }
  }

  function copyAllFromPrimary() {
    setTranslationDraft({
      title: primarySnapshot.title,
      description: primarySnapshot.description,
      whatYoullLearnText: primarySnapshot.whatYoullLearnText,
      prerequisitesText: primarySnapshot.prerequisitesText,
    });
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              render={<Link to="/instructor/career-tracks" />}
              nativeButton={false}
            >
              {t("careerTracks.actions.back")}
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              <Save className="size-4" aria-hidden />
              {saving ? t("careerTracks.actions.saving") : t("careerTracks.actions.save")}
            </Button>
          </div>
        </div>
      </PageSectionCard>

      <div className="grid gap-4 lg:grid-cols-12">
        <PageSectionCard className="lg:col-span-7">
          <FieldGroup>
            <Field>
              <FieldLabel>{t("careerTracks.fields.title")}</FieldLabel>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder={t("careerTracks.placeholders.title")}
              />
            </Field>
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
              <FieldLabel>{t("careerTracks.fields.description")}</FieldLabel>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={5}
                className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                placeholder={t("careerTracks.placeholders.description")}
              />
            </Field>

            <FieldSeparator>{t("careerTracks.sections.learning")}</FieldSeparator>

            <Field>
              <FieldLabel>{t("careerTracks.fields.whatYoullLearn")}</FieldLabel>
              <FieldDescription>{t("careerTracks.hints.lines")}</FieldDescription>
              <textarea
                value={form.whatYoullLearnText}
                onChange={(e) => setForm((p) => ({ ...p, whatYoullLearnText: e.target.value }))}
                rows={6}
                className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                placeholder={t("careerTracks.placeholders.whatYoullLearn")}
              />
            </Field>

            <Field>
              <FieldLabel>{t("careerTracks.fields.prerequisites")}</FieldLabel>
              <FieldDescription>{t("careerTracks.hints.lines")}</FieldDescription>
              <textarea
                value={form.prerequisitesText}
                onChange={(e) => setForm((p) => ({ ...p, prerequisitesText: e.target.value }))}
                rows={5}
                className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                placeholder={t("careerTracks.placeholders.prerequisites")}
              />
            </Field>
          </FieldGroup>
        </PageSectionCard>

        <PageSectionCard className="lg:col-span-5">
          <FieldGroup>
            <Field>
              <FieldLabel>{t("careerTracks.fields.settings")}</FieldLabel>
              <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-raised p-3">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.hasCertificate}
                    onChange={(e) => setForm((p) => ({ ...p, hasCertificate: e.target.checked }))}
                  />
                  {t("careerTracks.fields.hasCertificate")}
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                  />
                  {t("careerTracks.fields.published")}
                </label>
              </div>
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
                  {savingI18nConfig ? t("careerTracks.actions.saving") : "Save localization settings"}
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
                    className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-base px-3 py-2"
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

      {!isNew && id && track ? (
        <PageSectionCard className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Translations</h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Translate your career track content. Empty fields fall back to the primary locale ({primaryLocale}).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                value={targetLocale}
                onChange={(e) => setTargetLocale(normalizeLocale(e.target.value))}
              >
                <option value="vi">vi</option>
                <option value="en">en</option>
              </select>
              <Button
                type="button"
                variant="outline"
                disabled={targetLocale === primaryLocale}
                onClick={copyAllFromPrimary}
              >
                <Copy className="size-4" aria-hidden />
                Copy from primary
              </Button>
              <Button
                type="button"
                disabled={!targetSupported || targetLocale === primaryLocale || savingTranslation || !translationDirty}
                onClick={() => void handleSaveTranslation()}
              >
                <Save className="size-4" aria-hidden />
                {savingTranslation ? "Saving…" : "Save translation"}
              </Button>
            </div>
          </div>

          {!targetSupported ? (
            <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              Target locale <b>{targetLocale}</b> is not enabled in supported locales.
            </div>
          ) : null}
          {translationError ? (
            <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {translationError}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                Primary ({primaryLocale})
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className="text-xs font-medium text-foreground-muted">Title</div>
                  <div className="mt-1 whitespace-pre-wrap text-foreground">{primarySnapshot.title || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground-muted">Description</div>
                  <div className="mt-1 whitespace-pre-wrap text-foreground-muted">{primarySnapshot.description || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground-muted">What you’ll learn</div>
                  <div className="mt-1 whitespace-pre-wrap text-foreground-muted">{primarySnapshot.whatYoullLearnText || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground-muted">Prerequisites</div>
                  <div className="mt-1 whitespace-pre-wrap text-foreground-muted">{primarySnapshot.prerequisitesText || "—"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  Translation ({targetLocale})
                </div>
                <div className="text-xs text-foreground-muted">
                  {translationLoadedAt ? `Updated: ${new Date(translationLoadedAt).toLocaleString()}` : null}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-xs font-medium text-foreground-muted">Title</div>
                  <Input
                    value={translationDraft.title}
                    onChange={(e) => setTranslationDraft((p) => ({ ...p, title: e.target.value }))}
                    placeholder={primarySnapshot.title ? `Fallback: ${primarySnapshot.title}` : "Enter title"}
                    disabled={!targetSupported || targetLocale === primaryLocale}
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-foreground-muted">Description</div>
                  <textarea
                    value={translationDraft.description}
                    onChange={(e) => setTranslationDraft((p) => ({ ...p, description: e.target.value }))}
                    rows={5}
                    className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    placeholder={primarySnapshot.description ? "Fallback to primary if empty" : "Enter description"}
                    disabled={!targetSupported || targetLocale === primaryLocale}
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-foreground-muted">What you’ll learn (one per line)</div>
                  <textarea
                    value={translationDraft.whatYoullLearnText}
                    onChange={(e) => setTranslationDraft((p) => ({ ...p, whatYoullLearnText: e.target.value }))}
                    rows={6}
                    className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    placeholder="Fallback to primary if empty"
                    disabled={!targetSupported || targetLocale === primaryLocale}
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-foreground-muted">Prerequisites (one per line)</div>
                  <textarea
                    value={translationDraft.prerequisitesText}
                    onChange={(e) => setTranslationDraft((p) => ({ ...p, prerequisitesText: e.target.value }))}
                    rows={5}
                    className="w-full rounded border border-border bg-surface-base px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    placeholder="Fallback to primary if empty"
                    disabled={!targetSupported || targetLocale === primaryLocale}
                  />
                </div>
              </div>
            </div>
          </div>
        </PageSectionCard>
      ) : null}

      {!isNew && id ? (
        <PageSectionCard className="mt-4">
          <CareerTrackBlastEmailPanel trackId={id} />
        </PageSectionCard>
      ) : null}
    </PageContainer>
  );
}

