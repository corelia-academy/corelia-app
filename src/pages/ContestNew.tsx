import { useMemo, useState } from "react";
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
import { createContest } from "@/lib/contests";
import type { ContestLocation, ContestStatus } from "@/types/contests";
import { useTranslation } from "react-i18next";

function toIsoOrNull(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(value).toISOString();
}

export default function ContestNew() {
  const { t } = useTranslation("contests");
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [location, setLocation] = useState<ContestLocation>("hybrid");
  const [status, setStatus] = useState<ContestStatus>("draft");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return title.trim().length >= 3 && tagline.trim().length >= 8;
  }, [title, tagline]);
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
    setSubmitting(true);
    try {
      const contest = await createContest({
        title,
        tagline,
        description,
        rules,
        location,
        status,
        starts_at: toIsoOrNull(startsAt),
        ends_at: toIsoOrNull(endsAt),
        registration_deadline: toIsoOrNull(registrationDeadline),
        max_participants: maxParticipants.trim() ? Number(maxParticipants) : null,
      });
      toast.success(t("instructorNew.toasts.created"));
      navigate(`/instructor/contests/${contest.id}/manage`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("instructorNew.toasts.createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mb-4">
        <Button
          variant="ghost"
          className="-ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/instructor/contests")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("instructorNew.back")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("instructorNew.hero.eyebrow")}
              </div>
              <h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
                {t("instructorNew.hero.title")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                {t("instructorNew.hero.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
                {t("instructorNew.hero.pillMultiParty")}
              </span>
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
                {t("instructorNew.hero.pillPublicOps")}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border-subtle bg-background p-4">
              <div className="flex items-center gap-3">
                <Trophy className="size-5 text-primary" aria-hidden />
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {t("instructorNew.pillCards.publicSurfaceTitle")}
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {t("instructorNew.pillCards.publicSurfaceDescription")}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-background p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-primary" aria-hidden />
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {t("instructorNew.pillCards.applicationsTitle")}
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {t("instructorNew.pillCards.applicationsDescription")}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-background p-4">
              <div className="flex items-center gap-3">
                <Gavel className="size-5 text-primary" aria-hidden />
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {t("instructorNew.pillCards.judgingTitle")}
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {t("instructorNew.pillCards.judgingDescription")}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-background p-4">
              <div className="flex items-center gap-3">
                <Calendar className="size-5 text-primary" aria-hidden />
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <Card>
          <CardContent className="p-5 sm:p-6">
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

              <div className="grid gap-6 lg:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="contest-status">
                    {t("instructorNew.form.statusLabel")}
                  </FieldLabel>
                  <select
                    id="contest-status"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    value={location}
                    onChange={(e) => setLocation(e.target.value as ContestLocation)}
                  >
                    <option value="online">{t("instructorNew.form.locationOptions.online")}</option>
                    <option value="offline">{t("instructorNew.form.locationOptions.offline")}</option>
                    <option value="hybrid">{t("instructorNew.form.locationOptions.hybrid")}</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
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
              </div>

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

              <Field>
                <FieldLabel htmlFor="contest-description">
                  {t("instructorNew.form.descriptionLabel")}
                </FieldLabel>
                <textarea
                  id="contest-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="min-h-32 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("instructorNew.form.rulesPlaceholder")}
                />
                <FieldDescription>
                  {t("instructorNew.form.rulesDescription")}
                </FieldDescription>
              </Field>
            </FieldGroup>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => navigate("/instructor/contests")}>
                {t("instructorNew.actions.back")}
              </Button>
              <Button disabled={!canSubmit || submitting} onClick={handleCreate}>
                {submitting ? t("instructorNew.actions.creating") : t("instructorNew.actions.create")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("instructorNew.afterCreateChecklist.eyebrow")}
              </div>
              <div className="mt-4 space-y-3">
                {readinessItems.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border-subtle bg-background p-4"
                  >
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("instructorNew.nextSteps.eyebrow")}
              </div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <p>{t("instructorNew.nextSteps.intro")}</p>
                <p>{t("instructorNew.nextSteps.step1")}</p>
                <p>{t("instructorNew.nextSteps.step2")}</p>
                <p>{t("instructorNew.nextSteps.step3")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
