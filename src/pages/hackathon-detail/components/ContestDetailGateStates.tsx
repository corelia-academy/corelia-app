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
      <Card>
        <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
          <div className="rounded-full border border-border-subtle bg-muted/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {translate("detail.loading.eyebrow")}
          </div>
          <div className="mt-4 text-sm font-medium text-foreground">
            {translate("detail.loading.title")}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {translate("detail.loading.description")}
          </div>
          <div className="mt-4 grid w-full max-w-3xl gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border-subtle bg-background p-4 text-left">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="mt-3 h-4 w-3/4 rounded-full" />
              <Skeleton className="mt-2 h-4 w-2/3 rounded-full" />
            </div>
            <div className="rounded-md border border-border-subtle bg-background p-4 text-left">
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="mt-3 h-4 w-4/5 rounded-full" />
              <Skeleton className="mt-2 h-4 w-1/2 rounded-full" />
            </div>
            <div className="rounded-md border border-border-subtle bg-background p-4 text-left">
              <Skeleton className="h-3 w-28 rounded-full" />
              <Skeleton className="mt-3 h-4 w-2/3 rounded-full" />
              <Skeleton className="mt-2 h-4 w-3/5 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
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
          <div className="mt-2 max-w-xl text-sm text-muted-foreground">
            {translate("detail.errorState.description")}
          </div>
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground" />
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
            render={<NavLink to={`/hackathons/${contestId}/overview`} />}
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
