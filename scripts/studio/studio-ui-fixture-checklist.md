# Studio UI fixture checklist

Fixture entries use generic titles and random UUIDs. The runner writes only to the schema-only PostgreSQL container `supabase_db_studio-manual-order-clone`; it refuses to seed when the clone is not at the expected migration baseline or when Studio rows already exist.

```powershell
node scripts/studio/run-studio-ui-fixture.mjs seed
node scripts/studio/run-studio-ui-fixture.mjs cleanup <fixture-key>
```

The seed output lists the fixture course/run IDs. To review a case, open that course in Studio while its read API is connected to this disposable clone. Do not use the current `127.0.0.1:55321` API target for fixture writes: the browser session there contains existing course/run data, and the available clone exposes PostgreSQL only, without a local Auth/PostgREST API.

## Fixture coverage

| Case | Fixture state | Expected display |
| --- | --- | --- |
| `source_started` | Running A1 job; prior attempt failed; current request submitted; five completed A1 duration samples across fixture jobs | Running research state, attempt 2, elapsed time and estimated remaining range based on five samples; source says started in this run |
| `source_reused` | Completed A1 job and `source: reused` event | “Dùng lại” source label, local-time completion/expiry, no A1 cost added to the run total |
| `source_attached` | Running A1 job and `source: attached_running` event with submitted request | Attached/running source wording and no false “reused” label |
| `source_kept` | Expired completed A1 job and `source: kept_previous` event | “Giữ nguyên” source wording and no false “reused” label |
| `source_no_event` | Older completed A1 job, with no source event | Legacy/unknown provenance wording; no false “reused” label |
| `resumed_lessons` | Prior failed run, current run with `source: resumed` events for A5/A6, one accepted lesson and zero review drafts | Relative event message includes lesson totals; timestamp is taken from payload and formatted by the browser |
| `review_checks` | 27 lessons, 62 events at `lessons`, 64 events at `lesson_review`; A4 legacy and completed; structure & journey checks with 6 groups each | H-1: Steps 6 and 7 show compact summary lines (27/27 xong, 3 sửa lại; 27/27 đạt: 0 lỗi blocking · 188/189 tiêu chí ok (162 có nguồn hoặc công cụ, 26 chỉ suy luận) · 1 chưa kiểm chứng · 3 vòng sửa) with collapsibles; H-2: Steps 8 and 9 display explicit passing reasons for all 6 rule groups and warning for restricted links |
| `paused_run` | Running run with `paused_at` and a pause progress event | “Đã tạm dừng” and “Tiếp tục”; underlying run remains `running` |
| `malformed_draft` | Corrupted generation output (quiz with null questions) | H-4: StepErrorBoundary catches render error in right panel, displays local retry button; app shell and other steps remain intact |
| `needs_fix_lesson` | 1 lesson with latest review verdict `needs_fix` and 1 blocking issue | V-01: Displays prominent un-collapsed warning line for failing lesson and blocking error; summary line does not claim all completed |

## Browser acceptance

| Check | State to open | Expected result | Result / evidence / checker |
| --- | --- | --- | --- |
| Research status icon | `source_started` | Magnifying glass spins beside “Đang nghiên cứu”; reduced-motion preference keeps it still | **BLOCKED** — fixture clone has no Auth/PostgREST API. Source uses `motion-safe:animate-spin`; no browser observation. Codex, source only. |
| Submission time and estimate | `source_started` | Local `hh:mm`, attempt 2, elapsed time and non-negative estimated range; estimate refreshes every 30 seconds | **BLOCKED** — browser not connected to fixture. Fixture provides failed attempt 1, submitted attempt 2 and five duration samples. Codex, fixture SQL/source only. |
| Retry timer | `source_started` | A retry displays the new attempt and starts elapsed-time estimate from its new `submitted_at` | **BLOCKED** — static fixture represents the second attempt; before/after retry was not observed in a browser. |
| Local time zone | `source_reused`, `source_kept`, `resumed_lessons` | Absolute timestamps use the browser’s local time; event messages contain relative time only | **BLOCKED** — no browser observation. Clone SQL test verifies UTC timestamps are in payload and not source-event messages; W-03/W-04h mutation checks pass. |
| Source labels | `source_started`, `source_reused`, `source_attached`, `source_kept`, `source_no_event` | Each case shows its recorded source; the no-event legacy case is never mislabeled “Dùng lại” | **BLOCKED** — source cases and no-event case seeded and removed on clone; browser API unavailable. |
| Run totals | Started and reused cases | A1 is counted only for a job started by the run; reuse shows “dùng lại, không tốn thêm” | **BLOCKED** — existing source/unit logic was not observed in a browser using fixture data. |
| Activity log | Source and review cases | Full localized agent names; no raw agent codes, model names, or UTC date embedded in the message | **BLOCKED** — no fixture browser. W-04h SQL and existing event/source code were inspected; browser text not observed. |
| A4/A6 evidence | `review_checks` | Both evidence groups render; `reasoning` says it is agent self-assessment; alpha and beta at the same attempt show their own code checks | **BLOCKED** — fixture rows satisfy the same-attempt pair; no browser observation. Mapper tests cover lesson/attempt scoping. |
| Legacy review event | `review_checks` | Old event without `checks` does not fabricate a reviewer checklist | **BLOCKED** — fixture includes a legacy A4 attempt and no-check event; no browser observation. |
| Deterministic code steps | `review_checks` | Steps 8 and 9 display explicit passing reasons for all 6 rule groups and warning for restricted links; legacy runs show note | **BLOCKED** — fixture includes 6-group payloads; unit tests pass for all 12 rule IDs. |
| Compact lesson log | `review_checks` | Steps 6 & 7 show compact single summary lines; full events collapsed under details | **BLOCKED** — 62 and 64 events seeded in fixture; unit tests cover progress summary. |
| Resumed step activity | `resumed_lessons` | Step 4 shows resumed summary line from generation completed_at without events; Steps 6 & 7 show original events | **BLOCKED** — fixture provides resumed generation without events; unit tests pass. |
| Error boundary isolation | `malformed_draft` | Right panel shows localized error banner with retry button; other steps and navigation remain functional | **BLOCKED** — fixture provides corrupted quiz generation; tested via React StepErrorBoundary. |
| Failing review warning | `needs_fix_lesson` | Step 7 displays un-collapsed warning line for failing lesson and does not claim full pass | **BLOCKED** — fixture provides needs_fix review event; unit tests cover failing lesson handling. |
| Pause control | `paused_run` | Pause state label and Continue button appear; primary “Đang tạo” still reflects the `running` status | **BLOCKED** — browser not connected to fixture. SQL test verifies pause retains `running`; source build passed. |
| Loading, disabled and error states | Running and paused cases | Control disables during request, shows loading, and renders a localized alert on API/network failure | **BLOCKED** — requires browser interaction and API response simulation against a disposable Auth/PostgREST stack. |
| Docs wording | Docs page | Explains pause takes effect from the next tick | **PASS — source/build**; browser rendering was not observed. |

Seed and cleanup verified on PostgreSQL clone container `supabase_db_studio-manual-order-clone` (Delta: +10 courses, +11 runs, +79 generations, +139 events; cleanup restores 0 rows across all 4 tables). Brief generation kind constraint fixed to `text`; `needs_fix_lesson` category verified as `outcome_mismatch` within the closed taxonomy.

No model call or tick is part of fixture seeding or this checklist. The current browser/API target was not mutated because it contains existing run data. All browser checklist items remain BLOCKED pending manual browser verification after pointing the Studio read API to the disposable fixture database.
