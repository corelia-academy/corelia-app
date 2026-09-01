import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ArrowLeft, Calendar, Gavel, ShieldCheck, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createContest, updateContest } from "@/lib/hackathons";
import { validateContestScheduleInputs } from "@/lib/hackathonScheduleValidation";
import { uploadContestBanner, uploadContestThumbnail } from "@/lib/storage";
import type { ContestLocation, ContestStatus } from "@/types/hackathons";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/layouts/PagePrimitives";
import { datetimeLocalToIso } from "@/pages/hackathon-detail/utils/datetime";
import { normalizeSlug, slugifyTitle } from "@/pages/hackathon-detail/utils/slug";
import { hackathonKeys } from "@/features/hackathons/hackathonQueries";

export default function ContestNew() {
  const { t } = useTranslation("contests");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [location, setLocation] = useState<ContestLocation>("hybrid");
  const [status, setStatus] = useState<ContestStatus>("draft");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [autoApproveRegistrations, setAutoApproveRegistrations] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState("");
  const [prizePoolSummary, setPrizePoolSummary] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const effectiveSlug = slugTouched ? slug : slugifyTitle(title);
  const createMutation = useMutation({
    mutationFn: async () => {
      const contest = await createContest({
        slug: effectiveSlug,
        title,
        tagline,
        description,
        rules,
        location,
        status,
        starts_at: datetimeLocalToIso(startsAt),
        ends_at: datetimeLocalToIso(endsAt),
        registration_deadline: datetimeLocalToIso(registrationDeadline),
        submission_deadline: datetimeLocalToIso(submissionDeadline),
        config: { auto_approve_registrations: autoApproveRegistrations },
        max_participants: maxParticipants.trim() ? Number(maxParticipants) : null,
        prize_pool_summary: prizePoolSummary.trim() || null,
      });

      let imagesFailed = false;
      try {
        const [banner, thumbnail] = await Promise.all([
          bannerFile
            ? uploadContestBanner(contest.id, bannerFile)
            : Promise.resolve(null),
          thumbnailFile
            ? uploadContestThumbnail(contest.id, thumbnailFile)
            : Promise.resolve(null),
        ]);
        if (banner || thumbnail) {
          await updateContest(contest.id, {
            ...(banner
              ? { cover_image_url: banner.url, cover_image_path: banner.path }
              : {}),
            ...(thumbnail
              ? { thumbnail_url: thumbnail.url, thumbnail_path: thumbnail.path }
              : {}),
          });
        }
      } catch {
        imagesFailed = true;
      }
      return { contest, imagesFailed };
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...hackathonKeys.all, "catalog"] }),
  });
  const submitting = createMutation.isPending;

  useEffect(() => {
    return () => {
      if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
    };
  }, [bannerPreviewUrl]);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    };
  }, [thumbnailPreviewUrl]);

  const canSubmit = useMemo(() => {
    const normalized = normalizeSlug(effectiveSlug);
    return (
      title.trim().length >= 3 &&
      tagline.trim().length >= 8 &&
      normalized.length >= 3 &&
      normalized.length <= 80
    );
  }, [effectiveSlug, tagline, title]);
  const readinessItems = useMemo(
    () => [
      {
        title: t("instructorNew.readiness.publicTitle"),
        description: t("instructorNew.readiness.publicDescription"),
      },
      {
        title: t("instructorNew.readiness.applicationsTitle"),
        description: t("instructorNew.readiness.applicationsDescription"),
      },
      {
        title: t("instructorNew.readiness.judgingTitle"),
        description: t("instructorNew.readiness.judgingDescription"),
      },
    ],
    [t],
  );

  async function handleCreate() {
    if (!canSubmit || submitting) return;
    const schedule = validateContestScheduleInputs({
      startsAt,
      endsAt,
      submissionDeadline,
    });
    if (!schedule.ok) {
      toast.error(
        t(
          schedule.reason === "submission_after_end"
              ? "instructorNew.validation.submissionAfterEnd"
              : "instructorNew.validation.endsNotAfterStart",
        ),
      );
      return;
    }
    try {
      const { contest, imagesFailed } = await createMutation.mutateAsync();
      if (imagesFailed) toast.error(t("instructorNew.toasts.imagesUploadFailed"));

      toast.success(t("instructorNew.toasts.created"));
      if (!contest.slug) {
        navigate("/hackathons/manage");
        toast.error(t("instructorNew.toasts.slugMissing"));
        return;
      }
      navigate(`/hackathons/${contest.slug}/manage/overview`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("instructorNew.toasts.createFailed"));
    }
  }

  return (
    <PageContainer width="narrow">
      <div className="mb-4">
        <Button
          variant="ghost"
          className="-ml-2 text-foreground-muted hover:text-foreground"
          onClick={() => navigate("/hackathons/manage")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("instructorNew.back")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {t("instructorNew.hero.eyebrow")}
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {t("instructorNew.hero.title")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-foreground-muted">
                {t("instructorNew.hero.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
                {t("instructorNew.hero.pillMultiParty")}
              </span>
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
                {t("instructorNew.hero.pillPublicOps")}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
              <div className="flex items-center gap-3">
                <Trophy className="size-5 text-primary" aria-hidden />
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    {t("instructorNew.pillCards.publicSurfaceTitle")}
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {t("instructorNew.pillCards.publicSurfaceDescription")}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-primary" aria-hidden />
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    {t("instructorNew.pillCards.applicationsTitle")}
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {t("instructorNew.pillCards.applicationsDescription")}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
              <div className="flex items-center gap-3">
                <Gavel className="size-5 text-primary" aria-hidden />
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    {t("instructorNew.pillCards.judgingTitle")}
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {t("instructorNew.pillCards.judgingDescription")}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
              <div className="flex items-center gap-3">
                <Calendar className="size-5 text-primary" aria-hidden />
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    {t("instructorNew.pillCards.timelineTitle")}
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {t("instructorNew.pillCards.timelineDescription")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <Card>
          <CardContent className="p-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="contest-title">{t("instructorNew.form.titleLabel")}</FieldLabel>
                <Input
                  id="contest-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("instructorNew.form.titlePlaceholder")}
                />
                <FieldDescription>
                  {t("instructorNew.form.titleDescription")}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="contest-slug">{t("instructorNew.form.slugLabel")}</FieldLabel>
                <Input
                  id="contest-slug"
                    value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  placeholder={t("instructorNew.form.slugPlaceholder")}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="url"
                />
                <FieldDescription>
                  {t("instructorNew.form.slugDescription", { slug: normalizeSlug(effectiveSlug) })}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="contest-tagline">
                  {t("instructorNew.form.taglineLabel")}
                </FieldLabel>
                <Input
                  id="contest-tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder={t("instructorNew.form.taglinePlaceholder")}
                />
                <FieldDescription>
                  {t("instructorNew.form.taglineDescription")}
                </FieldDescription>
              </Field>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="contest-status">
                    {t("instructorNew.form.statusLabel")}
                  </FieldLabel>
                  <select
                    id="contest-status"
                    className="h-10 w-full rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ContestStatus)}
                  >
                    <option value="draft">{t("instructorNew.form.statusOptions.draft")}</option>
                    <option value="published">
                      {t("instructorNew.form.statusOptions.published")}
                    </option>
                    <option value="running">{t("instructorNew.form.statusOptions.running")}</option>
                    <option value="ended">{t("instructorNew.form.statusOptions.ended")}</option>
                  </select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="contest-location">
                    {t("instructorNew.form.locationLabel")}
                  </FieldLabel>
                  <select
                    id="contest-location"
                    className="h-10 w-full rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    value={location}
                    onChange={(e) => setLocation(e.target.value as ContestLocation)}
                  >
                    <option value="online">{t("instructorNew.form.locationOptions.online")}</option>
                    <option value="offline">{t("instructorNew.form.locationOptions.offline")}</option>
                    <option value="hybrid">{t("instructorNew.form.locationOptions.hybrid")}</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="contest-starts-at">
                    {t("instructorNew.form.startsAtLabel")}
                  </FieldLabel>
                  <Input
                    id="contest-starts-at"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="contest-ends-at">
                    {t("instructorNew.form.endsAtLabel")}
                  </FieldLabel>
                  <Input
                    id="contest-ends-at"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="contest-registration-deadline">
                    {t("instructorNew.form.registrationDeadlineLabel")}
                  </FieldLabel>
                  <Input
                    id="contest-registration-deadline"
                    type="datetime-local"
                    value={registrationDeadline}
                    onChange={(e) => setRegistrationDeadline(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="contest-submission-deadline">
                    {t("instructorNew.form.submissionDeadlineLabel")}
                  </FieldLabel>
                  <Input
                    id="contest-submission-deadline"
                    type="datetime-local"
                    value={submissionDeadline}
                    onChange={(e) => setSubmissionDeadline(e.target.value)}
                  />
                  <FieldDescription>
                    {t("instructorNew.form.submissionDeadlineDescription")}
                  </FieldDescription>
                </Field>
              </div>

              <Field>
                <label
                  htmlFor="contest-auto-approve-registrations"
                  className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card px-4 py-3"
                >
                  <input
                    id="contest-auto-approve-registrations"
                    type="checkbox"
                    checked={autoApproveRegistrations}
                    onChange={(e) => setAutoApproveRegistrations(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {t("instructorNew.form.autoApproveRegistrationsLabel")}
                    </div>
                    <FieldDescription className="mt-1">
                      {t("instructorNew.form.autoApproveRegistrationsDescription")}
                    </FieldDescription>
                  </div>
                </label>
              </Field>

              <Field>
                <FieldLabel htmlFor="contest-max-participants">
                  {t("instructorNew.form.maxParticipantsLabel")}
                </FieldLabel>
                <Input
                  id="contest-max-participants"
                  type="number"
                  min={1}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder={t("instructorNew.form.maxParticipantsPlaceholder")}
                />
                <FieldDescription>
                  {t("instructorNew.form.maxParticipantsDescription")}
                </FieldDescription>
              </Field>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="contest-banner-file">
                    {t("instructorNew.form.bannerLabel")}
                  </FieldLabel>
                  <Input
                    id="contest-banner-file"
                    type="file"
                    accept="image/*"
                    className="cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setBannerFile(file);
                      setBannerPreviewUrl(file ? URL.createObjectURL(file) : null);
                    }}
                  />
                  <FieldDescription>{t("instructorNew.form.bannerHint")}</FieldDescription>
                  {bannerPreviewUrl ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle">
                      <img
                        src={bannerPreviewUrl}
                        alt=""
                        className="aspect-21/9 w-full object-cover"
                      />
                    </div>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="contest-thumbnail-file">
                    {t("instructorNew.form.thumbnailLabel")}
                  </FieldLabel>
                  <Input
                    id="contest-thumbnail-file"
                    type="file"
                    accept="image/*"
                    className="cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setThumbnailFile(file);
                      setThumbnailPreviewUrl(file ? URL.createObjectURL(file) : null);
                    }}
                  />
                  <FieldDescription>{t("instructorNew.form.thumbnailHint")}</FieldDescription>
                  {thumbnailPreviewUrl ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle">
                      <img
                        src={thumbnailPreviewUrl}
                        alt=""
                        className="aspect-square max-h-36 w-full max-w-36 object-cover"
                      />
                    </div>
                  ) : null}
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="contest-prize-pool-summary">
                  {t("instructorNew.form.prizePoolSummaryLabel")}
                </FieldLabel>
                <Input
                  id="contest-prize-pool-summary"
                  value={prizePoolSummary}
                  onChange={(e) => setPrizePoolSummary(e.target.value)}
                  placeholder={t("instructorNew.form.prizePoolSummaryPlaceholder")}
                />
                <FieldDescription>{t("instructorNew.form.prizePoolSummaryDescription")}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="contest-description">
                  {t("instructorNew.form.descriptionLabel")}
                </FieldLabel>
                <textarea
                  id="contest-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="min-h-32 w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder={t("instructorNew.form.descriptionPlaceholder")}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="contest-rules">
                  {t("instructorNew.form.rulesLabel")}
                </FieldLabel>
                <textarea
                  id="contest-rules"
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  rows={6}
                  className="min-h-36 w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder={t("instructorNew.form.rulesPlaceholder")}
                />
                <FieldDescription>
                  {t("instructorNew.form.rulesDescription")}
                </FieldDescription>
              </Field>
            </FieldGroup>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => navigate("/hackathons/manage")}>
                {t("instructorNew.actions.back")}
              </Button>
              <Button disabled={!canSubmit || submitting} onClick={handleCreate}>
                {submitting ? t("instructorNew.actions.creating") : t("instructorNew.actions.create")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {t("instructorNew.afterCreateChecklist.eyebrow")}
              </div>
              <div className="mt-4 space-y-3">
                {readinessItems.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4"
                  >
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-2 text-sm leading-6 text-foreground-muted">
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {t("instructorNew.nextSteps.eyebrow")}
              </div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-foreground-muted">
                <p>{t("instructorNew.nextSteps.intro")}</p>
                <p>{t("instructorNew.nextSteps.step1")}</p>
                <p>{t("instructorNew.nextSteps.step2")}</p>
                <p>{t("instructorNew.nextSteps.step3")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
