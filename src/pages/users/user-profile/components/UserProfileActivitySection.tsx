import { useInfiniteQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { milestoneFeedQuery } from "@/features/feed/milestoneQueries";
import { useAuth } from "@/stores/authStore";
import type { PublicProfile } from "@/types/database";

export function UserProfileActivitySection({ profile }: { profile: PublicProfile }) {
  const { t } = useTranslation("feed");
  const { user } = useAuth();
  const query = useInfiniteQuery(milestoneFeedQuery(user?.id ?? "",false,profile.id));
  const milestones = query.data?.pages.flatMap((page) => page.milestones) ?? [];
  const sources = Object.assign({}, ...(query.data?.pages.map((page) => page.sources) ?? []));
  return <section className="space-y-3"><h2 className="flex items-center gap-2 text-heading-small font-display"><Trophy className="size-4" />{t("milestones.profileTitle")}</h2>
    {query.isPending ? <Skeleton className="h-24 rounded-lg" /> : query.isError ? <p role="alert" className="text-sm text-destructive">{t("milestones.error")}</p> : milestones.length===0 ? <p className="rounded-lg border border-border-subtle p-4 text-sm text-foreground-muted">{t("milestones.profileEmpty")}</p> : <div className="space-y-2">{milestones.map((item) => <div key={item.id} className="rounded-lg border border-border-subtle bg-surface-base p-4"><p className="font-medium">{t(`milestones.kind.${item.kind}`)}{item.kind==="xp_reached" ? ` · ${item.xp_total} XP` : ""}</p>{(sources[item.id] ?? []).map((source: {href:string;label:string}) => <NavLink key={source.href} to={source.href} className="mt-1 block truncate text-sm text-primary hover:underline">{source.label}</NavLink>)}</div>)}{query.hasNextPage && <Button type="button" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t("milestones.loadMore")}</Button>}</div>}
  </section>;
}
