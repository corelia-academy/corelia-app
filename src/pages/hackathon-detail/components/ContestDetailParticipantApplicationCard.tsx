import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { intlLocale } from "@/lib/intl";
import { cn } from "@/lib/utils";
import { maskEmailAddress } from "@/pages/hackathon-detail/utils/emailMask";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

export function ContestDetailParticipantApplicationCard({
  vm,
  embedded,
}: {
  vm: ContestDetailViewModel;
  /** Render inside participant workspace tabs (no outer card / duplicate title). */
  embedded?: boolean;
}) {
  const {
    translate,
    contest,
    navigate,
    registration,
    registrationStatusLabel,
    motivation,
    setMotivation,
    applying,
    registrationDraftReady,
    registrationWorkspaceEditable,
    handleApply,
    profile,
    user,
  } = vm;

  const previewEmail = profile?.email?.trim() || user?.email?.trim() || "";
  const maskedPreviewEmail = previewEmail ? maskEmailAddress(previewEmail) : "";
  const autoApproveRegistrations = Boolean(
    contest.config?.auto_approve_registrations,
  );
  const registrationBody =
    registration?.status === "approved"
      ? translate("detail.participant.applicationCardApprovedBody")
      : translate("detail.participant.applicationCardPendingBody");

  const inner = (
    <>
      {registration ? (
        <>
          {embedded ? (
            <div className="mb-4">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {translate("detail.participant.applicationCardTitle")}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                {registrationBody}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {translate("detail.participant.applicationCardTitle")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                  {registrationBody}
                </p>
              </div>
            </div>
          )}
          <div
            className={cn(
              "rounded-md border border-border-subtle bg-surface-base p-4",
              embedded ? "mt-0" : "mt-4",
            )}
          >
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {registrationStatusLabel(registration.status)}
              </div>
              <div className="mt-2 text-sm text-foreground-muted">
                {translate("detail.participant.sentAt", {
                  datetime: new Date(registration.applied_at).toLocaleString(
                    intlLocale(),
                  ),
                })}
              </div>
              {registration.review_note ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {registration.review_note}
                </p>
              ) : null}
            </div>
          </>
        ) : contest.status !== "published" ? (
          <>
            {embedded ? (
              <h2 className="mb-3 text-base font-semibold tracking-tight text-foreground">
                {translate("detail.participant.registrationLockedTitle")}
              </h2>
            ) : (
              <div className="flex items-center gap-3">
                <Lock className="size-5 text-primary" aria-hidden />
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {translate("detail.participant.registrationLockedTitle")}
                  </h2>
                </div>
              </div>
            )}
            <p
              className={cn(
                "text-sm leading-relaxed text-foreground-muted",
                embedded ? "mt-0" : "mt-4",
              )}
            >
              {translate("detail.participant.registrationLockedBody")}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11 w-full sm:w-auto"
              onClick={() =>
                navigate(
                  contest.slug
                    ? `/hackathons/${contest.slug}/timeline`
                    : "/hackathons",
                )
              }
            >
              {translate("detail.cta.viewSchedule")}
            </Button>
          </>
        ) : !registrationWorkspaceEditable ? (
          <>
            {embedded ? (
              <h2 className="mb-3 text-base font-semibold tracking-tight text-foreground">
                {translate("detail.participant.registrationClosedTitle")}
              </h2>
            ) : (
              <div className="flex items-center gap-3">
                <Lock className="size-5 text-primary" aria-hidden />
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {translate("detail.participant.registrationClosedTitle")}
                  </h2>
                </div>
              </div>
            )}
            <p
              className={cn(
                "text-sm leading-relaxed text-foreground-muted",
                embedded ? "mt-0" : "mt-4",
              )}
            >
              {translate("detail.participant.registrationClosedBody")}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11 w-full sm:w-auto"
              onClick={() =>
                navigate(
                  contest.slug
                    ? `/hackathons/${contest.slug}/timeline`
                    : "/hackathons",
                )
              }
            >
              {translate("detail.cta.viewSchedule")}
            </Button>
          </>
        ) : (
          <>
            {embedded ? (
              <div className="mb-4">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  {translate("detail.participant.applicationCardTitle")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                  {registrationBody}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {translate("detail.participant.applicationCardTitle")}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                    {registrationBody}
                  </p>
                </div>
              </div>
            )}
            <div className={cn("space-y-4", embedded ? "mt-0" : "mt-4")}>
              {previewEmail ? (
                <>
                  <p className="text-sm leading-relaxed text-foreground-muted">
                    {translate(
                      autoApproveRegistrations
                        ? "detail.participant.quickRegisterIntroInstant"
                        : "detail.participant.quickRegisterIntro",
                      {
                        email: maskedPreviewEmail,
                      },
                    )}
                  </p>
                  <p className="text-xs leading-relaxed text-foreground-muted">
                    {translate("detail.participant.profileAttachedHint")}
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-foreground-muted">
                  {translate("detail.participant.quickRegisterNeedsEmail")}
                </p>
              )}
              {profile?.full_name?.trim() ? (
                <p className="text-xs leading-relaxed text-foreground-muted">
                  {translate("detail.participant.quickRegisterNameLine", {
                    name: profile.full_name.trim(),
                  })}
                </p>
              ) : null}
              <p className="text-xs leading-relaxed text-foreground-muted">
                {translate("detail.participant.teamViaInvitesHint")}
              </p>
              <Button
                className="w-full min-h-11"
                disabled={applying || !registrationDraftReady}
                onClick={() => void handleApply()}
              >
                {applying
                  ? translate("common:status.loading")
                  : translate("detail.participant.registerOneClickCta")}
              </Button>
              <details className="rounded-lg border border-border-subtle bg-surface-base [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-foreground underline-offset-4 hover:underline">
                  {translate("detail.participant.optionalNoteSummary")}
                </summary>
                <div className="border-t border-border-subtle px-3 py-3">
                  <textarea
                    rows={4}
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    className="min-h-24 w-full rounded-md border border-border bg-surface-base px-3 py-2 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    placeholder={translate(
                      "detail.forms.application.motivationPlaceholder",
                    )}
                  />
                </div>
              </details>
              <p className="text-xs leading-5 text-foreground-muted">
                {translate(
                  autoApproveRegistrations
                    ? "detail.participant.postSubmitHintInstant"
                    : "detail.participant.postSubmitHint",
                )}
              </p>
              {!registrationDraftReady ? (
                <div className="rounded-md border border-border-subtle bg-surface-base px-4 py-3 text-sm text-foreground-muted">
                  {translate("detail.participant.draftNotReadyHint")}
                </div>
              ) : null}
            </div>
          </>
        )}
    </>
  );

  if (embedded) {
    return <div className="pt-4">{inner}</div>;
  }

  return (
    <Card id="participant-workspace">
      <CardContent className="p-4">{inner}</CardContent>
    </Card>
  );
}
