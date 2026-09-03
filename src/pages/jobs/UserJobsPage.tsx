import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkX, BriefcaseBusiness } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { JobCard } from "@/features/jobs/JobCard";
import { JobsNav } from "@/features/jobs/JobsNav";
import { jobKeys, userJobsQueryOptions } from "@/features/jobs/jobQueries";
import { setUserJobState } from "@/lib/jobs";
import { useAuth } from "@/stores/authStore";
import type { UserJobState } from "@/types/jobs";

export function UserJobsPage({ mode }: { mode: "saved" | "applied" }) {
  const { t } = useTranslation("jobs");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery(userJobsQueryOptions(user?.id, mode));
  const mutation = useMutation({
    mutationFn: ({ jobId, patch }: { jobId: string; patch: Partial<Pick<UserJobState, "saved" | "applied" | "hidden">> }) => setUserJobState(user!.id, jobId, patch),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: jobKeys.all }); },
    onError: () => toast.error(t("messages.updateFailed")),
  });
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><JobsNav /><header className="mt-6"><h1 className="text-2xl font-bold tracking-tight">{t(`user.${mode}.title`)}</h1><p className="mt-2 text-sm text-foreground-muted">{t(`user.${mode}.description`)}</p></header>{query.isPending ? <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-surface-raised" />)}</div> : query.data?.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{query.data.map(({ job, state }) => <JobCard key={job.id} job={job} state={state} busy={mutation.isPending && mutation.variables?.jobId === job.id} onToggleSaved={() => mutation.mutate({ jobId: job.id, patch: { saved: !state.saved } })} onToggleApplied={() => mutation.mutate({ jobId: job.id, patch: { applied: !state.applied } })} onHide={() => mutation.mutate({ jobId: job.id, patch: { hidden: true } })} />)}</div> : <div className="mt-6 rounded-xl border border-border-subtle bg-surface-base p-12 text-center">{mode === "saved" ? <BookmarkX className="mx-auto size-8 text-foreground-subtle" aria-hidden /> : <BriefcaseBusiness className="mx-auto size-8 text-foreground-subtle" aria-hidden />}<h2 className="mt-3 font-semibold">{t(`user.${mode}.empty`)}</h2></div>}</div>;
}

export function SavedJobsPage() { return <UserJobsPage mode="saved" />; }
export function AppliedJobsPage() { return <UserJobsPage mode="applied" />; }
