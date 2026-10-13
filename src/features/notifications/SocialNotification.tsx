import { notificationTarget } from "@/lib/notificationTarget";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/components/UserAvatar";
import { FollowButton } from "@/components/social/FollowButton";
import type { UserNotificationRow } from "@/lib/notifications";

export function SocialNotification({ notification: n, onOpen }: { notification: UserNotificationRow; onOpen: () => void }) {
  const { t } = useTranslation("common");
  const actor = n.payload.actor as { id?: string; name?: string; avatar_url?: string } | null;
  const count = Number(n.payload.count ?? 1);
  const name = actor?.name || t("notifications.member");
  const actors = count > 1 ? t("notifications.actorGroup", { name, count: count - 1 }) : name;
  return <div className="flex items-start gap-3">
    <UserAvatar userId={actor?.id} avatarUrl={actor?.avatar_url} alt={name} fallback={name[0]} className="size-9 shrink-0" />
    <div className="min-w-0 flex-1">
      <NavLink to={notificationTarget(n.payload)} onClick={onOpen} className="block rounded-sm leading-relaxed hover:underline focus-visible:outline focus-visible:outline-primary">
        {t(`notifications.social.${n.type}`, { actors, count, title: String(n.payload.title ?? ""), defaultValue: t("notifications.newActivity") })}
      </NavLink>
      {n.type === "hackathon_announcement" && typeof n.payload.body === "string" && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground-muted">{n.payload.body}</p>}
      {n.type === "user_followed" && actor?.id && <div className="mt-2"><FollowButton subject={{ type: "user", id: actor.id }} size="xsmall" showCount={false} /></div>}
    </div>
  </div>;
}
