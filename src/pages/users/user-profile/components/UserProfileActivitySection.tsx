import { useInfiniteQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { publicProfileActivityQueryOptions } from "@/features/profiles/publicProfileQueries";
import type { PublicProfile } from "@/types/database";
import type { ActivityEvent } from "@/types/feed";
import { profileTitle } from "../utils/profileDisplay";

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
  return profileTitle(profile);
}

function subjectHref(
  type: string | null,
  id: string | null,
  payload: Record<string, unknown>,
): string | null {
  if (!type || !id) return null;

  if (type === "course") {
    const slug = payloadText(payload, ["course_slug", "slug"]);
    return `/courses/${slug ?? id}`;
  }

  if (type === "hackathon") {
    const slug = payloadText(payload, ["hackathon_slug", "slug"]);
    return `/hackathons/${slug ?? id}`;
  }

  if (type === "project") return `/projects/${id}`;
  if (type === "user") return `/@${id}`;

  return null;
}

function objectHref(event: ActivityEvent): string | null {
  // Prefer the object (the thing acted upon, e.g. the course completed).
  // Skip when the object is the actor themselves (follow events store the
  // actor as the object) or a route-less type (e.g. credential), then fall
  // back to the target (e.g. the course a credential was earned for).
  const objectIsActor =
    event.object_type === "user" && event.object_id === event.actor_id;
  const objectHrefValue = objectIsActor
    ? null
    : subjectHref(event.object_type, event.object_id, event.payload);
  if (objectHrefValue) return objectHrefValue;

  return subjectHref(event.target_type, event.target_id, event.payload);
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
  const { t, i18n } = useTranslation("common");
  const { t: tFeed } = useTranslation("feed");
  const query = useInfiniteQuery(publicProfileActivityQueryOptions(profile.id));
  const items = query.data?.pages.flat() ?? [];
  const loading = query.isPending;
  const loadingMore = query.isFetchingNextPage;
  const hasMore = query.hasNextPage;
  const error = query.error ? t("userProfile.errors.loadFailed") : null;

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

          {hasMore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => void query.fetchNextPage()}
                disabled={loadingMore}
                className="inline-flex items-center justify-center rounded-md border border-border px-4 py-1.5 text-xs font-medium text-foreground hover:bg-surface-elevated disabled:opacity-50"
              >
                {loadingMore ? "..." : tFeed("actions.loadMore")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
