# Cora AI Beta — product and implementation audit

> **SUPERSEDED — HISTORICAL EVIDENCE ONLY.** Learner-facing Cora was removed under issues #325–#332. The decisions and implementation state below describe the 2026-08-25 snapshot and must not be used as current product guidance. Instructor Description Generator, Question Generator, and Career Track AI Translate remain supported.

Date: 2026-08-25  
Status: implemented in the current worktree

## Decision

Cora is no longer positioned as a platform-wide paid assistant. During the beta it is a learner aid available only inside `/learn/...`, with the existing Free-tier quota. Instructor AI features in Instructor Course Edit are outside this change and remain unchanged.

## Why this scope

The strongest Cora use cases are attached to an active lesson: explaining selected text, answering questions with lesson/course context, helping with practice, and continuing a lesson-scoped conversation. Dashboard, catalog, search, career, profile, and generic global-chat surfaces duplicate information or actions that the product can already present deterministically.

The previous implementation also made monetization more prominent than validated learner value: it exposed plan status in the account menu, upgrade prompts when quota was exhausted, a dedicated checkout, and global entry points. No dedicated product analytics events were found for Cora open rate, first-question conversion, learning continuation, lesson completion uplift, recommendation clicks, or retention. Monetization should not be restored until those outcomes are measured.

## Surface audit

| Surface | Previous behavior | Beta decision |
| --- | --- | --- |
| Learn desktop | Resizable course/lesson tutor sidebar | Keep; show Beta and Free usage |
| Learn mobile | Floating assistant opened a generic route-context chat | Keep; open the actual lesson-aware tutor |
| Selected lesson text | “Explain with Cora” action | Keep |
| Practice | “Ask Cora” action | Keep |
| Dashboard | Dedicated assistant panel implementation | Do not mount or expose |
| Course detail | Cora sidebar | Remove from learner shell |
| Catalog/search/career/profile | Global assistant | Remove from learner shell |
| Header/account menu | Cora toggle and plan/quota summary | Remove |
| `/cora`, `/account/cora`, `/upgrade/cora` | Paid-plan checkout/upgrade | Redirect to `/courses` |
| Quota exhausted | Paid Student/Pro/Bootcamp offers | Show reset information only |
| Instructor Course Edit | Description/question generation | Unchanged |

## Enforcement audit

Frontend visibility is not sufficient because the Edge Function can be invoked directly. The `ai-tutor` endpoint now:

1. Rejects every context except lesson context with HTTP 403.
2. Requires a `lessonId` as before.
3. Always evaluates usage against the `free` row in `tier_limits`, ignoring legacy profile or AI-subscription tiers.
4. Retains monthly and rolling three-hour abuse controls.

The current fallback Free limit is 50 questions/month and 5 questions/rolling three hours. Database values in `tier_limits` remain authoritative when available.

## UI changes

- Cora assets and components are no longer mounted by `MainLayout`.
- Header subscription/quota reads and the global Cora control were removed.
- Cora shells show a visible `Beta` badge.
- The lesson tutor displays `used/limit` for the monthly Free allowance.
- Paid upgrade buttons were removed from the quota-exhausted state.
- Mobile Learn now renders `CourseAiTutorPanel` with the current lesson metadata instead of the generic assistant card.

## Legacy code and data

`AccountCoraRoute`, `CoraCheckoutPage`, `CoraPlanSummary`, AI-subscription tables, voucher administration, and shared payment helpers are still present as dormant legacy code/data. They have no learner purchase route or upgrade entry point, and paid tiers are ignored by `ai-tutor`.

They were intentionally not deleted in this pass because payment helpers and database structures may share production history or operational dependencies. Remove them in a separate destructive cleanup after confirming there are no active subscriptions, refunds, reporting requirements, or external deep links.

## Risks and follow-up

- Existing paid subscribers, if any, now receive the Free quota. Communicate or refund before deployment if applicable.
- The large `public/logo/Cora_AI_Tutor.svg` remains a performance concern on Learn and should be optimized separately.
- Non-chat lesson AI features (recap, readiness checks, flashcards) use separate endpoints. They remain available and are not counted by the chat quota unless their own endpoint does so.
- Add analytics before deciding whether to expand Cora: tutor opened, first question sent, successful response, lesson resumed/completed after response, repeated weekly use, and cost per engaged learner.

## Acceptance checks

- `/learn/...` displays the Cora Beta tutor on desktop and mobile.
- The tutor shows Free monthly usage when quota data is available.
- Exhausting quota offers no paid plan and explains when the allowance resets.
- Cora is absent from the main dashboard, course detail, catalog, search, career, profile, header, and account menu.
- `/cora`, `/account/cora`, and `/upgrade/cora` cannot open checkout.
- Direct non-lesson calls to `ai-tutor` return 403.
- All accepted learner calls are checked against the Free quota.
- Instructor Course Edit files and AI generation flows are unchanged.
