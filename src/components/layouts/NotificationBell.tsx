import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Bell } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/stores/authStore";
import { notificationsQueryOptions } from "@/features/notifications/notificationQueries";
import { NotificationInbox } from "@/features/notifications/NotificationInbox";
import { NotificationDrawer } from "@/features/notifications/NotificationDrawer";

export function NotificationBell() {
  const { t } = useTranslation("common");
  const { user, authInitialized, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const query = useInfiniteQuery(notificationsQueryOptions(user?.id ?? null, authInitialized && isAuthenticated));
  const unread = query.data?.pages[0]?.unread_count ?? 0;
  if (!authInitialized || !isAuthenticated) return null;
  return <><DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger render={<button type="button" aria-label={t("header.notificationsAria")} className="relative inline-flex size-10 items-center justify-center rounded-full bg-surface-base text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
      <Bell className="size-5" weight="duotone" aria-hidden />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
    </button>} />
    <DropdownMenuContent className="w-[560px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border-dropdown-container-border bg-dropdown-surface p-2 shadow-sm" align="end"><NotificationInbox compact onNavigate={() => setOpen(false)} onViewAll={() => { setOpen(false); setDrawerOpen(true); }} /></DropdownMenuContent>
  </DropdownMenu><NotificationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} /></>;
}
