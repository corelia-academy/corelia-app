import { SocialNotification, SocialNotificationAvatar } from "./SocialNotification";
import { ProjectAutoHiddenNotification } from "./ProjectAutoHiddenNotification";
import { feedRelativeTime } from "@/lib/feedRelativeTime";
import { notificationTarget } from "@/lib/notificationTarget";
import { groupNotificationsByDay, type NotificationDayGroup } from "@/lib/notificationGroups";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Action } from "@/components/ui/action";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Timestamp } from "@/components/ui/timestamp";
import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { Checks } from "@phosphor-icons/react";
import { QueryErrorState } from "@/components/QueryErrorState";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import {
  acceptProjectInviteById,
  declineProjectInviteById,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotificationRow,
} from "@/lib/notifications";
import {
  acceptCoInstructorInviteById,
  declineCoInstructorInviteById,
} from "@/lib/coInstructorInvites";
import { useNavigate } from "react-router";
import { openCampusCredentialExplorerUrl } from "@/lib/credentialIssuances";
import {
  notificationInviteContextsQueryOptions,
  notificationKeys,
  notificationsQueryOptions,
} from "@/features/notifications/notificationQueries";
import { ListRowsSkeleton } from "@/components/loading/RouteSkeleton";

function payloadString(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === "string" ? v.trim() : "";
}

