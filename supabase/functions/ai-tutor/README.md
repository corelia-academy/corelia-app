# `ai-tutor` (Supabase Edge Function)

Learner-facing Cora AI chat endpoint.

Current slice includes:
- Bearer auth + email confirmation check
- AI sessions + conversation persistence
- Context-aware replies for `dashboard`, `lesson`, `course_discovery`, `career`, `activity`, `profile_review`
- Monthly quota + daily soft-throttle
- Burst rate limiting / pending-request limiting / short-window dedupe
- SSE streaming surface for the frontend
- Provider abstraction with `stub`, `openai`, and `anthropic`

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

3. Call the local SSE tester:

```bash
CORA_AI_TEST_ACCESS_TOKEN=<token> pnpm cora:test:stream
```

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
| `CORELIA_AI_PROVIDER` | `stub`, `openai`, or `anthropic` |
| `OPENAI_API_KEY` | Enables OpenAI streaming path |
| `ANTHROPIC_API_KEY` | Enables Anthropic streaming path |

## Notes

- If no provider API key is present, the function falls back to `stub` and still streams tokens so the product flow remains testable.
- Frontend expects SSE events: `meta`, `delta`, `done`, `error`.
- `verify_jwt` stays disabled in `supabase/config.toml`; auth is enforced inside the handler so `OPTIONS` preflight works consistently.
