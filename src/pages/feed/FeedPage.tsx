import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, Loader2, Megaphone, RefreshCw, Rss } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Markdown } from "@/components/markdown/Markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeed } from "@/lib/feed";
import { bundleFeedEvents } from "@/lib/feedBundling";
import { markFeedRead } from "@/lib/feedUnread";
import { listFollowing } from "@/lib/follows";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import type { ActivityEvent, FeedBundle, FollowRow, FollowSubjectType } from "@/types/feed";

interface FeedActor {
  id: string;
  username: string | null;
  ocid: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const PAGE_SIZE = 20;
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

function activityEventFromRecord(record: Record<string, unknown>): ActivityEvent | null {
  if (
    typeof record.id !== "number" ||
    typeof record.actor_id !== "string" ||
    typeof record.verb !== "string" ||
    typeof record.object_type !== "string" ||
    typeof record.object_id !== "string" ||
    typeof record.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    actor_id: record.actor_id,
    verb: record.verb,
    object_type: record.object_type,
    object_id: record.object_id,
    target_type: typeof record.target_type === "string" ? record.target_type : null,
    target_id: typeof record.target_id === "string" ? record.target_id : null,
    payload: record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : {},
    visibility: record.visibility === "followers" || record.visibility === "private"
      ? record.visibility
      : "public",
    created_at: record.created_at,
  };
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

  if (event.verb === "announcement") {
    const title = String(event.payload.title || "");
    const content = String(event.payload.content || "");
    
    return (
      <article className="relative overflow-hidden rounded-lg border-2 border-primary bg-primary/5 p-5 shadow-card">
        <div className="absolute top-0 right-0 rounded-bl-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground flex items-center gap-1.5 shadow-sm">
          <Megaphone className="size-3.5" />
          THÔNG BÁO TỪ {event.object_type === 'hackathon' ? 'BAN TỔ CHỨC' : 'GIẢNG VIÊN'}
        </div>
        <div className="flex gap-4">
          <NavLink to={actorHref(actor, event.actor_id)} className="shrink-0 mt-1">
            <Avatar className="size-12 border-2 border-background shadow-sm">
              <AvatarImage src={actor?.avatar_url ?? undefined} alt="" />
              <AvatarFallback>{actorName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </NavLink>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-semibold text-foreground text-base">
                {actorName}
              </span>
              <span className="text-sm text-foreground-muted">
                đã đăng trong <span className="font-medium text-foreground">{object}</span>
              </span>
            </div>
            
            <div className="mt-3 rounded-md bg-background/50 border border-primary/20 p-4">
              {title && <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>}
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                <Markdown content={content} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
              <span>{formatDate(event.created_at, locale)}</span>
              {href ? (
                <>
                  <span aria-hidden>-</span>
                  <NavLink
                    to={href}
                    className="font-medium text-primary underline underline-offset-4 hover:no-underline"
                  >
                    Đến {event.object_type === 'hackathon' ? 'Cuộc thi' : 'Khóa học'}
                  </NavLink>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    );
  }

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
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [actors, setActors] = useState<Record<string, FeedActor>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNewEvents, setHasNewEvents] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const followedRef = useRef<FollowedSubjects>(createFollowedSubjects());

  const refreshFollowedSubjects = useCallback(async () => {
    if (!user?.id) {
      followedRef.current = createFollowedSubjects();
      return followedRef.current;
    }

    const rows = await listFollowing();
    const next = buildFollowedSubjects(rows);
    followedRef.current = next;
    return next;
  }, [user?.id]);

  const loadActors = useCallback(async (nextEvents: ActivityEvent[]) => {
    const ids = Array.from(new Set(nextEvents.map((event) => event.actor_id)));
    if (ids.length === 0) return;

    const { data, error: actorError } = await supabase
      .from("public_profiles")
      .select("id,username,ocid,full_name,avatar_url")
      .in("id", ids);
    if (actorError) throw new Error(actorError.message);

    setActors((current) => {
      const next = { ...current };
      for (const row of data ?? []) {
        const actor = row as FeedActor;
        next[actor.id] = actor;
      }
      return next;
    });
  }, []);

  const load = useCallback(
    async ({ append = false }: { append?: boolean } = {}) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        await refreshFollowedSubjects();
        const nextEvents = await getFeed({
          cursor: append ? cursorRef.current : null,
          limit: PAGE_SIZE,
        });
        await loadActors(nextEvents);
        setEvents((current) => {
          if (!append) return nextEvents;
          const seen = new Set(current.map((event) => event.id));
          return [...current, ...nextEvents.filter((event) => !seen.has(event.id))];
        });
        if (!append) {
          if (user?.id) markFeedRead(user.id, nextEvents[0]?.created_at ?? new Date().toISOString());
          setHasNewEvents(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.load"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [loadActors, refreshFollowedSubjects, t, user?.id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    cursorRef.current = events.at(-1)?.created_at ?? null;
  }, [events]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("activity-feed-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events" },
        (payload) => {
          const event = activityEventFromRecord(payload.new);
          if (!event) return;
          if (eventMatchesFollowedSubjects(event, followedRef.current, user.id)) {
            setHasNewEvents(true);
          }
        },
      )
      .subscribe();

    const followsChannel = supabase
      .channel("activity-feed-follows")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follows",
          filter: `follower_id=eq.${user.id}`,
        },
        () => {
          void refreshFollowedSubjects();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(followsChannel);
    };
  }, [refreshFollowedSubjects, user?.id]);

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
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={cn("size-4", loading ? "animate-spin" : "")} aria-hidden />
          {t("actions.refresh")}
        </Button>
      </div>

      {hasNewEvents ? (
        <Button
          type="button"
          variant="secondary"
          className="mb-4 w-full gap-1.5"
          onClick={() => void load()}
        >
          <Bell className="size-4" aria-hidden />
          {t("actions.showNew")}
        </Button>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-border-subtle bg-surface-base p-6 text-center shadow-card">
          <p className="text-sm font-medium text-foreground">{t("errors.title")}</p>
          <p className="mt-1 text-sm text-foreground-muted">{error}</p>
          <Button type="button" className="mt-4" onClick={() => void load()}>
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
              disabled={loadingMore || groupedEvents.length < PAGE_SIZE}
              onClick={() => void load({ append: true })}
            >
              {loadingMore ? (
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
