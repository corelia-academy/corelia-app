import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Trophy } from "lucide-react";
import { NavLink, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { milestoneFeedQuery, milestoneKeys } from "@/features/feed/milestoneQueries";
import { setMilestoneLike, subscribeToMilestones, type FeedMode, type FeedMilestone, type FeedProfile, type FeedSource } from "@/lib/milestoneFeed";
import { feedRelativeTime } from "@/lib/feedRelativeTime";
import { useAuth } from "@/stores/authStore";
import { FeedFollowingPanel, FeedSuggestedPeople } from "./FeedFollowingPanel";
import FeedLeaderboard from "./FeedLeaderboard";

type CardProps = { milestone: FeedMilestone; actor?: FeedProfile; sources: FeedSource[]; likes: number; liked: boolean; own: boolean; now: number; onLike: () => void };
function MilestoneCard({ milestone, actor, sources, likes, liked, own, now, onLike }: CardProps) {
  const { t, i18n } = useTranslation("feed");
  const actorName = actor?.full_name?.trim() || actor?.username || actor?.ocid || t("milestones.member");
  const href = `/@${actor?.username || actor?.ocid || milestone.actor_id}`;
  const primary = sources[0];
  const absoluteTime = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(milestone.created_at));
  return <article className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
    <NavLink to={href} aria-label={actorName} className="shrink-0"><UserAvatar userId={milestone.actor_id} avatarUrl={actor?.avatar_url} avatarSeed={actor?.avatar_seed} avatarConfig={actor?.avatar_config} alt={actorName} fallback={actorName[0]?.toUpperCase() ?? "C"} className="size-11" /></NavLink>
    <div className="min-w-0 flex-1">
      <p className="text-sm leading-6 text-foreground sm:text-base">
        <NavLink to={href} className="font-semibold hover:underline">{actorName}</NavLink>{" "}
        {milestone.kind === "course_completed" ? t("milestones.completed") : milestone.kind === "xp_reached" ? t("milestones.reached", { count: milestone.xp_total ?? 0 }) : t("milestones.submitted")}
        {primary && <> <NavLink to={primary.href} className="font-semibold text-primary hover:underline">{primary.label}</NavLink></>}
      </p>
      <time className="mt-1 block text-xs text-foreground-muted" dateTime={milestone.created_at} title={absoluteTime} tabIndex={0}>{feedRelativeTime(milestone.created_at, now, i18n.language, t("milestones.justNow"))}</time>
    </div>
    <Button type="button" size="sm" variant="ghost" className="shrink-0 gap-1 text-foreground-muted" aria-label={liked ? t("milestones.unlike") : t("milestones.like")} aria-pressed={liked} disabled={own} onClick={onLike}><Heart className="size-4" fill={liked ? "currentColor" : "none"} /><span className="text-xs">{likes}</span></Button>
  </article>;
}

type FeedView = FeedMode | "leaderboard";

export default function FeedPage() {
  const { t } = useTranslation("feed");
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const view: FeedView = requestedTab === "following" || requestedTab === "leaderboard" ? requestedTab : "explore";
  const setView = (next: FeedView) => setSearchParams(previous => {
    const params = new URLSearchParams(previous);
    if (next === "explore") params.delete("tab");
    else params.set("tab", next);
    return params;
  });

  return <div className="container-app py-6 sm:py-8"><div className="mx-auto max-w-6xl">
    <div><h1 className="text-display-small font-display">{t("milestones.title")}</h1><p className="mt-1 text-sm text-foreground-muted">{t("milestones.description")}</p></div>
    <Tabs.Root value={view} onValueChange={value => { if (value === "explore" || value === "following" || value === "leaderboard") setView(value); }}>
      <Tabs.List activateOnFocus className="mt-6 border-b border-border-subtle" level="2a" aria-label={t("milestones.tabs")}>
        <Tabs.Tab value="explore">{t("milestones.explore")}</Tabs.Tab>
        <Tabs.Tab value="following">{t("milestones.following")}</Tabs.Tab>
        <Tabs.Tab value="leaderboard">{t("milestones.leaderboard")}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value={view} className="pt-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {view === "leaderboard" ? <FeedLeaderboard /> : <FeedTimeline userId={userId} mode={view} onFindPeople={() => setView("explore")} />}
          </div>
          <aside className="hidden space-y-5 lg:block"><FeedSuggestedPeople userId={userId} /><FeedFollowingPanel userId={userId} /></aside>
        </div>
      </Tabs.Panel>
    </Tabs.Root>
  </div></div>;
}

