import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileCombobox } from "@/components/ui/profile-combobox";
import { createOfflineCohort, createOfflineCourse } from "@/lib/offline";
import { listCoreliaInstructorProfiles } from "@/lib/profile";
import type { Profile } from "@/types/database";
import type {
  OfflineCohortStatus,
  OfflineDeliveryMode,
  OfflineMeetingProvider,
} from "@/types/offline";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/layouts/PagePrimitives";

function toIsoOrNull(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(value).toISOString();
}

export default function CohortNew() {
  const { t } = useTranslation("cohorts");
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<OfflineCohortStatus>("draft");
  const [deliveryMode, setDeliveryMode] = useState<OfflineDeliveryMode>("offline");
  const [meetingProvider, setMeetingProvider] = useState<OfflineMeetingProvider>("google_meet");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [city, setCity] = useState("");
  const [courseInstructorIds, setCourseInstructorIds] = useState<string[]>([]);
  const [cohortInstructorId, setCohortInstructorId] = useState("");
  const [zoomHostEmail, setZoomHostEmail] = useState("");
  const [defaultZoomJoinUrl, setDefaultZoomJoinUrl] = useState("");
  const [defaultZoomStartUrl, setDefaultZoomStartUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [registrationNotes, setRegistrationNotes] = useState("");
  const [certificateTitle, setCertificateTitle] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [instructorOptions, setInstructorOptions] = useState<Profile[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingInstructors(true);
    void listCoreliaInstructorProfiles()
      .then((rows) => {
        if (!active) return;
        setInstructorOptions(rows);
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : t("instructorNew.toasts.loadInstructorsFailed"),
        );
      })
      .finally(() => {
        if (active) setLoadingInstructors(false);
      });

    return () => {
      active = false;
    };
  }, [t]);

  const instructorPickerOptions = useMemo(
    () =>
      instructorOptions.map((item) => ({
        id: item.id,
        label: item.full_name || item.email || item.id,
        description: item.email || item.instructor_organization || item.id,
      })),
    [instructorOptions],
  );
  const selectedCohortInstructor = useMemo(
    () => instructorOptions.find((item) => item.id === cohortInstructorId) ?? null,
    [cohortInstructorId, instructorOptions],
  );
  const selectedCourseInstructorNames = useMemo(
    () =>
      courseInstructorIds
        .map((id) => {
          const profile = instructorOptions.find((item) => item.id === id);
          return profile?.full_name || profile?.email || profile?.id;
        })
        .filter(Boolean) as string[],
    [courseInstructorIds, instructorOptions],
  );

  const canSubmit = useMemo(
    () =>
      title.trim().length >= 3 &&
      tagline.trim().length >= 12 &&
      cohortInstructorId.trim().length >= 3 &&
      courseInstructorIds.length > 0,
    [cohortInstructorId, courseInstructorIds.length, tagline, title],
  );

  useEffect(() => {
    if (!cohortInstructorId) return;
    setCourseInstructorIds((prev) =>
      prev.includes(cohortInstructorId) ? prev : [...prev, cohortInstructorId],
    );
    if (!zoomHostEmail.trim()) {
      setZoomHostEmail(selectedCohortInstructor?.email ?? "");
    }
  }, [cohortInstructorId, selectedCohortInstructor?.email, zoomHostEmail]);

  async function handleCreate() {
    if (!canSubmit || submitting) return;
    if (!selectedCohortInstructor) {
      toast.error(t("instructorNew.toasts.cohortInstructorRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const course = await createOfflineCourse({
        title,
        tagline,
        description,
        venue_city: city,
        instructor_ids: courseInstructorIds,
        instructor_names: selectedCourseInstructorNames,
        certificate_title: certificateTitle,
        price_note: priceNote,
        published: status !== "draft",
      });
      await createOfflineCohort({
        offline_course_id: course.id,
        title: t("instructorNew.defaults.firstCohortTitle", { title }),
        tagline,
        description,
        status,
        delivery_mode: deliveryMode,
        meeting_provider: meetingProvider,
        venue_name: venueName,
        venue_address: venueAddress,
        city,
        instructor_id: selectedCohortInstructor.id,
        instructor_name:
          selectedCohortInstructor.full_name ||
          selectedCohortInstructor.email ||
          selectedCohortInstructor.id,
        zoom_host_email: zoomHostEmail,
        default_zoom_join_url: defaultZoomJoinUrl,
        default_zoom_start_url: defaultZoomStartUrl,
        starts_at: toIsoOrNull(startsAt),
        ends_at: toIsoOrNull(endsAt),
        registration_notes: registrationNotes,
      });
      toast.success(t("instructorNew.toasts.created"));
      navigate(`/instructor/cohorts/${course.id}/manage`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("instructorNew.toasts.createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <Card>
        <CardContent className="p-6">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("instructorNew.hero.eyebrow")}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {t("instructorNew.hero.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("instructorNew.hero.description")}
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="space-y-4 p-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            placeholder={t("instructorNew.form.titlePlaceholder")}
          />
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            placeholder={t("instructorNew.form.taglinePlaceholder")}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OfflineCohortStatus)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="draft">{t("instructorNew.form.statusOptions.draft")}</option>
              <option value="published">{t("instructorNew.form.statusOptions.published")}</option>
              <option value="running">{t("instructorNew.form.statusOptions.running")}</option>
              <option value="completed">{t("instructorNew.form.statusOptions.completed")}</option>
            </select>
            <select
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as OfflineDeliveryMode)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="offline">{t("instructorNew.form.deliveryModeOptions.offline")}</option>
              <option value="hybrid">{t("instructorNew.form.deliveryModeOptions.hybrid")}</option>
            </select>
            <select
              value={meetingProvider}
              onChange={(e) =>
                setMeetingProvider(e.target.value as OfflineMeetingProvider)
              }
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="google_meet">
                {t("instructorNew.form.meetingProviderOptions.googleMeet")}
              </option>
              <option value="manual">{t("instructorNew.form.meetingProviderOptions.manual")}</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                {t("instructorNew.form.courseInstructorsLabel")}
              </div>
              <ProfileCombobox
                title={t("instructorNew.form.courseInstructorsTitle")}
                description={t("instructorNew.form.courseInstructorsDescription")}
                options={instructorPickerOptions}
                placeholder={
                  loadingInstructors
                    ? t("instructorNew.form.courseInstructorsPlaceholderLoading")
                    : t("instructorNew.form.courseInstructorsPlaceholder")
                }
                value={courseInstructorIds}
                onChange={(value) => setCourseInstructorIds(value as string[])}
                multiple
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                {t("instructorNew.form.cohortInstructorLabel")}
              </div>
              <ProfileCombobox
                title={t("instructorNew.form.cohortInstructorTitle")}
                description={t("instructorNew.form.cohortInstructorDescription")}
                options={instructorPickerOptions}
                placeholder={
                  loadingInstructors
                    ? t("instructorNew.form.cohortInstructorPlaceholderLoading")
                    : t("instructorNew.form.cohortInstructorPlaceholder")
                }
                value={cohortInstructorId}
                onChange={(value) => setCohortInstructorId(value as string)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder={t("instructorNew.form.venueNamePlaceholder")}
            />
            <input
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder={t("instructorNew.form.venueAddressPlaceholder")}
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder={t("instructorNew.form.cityPlaceholder")}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <input
              value={zoomHostEmail}
              onChange={(e) => setZoomHostEmail(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder={t("instructorNew.form.meetHostEmailPlaceholder")}
            />
            <input
              value={defaultZoomJoinUrl}
              onChange={(e) => setDefaultZoomJoinUrl(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder={t("instructorNew.form.meetJoinPlaceholder")}
            />
            <input
              value={defaultZoomStartUrl}
              onChange={(e) => setDefaultZoomStartUrl(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder={t("instructorNew.form.meetStartPlaceholder")}
            />
            <input
              value={certificateTitle}
              onChange={(e) => setCertificateTitle(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder={t("instructorNew.form.certificateTitlePlaceholder")}
            />
            <input
              value={priceNote}
              onChange={(e) => setPriceNote(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder={t("instructorNew.form.priceNotePlaceholder")}
            />
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="rounded-lg border border-border-subtle bg-background p-4 text-sm leading-6 text-muted-foreground">
            {t("instructorNew.form.meetFallbackHint")}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="min-h-32 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder={t("instructorNew.form.descriptionPlaceholder")}
          />
          <textarea
            value={registrationNotes}
            onChange={(e) => setRegistrationNotes(e.target.value)}
            rows={4}
            className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder={t("instructorNew.form.registrationNotesPlaceholder")}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => navigate("/instructor/cohorts")}>
              {t("instructorNew.actions.back")}
            </Button>
            <Button disabled={!canSubmit || submitting} onClick={handleCreate}>
              {submitting ? t("instructorNew.actions.creating") : t("instructorNew.actions.create")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
