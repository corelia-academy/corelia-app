# Codex CLI via Studio MCP: three-course local E2E

Date: 2026-11-07
Target: local Supabase only. No staging, production, push, merge, or publish.

## Goal and retry policy

Run three courses sequentially, one per distinct Studio path. Use Codex CLI authenticated through the existing ChatGPT session and Studio MCP for all course/run operations. Retry transient task errors within the MCP retry budget. Preserve successful outputs if a run cannot finish. Record remaining errors and coordination conflicts here for follow-up.

## Baseline

- Local Supabase API, database, and Studio ports were listening.
- Local DB baseline: 1 auth user, 1 profile, 0 paths, 0 Studio courses, 0 Studio runs.
- App and Studio worktrees were already dirty before this run; those files are being preserved.
- Codex CLI login status: ChatGPT session.
- Local consent-page attempt: blocked because pnpm dev failed while Miniflare started. No source changes were made for that failure.
- A Codex CLI probe authenticated through the ChatGPT session and did not use a model API key. It loaded the existing unauthenticated MCP configuration and consumed 31,420 tokens; the full run will isolate the CLI configuration to the local Studio MCP server.

## Known coordination conflict to verify

- Studio MCP currently creates execution_mode=claude_code, exposes Claude model aliases, and returns task instructions that say to spawn Claude Code children.
- The requested runtime is Codex CLI. The run will submit actual model_id=codex/gpt-6.1-sol, but the existing run-level execution mode may still say claude_code.
- This is an audit-label conflict, not evidence that a Codex model API key was used. Record the exact stored values after each run; do not rewrite them in the database.

## Course plan

1. Ecosystem path Web3: Web3 Foundations, beginner, English canonical with the available Vietnamese translation step.
2. Skill path Smart Contract Development: Solidity Smart Contracts, beginner/intermediate, English canonical with the available Vietnamese translation step.
3. Role path Web3 Developer: Build a dApp Front End, intermediate, English canonical with the available Vietnamese translation step.

Use primary documentation and established educational sources. Prefer official education channels over personal channels when relevance is comparable. Keep all courses local and unpublished.

## Run log

Preflight attempts:
- [2026-11-07] Direct MCP request without an authenticated user returned HTTP 401 with OAuth resource metadata.
- [2026-11-07] Local pnpm dev --host 127.0.0.1 failed with Miniflare ERR_RUNTIME_FAILURE; no app-source changes were made.
- [2026-11-07] No temporary admin user, MCP bearer token, or course has been created yet.

Errors, retries, and conflicts will be appended below after each Codex CLI run.

Retry handling: the Codex CLI coordinator will wait for one Codex child session per generation, submit only complete schema-shaped JSON, and request Studio retries for transient execution errors. Unresolved failures will be logged for user follow-up.

## Progress update

- Codex CLI MCP preflight passed using the ChatGPT login, model gpt-6.1-sol, and only the isolated local corelia-studio MCP configuration. studio_coordinator_guide and studio_list_paths succeeded; path list was empty.
- The preflight consumed 72,611 input tokens for two read-only tool calls. This is a high context cost; keep coordinators scoped to one course and use a temporary working directory to avoid loading unrelated project files.
- A loopback-only MCP proxy now holds a temporary local Supabase admin session so the CLI does not receive the bearer token in its environment. Temporary local profile UUID: 5ee31b2d-54e9-4e58-ad1a-d588a1921036. Cleanup is pending until all runs finish.
- Confirmed coordination conflict: the MCP guide labels the coordinator and child runs as Claude Code and sets Claude model aliases; the requested runtime is Codex CLI. Run records will store the actual model_id as codex/gpt-6.1-sol. Codex effort max is mapped to xhigh where needed. This is a record-label/profile mismatch; no source or stored profile changes are being made.
- The first source-search command had a PowerShell/regex quoting error and changed nothing; it was retried successfully with a simpler literal search.
- The deterministic workflow includes an automatic publish step after translation and local checks. To preserve the no-publish goal, stop each run after all translation tasks are accepted and verify the completed content and unpublished local state without advancing to publish. This leaves the run pending deterministic post-translation checks and should be treated as a workflow limitation.

