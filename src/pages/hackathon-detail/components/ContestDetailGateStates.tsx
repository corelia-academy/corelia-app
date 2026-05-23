import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layouts/PagePrimitives";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";

export function ContestDetailLoadingCard({
  translate,
}: {
  translate: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <PageContainer width="default">
      <div
        className="space-y-4 sm:space-y-5"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={translate("detail.loading.title")}
      >
        <Skeleton className="h-4 w-48" />
        <Card className="overflow-hidden">
          <Skeleton className="aspect-[21/9] w-full rounded-none" />
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
                <Skeleton className="h-8 w-full max-w-xl" />
                <Skeleton className="h-4 w-full max-w-2xl" />
                <Skeleton className="h-4 w-3/4 max-w-xl" />
              </div>
              <div className="flex shrink-0 gap-2">
                <Skeleton className="h-11 w-36" />
                <Skeleton className="h-11 w-24" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-border-subtle bg-surface-base p-3"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-4 w-28" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] xl:items-start xl:gap-8">
          <div className="order-2 space-y-6 xl:order-1">
            <Skeleton className="h-11 w-full" />
            {Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx}>
                <CardContent className="space-y-3 p-4 sm:p-6">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="order-1 xl:order-2">
            <CardContent className="space-y-4 p-4 sm:p-6">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

export function ContestDetailErrorCard({
  translate,
  error,
}: {
  translate: (key: string, options?: Record<string, unknown>) => string;
  error: string | null;
}) {
  return (
    <PageContainer width="default">
      <Card>
        <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <div className="rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-destructive">
            {translate("detail.errors.deleteAccessDeniedTitle")}
          </div>
          <div className="text-base font-medium text-foreground">
            {error || translate("detail.errors.deleteAccessDeniedFallback")}
          </div>
          <div className="mt-2 max-w-xl text-sm text-foreground-muted">
            {translate("detail.errorState.description")}
          </div>
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-foreground-muted hover:text-foreground" />
          <Button
            render={<NavLink to="/hackathons" />}
            nativeButton={false}
            variant="ghost"
            className="mt-4"
          >
            {translate("detail.errorState.backToList")}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export function ContestDetailWorkspaceAccessDenied({
  translate,
  contestId,
}: {
  translate: (key: string, options?: Record<string, unknown>) => string;
  contestId: string;
}) {
  return (
    <PageContainer width="default">
      <Card>
        <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <div className="text-base font-medium text-foreground">
            {translate("detail.errors.workspaceAccessDenied")}
          </div>
          <Button
            render={<NavLink to={`/hackathons/${contestId}`} />}
            nativeButton={false}
            variant="ghost"
            className="mt-4"
          >
            {translate("workspace.manage.backToContestPage")}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
