import type { CourseLesson } from "@/types/courses";
export interface CourseInstructorRef { profile_id: string; role_label?: string; order: number }
export interface QuizConfig { passing_ratio: number; allow_retry: boolean }
export type ArtifactField = "github_url" | "deployment_url" | "contract_address" | "transaction_url" | "demo_url" | "notes";
export const ARTIFACT_FIELDS: ArtifactField[] = ["github_url", "deployment_url", "contract_address", "transaction_url", "demo_url", "notes"];
export interface GuidedProjectStep { id: string; title: string; instructions_markdown?: string; verification: "self_check" | "artifact_required"; artifact_fields?: ArtifactField[]; order: number }
export interface PracticeConfig {
  mode: "instruction" | "checklist" | "submission" | "guided_project";
  revision?: number;
  checklist_items?: Array<{ id: string; label: string }>;
  project_steps?: GuidedProjectStep[];
  submission_fields?: ArtifactField[];
  requires_review?: boolean;
  related_hackathon_id?: string;
  related_project_id?: string;
  related_project_template_id?: string;
}
export type NormalizedLesson = CourseLesson & { lesson_format: NonNullable<CourseLesson["lesson_format"]> };
export type LessonStatus = "loading" | "ready" | "checking" | "submitting" | "completed" | "failed" | "system_error" | "unavailable";
export interface LessonActionState { label: string; disabled?: boolean; pending?: boolean; run(): void | Promise<void> }
export interface LessonRendererProps {
  courseId: string;
  lesson: CourseLesson;
  completed: boolean;
  mode: "learner" | "preview";
  contentLocale?: string;
  onComplete(): Promise<void>;
  onAction(action: LessonActionState | null): void;
}
export interface PublishValidationIssue { panel?: "info" | "content" | "assignments"; fieldPath?: Array<string | number>; lessonId?: string; field: string; code: string; locale?: "vi" | "en" }
