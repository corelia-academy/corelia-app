import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/stores/authStore";
import {
  acceptProjectInviteById,
  declineProjectInviteById,
  listMyNotifications,
  markNotificationRead,
  type UserNotificationRow,
} from "@/lib/notifications";
import {
  fetchProjectInviteDisplayContextByProjectIds,
  type ProjectInviteDisplayContext,
} from "@/lib/notificationInviteContext";

function payloadString(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === "string" ? v.trim() : "";
}

export function NotificationBell() {
  const { t } = useTranslation("common");
  const { isAuthenticated, authInitialized } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteContextByProjectId, setInviteContextByProjectId] = useState<
    Record<string, ProjectInviteDisplayContext>
  >({});

  const inviteProjectIdsKey = useMemo(() => {
    const ids = new Set<string>();
    for (const n of items) {
      if (n.type !== "project_collaboration_invite") continue;
      const pid = n.payload.project_id;
      if (typeof pid === "string" && pid) ids.add(pid);
    }
    return Array.from(ids).sort().join("|");
  }, [items]);

  useEffect(() => {
    const inviteProjectIds = inviteProjectIdsKey
      ? inviteProjectIdsKey.split("|").filter(Boolean)
      : [];
    if (inviteProjectIds.length === 0) {
      setInviteContextByProjectId({});
      return;
    }
    let cancelled = false;
    void fetchProjectInviteDisplayContextByProjectIds(inviteProjectIds).then((ctx) => {
      if (!cancelled) setInviteContextByProjectId(ctx);
    });
    return () => {
      cancelled = true;
    };
  }, [inviteProjectIdsKey]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const list = await listMyNotifications(40);
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authInitialized || !isAuthenticated) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 60000);
    return () => window.clearInterval(id);
  }, [authInitialized, isAuthenticated, refresh]);

  useEffect(() => {
    if (open && isAuthenticated) void refresh();
  }, [open, isAuthenticated, refresh]);

  const unreadCount = items.filter((n) => !n.read_at && !n.resolved_at).length;

  async function handleAcceptInvite(notification: UserNotificationRow) {
    const inviteId = notification.payload.invite_id;
    if (typeof inviteId !== "string" || !inviteId) return;
    setBusyId(notification.id);
    try {
      await acceptProjectInviteById(inviteId);
      await markNotificationRead(notification.id);
      await refresh();
      toast.success(t("notifications.inviteAccepted"));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("notifications.inviteAcceptFailed"),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeclineInvite(notification: UserNotificationRow) {
    const inviteId = notification.payload.invite_id;
    if (typeof inviteId !== "string" || !inviteId) return;
    setBusyId(notification.id);
    try {
      await declineProjectInviteById(inviteId);
      await markNotificationRead(notification.id);
      await refresh();
      toast.success(t("notifications.inviteDeclined"));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("notifications.inviteDeclineFailed"),
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!authInitialized || !isAuthenticated) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface-base text-foreground transition-colors duration-150 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label={t("header.notificationsAria")}
          >
            <Bell className="size-5" aria-hidden />
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        }
      />
      <DropdownMenuContent className="w-80 p-0" align="end">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground">
          {t("header.notifications")}
        </div>
        <div className="max-h-80 overflow-auto p-2">
          {loading && items.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-foreground-muted">
              {t("status.loading")}
            </div>
          ) : items.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-foreground-muted">
              {t("header.noNotifications")}
            </div>
          ) : (
            <ul className="grid gap-2">
              {items.map((n) => {
                const isInvite = n.type === "project_collaboration_invite";
                const isRegApproved = n.type === "hackathon_registration_approved";
                const isRegRejected = n.type === "hackathon_registration_rejected";
                const isHackathonRegistrationReview = isRegApproved || isRegRejected;
                const resolved = Boolean(n.resolved_at);
                const pid =
                  typeof n.payload.project_id === "string" ? n.payload.project_id : "";
                const inviteCtx = pid ? inviteContextByProjectId[pid] : undefined;
                const hackathonTitle =
                  payloadString(n.payload, "hackathon_title") ||
                  t("notifications.hackathonRegistrationFallbackTitle");
                const hackathonSlug = payloadString(n.payload, "hackathon_slug");
                const reviewNote = payloadString(n.payload, "review_note");
                return (
                  <li
                    key={n.id}
                    className="rounded-lg border border-border-subtle bg-surface-base p-3 text-sm"
                  >
                    {isInvite ? (
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
                              variant="ghost"
                              size="xs"
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
                              size="sm"
                              className="min-h-8"
                              disabled={busyId === n.id}
                              onClick={() => void handleAcceptInvite(n)}
                            >
                              {t("header.accept")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-h-8"
                              disabled={busyId === n.id}
                              onClick={() => void handleDeclineInvite(n)}
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
                              variant="ghost"
                              size="xs"
                              className="h-auto px-0 py-0 text-xs font-medium underline-offset-4 hover:underline"
                              render={<NavLink to={`/hackathons/${hackathonSlug}`} />}
                              nativeButton={false}
                              onClick={() => {
                                setOpen(false);
                                void markNotificationRead(n.id).then(() => refresh());
                              }}
                            >
                              {t("notifications.viewHackathon")}
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-foreground-muted">{n.type}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
