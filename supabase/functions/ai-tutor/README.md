# `ai-tutor` (Supabase Edge Function)

Learner-facing Cora AI chat endpoint.

Current slice includes:
- Bearer auth + email confirmation check
- AI sessions + conversation persistence
- Context-aware replies for `dashboard`, `lesson`, `course_discovery`, `career`, `activity`, `profile_review`
- Fallback-first knowledge retrieval from `knowledge_chunks` for `lesson`, `course_discovery`, `career`, and `activity`
- Stub replies that surface retrieved knowledge highlights, so local testing still shows RAG impact before a real provider is enabled
- Monthly quota + rolling 3-hour soft-throttle
- Burst rate limiting / pending-request limiting / short-window dedupe
- SSE streaming surface for the frontend
- Provider abstraction with `stub` and `openai`

## Local serve

```bash
supabase functions serve ai-tutor --env-file supabase/functions/ai-tutor/.env
```

Copy [`./.env.example`](./.env.example) to `./.env` for local work.

## Quick local stream test

1. Start the function:

```bash
pnpm functions:serve:ai
```

2. Grab a valid Supabase access token for a learner account.

3. Optional but recommended: seed starter knowledge first so `stub` replies can quote relevant course/lesson/activity chunks:

```bash
CORELIA_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
pnpm cora:seed:knowledge --write
```

4. Call the local SSE tester:

```bash
CORA_AI_TEST_ACCESS_TOKEN=<token> pnpm cora:test:stream
```

When `CORELIA_AI_PROVIDER=stub`, successful replies should still mention a short “knowledge chunks” section if retrieval finds relevant seeded content.

## Seed starter knowledge

Dry run:

```bash
CORELIA_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
pnpm cora:seed:knowledge
```

Write to `knowledge_chunks`:

```bash
CORELIA_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
pnpm cora:seed:knowledge --write
```

The script currently seeds:
- `lesson` from lessons inside published courses
- `course_catalog` from published courses
- `career_track` from published career tracks
- `activity` from public hackathons and public projects
- `platform_guide` with a small built-in Corelia/Cora usage guide

Optional env vars:
- `CORA_AI_TEST_CONTEXT=lesson`
- `CORA_AI_TEST_LESSON_ID=<lesson_id>`
- `CORA_AI_TEST_MESSAGE="Giải thích bài này ngắn gọn giúp mình"`
- `CORA_AI_TEST_URL=http://127.0.0.1:54321/functions/v1/ai-tutor`

## Important env vars

| Variable | Purpose |
|---|---|
| `CORELIA_SUPABASE_URL` | Local or hosted Supabase project URL |
| `CORELIA_SUPABASE_SECRET_KEYS` | Service secret key for database access |
| `CORELIA_CORS_ALLOWED_ORIGINS` | Browser origins allowed to call the function |
| `CORELIA_AI_PROVIDER` | `stub` or `openai` |
| `OPENAI_API_KEY` | Enables OpenAI streaming path |

## Notes

- If no provider API key is present, the function falls back to `stub` and still streams tokens so the product flow remains testable.
- Frontend expects SSE events: `meta`, `delta`, `done`, `error`.
- `meta` and `done` events now include a small `sources` array when retrieval finds relevant knowledge chunks, which is useful for local QA and future source-aware UI.
- `verify_jwt` stays disabled in `supabase/config.toml`; auth is enforced inside the handler so `OPTIONS` preflight works consistently.
