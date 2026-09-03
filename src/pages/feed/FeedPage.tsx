import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, Loader2, RefreshCw, Rss } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  feedFollowingQueryOptions,
  feedKeys,
  feedTimelineQueryOptions,
} from "@/features/feed/feedQueries";
import type { FeedActor } from "@/lib/feed";
import { subscribeToActivityEvents } from "@/lib/feed";
import { bundleFeedEvents } from "@/lib/feedBundling";
import { markFeedRead } from "@/lib/feedUnread";
import { subscribeToFollowingChanges } from "@/lib/follows";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import type { ActivityEvent, FeedBundle, FollowRow, FollowSubjectType } from "@/types/feed";

const FOLLOW_SUBJECT_TYPES: FollowSubjectType[] = ["user", "course", "hackathon", "project"];

type FollowedSubjects = Record<FollowSubjectType, Set<string>>;

function createFollowedSubjects(): FollowedSubjects {
  return {
    user: new Set<string>(),
    course: new Set<string>(),
    hackathon: new Set<string>(),
    project: new Set<string>(),
  };
}

function buildFollowedSubjects(rows: FollowRow[]): FollowedSubjects {
  const subjects = createFollowedSubjects();
  const now = Date.now();

  for (const row of rows) {
    if (row.muted_until && new Date(row.muted_until).getTime() > now) continue;
    subjects[row.subject_type].add(row.subject_id);
  }

  return subjects;
}

function isFollowSubjectType(value: string | null): value is FollowSubjectType {
  return Boolean(value && FOLLOW_SUBJECT_TYPES.includes(value as FollowSubjectType));
}

function eventMatchesFollowedSubjects(
  event: ActivityEvent,
  followed: FollowedSubjects,
  userId: string,
): boolean {
  if (event.actor_id === userId) return true;
  if (followed.user.has(event.actor_id)) return true;

  if (
    isFollowSubjectType(event.object_type) &&
    followed[event.object_type].has(event.object_id)
  ) {
    return true;
  }

  if (
    isFollowSubjectType(event.target_type) &&
    event.target_id &&
    followed[event.target_type].has(event.target_id)
  ) {
    return true;
  }

  return false;
}

function actorLabel(actor: FeedActor | undefined): string {
  return actor?.full_name?.trim() || actor?.username?.trim() || actor?.ocid?.trim() || "Corelia";
}

function actorHref(actor: FeedActor | undefined, fallbackId: string): string {
  const handle = actor?.username?.trim() || actor?.ocid?.trim() || fallbackId;
  return `/@${handle}`;
}

function objectHref(event: ActivityEvent): string | null {
  const type = event.target_type ?? event.object_type;
  const id = event.target_id ?? event.object_id;
  if (!id) return null;
  if (type === "course") {
    const slug = payloadText(event.payload, ["course_slug", "slug"]);
    return `/courses/${slug ?? id}`;
  }
  if (type === "hackathon") {
    const slug = payloadText(event.payload, ["hackathon_slug", "slug"]);
    return `/hackathons/${slug ?? id}`;
  }
  if (type === "project") return `/projects/${id}`;
  if (type === "user") return `/@${id}`;
  return null;
}

