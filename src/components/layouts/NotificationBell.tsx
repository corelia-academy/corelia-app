import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Bell } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
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
    <DropdownMenuTrigger render={<button type="button" aria-label={t("header.notificationsAria")} className="relative inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface-base text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
      <span className="relative inline-flex">
        <Bell className="size-5" weight="duotone" aria-hidden />
        {unread > 0 && <Badge size="xsmall" color="error" variant="filled" className="absolute -right-2 -top-2">{unread > 99 ? "99+" : unread}</Badge>}
      </span>
    </button>} />
    <DropdownMenuContent className="w-120 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border-dropdown-container-border bg-dropdown-surface p-2 shadow-sm" align="end"><NotificationInbox compact onNavigate={() => setOpen(false)} onViewAll={() => { setOpen(false); setDrawerOpen(true); }} /></DropdownMenuContent>
  </DropdownMenu><NotificationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} /></>;
}
