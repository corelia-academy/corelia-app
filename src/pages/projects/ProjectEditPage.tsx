import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ProjectManagementControls } from "@/components/projects/ProjectManagementControls";
import { Button } from "@/components/ui/button";
import { ProjectEditor } from "@/features/projects/ProjectEditor";
import { projectEditorQueryOptions } from "@/features/projects/projectQueries";
import { getContest } from "@/lib/hackathons";
import { updateMyProject } from "@/lib/projects";
import { isHackathonProjectSource } from "@/lib/projectSource";
import { useAuth } from "@/stores/authStore";

export default function ProjectEditPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation("common");
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const projectQuery = useQuery(projectEditorQueryOptions(slug, user?.id));
  const project = projectQuery.data?.project;
  const hackathon = Boolean(project && isHackathonProjectSource(project.source_type));
  const contestQuery = useQuery({ queryKey: ["hackathons", project?.source_id, "project-edit", locale], queryFn: () => getContest(project!.source_id!, locale), enabled: Boolean(project?.source_id && hackathon) });
  if (projectQuery.isPending || (hackathon && contestQuery.isPending)) return <div className="container-app py-16" role="status">{t("projects.loading")}</div>;
  if (projectQuery.isError || contestQuery.isError || (hackathon && !contestQuery.data)) return <div className="container-app py-16" role="alert"><p>{t("projects.errorDescription")}</p><Button onClick={() => { void projectQuery.refetch(); if (hackathon) void contestQuery.refetch(); }}>{t("projects.retry")}</Button></div>;
  if (!project || !(project.owner_id === user?.id || profile?.role === "admin" || profile?.role === "support_staff")) return <div className="container-app py-16"><h1>{t("projects.form.cannotEdit")}</h1><Button className="mt-4" render={<NavLink to="/projects" />} nativeButton={false}>{t("projects.detail.goBack")}</Button></div>;
  if (project.blocked) return <div className="container-app space-y-4 py-8"><p role="status">{t("projects.management.blockedError")}</p><ProjectManagementControls project={project} onDeleted={() => navigate("/projects", { replace: true })} /></div>;
  return <ProjectEditor key={project.id} projectId={project.id} userId={user!.id} project={project} contest={contestQuery.data} onSave={async ({ draft, removedPaths }) => {
    await updateMyProject(project.id, { slug: draft.slug, title: draft.title, summary: draft.summary, description: draft.description, progress: draft.progress, pitch_video_url: draft.pitchVideo, demo_url: draft.demo, repo_url: draft.repo, slide_url: draft.slide, video_url: draft.video, logo_path: draft.logo?.path ?? null, screenshot_paths: draft.screenshots.map(item => item.path), visibility: draft.visibility, hackathon_track_ids: draft.tracks, hackathon_sector_ids: draft.sectors, hackathon_tech_stack_ids: draft.tech, removed_media_paths: removedPaths });
    return draft.slug;
  }} onSaved={savedSlug => {
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    void queryClient.invalidateQueries({ queryKey: ["hackathons"] });
    toast.success(t("projects.form.saved")); navigate(`/projects/${savedSlug}`);
  }} />;
}
