import { useQuery } from "@tanstack/react-query";
import { blogCategoryLabel, type BlogCategory, type BlogLocale } from "@corelia/ui/blog";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { QueryErrorState } from "@/components/QueryErrorState";
import { ListRowsSkeleton } from "@/components/loading/RouteSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { blogPublicPath } from "@/features/blog/blogPost";
import { adminBlogPostsQueryOptions } from "@/features/blog/blogQueries";
import { landingUrl } from "@/lib/appUrl";
import { useAuth } from "@/stores/authStore";
import type { BlogPostSummary, BlogStatus } from "@/types/blog";

const SELECT_CLASS = "h-9 rounded-md border border-border-subtle bg-surface-base px-3 text-sm outline-none focus:border-primary";

type TranslationGroup = { key: string; posts: BlogPostSummary[] };

/** Translations of one article side by side, in the order of the newest version. */
function groupByTranslation(posts: BlogPostSummary[]): TranslationGroup[] {
  const groups = new Map<string, TranslationGroup>();
  for (const post of posts) {
    const key = `${post.content_type}:${post.translation_key}`;
    const group = groups.get(key) ?? { key, posts: [] };
    group.posts.push(post);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export default function AdminBlogPage() {
  const { t, i18n } = useTranslation("admin");
  const { user } = useAuth();
  const query = useQuery(adminBlogPostsQueryOptions(user?.id));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BlogStatus | "">("");
  const [locale, setLocale] = useState<BlogLocale | "">("");
  const labelLocale: BlogLocale = (i18n.resolvedLanguage ?? i18n.language).startsWith("vi") ? "vi" : "en";
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, { dateStyle: "medium", timeZone: "UTC" }),
    [i18n.language, i18n.resolvedLanguage],
  );

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matches = (post: BlogPostSummary) =>
      (!status || post.status === status) &&
      (!locale || post.locale === locale) &&
      (!needle || post.title.toLowerCase().includes(needle) || post.slug.includes(needle));
    return groupByTranslation(query.data ?? []).filter((group) => group.posts.some(matches));
  }, [query.data, search, status, locale]);

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-heading-medium font-display">{t("blog.title")}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{t("blog.description")}</p>
        </div>
        <Button render={<NavLink to="/admin/blog/new" />} nativeButton={false}>
          <Plus className="size-4" aria-hidden />
          {t("blog.new")}
        </Button>
      </header>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="min-w-56 flex-1">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("blog.list.search")}
            aria-label={t("blog.list.search")}
          />
        </div>
        <select className={SELECT_CLASS} value={status} onChange={(event) => setStatus(event.target.value as BlogStatus | "")} aria-label={t("blog.fields.status")}>
          <option value="">{t("blog.list.allStatuses")}</option>
          <option value="published">{t("blog.status.published")}</option>
          <option value="draft">{t("blog.status.draft")}</option>
        </select>
        <select className={SELECT_CLASS} value={locale} onChange={(event) => setLocale(event.target.value as BlogLocale | "")} aria-label={t("blog.fields.locale")}>
          <option value="">{t("blog.list.allLocales")}</option>
          <option value="vi">{t("blog.locales.vi")}</option>
          <option value="en">{t("blog.locales.en")}</option>
        </select>
      </div>

      {query.isPending ? (
        <ListRowsSkeleton rows={8} className="mt-6" />
      ) : query.isError && !query.data ? (
        <QueryErrorState className="mt-6" message={t("blog.loadFailed")} retrying={query.isFetching} onRetry={() => void query.refetch()} />
      ) : groups.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-foreground-muted">
            {query.data?.length ? t("blog.list.noMatches") : t("blog.list.empty")}
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-base">
          {groups.map((group) => {
            const first = group.posts[0];
            const missing = (["vi", "en"] as const).find((code) => !group.posts.some((post) => post.locale === code));
            return (
              <li key={group.key} className="p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
                  <span>{dateFormat.format(new Date(first.published_on))}</span>
                  <span>{t(`blog.contentTypes.${first.content_type}`)}</span>
                  <span>{blogCategoryLabel(labelLocale, first.category as BlogCategory)}</span>
                </div>
                <ul className="mt-2 space-y-2">
                  {group.posts.map((post) => (
                    <li key={post.id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="w-8 shrink-0 rounded bg-surface-raised px-1.5 py-0.5 text-center text-xs font-medium uppercase">{post.locale}</span>
                      <NavLink to={`/admin/blog/${post.id}/edit`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">
                        {post.title}
                      </NavLink>
                      <span
                        className={
                          post.status === "published"
                            ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300"
                            : "rounded-full bg-surface-raised px-2 py-0.5 text-xs text-foreground-muted"
                        }
                      >
                        {t(`blog.status.${post.status}`)}
                      </span>
                      <div className="flex gap-2">
                        <Button size="small" variant="cta" hierarchy="secondary" render={<NavLink to={`/admin/blog/${post.id}/edit`} />} nativeButton={false}>
                          <Pencil className="size-4" aria-hidden />
                          {t("blog.actions.edit")}
                        </Button>
                        {post.status === "published" ? (
                          <Button
                            size="small"
                            variant="cta"
                            hierarchy="tertiary"
                            render={<a href={landingUrl(blogPublicPath(post))} target="_blank" rel="noreferrer" />}
                            nativeButton={false}
                          >
                            <ExternalLink className="size-4" aria-hidden />
                            {t("blog.actions.view")}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                {missing ? (
                  <NavLink to={`/admin/blog/new?from=${first.id}`} className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="size-3" aria-hidden />
                    {t("blog.actions.addTranslation", { language: t(`blog.locales.${missing}`) })}
                  </NavLink>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