function payloadText(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function objectLabel(event: ActivityEvent, fallback: string): string {
  return (
    payloadText(event.payload, [
      "title",
      "name",
      "course_title",
      "hackathon_title",
      "project_title",
    ]) ?? fallback
  );
}

function verbKey(verb: string): string {
  return verb.replaceAll(".", "_");
}

function formatDate(value: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function FeedItem({
  bundle,
  actor,
  locale,
}: {
  bundle: FeedBundle;
  actor: FeedActor | undefined;
  locale: string;
}) {
  const { t } = useTranslation("feed");
  const event = bundle.events[0];
  if (!event) return null;

  const fallbackObject = t(`objects.${event.object_type}`, {
    defaultValue: event.object_type,
  });
  const object = objectLabel(event, fallbackObject);
  const actorName = actorLabel(actor);
  const href = objectHref(event);
  const i18nKey = bundle.kind === "bundle"
    ? `verbs.${verbKey(event.verb)}_bundle`
    : `verbs.${verbKey(event.verb)}`;
  const text = t(i18nKey, {
    actor: actorName,
    object,
    count: bundle.kind === "bundle"
      ? bundle.events.length
      : Number(event.payload.milestone ?? event.payload.like_count ?? 0),
    section: payloadText(event.payload, ["section_title"]) ?? "",
    defaultValue: t("verbs.fallback", { actor: actorName, object }),
  });

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-card">
      <div className="flex gap-3">
        <NavLink to={actorHref(actor, event.actor_id)} className="shrink-0">
          <Avatar className="size-10">
            <AvatarImage src={actor?.avatar_url ?? undefined} alt="" />
            <AvatarFallback>{actorName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </NavLink>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-6 text-foreground">
            {text}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
            <span>{formatDate(event.created_at, locale)}</span>
            {href ? (
              <>
                <span aria-hidden>-</span>
                <NavLink
                  to={href}
                  className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                >
                  {t("item.open")}
                </NavLink>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function FeedPage() {
  const { t, i18n } = useTranslation("feed");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hasNewEvents, setHasNewEvents] = useState(false);
  const timelineQuery = useInfiniteQuery(feedTimelineQueryOptions(user?.id ?? null));
  const followingQuery = useQuery(feedFollowingQueryOptions(user?.id ?? null));
  const events = useMemo(() => {
    const seen = new Set<number>();
    return (timelineQuery.data?.pages ?? []).flatMap((page) =>
      page.events.filter((event) => {
        if (seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      }),
    );
  }, [timelineQuery.data]);
  const actors = useMemo(
    () => Object.assign({}, ...(timelineQuery.data?.pages.map((page) => page.actors) ?? [])) as Record<string, FeedActor>,
    [timelineQuery.data],
  );
  const followedSubjects = useMemo(
    () => buildFollowedSubjects(followingQuery.data ?? []),
    [followingQuery.data],
  );

  useEffect(() => {
    const newest = events[0]?.created_at;
    if (!user?.id || !newest) return;
    markFeedRead(user.id, newest);
    queryClient.setQueryData(feedKeys.unread(user.id), 0);
  }, [events, queryClient, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribeActivity = subscribeToActivityEvents("feed-page", (event) => {
      if (eventMatchesFollowedSubjects(event, followedSubjects, user.id)) {
        setHasNewEvents(true);
      }
    });
    const unsubscribeFollowing = subscribeToFollowingChanges(
      user.id,
      "feed-page",
      () => {
        void queryClient.invalidateQueries({ queryKey: feedKeys.following(user.id) });
      },
    );

    return () => {
      unsubscribeActivity();
      unsubscribeFollowing();
    };
  }, [followedSubjects, queryClient, user?.id]);

  const refresh = async () => {
    await Promise.all([timelineQuery.refetch(), followingQuery.refetch()]);
    setHasNewEvents(false);
  };

  const groupedEvents = useMemo(() => bundleFeedEvents(events), [events]);

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground-muted">
            <Rss className="size-4" aria-hidden />
            {t("eyebrow")}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">
            {t("description")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5 self-start sm:self-auto"
          onClick={() => void refresh()}
          disabled={timelineQuery.isFetching}
        >
          <RefreshCw
            className={cn("size-4", timelineQuery.isFetching ? "animate-spin" : "")}
            aria-hidden
          />
          {t("actions.refresh")}
        </Button>
      </div>

      {hasNewEvents ? (
        <Button
          type="button"
          variant="secondary"
          className="mb-4 w-full gap-1.5"
          onClick={() => void refresh()}
        >
          <Bell className="size-4" aria-hidden />
          {t("actions.showNew")}
        </Button>
      ) : null}

      {timelineQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : timelineQuery.error ? (
        <div className="rounded-lg border border-border-subtle bg-surface-base p-6 text-center shadow-card">
          <p className="text-sm font-medium text-foreground">{t("errors.title")}</p>
          <p className="mt-1 text-sm text-foreground-muted">
            {timelineQuery.error instanceof Error ? timelineQuery.error.message : t("errors.load")}
          </p>
          <Button type="button" className="mt-4" onClick={() => void refresh()}>
            {t("actions.retry")}
          </Button>
        </div>
      ) : groupedEvents.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-surface-base p-8 text-center shadow-card">
          <Rss className="mx-auto size-8 text-foreground-subtle" aria-hidden />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            {t("empty.title")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-foreground-muted">
            {t("empty.description")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedEvents.map((bundle) => (
            <FeedItem
              key={bundle.key}
              bundle={bundle}
              actor={actors[bundle.events[0]?.actor_id ?? ""]}
              locale={i18n.resolvedLanguage ?? i18n.language}
            />
          ))}
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={timelineQuery.isFetchingNextPage || !timelineQuery.hasNextPage}
              onClick={() => void timelineQuery.fetchNextPage()}
            >
              {timelineQuery.isFetchingNextPage ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ChevronDown className="size-4" aria-hidden />
              )}
              {t("actions.loadMore")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
