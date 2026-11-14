import { useQuery } from "@tanstack/react-query";
import { blogCategoryLabel, type BlogCategory, type BlogLocale } from "@corelia/ui/blog";
import { ExternalLink, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { QueryErrorState } from "@/components/QueryErrorState";
import { ListRowsSkeleton } from "@/components/loading/RouteSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { blogPublicPath, groupBlogArticles } from "@/features/blog/blogPost";
import { adminBlogPostsQueryOptions } from "@/features/blog/blogQueries";
import { landingUrl } from "@/lib/appUrl";
import { useAuth } from "@/stores/authStore";
import type { BlogPostSummary, BlogStatus } from "@/types/blog";

const SELECT_CLASS = "h-9 rounded-md border border-border-subtle bg-surface-base px-3 text-sm outline-none focus:border-primary";

const LOCALES = ["vi", "en"] as const;

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
    return groupBlogArticles(query.data ?? [], labelLocale).filter((group) =>
      LOCALES.some((code) => {
        const post = group.versions[code];
        return post ? matches(post) : false;
      }),
    );
  }, [query.data, search, status, locale, labelLocale]);

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
        <>
          <p className="mt-6 text-xs text-foreground-muted" aria-live="polite">
            {t("blog.list.total", { total: groups.length })}
          </p>
          <ul className="mt-2 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-base">
            {groups.map((group) => {
              const { lead } = group;
              const live = lead.status === "published" ? lead : LOCALES.map((code) => group.versions[code]).find((post) => post?.status === "published");
              return (
                <li key={group.key} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                  <div className="min-w-0 flex-1 basis-64">
                    <NavLink to={`/admin/blog/${lead.id}/edit`} className="block truncate text-sm font-medium hover:text-primary">
                      {lead.title}
                    </NavLink>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
                      <span>{group.published ? dateFormat.format(new Date(lead.published_on)) : t("blog.list.notPublished")}</span>
                      <span>{t(`blog.contentTypes.${lead.content_type}`)}</span>
                      <span>{blogCategoryLabel(labelLocale, lead.category as BlogCategory)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {LOCALES.map((code) => {
                      const post = group.versions[code];
                      const language = t(`blog.locales.${code}`);
                      if (!post) {
                        const label = t("blog.actions.addTranslation", { language });
                        return (
                          <NavLink
                            key={code}
                            to={`/admin/blog/new?from=${lead.id}`}
                            title={label}
                            aria-label={label}
                            className="inline-flex h-8 w-32 items-center justify-center gap-1 rounded-md border border-dashed border-border-subtle text-xs text-primary hover:border-primary"
                          >
                            <Plus className="size-3" aria-hidden />
                            <span className="font-medium uppercase">{code}</span>
                          </NavLink>
                        );
                      }
                      const label = t("blog.actions.editVersion", { language, status: t(`blog.status.${post.status}`) });
                      return (
                        <NavLink
                          key={code}
                          to={`/admin/blog/${post.id}/edit`}
                          title={label}
                          aria-label={label}
                          className="inline-flex h-8 w-32 items-center gap-2 rounded-md border border-border-subtle px-2 text-xs hover:border-primary"
                        >
                          <span className="font-medium uppercase">{code}</span>
                          <span
                            aria-hidden
                            className={post.status === "published" ? "size-1.5 shrink-0 rounded-full bg-emerald-500" : "size-1.5 shrink-0 rounded-full bg-foreground-muted/50"}
                          />
                          <span className={post.status === "published" ? "truncate" : "truncate text-foreground-muted"}>{t(`blog.status.${post.status}`)}</span>
                        </NavLink>
                      );
                    })}
                    {live ? (
                      <Button
                        size="small"
                        variant="cta"
                        hierarchy="tertiary"
                        iconOnly
                        aria-label={t("blog.actions.view")}
                        title={t("blog.actions.view")}
                        render={<a href={landingUrl(blogPublicPath(live))} target="_blank" rel="noreferrer" />}
                        nativeButton={false}
                      >
                        <ExternalLink className="size-4" aria-hidden />
                      </Button>
                    ) : (
                      <span className="size-8" aria-hidden />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
