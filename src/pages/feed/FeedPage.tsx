import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, Loader2, RefreshCw, Rss } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeed } from "@/lib/feed";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ActivityEvent } from "@/types/feed";

interface FeedActor {
  id: string;
  username: string | null;
  ocid: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const PAGE_SIZE = 20;

function actorLabel(actor: FeedActor | undefined): string {
  return actor?.full_name?.trim() || actor?.username?.trim() || actor?.ocid?.trim() || "Corelia";
}

function actorHref(actor: FeedActor | undefined, fallbackId: string): string {
  const handle = actor?.username?.trim() || actor?.ocid?.trim() || fallbackId;
  return `/u/${handle}`;
}

function objectHref(event: ActivityEvent): string | null {
  const type = event.target_type ?? event.object_type;
  const id = event.target_id ?? event.object_id;
  if (!id) return null;
  if (type === "course") return `/courses/${id}`;
  if (type === "hackathon") {
    const slug = payloadText(event.payload, ["hackathon_slug", "slug"]);
    return `/hackathons/${slug ?? id}`;
  }
  if (type === "project") return `/projects/${id}`;
  if (type === "user") return `/u/${id}`;
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
  event,
  actor,
  locale,
}: {
  event: ActivityEvent;
  actor: FeedActor | undefined;
  locale: string;
}) {
  const { t } = useTranslation("feed");
  const fallbackObject = t(`objects.${event.object_type}`, {
    defaultValue: event.object_type,
  });
  const object = objectLabel(event, fallbackObject);
  const actorName = actorLabel(actor);
  const href = objectHref(event);
  const text = t(`verbs.${verbKey(event.verb)}`, {
    actor: actorName,
    object,
    count: Number(event.payload.milestone ?? event.payload.like_count ?? 0),
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
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [actors, setActors] = useState<Record<string, FeedActor>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNewEvents, setHasNewEvents] = useState(false);
  const cursorRef = useRef<string | null>(null);

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
        if (!append) setHasNewEvents(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.load"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [loadActors, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    cursorRef.current = events.at(-1)?.created_at ?? null;
  }, [events]);

  useEffect(() => {
    const channel = supabase
      .channel("activity-feed-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events" },
        () => setHasNewEvents(true),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const groupedEvents = useMemo(() => events, [events]);

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
          {groupedEvents.map((event) => (
            <FeedItem
              key={event.id}
              event={event}
              actor={actors[event.actor_id]}
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
