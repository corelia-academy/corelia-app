# Project redesign — local validation — 2026-09-07

Status: implementation available locally; validation is not fully complete. No commit, push, frontend deployment, or production migration was performed.

## Implemented scope

Reference inspected in the browser: HackQuest OKXAI Genesis Hackathon project gallery and a linked project detail. Corelia now uses compact project cards with builder, technology, area tags, resources and reactions; compact taxonomy filters; and a detail page with overview/resources/team tabs, demo/pitch videos, Markdown description, hackathon progress, event context and a team/resource sidebar. This does not add HackQuest fundraising or checkpoint business features.

The shared create/edit form has section navigation, required-field guidance, completion status, recoverable session text drafts, dirty-navigation warnings, upload status and localized save errors. Existing hackathon submissions redirect to their populated editor. A second create ID is rejected instead of overwriting the original project. Source text is loaded independently of UI translation, and editor loading fails if signed media URLs are incomplete so an unrelated text save cannot discard or mis-pair images.

New optional database fields: `description`, `progress`, `pitch_video_url`. The Edge handler validates lengths and HTTPS, moderates story/progress with existing text, and retains the existing video exclusion. A new forward migration wraps the existing private save gate, preserves fields for older clients, allows explicit clearing, restricts execution to service_role and serializes simultaneous submission attempts by actor/event.

## Evidence

- Full `pnpm test`: 58 files, 305 tests passed; subsequent targeted source/media regression: 2 tests passed; route regression: 4 tests passed. These are separate runs (311 passing test cases in total), not a claim of a single final full-suite run.
- Route tests render the actual `ProjectNewPage` with query/router providers and cover existing-project redirect without mounting an editor or saving, lookup failure, eligible new owner and rejected registration.
- Editor regression tests cover failed-save draft preservation, upload/save interlock, required selections and slug generation, dirty navigation and draft recovery.
- Media tests cover invalid type/empty/oversize, six-file maximum, partial upload failure, reorder and deferred removal.
- Helper tests cover existing submission identity, explicit edit and lookup failure. Edge tests cover story moderation, video exclusions, compatibility and invalid fields.
- `pnpm lint`, production-neutral `pnpm build` and TypeScript checks passed. Build retains the existing large-chunk warning.
- `pnpm db:verify:local` passed against an isolated local Supabase stack: clean migration application, retained SQL integration tests and Jobs PostgREST smoke. Added SQL assertions cover story persistence, older-client preservation, length-limit rollback, clearing, and RPC role grants.
- Local browser: two seeded projects rendered in the hackathon gallery; React filter reduced the list to the correct project. Detail Markdown and overview/resources/team panels rendered. Mobile gallery/detail inspected; no document-wide horizontal overflow. Viewport restored afterward.
- Local demo video fixture returned the provider's unavailable-video UI. Embed rendering was observed; successful video playback is not claimed.

## Outstanding gates and limitations

1. `pnpm db:verify` baseline/drift checks pass, but the release artifact schema test fails because the existing manifest describes 182 migrations while the new reviewed migration declaration requires 183. The canonical manifest generator reads committed HEAD, so it cannot include this uncommitted migration. The candidate builder also supports workspace recipes, but that requires reconstructing and verifying the entire candidate from the production base, not simply changing the migration count. The historical manifest has not been edited to pretend that the old candidate contains new code. Regenerate and verify the exact candidate manifest as part of an authorized commit/release preparation.
2. Local login is waiting at hCaptcha. Explicit CAPTCHA authorization was requested through the browser handoff and has not been received. Authenticated editor redirect/save was not manually re-tested on the changed app.
3. Local Edge AI credentials are absent. Successful moderation-backed save/upload is not verified end-to-end; SQL and handler unit tests are separate evidence, not substitutes for that integration.
4. Browser file selection was rejected by the extension (`Not allowed`). Its file URL permission must be enabled to finish real upload testing. No team invitations were sent.

Local public fixture: `/hackathons/project-qa-hackathon/projects`, project `/projects/qa-learning-studio`. These synthetic records exist only in the local Supabase environment. Live findings and the retained live QA record are documented separately in `2026-09-07-project-manual-qa.md`.