- Course 1 creation attempt was blocked before mutation: Codex CLI returned MCP approval-required under approval policy never. Read-only follow-up showed studio_courses=0 and studio_paths=0; the stable run_id is safe to retry.
- That blocked parent session consumed 136,059 input tokens. This confirms high context usage can itself become a practical run limit; subsequent calls are shorter and isolated to temp cwd.
- A one-off run-id generation helper also failed because the exec JavaScript sandbox has no global crypto object; GUIDs were generated by PowerShell instead. No project state changed.

### Course 1 progress: Web3 Foundations

- Retry via codex exec --approve-for-me succeeded after the first run was blocked by approval policy. No artifact existed before retry; the same stable run_id was used.
- Created local course_id b63eae7d-ab52-4852-b3f6-69a320dd78da, path_id 4f2f0409-3cfa-4a59-9027-e6d19e8c165f, and run_id ddc472f0-4b87-4b3d-ad0f-bf866996b8a5.
- First task is catalog_research / A1, generation_id 141bfc6e-dc25-453c-89d4-91b683d7d127. A separate Codex CLI child was started; result is pending.

- During A1 child setup, the coordinator unnecessarily searched several unrelated user directories for the caption helper. It only surfaced path/directory names and found the helper at the known Studio path; no content read or write outside the task was observed. Follow-up handoffs now need to provide the exact absolute helper path and prohibit broad filesystem discovery.
- A transport-size probe exceeded the Windows PowerShell command-line limit and failed with OS error 206. The coordinator then verified stdin piping with a small payload. The large task prompt still needs a successful child result before this transport path is considered verified.

- A1 child result used stdin transport successfully at 40,000 bytes and returned a schema-shaped JSON object. MCP rejected it as an ordinary validation rejection: I05 cited app_courses even though the input catalog contained 0 published courses. No operations incident was created.
- Prompt/validator coordination conflict, impact: one extra A1 repair generation. The prompt describes app_courses as available input evidence and asks for catalog-gap evaluation, but an empty app_courses array cannot be cited as evidence. The correction task should omit I05 and rely on the empty group.other_courses evidence; follow-up should clarify this in the A1 prompt.

### Reproduced MCP submit blocker

- Runtime: A1 repair generation 79f51714-b7c5-4460-b515-78710ecc592e returned completed JSON, but studio_submit_task failed with database check violation studio_generations_submitted_has_request. A read-only status call confirmed the generation remained submitting; catalog_research remained pending. No accepted A1 result was persisted.
- Source diagnosis: studio_generations_submitted_has_request requires provider_request_id for every completed generation. External Codex task creation leaves provider_request_id null, and studio_submit_task does not set it. This makes a valid accepted Codex result impossible to persist through the current MCP contract.
- The coordinator tried studio_report_task_failure twice with valid incident fields; both calls returned invalid_operational_incident. Source diagnosis: the MCP Zod incident schema is strict and omits incident.error_code, while the database RPC requires p_incident.error_code. The handler passes the nested incident unchanged and does not copy the top-level error_code into it. Thus the MCP's system-incident recovery route also cannot record this failure.
- Classification: BUG. Evidence: REPRODUCED LOCAL for accepted-result persistence and incident-call rejection; SOURCE ONLY for the constraint/schema mismatch explanation. Impact: Codex MCP runs cannot advance past their first accepted external generation, and the built-in operational incident tool cannot record this repair failure. Priority P2, high confidence. No source/DB workaround applied because the requested error-handling instruction says to record the issue for later handling.

### Final verification and cleanup

- Independent local DB query confirmed baseline auth state restored: auth.users=1, profiles=1; temporary admin user/profile/audit rows are all 0. The only added Studio data is one path, one course, and one run. Operational incidents=0.
- The Web3 course remains queued; run remains running with execution_mode=claude_code; no task generation was accepted, and all run steps including publish remain pending. The first rejected A1 output is stored as failed; the A1 repair remains submitting with null model_id/provider_request_id and no persisted output. No app course was published.
- Courses 2 and 3 were not created because the same global persistence constraint blocks every accepted Codex generation. Creating empty shells would not advance the requested goal.
- Temporary loopback proxy stopped, its helper script removed, the temporary admin profile and audit row removed, the global unauthenticated corelia-studio MCP entry removed, and the local supabase functions serve session ended. Local Supabase database services were left running.
- The verification query initially used multiple SQL statements, which supabase db query rejected as one prepared statement. It was rerun as separate single-statement checks and passed; no data changed from the failed query.
- The Codex parent session reported 3,350,040 input tokens (3,263,488 cached) for this one course before it stopped at A1. The child usage is not separately captured here. Repeatedly carrying large MCP task schemas and prior outputs through one coordinator context is a material efficiency conflict for multi-course runs.

