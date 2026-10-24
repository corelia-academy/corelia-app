// Result of studio_start_run when a run is resumed from a failed one (migration 20261021130000).

export interface StartResult {
  run_id: string;
  created: boolean;
  resume?: { from_run_id: string; steps: number; lessons_copied: number; drafts_copied: number; lessons_total: number };
  /** Why nothing was copied and the run started from the beginning. */
  resume_skipped?: "run_not_found" | "run_not_draft_failed" | "not_latest_run" | "nothing_done";
}

const SKIPPED: Record<NonNullable<StartResult["resume_skipped"]>, string> = {
  run_not_found: "không tìm thấy lượt chạy của khóa này",
  run_not_draft_failed: "lượt chạy đó không dừng ở trạng thái giữ nháp",
  not_latest_run: "đã có lượt chạy mới hơn",
  nothing_done: "lượt chạy đó chưa xong bước nào",
};

/** Event for the log of a newly created run; null when it was not asked to resume. */
export function resumeNote(result: StartResult, requestedFrom: string | null): string | null {
  if (result.resume) {
    const r = result.resume;
    // Without an accepted curriculum there are no lessons yet: everything from the curriculum on runs again.
    if (r.lessons_total === 0) return `Chạy tiếp từ lượt ${r.from_run_id}: chép ${r.steps} bước; các bước sau chạy lại.`;
    const redo = r.lessons_total - r.lessons_copied - r.drafts_copied;
    const kept = r.drafts_copied > 0 ? `, ${r.drafts_copied} bản nháp chờ review` : "";
    return `Chạy tiếp từ lượt ${r.from_run_id}: chép ${r.steps} bước, ${r.lessons_copied} lesson${kept}; tạo lại ${redo} lesson.`;
  }
  if (result.resume_skipped && requestedFrom) {
    return `Không chạy tiếp được từ lượt ${requestedFrom} (${SKIPPED[result.resume_skipped]}); chạy từ đầu.`;
  }
  return null;
}
