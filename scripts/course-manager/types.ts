export type CourseStepKind =
  | "brief"
  | "research"
  | "curriculum"
  | "curriculum-review"
  | "course-review";

export type ContextMode = "write" | "review" | "patch";

export interface AgentTarget {
  provider: string;
  model: string;
  effort?: string;
}

export interface FallbackTarget {
  enabled: boolean;
  provider: string;
  model: string;
  effort?: string;
  on_rate_limit: boolean;
}

export interface AgentProfile {
  coordinator: AgentTarget;
  default_child: AgentTarget;
  steps: Record<string, AgentTarget>;
  fallback?: FallbackTarget;
  litellm_url: string;
}

export interface LessonSummary {
  lesson_id: string;
  module_id: string;
  title: string;
  lesson_type: string;
  status: string;
  cycles: number;
  capped: boolean;
  blocking_issues: number;
  minor_issues: number;
  lint_problems: string[];
  review_problems: string[];
  next_step: string;
}

export interface GateSummary {
  has_handoff: boolean;
  has_metadata: boolean;
  has_brief: boolean;
  has_research: boolean;
  has_curriculum: boolean;
  has_frame: boolean;
  has_labels: boolean;
  has_final_assignment: boolean;
  curriculum_review: string;
  course_review: string;
}

export interface StatusCounts {
  total: number;
  chưa_viết: number;
  chờ_kiểm_chứng: number;
  chờ_review: number;
  cần_sửa: number;
  đạt: number;
  quá_trần: number;
}

export interface CostRow {
  step: string;
  normalized_role: string;
  raw_role: string;
  model: string;
  calls: number;
  measured_calls: number;
  tokens: number;
  tool_uses: number;
  duration_ms: number;
  retries: number;
}

export interface CostTotals {
  calls: number;
  measured_calls: number;
  tokens: number;
  tool_uses: number;
  duration_ms: number;
  retries: number;
}

export interface OpenCall {
  step: string;
  lesson_id: string | null;
  raw_role: string;
  normalized_role: string;
  model: string;
  started_at: string;
  elapsed_ms: number;
  likely_orphan: boolean;
}

export interface CourseStatusReport {
  slug: string;
  title: string | null;
  course_dir: string;
  overall_status: string;
  gates: GateSummary;
  summary: StatusCounts;
  lessons: LessonSummary[];
  cost_rows: CostRow[];
  cost_totals: CostTotals;
  open_calls: OpenCall[];
  lint_checked: boolean;
  lint_error: string | null;
}

export interface CliProviderStatus {
  id: string;
  display_name: string;
  installed: boolean;
  path: string | null;
  version: string | null;
  auth_status: string;
  logged_in: boolean | null;
  models: string[];
  note: string | null;
}

export interface LiteLlmStatus {
  binary_installed: boolean;
  binary_path: string | null;
  binary_version: string | null;
  server_url: string;
  server_reachable: boolean;
  models: string[];
  error: string | null;
}

export interface ApiKeyEnvStatus {
  env_var: string;
  provider_hint: string;
  is_set: boolean;
}

export interface ProvidersReport {
  cli_providers: CliProviderStatus[];
  litellm: LiteLlmStatus;
  api_key_envs: ApiKeyEnvStatus[];
}

export interface VerifyCheck {
  id: string;
  status: "pass" | "fail" | "skipped";
  detail: string;
}

export interface VerifyReport {
  slug: string;
  lesson_id: string;
  lesson_type: string;
  passed: boolean;
  checks: VerifyCheck[];
  lint_problems: string[];
  diagram_problems: string[];
  verification_markdown: string;
  written_path: string | null;
}

export interface PromptBundle {
  slug: string;
  lesson_id: string;
  lesson_type: string;
  mode: string;
  bundle_path: string;
  chars: number;
  prompt: string;
}

export interface RunOptions {
  dry_run: boolean;
  max_cycles: number;
  timeout_secs: number;
  force: boolean;
}

export interface StepTrace {
  phase: string;
  provider: string;
  model: string;
  result: string;
  detail: string;
}

export interface LessonRunOutcome {
  lesson_id: string;
  final_status: string;
  dry_run: boolean;
  cycles_used: number;
  needs_coordinator: boolean;
  coordinator_reason: string | null;
  traces: StepTrace[];
}

export interface CourseRunOutcome {
  slug: string;
  dry_run: boolean;
  processed: LessonRunOutcome[];
  halted_reason: string | null;
}

export interface CourseStepOutcome {
  slug: string;
  step: string;
  dry_run: boolean;
  provider: string;
  model: string;
  result: string;
  written_files: string[];
  lint_problems: string[];
}

export interface RankedProposal {
  rank: number;
  slug: string;
  title: string;
  map_slug: string;
  direction: string;
  level: string;
  status: string;
  layer_branch: string;
  modules: string[];
  promise: string;
  final_product: string;
  eligible: boolean;
  met_count: number;
  missing_tools: string[];
  warnings: string[];
  missing_evidence: string[];
  course_run_status: string | null;
}

export interface PlanReport {
  total: number;
  eligible_count: number;
  env_warnings: string[];
  rows: RankedProposal[];
  decision_file: string | null;
  decision_pick: string | null;
  decision_queue: string[];
}

export interface CourseQueueItem {
  slug: string;
  title: string;
  source: string;
  enabled: boolean;
}

export interface CourseQueueFile {
  items: CourseQueueItem[];
}

export interface QueueCourseResult {
  slug: string;
  outcome: string;
  detail: string;
}

export interface QueueRunSummary {
  results: QueueCourseResult[];
  halted_reason: string | null;
}