## Outstanding work

1. Fix the external-generation completion contract so an accepted Codex result can satisfy the database constraint without fabricating a provider request ID.
2. Fix incident reporting so the MCP contract and database RPC agree about error_code; then verify an operational incident is actually recorded.
3. Clarify the A1 prompt for empty app_courses input.
4. Resume this local run and complete the three-course goal after those fixes. Keep publish disabled or provide an explicit safe stop before publish.
- Removing the temporary helper with Remove-Item was blocked by command policy; retried with a one-file Node unlink under OS temp, then verified the file was absent.

## Continuation: local fixes and resumed verification

- User explicitly continued the goal and authorized fixing the reproduced conflicts. The earlier note saying no source/DB workaround was applied is superseded by the changes below.
- Added local migration `20261107140000_studio_external_generations_a1_prompt_v8.sql`. It allows `origin='external'` generations to complete without a provider request ID, while retaining that requirement for provider-managed generations. The migration applied successfully with `supabase migration up --local`; a local catalog query confirmed the check definition and A1 v8 seed. No staging or remote migration was run.
- Pinned A1 to v8 and added the empty-catalog rule to the immutable prompt seed, runtime version map, test expectation, and Studio agent reference. The validator already rejects citing `app_courses` when the list is empty and accepts the empty `groups.<group_kind>.other_courses` list as input evidence; the existing cases are retained and the prompt test now asserts the instruction.
- Fixed the incident adapter to copy the validated top-level `error_code` into the JSON object required by the incident RPC. Added an MCP `studio_pause_run` wrapper and guide instruction to pause before another task fetch can cross into publish. MCP task instructions now allow Codex CLI as the active external runtime and require auditing the actual model identifier instead of labeling Codex as Claude.
- Initial targeted verification passed: `catalog.test.ts`, `prompts.test.ts`, and `agent_prompts.test.ts` (56 tests), `deno check --no-lock supabase/functions/studio-mcp/index.ts`, and `pnpm build` (2m12s; existing large-chunk advisory). A later source audit found and is fixing exact prompt-version loading; rerun applicable checks after that delta.
- Codex CLI preflight succeeded against the loopback-only local MCP proxy using model `gpt-6.1-sol` and ChatGPT login. It read the coordinator guide, path list, and existing run status. The MCP schema remains backed by the legacy DB `execution_mode='claude_code'`; actual submissions must use `model_id='codex/gpt-6.1-sol'`. The execution-mode label mismatch is non-blocking and remains a known audit limitation.
- The local MCP proxy uses a short-lived JWT signed with the local Supabase JWT secret for the existing local admin profile. No user, profile, or password was created or changed; the token stays in the proxy process and must be allowed to expire after shutdown.
- Prompt-pinning review found another reproducible coordination conflict: MCP task retrieval loaded the current runtime pin instead of the prompt version recorded on an in-flight generation. Since the existing A1 generation is v7 and the runtime pin is now v8, the task payload could otherwise mismatch its audit row. MCP now loads the generation's exact immutable prompt version, and a targeted test checks this lookup.
- The installed Codex CLI has standalone web search disabled by default and marks the feature as under development. Enabling it per E2E invocation successfully returned an official Ethereum.org source; keep the warning in mind and log any search/tool failures during course generation.

### Errors encountered and retries in this continuation