function payloadInternalPath(
  payload: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const path = payloadString(payload, key);
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function InboxScroller({ compact, drawer, contentClassName, children }: { compact: boolean; drawer: boolean; contentClassName?: string; children: ReactNode }) {
  if (compact) return <ScrollArea className="max-h-[21.5625rem]" viewportClassName="max-h-[inherit]" contentClassName={contentClassName}>{children}</ScrollArea>;
  return <div className={drawer ? undefined : "py-4"}>{children}</div>;
}

export function NotificationInbox({ compact = false, drawer = false, onNavigate, onViewAll }: { compact?: boolean; drawer?: boolean; onNavigate?: () => void; onViewAll?: () => void }) {
  const { t, i18n } = useTranslation("common");
  const { isAuthenticated, authInitialized, profile, user } = useAuth();
  const userId = user?.id ?? null;
  // Achievements (Certificate vault) live on the public profile page.
  const achievementsPath = profile?.username
    ? `/@${encodeURIComponent(profile.username)}`
    : "/account";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [unread, setUnread] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const setOpen = (open: boolean) => { if (!open) onNavigate?.(); };
  const notificationsQuery = useInfiniteQuery(
    notificationsQueryOptions(userId, authInitialized && isAuthenticated, unread),
  );
  const items = useMemo(() => Array.from(new Map((notificationsQuery.data?.pages.flatMap(page => page.items) ?? []).map(item => [item.id, item])).values()), [notificationsQuery.data]);
  const loading = notificationsQuery.isPending;
  const unreadCount = notificationsQuery.data?.pages[0]?.unread_count ?? 0;
  const groups: NotificationDayGroup[] = drawer
    ? groupNotificationsByDay(items, now, i18n.language, { today: t("notifications.today"), yesterday: t("notifications.yesterday") })
    : [{ key: "all", label: null, items: compact ? items.slice(0, 20) : items }];

  const inviteProjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of items) {
      if (n.type !== "project_collaboration_invite") continue;
      const pid = n.payload.project_id;
      if (typeof pid === "string" && pid) ids.add(pid);
    }
    return Array.from(ids).sort();
  }, [items]);

  const inviteContextQuery = useQuery(
    notificationInviteContextsQueryOptions(userId, inviteProjectIds),
  );
  const inviteContextByProjectId = inviteContextQuery.data ?? {};

  const { mutate: markAllRead, isPending: markingAllRead } = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: notificationKeys.all }); },
    onError: (error) => {
      console.error("[NotificationInbox] markAllNotificationsRead failed", error);
      toast.error(t("notifications.updateError"));
    },
  });

  type InviteAction =
    | "accept-project"
    | "decline-project"
    | "accept-course"
    | "decline-course";
  const inviteMutation = useMutation({
    mutationFn: async ({
      action,
      notification,
    }: {
      action: InviteAction;
      notification: UserNotificationRow;
    }) => {
      const inviteId = notification.payload.invite_id;
      if (typeof inviteId !== "string" || !inviteId) {
        throw new Error(t("notifications.inviteAcceptFailed"));
      }

      let courseId: string | null = null;
      if (action === "accept-project") await acceptProjectInviteById(inviteId);
      if (action === "decline-project") await declineProjectInviteById(inviteId);
      if (action === "accept-course") {
        const result = await acceptCoInstructorInviteById(inviteId);
        courseId = result?.course_id ?? null;
      }
      if (action === "decline-course") await declineCoInstructorInviteById(inviteId);
      await markNotificationRead(notification.id);
      return { courseId };
    },
    onSuccess: async ({ courseId }, { action }) => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      const messageKey =
        action === "accept-project"
          ? "notifications.inviteAccepted"
          : action === "decline-project"
            ? "notifications.inviteDeclined"
            : action === "accept-course"
              ? "notifications.coInstructorInviteAccepted"
              : "notifications.coInstructorInviteDeclined";
      toast.success(t(messageKey));
      if (action === "accept-course") {
        setOpen(false);
        if (courseId) navigate(`/instructor/courses/${courseId}/edit`);
      }
    },
    onError: (error, { action }) => {
      const fallbackKey =
        action === "accept-project"
          ? "notifications.inviteAcceptFailed"
          : action === "decline-project"
            ? "notifications.inviteDeclineFailed"
            : action === "accept-course"
              ? "notifications.coInstructorInviteAcceptFailed"
              : "notifications.coInstructorInviteDeclineFailed";
      toast.error(error instanceof Error && error.message.includes("project_team_full") ? t("projects.team.full") : error instanceof Error ? error.message : t(fallbackKey));
    },
  });
  const busyId = inviteMutation.isPending
    ? inviteMutation.variables?.notification.id ?? null
    : null;
  const { mutate: updateRead } = useMutation({
    mutationFn: ({ id, opened }: { id: string; opened: boolean }) => markNotificationRead(id, opened, items.find(item => item.id === id)?.activity_at),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: notificationKeys.all }); },
    onError: (error) => {
      console.error("[NotificationInbox] markNotificationRead failed", error);
      toast.error(t("notifications.updateError"));
    },
  });

  const markRead = (id: string, opened = true) => updateRead({ id, opened });

  if (!authInitialized || !isAuthenticated) return null;

  return (
    <section aria-label={t("header.notifications")} className={compact ? "relative flex max-h-[23.875rem] flex-col" : undefined}>
      {drawer ? null : compact ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-title-large font-body text-foreground">{t("header.notifications")}</h2>
              {unreadCount > 0 && <Badge color="gray" variant="filled" size="small">{unreadCount}</Badge>}
            </div>
            <Button type="button" size="small" variant="cta" hierarchy="tertiary" className="px-xs capitalize hover:bg-transparent hover:text-foreground-muted active:bg-transparent" leadingIcon={<Checks weight="duotone" aria-hidden />} disabled={markingAllRead} onClick={() => markAllRead()}>{t("notifications.markAllRead")}</Button>
          </div>
          <Separator />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle p-3">
          <Button type="button" size="small" variant="cta" hierarchy={unread ? "tertiary" : "secondary"} aria-pressed={!unread} onClick={() => setUnread(false)}>{t("notifications.all")}</Button><Button type="button" size="small" variant="cta" hierarchy={unread ? "secondary" : "tertiary"} aria-pressed={unread} onClick={() => setUnread(true)}>{t("notifications.unread")}</Button>
          <Button type="button" size="xsmall" variant="cta" hierarchy="tertiary" disabled={markingAllRead} onClick={() => markAllRead()}>{t("notifications.markAllRead")}</Button>
        </div>
      )}
      <InboxScroller compact={compact} drawer={drawer} contentClassName={cn("py-2", items.length > 0 && "pb-10")}>
        {notificationsQuery.isError && items.length > 0 && <p role="alert" className="p-3 text-sm text-destructive">{t("notifications.loadError")} <button type="button" className="underline" onClick={() => void notificationsQuery.refetch()}>{t("notifications.retry")}</button></p>}
          {loading && items.length === 0 ? (
            <ListRowsSkeleton rows={compact ? 4 : 6} className="px-2" />
          ) : notificationsQuery.isError && items.length === 0 ? (
            <QueryErrorState
              className="m-2"
              message={t("notifications.loadError")}
              retrying={notificationsQuery.isFetching}
              onRetry={() => void notificationsQuery.refetch()}
            />
          ) : items.length === 0 ? (
            <div className={cn("flex items-center justify-center p-3xl", compact && "min-h-[19.5rem]")}>
              <EmptyStateIllustration type="search" size="tiny" description={t("header.noNotifications")} />
            </div>
          ) : (
            <div className={cn("flex flex-col gap-4xl transition-opacity", notificationsQuery.isPlaceholderData && "opacity-60")} aria-busy={notificationsQuery.isPlaceholderData || undefined}>
              {groups.map(group => (
              <section key={group.key} className="flex flex-col gap-xl">
                {group.label ? <h3 className="text-title-large font-body text-foreground">{group.label}</h3> : null}
                <ul className={cn("grid", compact && "gap-1", drawer && "gap-2.5")}>
              {group.items.map((n, index) => {
                const isInvite = n.type === "project_collaboration_invite";
                const isCoInstructorInvite = n.type === "co_instructor_invite";
                const isRegApproved = n.type === "hackathon_registration_approved";
                const isRegRejected = n.type === "hackathon_registration_rejected";
                const isHackathonRegistrationReview = isRegApproved || isRegRejected;
                const isHackathonWinnerAward = n.type === "hackathon_winner_award";
                const isCourseAnnouncement = n.type === "course_announcement";
                const isCourseCompleted = n.type === "course_completed";
                const isProjectAutoHidden = n.type === "project_auto_hidden";
                const isCourseCertificateIssued = n.type === "course_certificate_issued";
                const isOcCredential = n.type === "oc_credential_minted";
                const ocCredentialUrl = isOcCredential
                  ? openCampusCredentialExplorerUrl(payloadString(n.payload, "oc_credential_id"), {
                      username: payloadString(n.payload, "holder_ocid") || profile?.ocid,
                      nftCollection: n.payload.is_oca ? "occredential" : "ocbadge",
                      network: payloadString(n.payload, "network") || undefined,
                    })
                  : null;
                const resolved = Boolean(n.resolved_at);
                const pid =
                  typeof n.payload.project_id === "string" ? n.payload.project_id : "";
                const inviteCtx = pid ? inviteContextByProjectId[pid] : undefined;
                const hackathonTitle =
                  payloadString(n.payload, "hackathon_title") ||
                  t("notifications.hackathonRegistrationFallbackTitle");
                const hackathonSlug = payloadString(n.payload, "hackathon_slug");
                const projectSlug = payloadString(n.payload, "project_slug");
                const reviewNote = payloadString(n.payload, "review_note");
                const rowTarget = n.group_key ? notificationTarget(n.payload) : null;
                const unreadRow = !n.read_at && !n.resolved_at;
                return (
                  <li
                    key={n.id}
                    className={cn("relative", compact && "flex items-start rounded-sm hover:bg-dropdown-hover", drawer && "flex flex-col gap-2.5")}
                    onClickCapture={event => { if (!n.group_key && (event.target as HTMLElement).closest("a")) markRead(n.id); }}
                  >
                    {compact
                      ? <span aria-hidden="true" className="relative h-7 w-2 shrink-0">{unreadRow && <span className="absolute left-0 top-5 size-2 rounded-full bg-icon-destructive" />}</span>
                      : unreadRow && <span aria-hidden="true" className="absolute left-0 top-[1.53125rem] z-10 size-2 rounded-full bg-icon-destructive" />}
                    <Action
                    nativeButton={false}
                    render={<div />}
                    role={rowTarget ? undefined : "presentation"}
                    tabIndex={rowTarget ? undefined : -1}
                    onClick={rowTarget ? () => { markRead(n.id); setOpen(false); navigate(rowTarget); } : undefined}
                    multiline
                    size="small"
                    className={cn(
                      compact
                        ? "min-w-0 flex-1 gap-3 rounded-md border-0 p-2.5 hover:rounded-md hover:bg-transparent [&>span.shrink-0:first-child]:!size-8 [&>span.flex-col]:gap-0.5"
                        : "items-start gap-2xl rounded-md border-0 px-3xl py-lg hover:rounded-md hover:bg-dropdown-hover [&>span.shrink-0:first-child]:!size-8 [&>span.shrink-0:first-child]:mt-xs",
                      rowTarget && "cursor-pointer",
                    )}
                    icon={n.group_key ? <SocialNotificationAvatar notification={n} /> : undefined}
                    label={n.group_key ? <SocialNotification notification={n} /> : isInvite ? (
                      <>
                        <div className="font-medium text-foreground">
                          {t("notifications.projectInviteTitle")}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                          {t("notifications.projectInviteBody")}
                        </p>
                        {inviteCtx?.projectTitle ? (
                          <p className="mt-2 text-xs font-medium text-foreground">
                            {t("notifications.projectInviteProjectLabel", {
                              title: inviteCtx.projectTitle,
                            })}
                          </p>
                        ) : null}
                        {inviteCtx?.hackathonTitle ? (
                          <p className="mt-0.5 text-xs text-foreground-muted">
                            {t("notifications.projectInviteHackathonLabel", {
                              title: inviteCtx.hackathonTitle,
                            })}
                          </p>
                        ) : null}
                        {inviteCtx?.hackathonHref ? (
                          <div className="mt-1">
                            <Button
                              type="button"
                              variant="cta" hierarchy="tertiary"
                              size="xsmall"
                              className="h-auto px-0 py-0 text-xs font-medium underline-offset-4 hover:underline"
                              render={<NavLink to={inviteCtx.hackathonHref} />}
                              nativeButton={false}
                              onClick={() => setOpen(false)}
                            >
                              {t("notifications.openHackathon")}
                            </Button>
                          </div>
                        ) : null}
                        {!resolved ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="small"
                              className="min-h-8"
                              disabled={busyId === n.id}
                              onClick={() =>
                                inviteMutation.mutate({
                                  action: "accept-project",
                                  notification: n,
                                })
                              }
                            >
                              {t("header.accept")}
                            </Button>
                            <Button
                              type="button"
                              size="small"
                              variant="cta" hierarchy="secondary"
                              className="min-h-8"
                              disabled={busyId === n.id}
                              onClick={() =>
                                inviteMutation.mutate({
                                  action: "decline-project",
                                  notification: n,
                                })
                              }
                            >
                              {t("header.decline")}
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-foreground-muted">
                            {t("notifications.inviteResolved")}
                          </p>
                        )}
                      </>
                    ) : isCoInstructorInvite ? (
                      <>
                        <div className="font-medium text-foreground">
                          {t("notifications.coInstructorInviteTitle")}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                          {t("notifications.coInstructorInviteBody", {
                            course: payloadString(n.payload, "course_title") ||
                              t("notifications.coInstructorInviteCourseFallback"),
                          })}
                        </p>
                        {(() => {
                          const perms = (n.payload.permissions ?? {}) as Record<string, unknown>;
                          const enabled = Object.entries(perms)
                            .filter(([, v]) => v === true)
                            .map(([k]) => k);
                          if (enabled.length === 0) return null;
                          return (
                            <p className="mt-1 text-xs text-foreground-muted">
                              {t("notifications.coInstructorInvitePermissions", {
                                list: enabled.join(", "),
                              })}
                            </p>
                          );
                        })()}
                        {!resolved ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="small"
                              className="min-h-8"
                              disabled={busyId === n.id}
                              onClick={() =>
                                inviteMutation.mutate({
                                  action: "accept-course",
                                  notification: n,
                                })
                              }
                            >
                              {t("header.accept")}
                            </Button>
                            <Button
                              type="button"
                              size="small"
                              variant="cta" hierarchy="secondary"
                              className="min-h-8"
                              disabled={busyId === n.id}
                              onClick={() =>
                                inviteMutation.mutate({
                                  action: "decline-course",
                                  notification: n,
                                })
                              }
                            >
                              {t("header.decline")}
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-foreground-muted">
                            {t("notifications.inviteResolved")}
                          </p>
                        )}
                      </>
                    ) : isHackathonRegistrationReview ? (
                      <>
                        <div className="font-medium text-foreground">
                          {isRegApproved
                            ? t("notifications.hackathonRegistrationApprovedTitle")
                            : t("notifications.hackathonRegistrationRejectedTitle")}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                          {isRegApproved
                            ? t("notifications.hackathonRegistrationApprovedBody", {
                                hackathonTitle,
                              })
                            : t("notifications.hackathonRegistrationRejectedBody", {
                                hackathonTitle,
                              })}
                        </p>
                        {reviewNote ? (
                          <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                            {t("notifications.hackathonRegistrationReviewNote", {
                              note: reviewNote,
                            })}
                          </p>
                        ) : null}
                        {hackathonSlug ? (
                          <div className="mt-2">
                            <Button
                              type="button"
                              variant="cta" hierarchy="tertiary"
                              size="xsmall"
                              className="h-auto px-0 py-0 text-xs font-medium underline-offset-4 hover:underline"
                              render={<NavLink to={`/hackathons/${hackathonSlug}`} />}
                              nativeButton={false}
                              onClick={() => {
                                setOpen(false);
                              }}
                            >
                              {t("notifications.viewHackathon")}
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : isHackathonWinnerAward ? (
                      <>
                        <div className="font-medium text-foreground">
                          {t("notifications.hackathonWinnerAwardTitle")}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                          {t("notifications.hackathonWinnerAwardBody", {
                            project:
                              payloadString(n.payload, "project_title") ||
                              t("notifications.projectFallback"),
                            award: payloadString(n.payload, "award_label"),
                            hackathon: hackathonTitle,
                          })}
                        </p>
                        {projectSlug || hackathonSlug ? (
                          <div className="mt-2">
                            <Button
                              type="button"
                              variant="cta" hierarchy="tertiary"
                              size="xsmall"
                              className="h-auto px-0 py-0 text-xs font-medium underline-offset-4 hover:underline"
                              render={
                                <NavLink
                                  to={
                                    projectSlug
                                      ? `/projects/${projectSlug}`
                                      : `/hackathons/${hackathonSlug}/projects`
                                  }
                                />
                              }
                              nativeButton={false}
                              onClick={() => {
                                setOpen(false);
                              }}
                            >
                              {t("notifications.viewAwardDetails")}
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : isProjectAutoHidden ? (
                      <ProjectAutoHiddenNotification notification={n} onOpen={() => setOpen(false)} />
                    ) : isCourseCompleted ? (
                      <>
                        <div className="font-medium text-foreground">
                          {t("notifications.courseCompletedTitle")}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                          {t(
                            payloadString(n.payload, "has_certificate") === "true" ||
                              n.payload.has_certificate === true
                              ? "notifications.courseCompletedWithCertificateBody"
                              : "notifications.courseCompletedBody",
                            {
                              course: payloadString(n.payload, "course_title") ||
                                t("notifications.courseCompletedCourseFallback"),
                            },
                          )}
                        </p>
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="cta" hierarchy="tertiary"
                            size="xsmall"
                            className="h-auto px-0 py-0 text-xs font-medium underline-offset-4 hover:underline"
                            render={
                              <NavLink
                                to={payloadInternalPath(n.payload, "target_path", achievementsPath)}
                              />
                            }
                            nativeButton={false}
                            onClick={() => {
                              setOpen(false);
                            }}
                          >
                            {t("notifications.viewCompletion")}
                          </Button>
                        </div>
                      </>
                    ) : isCourseCertificateIssued ? (
                      <>
                        <div className="font-medium text-foreground">
                          {t("notifications.courseCertificateIssuedTitle")}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                          {t("notifications.courseCertificateIssuedBody", {
                            course: payloadString(n.payload, "course_title") ||
                              t("notifications.courseCertificateIssuedCourseFallback"),
                          })}
                        </p>
                        {typeof n.payload.certificate_template_url === "string" &&
                        n.payload.certificate_template_url ? (
                          <img
                            src={n.payload.certificate_template_url}
                            alt=""
                            className="mt-2 size-12 rounded-md border border-border-subtle object-cover"
                          />
                        ) : null}
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="cta" hierarchy="tertiary"
                            size="xsmall"
                            className="h-auto px-0 py-0 text-xs font-medium underline-offset-4 hover:underline"
                            render={
                              <NavLink
                                to={payloadInternalPath(n.payload, "target_path", achievementsPath)}
                              />
                            }
                            nativeButton={false}
                            onClick={() => {
                              setOpen(false);
                            }}
                          >
                            {t("notifications.viewCertificate")}
                          </Button>
                        </div>
                      </>
                    ) : isOcCredential ? (
                      <>
                        <div className="font-medium text-foreground">
                          {t("notifications.ocCredentialMintedTitle")}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                          {n.payload.is_oca
                            ? t("notifications.ocCredentialMintedBodyOca", {
                                name: payloadString(n.payload, "credential_name"),
                              })
                            : t("notifications.ocCredentialMintedBody", {
                                name: payloadString(n.payload, "credential_name"),
                              })}
                        </p>
                        {typeof n.payload.image_url === "string" && n.payload.image_url ? (
                          <img
                            src={n.payload.image_url}
                            alt=""
                            className="mt-2 size-12 rounded-md border border-border-subtle object-cover"
                          />
                        ) : null}
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="cta" hierarchy="tertiary"
                            size="xsmall"
                            className="h-auto px-0 py-0 text-xs font-medium underline-offset-4 hover:underline"
                            render={ocCredentialUrl
                              ? <a href={ocCredentialUrl} target="_blank" rel="noopener noreferrer" />
                              : <NavLink to="/achievements" />}
                            nativeButton={false}
                            onClick={() => {
                              setOpen(false);
                            }}
                          >
                            {t("notifications.viewCredential")}
                          </Button>
                        </div>
                      </>
                    ) : isCourseAnnouncement ? (
                      <>
                        <NavLink className="font-medium text-foreground hover:underline" to={payloadInternalPath(n.payload, "target_path", `/courses/${encodeURIComponent(payloadString(n.payload, "course_id"))}`)} onClick={() => setOpen(false)}>
                          {t("notifications.courseAnnouncementTitle")}
                        </NavLink>
                        {typeof n.payload.subject === "string" && n.payload.subject ? (
                          <p className="mt-1 text-xs leading-relaxed text-foreground-muted line-clamp-2">
                            {n.payload.subject}
                          </p>
                        ) : null}
                        {!n.read_at && (
                          <div className="mt-2">
                            <Button
                              type="button"
                              variant="cta" hierarchy="tertiary"
                              size="xsmall"
                              className="h-auto px-0 py-0 text-xs font-medium underline-offset-4 hover:underline"
                              onClick={() => markRead(n.id, false)}
                            >
                              {t("notifications.markRead")}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-foreground-muted">{n.type}</div>
                    )}
                    supportingText={<Timestamp type="some-time-ago" size="medium" relativeText={feedRelativeTime(n.activity_at, now, i18n.language, t("notifications.justNow"))} />}
                    />
                    {drawer && index < group.items.length - 1 ? <Separator /> : null}
                  </li>
                );
              })}
                </ul>
              </section>
              ))}
            </div>
          )}
        </InboxScroller>
      {!compact && notificationsQuery.hasNextPage && <Button type="button" variant="cta" hierarchy="secondary" disabled={notificationsQuery.isFetchingNextPage} onClick={() => void notificationsQuery.fetchNextPage()}>{t("notifications.loadMore")}</Button>}
      {compact && items.length > 0 && (
        <div className="pointer-events-none absolute -inset-x-2 -bottom-2 z-30 flex items-end justify-center bg-gradient-to-b from-transparent to-dropdown-surface to-[72%] pb-xl pt-4xl">
          <Button type="button" size="small" variant="cta" hierarchy="tertiary" className="pointer-events-auto px-xs capitalize hover:bg-transparent hover:text-foreground-muted active:bg-transparent" onClick={onViewAll}>{t("notifications.viewAll")}</Button>
        </div>
      )}
    </section>
  );
}
