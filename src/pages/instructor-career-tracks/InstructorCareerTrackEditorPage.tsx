import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  listCareerTracksForInstructor,
  setInstructorCareerTrackCourses,
  updateInstructorCareerTrack,
  type CareerTrackUpsertInput,
} from "@/lib/careerTracks";

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
  const [, setTrack] = useState<CareerTrackDetail | null>(null);
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

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <div className="text-sm text-muted-foreground">{t("careerTracks.labels.loading")}</div>
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
            <p className="mt-1 text-sm text-muted-foreground">
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
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={t("careerTracks.placeholders.prerequisites")}
              />
            </Field>
          </FieldGroup>
        </PageSectionCard>

        <PageSectionCard className="lg:col-span-5">
          <FieldGroup>
            <Field>
              <FieldLabel>{t("careerTracks.fields.settings")}</FieldLabel>
              <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-muted/20 p-3">
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

            <FieldSeparator>{t("careerTracks.sections.includedCourses")}</FieldSeparator>

            <Field>
              <FieldLabel>{t("careerTracks.fields.addCourse")}</FieldLabel>
              <div className="flex gap-2">
                <select
                  value={courseToAdd}
                  onChange={(e) => setCourseToAdd(e.target.value)}
                  className="h-9 w-full rounded border border-input bg-background px-3 text-sm"
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
                <p className="text-sm text-muted-foreground">
                  {t("careerTracks.labels.noCourses")}
                </p>
              ) : (
                orderedCourses.map((course, idx) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-card px-3 py-2"
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
    </PageContainer>
  );
}

