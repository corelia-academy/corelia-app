# `ai-tutor` (Supabase Edge Function)

Learner-facing Cora AI chat endpoint.

Current slice includes:
- Bearer auth + email confirmation check
- AI sessions + conversation persistence
- Context-aware replies for `dashboard`, `lesson`, `course_discovery`, `career`, `activity`, `profile_review`
- Knowledge retrieval from `knowledge_chunks` (pgvector + keyword fallback) for `lesson`, `course_discovery`, `career`, and `activity`
- Monthly quota + rolling 3-hour soft-throttle
- Burst rate limiting / pending-request limiting / short-window dedupe
- SSE streaming surface for the frontend
- OpenAI provider via `/v1/responses` streaming

## Local serve

```bash
supabase functions serve ai-tutor --env-file supabase/functions/.env
```

Copy [`../.env.example`](../.env.example) to [`../.env`](../.env) for local work.

## Quick local stream test

1. Start the function:

```bash
pnpm functions:serve:ai
```

2. Grab a valid Supabase access token for a learner account.

3. Seed starter knowledge so retrieval has chunks to ground on:

```bash
CORELIA_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
pnpm cora:seed:knowledge --write
```

4. Call the local SSE tester:

```bash
CORA_AI_TEST_ACCESS_TOKEN=<token> pnpm cora:test:stream
```

`OPENAI_API_KEY` must be set; the function throws if it is missing.

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
| `CORELIA_AI_PROVIDER` | Currently only `openai` is supported |
| `OPENAI_API_KEY` | Required — used by the chat provider and embeddings (RAG) |
| `CORELIA_OPENAI_DEFAULT_MODEL` | Default model id (e.g. `gpt-4o-mini`) |
| `CORELIA_OPENAI_COMPLEX_MODEL` | Model id used for complex lesson questions (e.g. `gpt-4o`) |

## Notes

- The function throws if `OPENAI_API_KEY` is missing — there is no stub fallback.
- Frontend expects SSE events: `meta`, `delta`, `done`, `error`.
- `meta` and `done` events now include a small `sources` array when retrieval finds relevant knowledge chunks, which is useful for local QA and future source-aware UI.
- `verify_jwt` stays disabled in `supabase/config.toml`; auth is enforced inside the handler so `OPTIONS` preflight works consistently.
