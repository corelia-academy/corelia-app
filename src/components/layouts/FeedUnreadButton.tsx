import { NavLink } from "react-router";
import { Rss } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useFeedUnreadCount } from "@/hooks/useFeedUnreadCount";

export function FeedUnreadButton() {
  const { t } = useTranslation("common");
  const unreadCount = useFeedUnreadCount();

  return (
    <NavLink
      to="/feed"
      className="relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface-base text-foreground transition-colors duration-150 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      aria-label={t("header.feedAria")}
    >
      <Rss className="size-5" aria-hidden />
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </NavLink>
  );
}
