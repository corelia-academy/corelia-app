import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layouts/PagePrimitives";
import { getContest } from "@/lib/hackathons";
import type { Contest } from "@/types/hackathons";
import { useTranslation } from "react-i18next";

const PUBLIC_STATUSES: Contest["status"][] = ["published", "running", "ended"];

export default function ContestPublicLayout() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("contests");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await getContest(id);
        if (cancelled) return;
        if (!data || !PUBLIC_STATUSES.includes(data.status)) {
          setContest(null);
          setError(translate("detail.errors.notFound"));
          return;
        }
        setContest(data);
      } catch {
        if (!cancelled) setError(translate("detail.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, translate]);

  if (loading) {
    return (
      <PageContainer width="default">
        <div
          className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-16 text-center"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2
            className="size-8 animate-spin text-muted-foreground"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">
            {translate("detail.loading.title")}
          </p>
        </div>
      </PageContainer>
    );
  }

  if (error || !contest || !id) {
    return (
      <PageContainer width="default">
        <div
          className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-16 text-center"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm font-medium text-foreground">
            {error ?? translate("detail.errors.notFound")}
          </p>
          <Button
            render={<NavLink to="/hackathons" />}
            nativeButton={false}
            variant="outline"
            className="min-h-11"
          >
            {translate("detail.errorState.backToList")}
          </Button>
        </div>
      </PageContainer>
    );
  }

  return <Outlet context={{ contest, setContest }} />;
}
