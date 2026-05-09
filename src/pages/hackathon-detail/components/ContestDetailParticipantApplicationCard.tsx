import { CheckCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { intlLocale } from "@/lib/intl";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

export function ContestDetailParticipantApplicationCard({
  vm,
}: {
  vm: ContestDetailViewModel;
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
    handleApply,
    profile,
    user,
  } = vm;

  const previewEmail =
    profile?.email?.trim() || user?.email?.trim() || "";

  return (
    <Card id="participant-workspace">
      <CardContent className="p-4">
        {registration ? (
          <>
            <div className="flex items-center gap-3">
              <CheckCheck className="size-5 text-primary" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {translate("detail.participant.applicationCardTitle")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                  {translate("detail.participant.applicationCardPendingBody")}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-border-subtle bg-surface-base p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {registrationStatusLabel(registration.status)}
              </div>
              <div className="mt-2 text-sm text-foreground-muted">
                {translate("detail.participant.sentAt", {
                  datetime: new Date(
                    registration.applied_at,
                  ).toLocaleString(intlLocale()),
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
            <div className="flex items-center gap-3">
              <Lock className="size-5 text-primary" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {translate("detail.participant.registrationLockedTitle")}
                </h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
              {translate("detail.participant.registrationLockedBody")}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11 w-full sm:w-auto"
              onClick={() =>
                navigate(contest.slug ? `/hackathons/${contest.slug}/timeline` : "/hackathons")
              }
            >
              {translate("detail.cta.viewSchedule")}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <CheckCheck className="size-5 text-primary" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {translate("detail.participant.applicationCardTitle")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                  {translate("detail.participant.applicationCardPendingBody")}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {previewEmail ? (
                <>
                  <p className="text-sm leading-relaxed text-foreground-muted">
                    {translate("detail.participant.quickRegisterIntro", {
                      email: previewEmail,
                    })}
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
                {translate("detail.participant.postSubmitHint")}
              </p>
              {!registrationDraftReady ? (
                <div className="rounded-md border border-border-subtle bg-surface-base px-4 py-3 text-sm text-foreground-muted">
                  {translate("detail.participant.draftNotReadyHint")}
                </div>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
