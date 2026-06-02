import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Activity, ChevronDown, Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActorActivity } from "@/lib/feed";
import type { PublicProfile } from "@/types/database";
import type { ActivityEvent } from "@/types/feed";

const PAGE_SIZE = 8;

function payloadText(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function verbKey(verb: string): string {
  return verb.replaceAll(".", "_");
}

function profileLabel(profile: PublicProfile): string {
  return (
    profile.full_name?.trim() ||
    profile.username?.trim() ||
    profile.ocid?.trim() ||
    "Corelia"
  );
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
  if (type === "user") return `/u/${id}`;

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

function ActivityRow({
  event,
  profile,
  locale,
}: {
  event: ActivityEvent;
  profile: PublicProfile;
  locale: string;
}) {
  const { t } = useTranslation("feed");
  const actor = profileLabel(profile);
  const fallbackObject = t(`objects.${event.object_type}`, {
    defaultValue: event.object_type,
  });
  const object = objectLabel(event, fallbackObject);
  const href = objectHref(event);
  const text = t(`verbs.${verbKey(event.verb)}`, {
    actor,
    object,
    count: Number(event.payload.milestone ?? event.payload.like_count ?? 0),
    section: payloadText(event.payload, ["section_title"]) ?? "",
    defaultValue: t("verbs.fallback", { actor, object }),
  });

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-card">
      <div className="flex gap-3">
        <Avatar className="size-9">
          <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
          <AvatarFallback>{actor.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-6 text-foreground">{text}</p>
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

export function UserProfileActivitySection({
  profile,
}: {
  profile: PublicProfile;
}) {
  const { t, i18n } = useTranslation(["common", "feed"]);
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await getActorActivity(profile.id, { limit: PAGE_SIZE + 1 });
        if (cancelled) return;
        setItems(next.slice(0, PAGE_SIZE));
        setHasMore(next.length > PAGE_SIZE);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t("userProfile.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [profile.id, t]);

  async function loadMore() {
    const cursor = items.at(-1)?.created_at;
    if (!cursor) return;

    setLoadingMore(true);
    setError(null);
    try {
      const next = await getActorActivity(profile.id, {
        cursor,
        limit: PAGE_SIZE + 1,
      });
      setItems((current) => [...current, ...next.slice(0, PAGE_SIZE)]);
      setHasMore(next.length > PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("userProfile.errors.loadFailed"));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-foreground-muted" aria-hidden />
        <h2 className="text-base font-semibold text-foreground">
          {t("userProfile.activity.title")}
        </h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted shadow-card">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted shadow-card">
          {t("userProfile.activity.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((event) => (
            <ActivityRow
              key={event.id}
              event={event}
              profile={profile}
              locale={i18n.resolvedLanguage ?? i18n.language}
            />
          ))}
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ChevronDown className="size-4" aria-hidden />
                )}
                {t("feed:actions.loadMore")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