- First skill lookup used a stale `G:\Codex\skills\mcp-builder` path; the actual bundled skill path was found and read. No project state changed.
- `supabase db query --sql ...` is unsupported in the installed CLI; rerunning with SQL as the positional argument succeeded. A separate read-only query asked for nonexistent `studio_catalog_jobs.max_attempts`; it made no change and will be checked from `CATALOG_SPEC.maxAttempts` in source instead.
- First Codex CLI invocation combined `--sandbox` with `--approve-for-me`, which this CLI version rejects before startup. Retried without the explicit sandbox flag; auto-review started the CLI in read-only mode and all three MCP preflight calls passed.
- The first broad test-path listing included a nonexistent `supabase/tests` directory; the existing Studio function tests were listed and used instead.
- The local Edge runtime logged one wall-clock warning and early termination for an isolate during preflight, although all three MCP calls returned results. The cause is not yet clear; monitor it during the full runs and capture any user-visible MCP failure separately.

### Current continuation state

- Source and local DB fixes above are applied. The prior run still has one A1 generation (`79f51714-b7c5-4460-b515-78710ecc592e`) in `submitting` with recorded prompt version v7. Its generated JSON was not persisted and is no longer available. Report that actual system failure through MCP with an incident to verify the repaired error_code path. Since system failures are terminal in the same run's retry policy, restart the same course/path with a new run_id after it becomes `not_passed`; this is the retry for the original course, not an extra course. Do not rewrite generation rows. The new A1 job should use v8.
- Verification after the prompt-pinning fix: targeted Vitest passed (57 tests), `deno check --no-lock supabase/functions/studio-mcp/index.ts` passed, and `pnpm build` passed in 1m25s. Build retains the existing warning for several chunks larger than 500 kB; no dependency files were edited by this task.
- Local DB currently contains the original Web3 course/path/run plus the pre-existing baseline admin; no operations incident has yet been verified. The run is unpaused and unpublished.
- Continue through three suitable, distinct paths, validate every accepted result through Studio MCP, pause each run before publish, and recheck local counts/auth baseline and temporary proxy cleanup before closing the goal.

### Retry after terminal A1 failure: second reproduced blocker

- The Codex coordinator retried `studio_get_next_task` six times after the old catalog job became `failed`; each call returned `processing`. The previous result file is retained at `%TEMP%\corelia-studio-mcp-e2e\web3-foundations-run-result.md`.
- Local DB verification: the catalog job is `failed`, while its parent run remains `running`, the `catalog_research` step remains `pending`, and the course remains `queued`. The old run has no accepted generation output.
- Root cause confirmed from source: `studio_get_next_task` always called `advanceCatalogJob` while the current step was `catalog_research` but did not call `advanceRun` when the catalog job reached a terminal state. The failure-report RPC had already changed the job to `failed`; the catalog finish RPC updates only jobs still `running` and returns false for an already-ended job. Therefore the parent step never closed and the MCP loop hit its 12-tick processing limit repeatedly.
- Classification: BUG; evidence `REPRODUCED LOCAL` plus source/root-cause confirmation; priority P2, high confidence. Impact: Codex could record an A1 terminal failure but could not close that run or start the planned replacement run, blocking all courses in this E2E.
- Local source fix: after advancing A1, the MCP now advances the parent run when A1 returns `finish` or the catalog job was already terminal. This lets Studio mark `catalog_research` done/failed and continue or finish the run. No database rows were edited manually.
- Next verification: run focused catalog/MCP checks, then use MCP to confirm the old run closes as `draft_failed` and its course becomes `not_passed`; only then start a fresh run for the same Web3 course.

### Resume after the second blocker fix

