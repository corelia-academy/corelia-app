import { ARTIFACT_FIELDS, type PracticeConfig } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const fields = (value: unknown) => Array.isArray(value) && value.every(field =>
  typeof field === "string" && ARTIFACT_FIELDS.some(allowed => allowed === field));

/** Structural validation only: incomplete, well-formed drafts remain editable. */
export function isPracticeConfig(value: unknown): value is PracticeConfig {
  if (!record(value) || typeof value.mode !== "string" || !["instruction", "checklist", "submission", "guided_project"].includes(value.mode)) return false;
  if (value.revision !== undefined && (!Number.isSafeInteger(value.revision) || Number(value.revision) < 1)) return false;
  if (value.requires_review !== undefined && typeof value.requires_review !== "boolean") return false;
  for (const key of ["related_hackathon_id", "related_project_id", "related_project_template_id"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") return false;
  }
  if (value.submission_fields !== undefined && !fields(value.submission_fields)) return false;
  if (value.checklist_items !== undefined && (!Array.isArray(value.checklist_items) || !value.checklist_items.every(item =>
    record(item) && typeof item.id === "string" && typeof item.label === "string"))) return false;
  if (value.project_steps !== undefined && (!Array.isArray(value.project_steps) || !value.project_steps.every(step =>
    record(step) && typeof step.id === "string" && typeof step.title === "string" &&
    typeof step.order === "number" && Number.isFinite(step.order) &&
    typeof step.verification === "string" && ["self_check", "artifact_required"].includes(step.verification) &&
    (step.instructions_markdown === undefined || typeof step.instructions_markdown === "string") &&
    (step.artifact_fields === undefined || fields(step.artifact_fields))))) return false;
  return true;
}
