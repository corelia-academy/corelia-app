// Result of studio_start_run when a run is resumed from a failed one (migration 20261021130000).

export interface StartResult {
  run_id: string;
  created: boolean;
  resume?: { from_run_id: string; steps: number; lessons_copied: number; drafts_copied: number; lessons_total: number };
  /** Why nothing was copied and the run started from the beginning. */
  resume_skipped?: "run_not_found" | "run_not_draft_failed" | "not_latest_run" | "nothing_done";
}
