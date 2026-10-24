import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { QueryErrorState } from "@/components/QueryErrorState";
import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { JobCard } from "@/features/jobs/JobCard";
import { JobsNav } from "@/features/jobs/JobsNav";
import { jobKeys, userJobsQueryOptions } from "@/features/jobs/jobQueries";
import { setUserJobState } from "@/lib/jobs";
import { useAuth } from "@/stores/authStore";
import type { UserJobState } from "@/types/jobs";

export function UserJobsPage({ mode }: { mode: "saved" | "applied" | "hidden" }) {
  const { t } = useTranslation("jobs");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery(userJobsQueryOptions(user?.id, mode));
  const mutation = useMutation({
    mutationFn: ({ jobId, patch }: { jobId: string; patch: Partial<Pick<UserJobState, "saved" | "applied" | "hidden">> }) => setUserJobState(user!.id, jobId, patch),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
      if (variables.patch.hidden === false) toast.success(t("messages.unhidden"));
    },
    onError: () => toast.error(t("messages.updateFailed")),
  });
  return <div className="course-catalog-page container-app pb-8 pt-6 sm:py-8"><main className="course-catalog mx-auto w-full max-w-[1072px]"><JobsNav /><header className="mt-6"><h1 className="text-heading-large font-display text-foreground">{t(`user.${mode}.title`)}</h1><p className="mt-2 text-body-large text-catalog-subtitle">{t(`user.${mode}.description`)}</p></header>{query.isPending ? <div className="mobile-bleed-grid mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-surface-raised" />)}</div> : query.isError && !query.data ? <QueryErrorState className="mobile-bleed-surface mt-6" message={t("messages.loadFailed")} retrying={query.isFetching} onRetry={() => void query.refetch()} /> : query.data?.length ? <div className="mobile-bleed-grid mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{query.data.map(({ job, state }) => <JobCard key={job.id} job={job} state={state} busy={mutation.isPending && mutation.variables?.jobId === job.id} onToggleSaved={() => mutation.mutate({ jobId: job.id, patch: { saved: !state.saved } })} />)}</div> : <div className="mt-6 flex min-h-[31.25rem] items-center justify-center"><EmptyStateIllustration type="empty" size="medium" title={t(`user.${mode}.empty`)} /></div>}</main></div>;
}

export function SavedJobsPage() { return <UserJobsPage mode="saved" />; }
export function AppliedJobsPage() { return <UserJobsPage mode="applied" />; }
export function HiddenJobsPage() { return <UserJobsPage mode="hidden" />; }