function FeedTimeline({ userId, mode, onFindPeople }: { userId: string; mode: FeedMode; onFindPeople: () => void }) {
  const { t } = useTranslation("feed");
  const client = useQueryClient();
  const following = mode === "following";
  const [newAvailable,setNewAvailable] = useState(false);
  const [error,setError] = useState("");
  const [now,setNow] = useState(() => Date.now());
  const feed = useInfiniteQuery(milestoneFeedQuery(userId,mode));
  useEffect(() => subscribeToMilestones(() => setNewAvailable(true)), []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.milestones) ?? [], [feed.data]);
  const profiles = Object.assign({}, ...(feed.data?.pages.map((page) => page.profiles) ?? []));
  const sources = Object.assign({}, ...(feed.data?.pages.map((page) => page.sources) ?? []));
  const likes = Object.assign({}, ...(feed.data?.pages.map((page) => page.likes) ?? []));
  const liked = new Set(feed.data?.pages.flatMap((page) => [...page.liked]) ?? []);
  const mutate = async (action: () => Promise<void>) => { try { setError(""); await action(); await client.invalidateQueries({ queryKey:milestoneKeys.all }); } catch (cause) { setError(cause instanceof Error ? cause.message : t("milestones.error")); } };
  return <div className="space-y-3">
    <p className="text-sm text-foreground-muted">{t(following ? "milestones.followingDescription" : "milestones.exploreDescription")}</p>
    {following && <Button type="button" variant="ghost" className="px-0" onClick={onFindPeople}>{t("milestones.findPeople")}</Button>}
    {newAvailable && <Button type="button" className="w-full" variant="secondary" onClick={() => { setNewAvailable(false); void feed.refetch(); }}>{t("milestones.new")}</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!following && <div className="mb-5 lg:hidden"><FeedSuggestedPeople userId={userId} /></div>}
      {feed.isPending ? <><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /></> : feed.isError && !feed.data ? <div role="alert" className="rounded-xl border border-border-subtle p-5"><p>{t("milestones.error")}</p><Button type="button" variant="outline" className="mt-3" onClick={() => void feed.refetch()}>{t("milestones.retry")}</Button></div> : items.length===0 ? <div className="rounded-xl border border-border-subtle p-8 text-center"><Trophy className="mx-auto size-8 text-foreground-muted" /><h2 className="mt-3 font-semibold">{t("milestones.empty")}</h2><p className="mt-2 text-sm text-foreground-muted">{following ? t("milestones.followingHint") : t("milestones.emptyHint")}</p></div> : <><div className="divide-y divide-border-subtle rounded-2xl border border-border-subtle bg-surface-base">{items.map((item) => <MilestoneCard key={item.id} milestone={item} actor={profiles[item.actor_id]} sources={sources[item.id] ?? []} likes={likes[item.id] ?? 0} liked={liked.has(item.id)} own={item.actor_id===userId} now={now} onLike={() => void mutate(() => setMilestoneLike(item.id,userId,!liked.has(item.id)))} />)}</div>{feed.isFetchNextPageError && <p role="alert" className="text-sm text-destructive">{t("milestones.error")}</p>}{feed.hasNextPage && <div className="flex justify-center pt-2"><Button type="button" variant="outline" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>{t(feed.isFetchNextPageError ? "milestones.retry" : "milestones.loadMore")}</Button></div>}</>}
  </div>;
}
