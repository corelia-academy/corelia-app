# Project staging delivery — 2026-09-07

User authorized staging delivery and requested testing there instead of local.

- Staging commit: `824eaf4bfea512d21a576f31170989587519d430`.
- Work branch: `feat/project-showcase-redesign`; integrated latest staging `ed496690` before delivery.
- Backend workflow: https://github.com/corelia-academy/corelia-app/actions/runs/34079528647 — verification and deploy both successful. Migration, Security Advisor and Edge deployments passed.
- Frontend check: Workers Builds `corelia-staging` succeeded for the same commit; build `1cc2a18e-10b7-408d-93d0-011fd2ae9751`.
- Integrated validation: 64 test files / 354 tests, lint, staging build and `pnpm db:verify` passed. CI additionally passed isolated database recreation.
- Exact artifact verifier passed: 183 migrations, candidate tree `5893c8e88c80e2a2db7bc641f22a8046de0ba06b75448efde09f3883064148b7`. The manifest was regenerated from committed code; the previous local manifest blocker is resolved.
- Production was not deployed.

## Browser checks on the deployed app

Used the existing signed-in staging session. Registered in the existing QA hackathon `qa-356` and created only a new QA project; no existing user's project was edited and no invitations were sent.

QA record: https://staging.corelia.academy/projects/qa-project-showcase-20260907

1. New form shows redesigned sections, checklist, required taxonomy and disabled incomplete submit.
2. Created project with summary, Markdown description/progress and taxonomy through the deployed Edge AI gate. Success notification and detail rendered.
3. Opened editor; source text and all taxonomy choices persisted.
4. Changed progress to Vietnamese Markdown and saved successfully.
5. Reloaded detail; description and Vietnamese progress persisted and rendered correctly.
6. Returned to hackathon; CTA now says View project and opens the existing project.
7. Directly reopened `/projects/new?hackathon=qa-356`; redirected to `/projects/4c5f7cf2-846c-412f-8577-0098e4498fa4/edit` with existing title, summary, description and progress intact. No blank form or overwrite occurred.
8. Captured console error sample was empty.

This is a staging smoke/regression check, not complete manual coverage of uploads, invitations, every role, video playback or all validation errors. The QA record and registration are retained for review. The existing QA hackathon has an empty English title, which is unrelated fixture content.

## Extended staging manual QA

The following additional cases were exercised through the deployed browser UI unless marked API:

| Case | Result |
| --- | --- |
| Invalid URL syntax | Native validation focuses the URL field and prevents submission |
| HTTP link | Rejected by HTTPS pattern |
| Unverifiable HTTPS demo | Localized error, focused alert, draft retained |
| Correct invalid demo and retry | Save succeeds; automation used keyboard select-all/backspace to clear reliably |
| Remove required track | Save disabled and checklist identifies missing track |
| Save demo and pitch video links | Both persist and render as separate video tabs; playback itself not asserted |
| Resources and team panels | Resource links and owner/empty-team state render |
| Like in detail, inspect gallery, unlike | Count and pressed state synchronize 0 → 1 → 0 |
| Python filter | Empty result state |
| Clear filter, React filter | QA project returns; React filter leaves only matching QA project |
| Oldest/newest sort | Correct reversed ordering of two public projects in the main gallery |
| Unsaved text then leave/reopen editor | Text and Vietnamese characters recovered; browser dialog accept/cancel interaction was inconclusive, so that subcase remains open |
| Slug collision with another existing project | Rejected with a localized unavailable-URL error; no other project edited |
| Rename own QA slug | Save succeeds; original URL redirects to new canonical slug |
| Reuse previous slug | Rejected by the existing history reservation contract; retained current renamed slug |
| Mobile editor/detail at 390px | Document width 375px; no horizontal overflow; detail screenshot reviewed |
| Share button | Success notification shown; clipboard contents not inspected |
| Vietnamese interface | Gallery/editor labels and taxonomy render in Vietnamese |
| Empty optional fields, private standalone project | Created successfully; owner can open detail with clear empty states |
| Private standalone in public gallery | Excluded |
| Anonymous REST read of private/public QA records | Private returns empty list; public record returns expected ID and public visibility |
| Save/upload/delete Edge requests without Authorization | All three return 401 |
| My projects action | BUG: `/account/projects` redirected to profile. Route restored under its existing authenticated parent; staging retest shows both owned QA projects. Follow-up adds open/edit actions and visibility labels to the legacy screen |
| Public repository verification | `https://github.com/facebook/react` accepted; temporary resource subsequently cleared through the editor |
| Unlisted visibility | Readable by anonymous REST request through its direct slug, absent from public gallery; restored to private afterward |
| Team picker | Registered candidates load; nonexistent search has a clear empty state; closes without sending an invite |

Current public QA slug: `qa-project-showcase-20260907-renamed`; original link still redirects correctly. Private QA record: `/projects/qa-du-an-rieng-tu-20260907`. Both are intentionally retained. No invitation was sent and no other user's content was changed.

Remaining coverage requires external input: Chrome file chooser still fails `Not allowed` before upload reaches the app, and a second authorized QA account is needed for invite accept/decline/revoke and authenticated non-owner checks. Upload/file-size/type/reordering remain unit-tested only. Full keyboard/screen-reader audit, confirm-dialog cancellation and deadline boundaries are not yet manually proven.

First route repair published as staging `9fcd7875`, Cloudflare build `f0bca476-fb3a-487e-84f0-c09011a48075` succeeded. The backend remained on the already verified deployment; frontend-only repair did not require another backend deployment.

## Final repair retest

- Final staging commit `c25636c3`; Cloudflare build `746eeec2-08b2-4862-b2a6-86c7b1cdf76c` completed successfully.
- Refreshed `/account/projects` shows both QA records, translated owner badges and public/private labels instead of internal UUIDs.
- Selecting the private project updates the heading and both action destinations. Clicking Edit opens its populated editor with visibility still `private`.
- Successful repository fixture was cleared and no longer appears in detail resources.
- Nonexistent project route renders the localized not-found state; nonexistent hackathon context does not open a creation form.
- Latest console samples for project detail and private editor contain no error entries.
- Lint, staging build, `db:verify` and exact artifact verification passed for the final repair. Full suite before the final small action-link change passed 64 files / 354 tests; the final link behavior was verified in the deployed browser.
- Upload and second-account authorization remain outstanding; full manual completion is not claimed. The temporary local Supabase stack from earlier validation was stopped; ongoing testing uses staging.
