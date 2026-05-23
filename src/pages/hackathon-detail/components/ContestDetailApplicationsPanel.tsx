import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import type { ContestRegistration, ContestRegistrationStatus } from "@/types/hackathons";
import { maskEmailAddress } from "@/pages/hackathon-detail/utils/emailMask";

const PAGE_SIZE = 20;
const MOTIVATION_COLLAPSE_CHARS = 320;

type StatusFilter = "all" | ContestRegistrationStatus;

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

function registrationMatchesQuery(item: ContestRegistration, q: string): boolean {
  if (!q) return true;
  const haystack = [
    item.user_full_name,
    item.user_id,
    item.team_name,
    item.contact_email,
    item.contact_phone,
    item.portfolio_url,
    ...item.team_members,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function ContestDetailApplicationsPanel({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    translate,
    isManageView,
    canReview,
    activeManageSection,
    handleRefreshMetrics,
    refreshingMetrics,
    registrations,
    registrationStatusLabel,
    savingReviewId,
    handleReview,
    reviewNotes,
    setReviewNotes,
  } = vm;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [motivationExpanded, setMotivationExpanded] = useState<
    Record<string, boolean>
  >({});

  const queryNorm = useMemo(() => normalizeQuery(searchQuery), [searchQuery]);

  const statusCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of registrations) {
      if (r.status === "pending") pending += 1;
      else if (r.status === "approved") approved += 1;
      else rejected += 1;
    }
    return {
      all: registrations.length,
      pending,
      approved,
      rejected,
    };
  }, [registrations]);

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return registrationMatchesQuery(item, queryNorm);
    });
  }, [registrations, statusFilter, queryNorm]);

  const totalFiltered = filteredRegistrations.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageOffset = (safePage - 1) * PAGE_SIZE;
  const pageItems = filteredRegistrations.slice(
    pageOffset,
    pageOffset + PAGE_SIZE,
  );

  if (
    !isManageView ||
    !canReview ||
    activeManageSection !== "applications"
  ) {
    return null;
  }

  const filterButtons: { id: StatusFilter; labelKey: string }[] = [
    { id: "all", labelKey: "workspace.manage.applicationsFilterAll" },
    { id: "pending", labelKey: "workspace.manage.applicationsFilterPending" },
    {
      id: "approved",
      labelKey: "workspace.manage.applicationsFilterApproved",
    },
    {
      id: "rejected",
      labelKey: "workspace.manage.applicationsFilterRejected",
    },
  ];

  const summaryStart = totalFiltered === 0 ? 0 : pageOffset + 1;
  const summaryEnd = Math.min(pageOffset + PAGE_SIZE, totalFiltered);

  return (
    <Card id="applications">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {translate("workspace.manage.applicationsReviewTitle")}
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              {translate("workspace.manage.applicationsReviewDescription")}
            </p>
            {registrations.length > 0 ? (
              <p className="mt-2 text-xs font-medium text-foreground-subtle">
                {translate("workspace.manage.applicationsQueueSummary", {
                  count: registrations.length,
                })}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRefreshMetrics()}
          >
            {refreshingMetrics
              ? translate("detail.labels.refreshing")
              : translate("detail.labels.refreshMetrics")}
          </Button>
        </div>

        {registrations.length > 0 ? (
          <div className="mt-5 flex flex-col gap-4 border-t border-border-subtle pt-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={translate(
                  "workspace.manage.applicationsFilterGroupAriaLabel",
                )}
              >
                {filterButtons.map((fb) => (
                  <Button
                    key={fb.id}
                    type="button"
                    size="sm"
                    variant={statusFilter === fb.id ? "default" : "outline"}
                    onClick={() => {
                      setStatusFilter(fb.id);
                      setPage(1);
                    }}
                  >
                    {translate(fb.labelKey)} ({statusCounts[fb.id]})
                  </Button>
                ))}
              </div>
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={translate(
                  "workspace.manage.applicationsSearchPlaceholder",
                )}
                aria-label={translate(
                  "workspace.manage.applicationsSearchAriaLabel",
                )}
                className="lg:max-w-xs"
              />
            </div>

            {totalFiltered === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-subtle bg-surface-base px-4 py-12 text-center">
                <p className="text-sm font-medium text-foreground">
                  {translate("workspace.manage.applicationsNoMatchesTitle")}
                </p>
                <p className="text-xs text-foreground-muted">
                  {translate("workspace.manage.applicationsNoMatchesHint")}
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 text-xs text-foreground-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p aria-live="polite">
                    {translate("workspace.manage.applicationsPaginationSummary", {
                      start: summaryStart,
                      end: summaryEnd,
                      total: totalFiltered,
                    })}
                  </p>
                  <p>
                    {translate("workspace.manage.applicationsPaginationPage", {
                      page: safePage,
                      pages: totalPages,
                    })}
                  </p>
                </div>

                <div className="space-y-4">
                  {pageItems.map((item) => {
                    const motivation = item.motivation?.trim() ?? "";
                    const motivationLong =
                      motivation.length > MOTIVATION_COLLAPSE_CHARS;
                    const expanded = motivationExpanded[item.id] === true;
                    const motivationDisplay =
                      motivationLong && !expanded
                        ? `${motivation.slice(0, MOTIVATION_COLLAPSE_CHARS)}…`
                        : motivation;

                    return (
                      <div
                        key={item.id}
                        className="rounded-md border border-border-subtle bg-surface-base p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                              {registrationStatusLabel(item.status)}
                            </div>
                            <div className="mt-1 text-lg font-medium text-foreground">
                              {item.user_full_name || item.user_id}
                            </div>
                            <div className="mt-1 text-sm text-foreground-muted">
                              {item.team_name ||
                                translate(
                                  "detail.labels.defaultSoloRegistration",
                                )}
                            </div>
                            {item.team_members.length > 0 && (
                              <div className="mt-1 text-sm text-foreground-muted">
                                {translate(
                                  "workspace.manage.teamMembersPrefix",
                                )}{" "}
                                {item.team_members.join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                item.status === "approved"
                                  ? "default"
                                  : "outline"
                              }
                              disabled={savingReviewId === item.user_id}
                              onClick={() =>
                                void handleReview(item.user_id, "approved")
                              }
                            >
                              {translate("workspace.manage.approve")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                item.status === "rejected"
                                  ? "destructive"
                                  : "outline"
                              }
                              disabled={savingReviewId === item.user_id}
                              onClick={() =>
                                void handleReview(item.user_id, "rejected")
                              }
                            >
                              {translate("workspace.manage.reject")}
                            </Button>
                          </div>
                        </div>

                        {motivation ? (
                          <div className="mt-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">
                              {motivationDisplay}
                            </p>
                            {motivationLong ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-1 h-auto px-0 py-0 text-primary underline-offset-4 hover:bg-transparent hover:text-primary hover:underline"
                                onClick={() =>
                                  setMotivationExpanded((prev) => ({
                                    ...prev,
                                    [item.id]: !expanded,
                                  }))
                                }
                              >
                                {expanded
                                  ? translate(
                                      "workspace.manage.applicationsMotivationShowLess",
                                    )
                                  : translate(
                                      "workspace.manage.applicationsMotivationShowMore",
                                    )}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground-muted">
                            <span className="font-medium text-foreground">
                              {translate("detail.labels.contact")}
                            </span>{" "}
                            {item.contact_email
                              ? maskEmailAddress(item.contact_email)
                              : translate("detail.labels.notProvided")}{" "}
                            ·{" "}
                            {item.contact_phone ||
                              translate("detail.labels.noDataDash")}
                          </div>
                          <div className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground-muted">
                            <span className="font-medium text-foreground">
                              {translate("workspace.manage.portfolioLabel")}
                            </span>{" "}
                            {item.portfolio_url ||
                              translate("detail.labels.notProvided")}
                          </div>
                        </div>

                        <div className="mt-4">
                          <label
                            htmlFor={`review-note-${item.user_id}`}
                            className="text-sm font-medium text-foreground"
                          >
                            {translate("workspace.manage.reviewNoteLabel")}
                          </label>
                          <textarea
                            id={`review-note-${item.user_id}`}
                            rows={3}
                            value={reviewNotes[item.user_id] ?? ""}
                            onChange={(e) =>
                              setReviewNotes((prev) => ({
                                ...prev,
                                [item.user_id]: e.target.value,
                              }))
                            }
                            className="mt-2 min-h-24 w-full rounded-md border border-border bg-surface-base px-3 py-2 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 ? (
                  <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-foreground-muted">
                      {translate("workspace.manage.applicationsPaginationPage", {
                        page: safePage,
                        pages: totalPages,
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        {translate("workspace.manage.applicationsPrevPage")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={safePage >= totalPages}
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                      >
                        {translate("workspace.manage.applicationsNextPage")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
                <Users
                  className="size-6 text-foreground-subtle"
                  aria-hidden
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {translate("workspace.manage.applicationsEmptyTitle")}
                </p>
                <p className="mt-0.5 text-xs text-foreground-muted">
                  {translate("workspace.manage.applicationsEmptyHint")}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
