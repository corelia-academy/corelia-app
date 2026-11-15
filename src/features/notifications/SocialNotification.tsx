import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/components/UserAvatar";
import { FollowButton } from "@/components/social/FollowButton";
import type { UserNotificationRow } from "@/lib/notifications";

type SocialActor = { id?: string; name?: string; avatar_url?: string } | null;
const socialActor = (n: UserNotificationRow) => n.payload.actor as SocialActor;

export function SocialNotificationAvatar({ notification: n }: { notification: UserNotificationRow }) {
  const { t } = useTranslation("common");
  const actor = socialActor(n);
  const name = actor?.name || t("notifications.member");
  return <UserAvatar userId={actor?.id} avatarUrl={actor?.avatar_url} alt={name} fallback={name[0]} size="Medium" />;
}

export function SocialNotification({ notification: n }: { notification: UserNotificationRow }) {
  const { t } = useTranslation("common");
  const actor = socialActor(n);
  const count = Number(n.payload.count ?? 1);
  const name = actor?.name || t("notifications.member");
  const actors = count > 1 ? t("notifications.actorGroup", { name, count: count - 1 }) : name;
  return <>
    {t(`notifications.social.${n.type}`, { actors, count, title: String(n.payload.title ?? ""), defaultValue: t("notifications.newActivity") })}
    {n.type === "hackathon_announcement" && typeof n.payload.body === "string" && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground-muted">{n.payload.body}</p>}
    {n.type === "user_followed" && actor?.id && <div className="mt-2" onClick={event => event.stopPropagation()}><FollowButton subject={{ type: "user", id: actor.id }} size="xsmall" showCount={false} /></div>}
  </>;
}