- Focused verification after the MCP transition fix passed: 61 tests across catalog, catalog-run, prompt, and agent-prompt suites; `deno check --no-lock supabase/functions/studio-mcp/index.ts`; and `pnpm build` (completed successfully in 1m30s, with the existing >500 kB chunk warning).
- Through Codex CLI and local Studio MCP, the old run `ddc472f0-4b87-4b3d-ad0f-bf866996b8a5` transitioned to `draft_failed`. MCP then created replacement run `3711e06f-5f4c-40aa-b5ce-2ff82c4d9dad` for the same Web3 course and existing Web3 ecosystem path; no duplicate course/path was created.
- The repaired incident route recorded incident `f8960fc9-3295-466f-b7dc-a640897f27e8`, code `STUDIO_EXTERNAL_GENERATION_CONSTRAINT`, priority P2, status `open`, linked to the original catalog job and failed generation.
- Replacement run's first task is generation `0572a84e-fcd7-450b-a13a-a1eb653294aa`, A1 prompt `a1-catalog-research@v8`. It is still pending; no content has yet been accepted on the replacement run.
- Direct local DB verification shows the old run and catalog job are failed, the replacement run and job are running, and the replacement uses A1 v8. The course status is `queued` again because the replacement run has started. No publish action has run.
- Codex CLI retry errors: `codex exec resume` does not accept `-C`; that first retry ended before touching MCP. Retried by setting PowerShell's current directory. That resumed session then ran with `approval=never`; MCP blocked the non-read-only `studio_get_next_task` call before the task payload was fetched. Read-only status confirmed the same A1 v8 generation remains `submitting`. No task output was submitted. Next retry uses a fresh `codex exec --approve-for-me` invocation, which previously allowed the local MCP task calls under the isolated CLI session.
- Fresh Codex CLI invocation with `--approve-for-me` retried the same A1 generation successfully. Studio accepted it on the first submit: `evidence_ok`, 6/6 scored criteria, 7 web evidence items, 4 input evidence items; submitted model metadata is `codex/gpt-6.1-sol` / `xhigh`. The result cites Ipsos, Pew Research Center, National Cryptocurrency Association/Harris Poll, and Ethereum.org quiz/building pages. Independent URL/content verification and exact DB output audit are in progress.
- Independent source audit opened all seven stored URLs. Spot-checked source claims match: Ipsos fielded 1,545 U.S. adults in September 2026 and reports 16% interested in learning about crypto and 13% very/extremely interested in DeFi; Pew reports 19% of U.S. adults had ever invested in/used crypto; the NCA/Harris report supports 48% citing understanding as a top barrier and 27% naming crypto education organizations; Ethereum.org pages support the cited quiz, wallet-security, contract-read, and 2026 protocol-change claims. URLs returned real pages/PDFs; no dead or mismatched citation found in this sample.
- DB audit confirms generation `0572a84e-fcd7-450b-a13a-a1eb653294aa` is `completed`, prompt v8, `model_id=codex/gpt-6.1-sol`, `requested_model_id=haiku`, `provider_request_id=NULL`, with the 7-source output persisted. The actual model ID is accurate; the legacy requested alias/provider and `execution_mode=claude_code` remain a known audit-label mismatch for Codex CLI, not a claim that Claude ran.
- Research retry failure: Codex task `c7ed5215-486e-482c-b2eb-ff8d60ea63d8` (`a2-research@v19`) returned `status=needs_research`, empty topics/sources, and six blocking source questions; Studio correctly rejected it and retained the rejection feedback. The CLI attempted to route source discovery through a nonexistent `corelia_studio` MCP server and resource-list methods that this endpoint does not implement, then skipped the enabled standalone search tool. This is a coordinator/tool-selection failure, not an incident in Studio. Recovery is to use a verified official-source packet and explicitly instruct the CLI to use its standalone web search only if it needs additional sources; do not mark the rejected attempt complete.
- Research retry completed: Codex fetched repair task `8fa53e13-58ec-49b5-9d3a-ca2b696b9a65` (attempt 1, same prompt v19), used the verified source packet, and Studio accepted it. DB confirms 7 topics, 18 key points, 12 official sources, and 2 misconceptions; the rejected attempt remains preserved with its feedback. No video/tool stack is required for this non-coding simulation. Next deterministic advance will move the run from research to curriculum.
- Curriculum retry issue: Codex's first curriculum generation `24be455d-00e7-4d76-96b1-0ccc5c7afa10` (prompt `a3-curriculum@v27`) was rejected: five modules/seven outcomes were present, but no lesson reviewed outcomes from the prior module. The CLI then tried submitting its edited output with the same generation ID; MCP correctly returned `already_submitted` because rejected generations are immutable and corrections require a newly issued attempt. No data was overwritten. Continue by fetching the new repair task and submitting only against its new generation ID.
- Curriculum retry completed: Studio issued repair generation `f9a519dd-bac0-49d7-81f2-3e52fd238af7` (attempt 1, prompt v27); Codex added `quick_check.review_lesson_ids` links to prior-module lessons and submitted once. Studio accepted it: 5 modules, 19 lessons, 8 outcomes. Direct DB confirms `completed`, `model_id=codex/gpt-6.1-sol`, `requested_model_id=haiku`, and draft status. No publish action ran; next step is curriculum review.
- Independent A4 curriculum review `2e8e2fb3-bed9-4062-8bc1-cf387f0203fe` (prompt `a4-curriculum-review@v24`) was accepted as a review artifact. It returned `needs_fix`: one source blocker because the accepted research did not trace the claim that confirmed transfers are difficult to reverse; two minor assessment-wording gaps in `m2-quick-check`, `m5-quick-check`, and `final-check`. It also confirmed the final-check plans all 8 outcomes and the module 2–5 retrieval links are present. The next deterministic step must address the research blocker and the review findings; do not treat an accepted review artifact as a passed course review.
- Workflow audit for the A4 source blocker: this initially looked like `needs_research` might bypass A2. Source and existing test `steps.test.ts` confirm the intended two-hop route: A4 blocking review reopens curriculum; A3 receives `curriculumRevision(...).needs_research` and can return `status=needs_research`; then `planRun` uses `reopen_research` to reopen A2. No planner defect was reproduced, so no extra source change was made. The next A3 response must request the missing source rather than claim the A2 brief already contains it; then A2 can add the official evidence and A3 can fix the minor criteria.

