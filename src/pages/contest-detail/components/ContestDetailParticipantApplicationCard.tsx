import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { intlLocale } from "@/lib/intl";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";

export function ContestDetailParticipantApplicationCard({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    translate,
    contest,
    registration,
    registrationStatusLabel,
    teamName,
    setTeamName,
    teamMembers,
    setTeamMembers,
    contactEmail,
    setContactEmail,
    contactPhone,
    setContactPhone,
    portfolioUrl,
    setPortfolioUrl,
    motivation,
    setMotivation,
    applying,
    registrationDraftReady,
    parsedTeamMembers,
    handleApply,
  } = vm;

  return (
    <Card id="participant-workspace">
      <CardContent className="p-6">
    <div className="flex items-center gap-3">
      <CheckCheck className="size-5 text-primary" aria-hidden />
      <div>
        <h2 className="text-lg font-medium tracking-tight text-foreground">
          {translate("detail.participant.applicationCardTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {translate(
            "detail.participant.applicationCardPendingBody",
          )}
        </p>
      </div>
    </div>

    {registration ? (
      <div className="mt-4 rounded-2xl border border-border-subtle bg-background p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {registrationStatusLabel(registration.status)}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          {translate("detail.participant.sentAt", {
            datetime: new Date(
              registration.applied_at,
            ).toLocaleString(intlLocale()),
          })}
        </div>
        {registration.review_note && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
            {registration.review_note}
          </p>
        )}
      </div>
    ) : contest.status !== "published" ? (
      <div className="mt-4 rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5 text-sm text-muted-foreground">
        {translate("detail.forms.application.closedHint")}
      </div>
    ) : (
      <div className="mt-4 space-y-4">
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={translate(
            "detail.forms.application.teamNamePlaceholder",
          )}
        />
        <textarea
          rows={4}
          value={teamMembers}
          onChange={(e) => setTeamMembers(e.target.value)}
          className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={translate(
            "detail.forms.application.teamMembersPlaceholder",
          )}
        />
        <div className="rounded-2xl border border-border-subtle bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {translate("detail.participant.teamPreviewLabel")}
              </div>
              <div className="mt-1 text-sm text-foreground">
                {teamName.trim() ||
                  translate("detail.labels.soloOrUnnamedTeam")}
              </div>
            </div>
            <div className="rounded-full border border-border-subtle bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
              {translate("detail.participant.extraMembersCount", {
                count: parsedTeamMembers.length,
              })}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {parsedTeamMembers.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                {translate("detail.participant.soloMembersHint")}
              </span>
            ) : (
              parsedTeamMembers.map((member) => (
                <span
                  key={member}
                  className="inline-flex items-center rounded-full border border-border-subtle bg-card px-3 py-2 text-xs text-foreground"
                >
                  {member}
                </span>
              ))
            )}
          </div>
        </div>
        <input
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={translate(
            "detail.forms.application.contactEmailPlaceholder",
          )}
        />
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={translate(
            "detail.forms.application.contactPhonePlaceholder",
          )}
        />
        <input
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={translate(
            "detail.forms.application.portfolioPlaceholder",
          )}
        />
        <textarea
          rows={6}
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          className="min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={translate(
            "detail.forms.application.motivationPlaceholder",
          )}
        />
        <Button
          className="w-full"
          disabled={applying || !registrationDraftReady}
          onClick={() => void handleApply()}
        >
          {applying
            ? translate("common:status.loading")
            : translate("detail.forms.application.submitLabel")}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          {translate("detail.participant.postSubmitHint")}
        </p>
        {!registrationDraftReady && (
          <div className="rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm text-muted-foreground">
            {translate("detail.participant.draftNotReadyHint")}
          </div>
        )}
      </div>
    )}
      </CardContent>
    </Card>
  );
}
