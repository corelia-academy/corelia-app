import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestScopedViewerRole, ContestStatus } from "@/types/contests";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";

export function ContestDetailManagerSettingsCard({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    contest,
    translate,
    managerStatus,
    setManagerStatus,
    savingStatus,
    handleStatusSave,
    rubricWeights,
    setRubricWeights,
    savingRubric,
    handleRubricSave,
    savingTracksRounds,
    tracksDraft,
    setTracksDraft,
    roundsDraft,
    setRoundsDraft,
    activeRoundIdDraft,
    setActiveRoundIdDraft,
    anonymousJudgingDraft,
    setAnonymousJudgingDraft,
    handleTracksRoundsSave,
    inviteEmail,
    setInviteEmail,
    inviteRoles,
    setInviteRoles,
    inviteDisplayName,
    setInviteDisplayName,
    inviteOrganization,
    setInviteOrganization,
    inviteNote,
    setInviteNote,
    savingInvite,
    handleInviteCreate,
    handleBulkInviteCsv,
    invites,
    inviteActionId,
    handleInviteRevoke,
    handleCopyInviteLink,
    handleInviteMailTo,
    publicDraft,
    setPublicDraft,
    bannerUploading,
    thumbnailUploading,
    handleContestBannerChange,
    handleContestThumbnailChange,
    savingPublicContent,
    handleSavePublicContent,
    setDeleteDialogOpen,
  } = vm;

  return (
    <Card>
      <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-primary" aria-hidden />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("workspace.manage.operationsControlsTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate(
                        "workspace.manage.operationsControlsDescription",
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-foreground">
                    {translate("workspace.manage.contestStatusLabel")}
                  </label>
                  <select
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    value={managerStatus}
                    onChange={(e) =>
                      setManagerStatus(e.target.value as ContestStatus)
                    }
                  >
                    <option value="draft">
                      {translate("workspace.manage.statusDraft")}
                    </option>
                    <option value="published">
                      {translate("workspace.manage.statusPublished")}
                    </option>
                    <option value="running">
                      {translate("workspace.manage.statusRunning")}
                    </option>
                    <option value="ended">
                      {translate("workspace.manage.statusEnded")}
                    </option>
                  </select>
                </div>

                <Button
                  type="button"
                  className="mt-4 w-full"
                  disabled={savingStatus || managerStatus === contest.status}
                  onClick={() => void handleStatusSave()}
                >
                  {savingStatus
                    ? translate("detail.labels.saving")
                    : translate("detail.labels.saveStatus")}
                </Button>

                <div className="mt-4 border-t border-border-subtle pt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.rubricTitle")}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {translate("workspace.manage.rubricDescription")}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["product", "workspace.manage.criterionProduct"],
                        ["technical", "workspace.manage.criterionTechnical"],
                        [
                          "presentation",
                          "workspace.manage.criterionPresentation",
                        ],
                        ["impact", "workspace.manage.criterionImpact"],
                      ] as const
                    ).map(([key, labelKey]) => (
                      <div key={key}>
                        <label className="text-sm font-medium text-foreground">
                          {translate(labelKey)}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={
                            rubricWeights[key as keyof typeof rubricWeights]
                          }
                          onChange={(e) =>
                            setRubricWeights((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm text-muted-foreground">
                    {translate("workspace.manage.rubricTotalPrefix")}{" "}
                    <span className="font-medium text-foreground">
                      {[
                        Number(rubricWeights.product) || 0,
                        Number(rubricWeights.technical) || 0,
                        Number(rubricWeights.presentation) || 0,
                        Number(rubricWeights.impact) || 0,
                      ].reduce((sum, value) => sum + value, 0)}
                    </span>
                    /100
                  </div>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    variant="outline"
                    disabled={savingRubric}
                    onClick={() => void handleRubricSave()}
                  >
                    {savingRubric
                      ? translate("detail.labels.saving")
                      : translate("detail.labels.saveRubric")}
                  </Button>
                </div>

                <div className="mt-4 border-t border-border-subtle pt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.tracksRoundsTitle")}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {translate("workspace.manage.tracksRoundsDescription")}
                  </p>

                  <div className="mt-4 rounded-xl border border-border-subtle bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {translate("workspace.manage.anonymousJudgingTitle")}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {translate("workspace.manage.anonymousJudgingHint")}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={anonymousJudgingDraft}
                          onChange={(e) => setAnonymousJudgingDraft(e.target.checked)}
                        />
                        {translate("workspace.manage.anonymousJudgingToggle")}
                      </label>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-medium text-foreground">
                      {translate("workspace.manage.tracksTitle")}
                    </div>
                    <div className="mt-3 space-y-3">
                      {(tracksDraft ?? []).map((track, index) => (
                        <div
                          key={`track-${index}`}
                          className="grid gap-3 rounded-xl border border-border-subtle bg-background p-4 sm:grid-cols-2"
                        >
                          <input
                            value={track.id}
                            onChange={(e) =>
                              setTracksDraft((prev) =>
                                prev.map((t, i) =>
                                  i === index ? { ...t, id: e.target.value } : t,
                                ),
                              )
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={translate("workspace.manage.trackIdPlaceholder")}
                          />
                          <input
                            value={track.name}
                            onChange={(e) =>
                              setTracksDraft((prev) =>
                                prev.map((t, i) =>
                                  i === index ? { ...t, name: e.target.value } : t,
                                ),
                              )
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={translate("workspace.manage.trackNamePlaceholder")}
                          />
                          <div className="sm:col-span-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setTracksDraft((prev) => prev.filter((_, i) => i !== index))
                              }
                            >
                              {translate("workspace.manage.removeRow")}
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setTracksDraft((prev) => [
                            ...prev,
                            { id: "", name: "", active: true },
                          ])
                        }
                      >
                        {translate("workspace.manage.addTrackRow")}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-medium text-foreground">
                      {translate("workspace.manage.roundsTitle")}
                    </div>
                    <div className="mt-3 space-y-3">
                      {(roundsDraft ?? []).map((round, index) => (
                        <div
                          key={`round-${index}`}
                          className="grid gap-3 rounded-xl border border-border-subtle bg-background p-4 sm:grid-cols-2"
                        >
                          <input
                            value={round.id}
                            onChange={(e) =>
                              setRoundsDraft((prev) =>
                                prev.map((r, i) =>
                                  i === index ? { ...r, id: e.target.value } : r,
                                ),
                              )
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={translate("workspace.manage.roundIdPlaceholder")}
                          />
                          <input
                            value={round.name}
                            onChange={(e) =>
                              setRoundsDraft((prev) =>
                                prev.map((r, i) =>
                                  i === index ? { ...r, name: e.target.value } : r,
                                ),
                              )
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={translate("workspace.manage.roundNamePlaceholder")}
                          />
                          <div className="sm:col-span-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setRoundsDraft((prev) => prev.filter((_, i) => i !== index))
                              }
                            >
                              {translate("workspace.manage.removeRow")}
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setRoundsDraft((prev) => [
                            ...prev,
                            { id: "", name: "", active: true },
                          ])
                        }
                      >
                        {translate("workspace.manage.addRoundRow")}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="text-sm font-medium text-foreground">
                      {translate("workspace.manage.activeRoundLabel")}
                    </label>
                    <select
                      className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      value={activeRoundIdDraft}
                      onChange={(e) => setActiveRoundIdDraft(e.target.value)}
                    >
                      {(roundsDraft ?? []).map((round) => (
                        <option key={round.id} value={round.id}>
                          {round.name || round.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    type="button"
                    className="mt-4 w-full"
                    variant="outline"
                    disabled={savingTracksRounds}
                    onClick={() => void handleTracksRoundsSave()}
                  >
                    {savingTracksRounds
                      ? translate("detail.labels.saving")
                      : translate("workspace.manage.saveTracksRounds")}
                  </Button>
                </div>

                <div className="mt-4 border-t border-border-subtle pt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.accessInvitesTitle")}
                  </h3>
                  <div className="mt-4 space-y-3">
                    <input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate(
                        "detail.forms.invite.emailPlaceholder",
                      )}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                        <div className="text-xs font-medium text-muted-foreground">
                          {translate("workspace.manage.inviteRolesLabel")}
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {(
                            [
                              ["judge", "workspace.manage.inviteRoleJudge"],
                              [
                                "co_organizer",
                                "workspace.manage.inviteRoleCoOrganizer",
                              ],
                              [
                                "partner_viewer",
                                "workspace.manage.inviteRolePartnerViewer",
                              ],
                              ["mentor", "workspace.manage.inviteRoleMentor"],
                              [
                                "reviewer",
                                "workspace.manage.inviteRoleReviewer",
                              ],
                              [
                                "co_host_viewer",
                                "workspace.manage.inviteRoleCoHost",
                              ],
                            ] as const
                          ).map(([role, labelKey]) => {
                            const checked = inviteRoles.includes(
                              role as ContestScopedViewerRole,
                            );
                            return (
                              <label
                                key={role}
                                className="flex items-center gap-2 text-sm text-foreground"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? Array.from(new Set([...inviteRoles, role]))
                                      : inviteRoles.filter((r) => r !== role);
                                    setInviteRoles(next as ContestScopedViewerRole[]);
                                  }}
                                />
                                {translate(labelKey)}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <input
                        value={inviteDisplayName}
                        onChange={(e) => setInviteDisplayName(e.target.value)}
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={translate(
                          "detail.forms.invite.displayNamePlaceholder",
                        )}
                      />
                    </div>
                    <input
                      value={inviteOrganization}
                      onChange={(e) => setInviteOrganization(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate(
                        "detail.forms.invite.organizationPlaceholder",
                      )}
                    />
                    <textarea
                      rows={3}
                      value={inviteNote}
                      onChange={(e) => setInviteNote(e.target.value)}
                      className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate(
                        "detail.forms.invite.notePlaceholder",
                      )}
                    />
                    <Button
                      type="button"
                      className="w-full"
                      disabled={savingInvite || !inviteEmail.trim()}
                      onClick={() => void handleInviteCreate()}
                    >
                      {savingInvite
                        ? translate("detail.labels.creating")
                        : translate("detail.labels.sendInvite")}
                    </Button>
                    <div className="rounded-2xl border border-border-subtle bg-background px-4 py-4">
                      <div className="text-sm font-medium text-foreground">
                        {translate("workspace.manage.bulkInviteTitle")}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {translate("workspace.manage.bulkInviteHint")}
                      </p>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        disabled={savingInvite}
                        onChange={(e) => void handleBulkInviteCsv(e)}
                        className="mt-3 block w-full cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border-subtle file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {invites.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5 text-sm text-muted-foreground">
                        {translate("workspace.manage.invitesEmpty")}
                      </div>
                    ) : (
                      invites.map((invite) => (
                        <div
                          key={invite.id}
                          className="rounded-2xl border border-border-subtle bg-background p-4"
                        >
                          <div className="text-sm font-medium text-foreground">
                            {invite.display_name || invite.email}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {invite.email} · {invite.roles.join(", ")} ·{" "}
                            {invite.status}
                          </div>
                          {invite.organization_name && (
                            <div className="mt-1 text-sm text-muted-foreground">
                              {invite.organization_name}
                            </div>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-3"
                            disabled={inviteActionId === invite.email}
                            onClick={() =>
                              void handleInviteRevoke(invite.email)
                            }
                          >
                            {translate("workspace.manage.revoke")}
                          </Button>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={inviteActionId === invite.email}
                              onClick={() =>
                                void handleCopyInviteLink(invite.email)
                              }
                            >
                              {translate("workspace.manage.copyLink")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={inviteActionId === invite.email}
                              onClick={() => handleInviteMailTo(invite)}
                            >
                              {translate("workspace.manage.openEmail")}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-border-subtle pt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.publicPageContentTitle")}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {translate("workspace.manage.publicPageContentDescription")}
                  </p>

                  <div className="mt-6 rounded-xl border border-border-subtle bg-muted/30 p-4">
                    <div className="text-sm font-medium text-foreground">
                      {translate("workspace.manage.mediaTitle")}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {translate("workspace.manage.mediaDescription")}
                    </p>
                    <div className="mt-4 grid gap-5 sm:grid-cols-2">
                      <div>
                        <label
                          className="block text-sm font-medium text-foreground"
                          htmlFor="contest-settings-banner"
                        >
                          {translate("workspace.manage.bannerUploadLabel")}
                        </label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {translate("workspace.manage.bannerUploadHint")}
                        </p>
                        <input
                          id="contest-settings-banner"
                          type="file"
                          accept="image/*"
                          disabled={bannerUploading}
                          onChange={(e) => void handleContestBannerChange(e)}
                          className="mt-2 block w-full cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border-subtle file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          {bannerUploading ? (
                            <>
                              <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden
                              />
                              {translate("workspace.manage.uploadingBanner")}
                            </>
                          ) : null}
                        </div>
                        {contest.cover_image_url?.trim() ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle bg-background">
                            <img
                              src={contest.cover_image_url.trim()}
                              alt={translate("detail.visual.bannerAlt", {
                                title: contest.title,
                              })}
                              className="aspect-21/9 w-full object-cover"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <label
                          className="block text-sm font-medium text-foreground"
                          htmlFor="contest-settings-thumbnail"
                        >
                          {translate("workspace.manage.thumbnailUploadLabel")}
                        </label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {translate("workspace.manage.thumbnailUploadHint")}
                        </p>
                        <input
                          id="contest-settings-thumbnail"
                          type="file"
                          accept="image/*"
                          disabled={thumbnailUploading}
                          onChange={(e) => void handleContestThumbnailChange(e)}
                          className="mt-2 block w-full cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border-subtle file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          {thumbnailUploading ? (
                            <>
                              <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden
                              />
                              {translate("workspace.manage.uploadingThumbnail")}
                            </>
                          ) : null}
                        </div>
                        {contest.thumbnail_url?.trim() ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle bg-background">
                            <img
                              src={contest.thumbnail_url.trim()}
                              alt={translate("detail.visual.thumbnailAlt", {
                                title: contest.title,
                              })}
                              className="aspect-video w-full object-cover"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <label className="mt-4 block text-sm font-medium text-foreground">
                    {translate("workspace.manage.prizePoolSummaryLabel")}
                  </label>
                  <input
                    value={publicDraft.prize_pool_summary}
                    onChange={(e) =>
                      setPublicDraft((prev) => ({
                        ...prev,
                        prize_pool_summary: e.target.value,
                      }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={translate(
                      "workspace.manage.prizePoolSummaryPlaceholder",
                    )}
                  />

                  <div className="mt-6">
                    <div className="text-sm font-medium text-foreground">
                      {translate("detail.prizes.sectionTitle")}
                    </div>
                    <div className="mt-3 space-y-4">
                      {publicDraft.prizes.map((prize, index) => (
                        <div
                          key={`prize-${index}`}
                          className="grid gap-3 rounded-xl border border-border-subtle bg-background p-4 sm:grid-cols-2"
                        >
                          <input
                            value={prize.rank_label}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                prizes: prev.prizes.map((p, i) =>
                                  i === index
                                    ? { ...p, rank_label: e.target.value }
                                    : p,
                                ),
                              }))
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
                            placeholder={translate(
                              "workspace.manage.prizeRankPlaceholder",
                            )}
                          />
                          <input
                            value={prize.title}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                prizes: prev.prizes.map((p, i) =>
                                  i === index
                                    ? { ...p, title: e.target.value }
                                    : p,
                                ),
                              }))
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
                            placeholder={translate(
                              "workspace.manage.prizeTitlePlaceholder",
                            )}
                          />
                          <input
                            value={prize.value_display ?? ""}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                prizes: prev.prizes.map((p, i) =>
                                  i === index
                                    ? { ...p, value_display: e.target.value }
                                    : p,
                                ),
                              }))
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={translate(
                              "workspace.manage.prizeValuePlaceholder",
                            )}
                          />
                          <textarea
                            rows={2}
                            value={prize.description ?? ""}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                prizes: prev.prizes.map((p, i) =>
                                  i === index
                                    ? { ...p, description: e.target.value }
                                    : p,
                                ),
                              }))
                            }
                            className="min-h-16 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
                            placeholder={translate(
                              "workspace.manage.prizeDescriptionPlaceholder",
                            )}
                          />
                          <div className="sm:col-span-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPublicDraft((prev) => ({
                                  ...prev,
                                  prizes: prev.prizes.filter(
                                    (_, i) => i !== index,
                                  ),
                                }))
                              }
                            >
                              {translate("workspace.manage.removeRow")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        setPublicDraft((prev) => ({
                          ...prev,
                          prizes: [
                            ...prev.prizes,
                            {
                              rank_label: "",
                              title: "",
                              value_display: "",
                              description: "",
                            },
                          ],
                        }))
                      }
                    >
                      {translate("workspace.manage.addPrizeRow")}
                    </Button>
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-medium text-foreground">
                      {translate("detail.faqs.sectionTitle")}
                    </div>
                    <div className="mt-3 space-y-4">
                      {publicDraft.faqs.map((faq, index) => (
                        <div
                          key={`faq-${index}`}
                          className="space-y-3 rounded-xl border border-border-subtle bg-background p-4"
                        >
                          <input
                            value={faq.question}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                faqs: prev.faqs.map((f, i) =>
                                  i === index
                                    ? { ...f, question: e.target.value }
                                    : f,
                                ),
                              }))
                            }
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={translate(
                              "workspace.manage.faqQuestionPlaceholder",
                            )}
                          />
                          <textarea
                            rows={3}
                            value={faq.answer}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                faqs: prev.faqs.map((f, i) =>
                                  i === index
                                    ? { ...f, answer: e.target.value }
                                    : f,
                                ),
                              }))
                            }
                            className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={translate(
                              "workspace.manage.faqAnswerPlaceholder",
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                faqs: prev.faqs.filter((_, i) => i !== index),
                              }))
                            }
                          >
                            {translate("workspace.manage.removeRow")}
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        setPublicDraft((prev) => ({
                          ...prev,
                          faqs: [...prev.faqs, { question: "", answer: "" }],
                        }))
                      }
                    >
                      {translate("workspace.manage.addFaqRow")}
                    </Button>
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-medium text-foreground">
                      {translate("detail.sections.timeline")}
                    </div>
                    <div className="mt-3 grid gap-3 rounded-xl border border-border-subtle bg-background p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            {translate("instructorNew.form.registrationDeadlineLabel")}
                          </label>
                          <input
                            type="datetime-local"
                            value={publicDraft.registration_deadline_local}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                registration_deadline_local: e.target.value,
                              }))
                            }
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            {translate("instructorNew.form.startsAtLabel")}
                          </label>
                          <input
                            type="datetime-local"
                            value={publicDraft.starts_at_local}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                starts_at_local: e.target.value,
                              }))
                            }
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            {translate("instructorNew.form.endsAtLabel")}
                          </label>
                          <input
                            type="datetime-local"
                            value={publicDraft.ends_at_local}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                ends_at_local: e.target.value,
                              }))
                            }
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-4">
                      {publicDraft.milestones.map((milestone, index) => (
                        <div
                          key={`ms-${index}`}
                          className="grid gap-3 rounded-xl border border-border-subtle bg-background p-4 sm:grid-cols-2"
                        >
                          <input
                            value={milestone.title}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                milestones: prev.milestones.map((m, i) =>
                                  i === index
                                    ? { ...m, title: e.target.value }
                                    : m,
                                ),
                              }))
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
                            placeholder={translate(
                              "workspace.manage.milestoneTitlePlaceholder",
                            )}
                          />
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              {translate("workspace.manage.milestoneAtLabel")}
                            </label>
                            <input
                              type="datetime-local"
                              value={milestone.atLocal}
                              onChange={(e) =>
                                setPublicDraft((prev) => ({
                                  ...prev,
                                  milestones: prev.milestones.map((m, i) =>
                                    i === index
                                      ? { ...m, atLocal: e.target.value }
                                      : m,
                                  ),
                                }))
                              }
                              className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPublicDraft((prev) => ({
                                  ...prev,
                                  milestones: prev.milestones.filter(
                                    (_, i) => i !== index,
                                  ),
                                }))
                              }
                            >
                              {translate("workspace.manage.removeRow")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        setPublicDraft((prev) => ({
                          ...prev,
                          milestones: [
                            ...prev.milestones,
                            { title: "", atLocal: "" },
                          ],
                        }))
                      }
                    >
                      {translate("workspace.manage.addMilestoneRow")}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    className="mt-6 w-full"
                    disabled={savingPublicContent}
                    onClick={() => void handleSavePublicContent()}
                  >
                    {savingPublicContent
                      ? translate("detail.labels.saving")
                      : translate("workspace.manage.savePublicPageContent")}
                  </Button>
                </div>

                <div className="mt-4 border-t border-destructive/20 pt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.dangerZoneTitle")}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {translate("workspace.manage.dangerZoneDescription")}
                  </p>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {translate("workspace.manage.deleteContest")}
                  </Button>
                </div>
      </CardContent>
    </Card>
  );
}