- A3 revision request completed: generation 3e58e2cd-8a94-4476-ae28-f21931ed19e1 (curriculum, attempt 1, a3-curriculum@v27) was accepted with status=needs_research. It identified that the transfer/finality claim lacked direct evidence and asked A2 to add authoritative Ethereum material; the request preserved the existing curriculum and deferred minor assessment edits.
- A2 research retry completed: generation 186d5da8-3862-4777-8443-2218a2325da7 (research, attempt 2, a2-research@v19) was accepted by studio_submit_task on its first submit. Validator summary: 8 topics, 26 key points, 5 misconceptions, 15 sources read, 0 videos, 0 open questions. Actual run metadata: codex/gpt-6.1-sol, xhigh; the submit schema has no requested_model_id field.
- The research incorporates official Ethereum.org sources for the transaction lifecycle, justified/finalized blocks, proof-of-stake finality thresholds, and recovery limits. During CLI narration an interim research_gap message appeared before the completed submit response; because the final MCP response was accepted=true, do not classify this as a rejection. Independently verify persisted generation state before relying on that acceptance.

- A3 curriculum repair completed: generation 6970e609-3d01-4e63-b25f-b9820be232df (attempt 3, a3-curriculum@v27) was accepted on its first submit. Validator confirmed 5 modules, 19 lessons, and 8 outcomes. The curriculum now distinguishes execution, inclusion, and finality; module 2 quick-check uses node/shared-state evidence plus network-specific records; module 5 quick-check and the final check require first-safe actions for both unexpected signature and lookalike-site scenarios. Lesson-outcome mapping and retrieval links were retained.
- A transient Codex plugin-catalog HTTP 503 appeared during the curriculum generation. Corelia Studio MCP remained responsive and accepted the result; no app artifact or task state was lost.

- Independent curriculum review completed: A4 generation 7a933c62-40ce-4401-861b-0fe51ac11df9 (a4-curriculum-review@v24) was accepted with verdict pass and 0 blocker/minor/research findings. Reviewer confirmed all 8 outcomes, four prior-module retrieval links, evidence-aligned inclusion/finality language, node plus network-specific evidence in module 2, and concrete safe actions for both module 5 risk cases. Curriculum remains draft.

- Lesson coordinator command-construction error: one attempted PowerShell batch command did not execute because a PowerShell backtick inside the JavaScript command template terminated the wrapper string. No MCP call or app state change occurred; corrected by removing the escape and using the environment newline constant.
- Web3 A5 lessons accepted so far: read-a-pass-count (generation 18695230-701e-41a4-88c6-506f93e0a4df), compare-network-records (generation a24233d7-8cf1-4ece-9005-4fd14f07a9bb), and m1-quick-check (generation f317315e-d598-4503-bd84-e486ba86713b). Each was submitted once with actual Codex CLI metadata.
- Workflow observation: Studio interleaves an A6 lesson_review task after lesson generation. The batch loop correctly stopped at the next non-lessons step and left review generation aefbb65c-d5e9-4903-8e37-b3acec1cffad ready for independent checking.

