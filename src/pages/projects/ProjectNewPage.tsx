import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, NavLink, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ProjectEditor, type ProjectEditorSave } from "@/features/projects/ProjectEditor";
import { getContestBySlug, getMyContestRegistration, getMyContestSubmission, upsertContestSubmission } from "@/lib/hackathons";
import { createProjectCollaborationInvite } from "@/lib/projectCollaboration";
import { saveProject } from "@/lib/projectSubmission";
import { useAuth } from "@/stores/authStore";

export default function ProjectNewPage() {
  const { t, i18n } = useTranslation("common");
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectId] = useState(() => crypto.randomUUID());
  const hackathonSlug = params.get("hackathon") ?? "";
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const contestQuery = useQuery({ queryKey: ["hackathons", "project-new", hackathonSlug, locale], queryFn: () => getContestBySlug(hackathonSlug, locale), enabled: Boolean(hackathonSlug) });
  const contest = contestQuery.data;
  const contextQuery = useQuery({
    queryKey: ["projects", "new-context", contest?.id, user?.id],
    queryFn: async () => {
      const [registration, submission] = await Promise.all([getMyContestRegistration(contest!.id, user), getMyContestSubmission(contest!.id, user)]);
      return { registration, submission };
    }, enabled: Boolean(contest && user), staleTime: 0,
  });
  if (hackathonSlug && (contestQuery.isPending || (contest && contextQuery.isPending))) return <div className="container-app py-16 text-body-medium font-body" role="status">{t("projects.loading")}</div>;
  if (contestQuery.isError || contextQuery.isError) return <div className="container-app py-16" role="alert"><p className="text-body-medium font-body">{t("projects.errorDescription")}</p><Button onClick={() => { void contestQuery.refetch(); void contextQuery.refetch(); }}>{t("projects.retry")}</Button></div>;
  if (contextQuery.data?.submission?.project_id) return <Navigate replace to={`/projects/${contextQuery.data.submission.project_id}/edit`} />;
  if (hackathonSlug && (!contest || !contextQuery.data?.registration || !["registered", "approved"].includes(contextQuery.data.registration.status))) return <div className="container-app py-16 text-center"><h1 className="text-heading-medium font-display">{t("projects.form.notEligible")}</h1><p className="mt-2 text-body-medium font-body">{t("projects.form.notEligibleDescription")}</p><Button className="mt-4" render={<NavLink to={contest ? `/hackathons/${contest.slug}` : "/hackathons"} />} nativeButton={false}>{t("projects.form.back")}</Button></div>;

  async function save({ draft, teamIds, removedPaths }: ProjectEditorSave) {
    const input = { project_id: projectId, title: draft.title, slug: draft.slug, summary: draft.summary, description: draft.description, progress: draft.progress, pitch_video_url: draft.pitchVideo, demo_url: draft.demo, repo_url: draft.repo, slide_url: draft.slide, video_url: draft.video, logo_path: draft.logo?.path ?? null, screenshot_paths: draft.screenshots.map(item => item.path), removed_media_paths: removedPaths, track_ids: draft.tracks, sector_ids: draft.sectors, tech_stack_ids: draft.tech };
    let savedId: string = projectId;
    let savedSlug = draft.slug;
    if (contest) {
      const submission = await upsertContestSubmission(contest.id, input);
      savedId = submission.project_id ?? projectId;
    } else {
      const result = await saveProject({ ...input, visibility: draft.visibility, source_type: "standalone" });
      savedId = result.project_id;
      savedSlug = result.project_slug;
    }
    const invites = await Promise.allSettled(teamIds.map(id => createProjectCollaborationInvite(savedId, id)));
    if (invites.some(item => item.status === "rejected")) toast.warning(t("projects.team.someInvitesFailed"));
    return savedSlug || savedId;
  }
  return <ProjectEditor key={contest?.id ?? "standalone"} projectId={projectId} userId={user!.id} contest={contest} onSave={save} onSaved={slug => {
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    void queryClient.invalidateQueries({ queryKey: ["hackathons"] });
    toast.success(t("projects.form.created")); navigate(`/projects/${slug}`);
  }} />;
}
