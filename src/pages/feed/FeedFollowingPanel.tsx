import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { UsersRound } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowButton } from "@/components/social/FollowButton";
import { XpRankBadge } from "@/features/xp/XpRankBadge";
import { XpBadge } from "@/features/xp/XpBadge";
import { feedSuggestionsQueryOptions, myFeedFollowingQueryOptions } from "@/features/social/socialQueries";
import type { FeedSuggestedProfile, FollowerPreviewRow } from "@/lib/follows";

function profileName(row: Pick<FollowerPreviewRow, "full_name" | "username" | "ocid">): string {
  return row.full_name?.trim() || row.username?.trim() || row.ocid?.trim() || "Corelia";
}

function SuggestedPerson({ row }: { row: FeedSuggestedProfile }) {
  const name = profileName(row);
  const handle = row.username?.trim() || row.ocid?.trim() || row.id;
  return <div className="flex min-w-0 items-center gap-2 py-2">
    <NavLink to={`/@${handle}`} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg hover:bg-surface-raised">
      <UserAvatar userId={row.id} avatarUrl={row.avatar_url} avatarSeed={row.avatar_seed} alt={name} fallback={name[0]?.toUpperCase() ?? "C"} className="size-9 shrink-0" />
      <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{name}</span><span className="mt-1 flex flex-wrap items-center gap-1"><XpBadge total={row.total_xp} /><XpRankBadge total={row.total_xp} /></span></span>
    </NavLink>
    <FollowButton subject={{ type: "user", id: row.id }} size="sm" showCount={false} className="shrink-0 px-2 text-xs" />
  </div>;
}

function FollowingPerson({ row, onOpen }: { row: FollowerPreviewRow; onOpen?: () => void }) {
  const name = profileName(row);
  const handle = row.username?.trim() || row.ocid?.trim() || row.id;
  return <NavLink to={`/@${handle}`} onClick={onOpen} className="flex min-w-0 items-center gap-3 rounded-lg py-2 hover:bg-surface-raised">
    <UserAvatar userId={row.id} avatarUrl={row.avatar_url} avatarSeed={row.avatar_seed} alt={name} fallback={name[0]?.toUpperCase() ?? "C"} className="size-9 shrink-0" />
    <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{name}</span>{(row.username || row.ocid) && <span className="block truncate text-xs text-foreground-muted">{row.username ? `@${row.username}` : row.ocid}</span>}</span>
  </NavLink>;
}

export function FeedSuggestedPeople({ userId }: { userId: string }) {
  const { t } = useTranslation("feed");
  const suggestions = useQuery(feedSuggestionsQueryOptions(userId, true));
  return <section className="rounded-xl border border-border-subtle bg-surface-base p-4" aria-label={t("milestones.suggestedTitle")}>
    <h2 className="flex items-center gap-2 font-semibold"><UsersRound className="size-4 shrink-0 text-primary" aria-hidden />{t("milestones.suggestedTitle")}</h2>
    {suggestions.isPending ? <div className="mt-3 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      : suggestions.isError ? <div role="alert" className="mt-3 text-sm text-destructive">{t("milestones.suggestedError")} <Button type="button" size="sm" variant="ghost" onClick={() => void suggestions.refetch()}>{t("milestones.retry")}</Button></div>
      : suggestions.data?.length ? <div className="mt-2 space-y-1">{suggestions.data.map((row) => <SuggestedPerson key={row.id} row={row} />)}</div>
      : <p className="mt-3 text-sm text-foreground-muted">{t("milestones.suggestedEmpty")}</p>}
  </section>;
}

export function FeedFollowingPanel({ userId }: { userId: string }) {
  const { t } = useTranslation("feed");
  const [open, setOpen] = useState(false);
  const query = useInfiniteQuery(myFeedFollowingQueryOptions(userId));
  const rows = query.data?.pages.flat() ?? [];
  const preview = rows.slice(0, 6);
  const hasMore = rows.length > 6 || query.hasNextPage;
  return <>
    <section className="rounded-xl border border-border-subtle bg-surface-base p-4" aria-label={t("milestones.followedTitle")}>
      <h2 className="flex items-center gap-2 font-semibold"><UsersRound className="size-4 text-primary" aria-hidden />{t("milestones.followedTitle")}</h2>
      {query.isPending ? <div className="mt-3 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        : query.isError ? <div role="alert" className="mt-3 text-sm text-destructive">{t("milestones.followedError")} <Button type="button" size="sm" variant="ghost" onClick={() => void query.refetch()}>{t("milestones.retry")}</Button></div>
        : <><div className="mt-2 space-y-1">{preview.map((row) => <FollowingPerson key={row.id} row={row} />)}</div>
          {rows.length === 0 && <p className="mt-3 text-sm text-foreground-muted">{t("milestones.followedEmpty")}</p>}
          {hasMore && <Button type="button" size="sm" variant="ghost" className="mt-2 w-full" onClick={() => setOpen(true)}>{t("milestones.followedAll")}</Button>}</>}
    </section>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("milestones.followedTitle")}</DialogTitle><DialogDescription>{t("milestones.followedDescription")}</DialogDescription></DialogHeader>
        <div className="scrollbar-design max-h-80 overflow-y-auto">{rows.map((row) => <FollowingPerson key={row.id} row={row} onOpen={() => setOpen(false)} />)}</div>
        {query.isFetchNextPageError && <p role="alert" className="text-sm text-destructive">{t("milestones.followedError")}</p>}
        {query.hasNextPage && <Button type="button" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t(query.isFetchNextPageError ? "milestones.retry" : "milestones.loadMore")}</Button>}
      </DialogContent>
    </Dialog>
  </>;
}