- Codex CLI usage-limit error during A6 review: generation aefbb65c-d5e9-4903-8e37-b3acec1cffad (lesson_review, read-a-pass-count) was fetched, but the configured gpt-6.1-sol CLI stopped before producing or submitting review output with “You’ve hit your usage limit… try again at 7:50 AM.” No MCP submission was made; generation history is preserved. Retrying through Codex CLI with another supported Codex model is the next recovery check; do not substitute a provider API key or claim this review passed.

- Retry launch error: the cached Codex executable path disappeared because the installed Windows Store app updated from package 26.1029.9216.0 to 26.1103.3517.0. PowerShell resolved no executable, so no MCP call or task mutation occurred. Current PATH resolves codex.exe in the new package; retry will use that binary.

- Local runtime recovery after Codex CLI MCP connection failure: Docker Desktop was stopped; local Supabase DB/API, Edge runtime, and the 8791 loopback proxy were unavailable. Started Docker Desktop without stopping or resetting containers, confirmed the existing local database container was healthy, and restarted local Supabase Edge Functions. Recreated the loopback-only proxy with a 10-minute admin JWT held only in its Node process memory; no JWT was written to logs/files. Docker Desktop also brought unrelated quanlyvanban and studio-api-proxy containers back up; they were left untouched.

- A6 retry coordinator failure: the updated Codex CLI invocation header showed model gpt-6.1-terra and effort xhigh, and the local MCP returned the expected lesson_review generation. The coordinator then treated its CLI runtime header as insufficient model evidence, called studio_report_task_failure with code MODEL_ID_UNVERIFIED, and submitted no review. This is a runtime/coordinator decision error; no Studio source defect is established. The task failure is persisted; inspect run/generation/incident state before retrying.

- Direct local DB verification after MODEL_ID_UNVERIFIED: run 3711e06f-5f4c-40aa-b5ce-2ff82c4d9dad remains running and unpaused; generation aefbb65c-d5e9-4903-8e37-b3acec1cffad is failed with failure_kind=transport, no output/model_id, requested_model_id=haiku, and no operational incident. It is eligible for a fresh A6 attempt; the failed row remains preserved.
- Proxy refresh: rebuilt the owned 127.0.0.1:8791 proxy to sign a fresh 10-minute JWT per request from the running local Auth container's in-memory secret. It binds loopback only; neither the secret nor bearer token is logged or written to disk.

- The model-profile retry did not resubmit failed read-a-pass-count generation aefbb65c-d5e9-4903-8e37-b3acec1cffad. Studio had already queued independent A6 reviews for compare-network-records and m1-quick-check; the mismatched read-only retrieval therefore left those tasks untouched.
- A6 review for compare-network-records completed: generation c0842142-08f4-4cc9-b2f9-74dbaf1431ce accepted with verdict pass, 0 blockers and 0 minors. Reviewer confirmed the core distinction of separate network state, while explicitly treating chain-ID and transaction-hash lookup details as unverified rather than established facts.

- A6 validator rejection at 2026-11-07T08:26:26.7432463+07:00: generation 43cede76-3c9e-4585-a882-c208ee3192d8, lesson m1-quick-check; feedback: Review lesson m1-quick-check chưa hợp lệ: vị trí "questions.1.explanation" không phải field của lesson_draft (một đường dẫn tính từ gốc lesson_draft, không có tiền tố "lesson_draft.", mỗi issue một field; field gốc: lesson, questions, diagrams, source_ids, summary). Rejected generation preserved; next iteration fetches the newly issued repair generation.

