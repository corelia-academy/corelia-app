import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { Search, ShieldAlert } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

type SearchEntityType =
  | "project"
  | "contest"
  | "course"
  | "career_track"
  | "profile";

type SearchResultRow = {
  entity_type: SearchEntityType;
  entity_id: string;
  title: string;
  subtitle: string | null;
  href: string;
  rank: number;
};

function useQueryParam(name: string): string {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(name) ?? "";
  }, [location.search, name]);
}

export default function SearchPage() {
  const { t } = useTranslation("common");
  const q = useQueryParam("q").trim();
  const [items, setItems] = useState<SearchResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!q) {
        setItems([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcErr } = await supabase.rpc("search_public", {
          p_query: q,
          p_limit: 30,
          p_offset: 0,
        });
        if (rpcErr) throw new Error(rpcErr.message);
        if (cancelled) return;
        setItems((data ?? []) as SearchResultRow[]);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : t("search.errors.loadFailed"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [q, t]);

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="flex items-start gap-3">
        <Search className="mt-1 size-5 text-primary" aria-hidden />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
            {t("search.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {q
              ? t("search.queryLine", { query: q })
              : t("search.enterQueryHint")}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ShieldAlert
                className="size-6 text-muted-foreground"
                aria-hidden
              />
            </div>
            <div className="max-w-lg">
              <p className="text-sm font-medium text-foreground">{error}</p>
            </div>
          </div>
        ) : !q ? null : items.length === 0 ? (
          <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
            {t("search.empty")}
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <NavLink
                key={`${item.entity_type}:${item.entity_id}`}
                to={item.href}
                className="block rounded-md border border-border-subtle bg-card p-4 shadow-card transition hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {item.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border-subtle bg-background/60 px-2 py-0.5">
                      {t(`search.group.${item.entity_type}` as never, {
                        defaultValue: item.entity_type,
                      })}
                    </span>
                    {item.subtitle ? (
                      <span className="truncate">{item.subtitle}</span>
                    ) : null}
                  </div>
                </div>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