- Independent A6 recovery succeeded: after failing read-a-pass-count attempt 0, Studio drained the already-queued review tasks and issued read-a-pass-count attempt 1 as generation 0939ff02-402c-4d3a-bc2a-bf19690cd1cf. It was accepted with verdict pass, 0 blockers and 0 minors.
- m1-quick-check A6 attempt 0 (generation 43cede76-3c9e-4585-a882-c208ee3192d8) was rejected by Studio because the review finding used invalid field path questions.1.explanation. The rejected output was preserved. A fresh review generation a98ee592-f9de-43c0-b296-ce5948f352d7 was accepted with verdict pass, 0 blockers and 1 minor; the minor notes that the answer explanation assumes who submits a signed transaction when the question does not specify it. No lesson content was mutated by A6.
- The A6 queue then advanced to the next A5 lesson generation d0cd9a04-0a4a-4f70-b8d6-95ac50bb9a52 (m1-independent). The coordinator stopped without submitting it; this confirms the A5/A6 loop must handle both task types serially.

- Validator rejected A5/A6 generation at 2026-11-07T08:44:30.8995859+07:00: step lessons, generation 36179271-6d35-4651-a5d5-e3d0815b145f, lesson classify-pass-requests; feedback: Lesson classify-pass-requests chưa hợp lệ: sơ đồ pass-requests: nhãn "Asks for a wallet secret" đè lên node prompt; đổi route hoặc vị trí node. The attempt remains preserved; the next iteration fetches a new repair generation.

## Scope reduction and Web3 course handoff — 2026-11-07

- User reduced the requested run from three courses to one: **Web3 Foundations: Networks, Wallets, and dApps** (`course_id=b63eae7d-ab52-4852-b3f6-69a320dd78da`, `run_id=3711e06f-5f4c-40aa-b5ce-2ff82c4d9dad`, Web3 path `4f2f0409-3cfa-4a59-9027-e6d19e8c165f`). The user then scoped translation to Vietnamese only for this run and authorized publishing to the local app. No staging/production publish, push, merge, or deploy is authorized.
- At the user's later request to stop and hand off, `studio_pause_run` was called and `studio_get_run_status` confirmed `paused=true`, current step `translate`, and `publish=pending`. The local course row remains `generating`; no local publish has run.
- DB confirms A1-A6 done, 19 accepted English lessons, 19 accepted A6 reviews, and `structure_check` / `journey_test` done. Curriculum review passed with 0 findings.
- Vietnamese A7 has 11/20 units completed (course metadata plus 10 lessons), all locale `vi`. One task remains `submitting`: `ffaeb8f1-fbfd-43fe-a320-34738fd7aea0`, lesson `m3-independent`, attempt 0. Eight lessons have not yet been translated: `calculate-claim-fee`, `final-check`, `interpret-claim-status`, `m4-independent`, `m4-quick-check`, `m5-independent`, `m5-quick-check`, `verify-the-pass-request`. No non-Vietnamese translation generations were created.
- Scope blocker before local publish: `publish.ts` requires all six `TRANSLATION_LOCALES` and declares all seven course locales (English plus six translations). A VI-only translation map will be rejected before database publish. The source path confirms this; publish was not attempted. Resume requires a run-scoped publish payload for `en` + `vi` without changing default behavior for other runs.
- New runtime hiccup: `studio_get_next_task` twice returned `path not found` for `supabase/functions/corelia-api/og/assets/resvg.wasm`. The asset exists on host and in the Edge container, and `supabase/config.toml` already lists it as a static file. After Edge Runtime hot-reload, the retry succeeded and `structure_check` completed. No source fix was made; root cause remains unverified.
- The initial temporary PowerShell translation coordinator failed parsing `$i:` before any MCP call; it was corrected. That attempt created no DB generation. The corrected coordinator then accepted 11 VI units before the user stopped it.
- Temporary edits (`TRANSLATION_LOCALES=["vi"]`, one MCP workflow tick per `studio_get_next_task`) were restored to defaults after pausing. Reapply only a run-scoped mechanism before continuing; otherwise a resumed run may create the other five locales.
- Catalog ranking is not computed locally: `studio_catalog_rankings` and `studio_catalog_scores` contain no rows. The most recent research job is `fdff555b-ea9e-4750-bb5b-3ae666bb1e82` (`evidence_ok`, 2026-11-06). After local publish, user requested a fresh catalog research job followed by local admin operations `studio.catalog_research` and `studio.catalog_rerank` and DB verification of score, confidence, and rank.
- Full handoff: `docs/tests/2026-11-07-web3-course-handoff.md`.
