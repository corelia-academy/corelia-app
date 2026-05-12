# Cora AI — Implementation Plan

> Nguồn: `CORA_AI_TUTOR.md` · `CORA_MONETIZATION.md`
> Tick checkbox khi hoàn thành. Không xóa item đã tick — dùng để audit.

---

## Phase 1 — Database Migrations

### 1.1 Core AI tables

- [ ] Tạo migration: cập nhật `ai_conversations` — thêm `session_id` (nullable FK), `context_type` (text), đổi `lesson_id` thành nullable
- [ ] Tạo migration: tạo `ai_chat_sessions` (`id`, `user_id`, `context_type`, `title`, `message_count`, `last_message_at`)
- [ ] Tạo migration: tạo `knowledge_chunks` với `content_category` enum (`lesson | course_catalog | career_track | activity | platform_guide`) và pgvector `embedding` column
- [ ] Enable `pgvector` extension trên Supabase project
- [ ] RLS policies: `ai_conversations` (own rows), `ai_chat_sessions` (own rows), `knowledge_chunks` (read-only cho authenticated)

### 1.2 Quota & tier tables

- [ ] Tạo migration: tạo `ai_usage_monthly` (`user_id`, `month` text, `message_count`, `tokens_used`, `cost_usd`, unique `user_id,month`)
- [ ] Tạo migration: tạo hoặc seed `tier_limits` — thêm columns `monthly_messages`, `daily_soft_cap`, `price_vnd_monthly`
- [ ] Seed tier_limits: Free (50/5), Student (500/25), Pro (1500/75), Bootcamp (4000/200)
- [ ] Tạo migration: thêm `signup_fingerprint` jsonb vào `profiles` (cho anti-cheat fingerprinting)

### 1.3 Subscription tables

- [ ] Tạo migration: tạo `ai_subscriptions` (xem schema Section 6.2 của CORA_MONETIZATION.md)
- [ ] Tạo partial unique index `ai_subscriptions_one_active_per_user` (`where status = 'active'`)
- [ ] RLS: `ai_subscriptions` — select own rows; insert/update service role only

---

## Phase 2 — Edge Function: `ai-tutor`

### 2.1 Auth & quota

- [ ] Implement `verifyBearerUser()` — trả về user với `email_confirmed_at` check
- [ ] Implement `checkQuota(supabase, userId, tier)` — dual quota: monthly hard cap + daily soft cap (xem Section 4.2)
- [ ] Trả về `QuotaResult` với `allowed`, `throttled`, `haikuOnly`, `monthlyUsed/Limit`, `dailyUsed/SoftCap`
- [ ] Return HTTP 429 với `{ used, limit, tier }` khi `allowed = false`

### 2.2 Anti-cheat trong handler

- [ ] Validate input length ≤ 2,000 ký tự (400 trước khi chạm quota check)
- [ ] Rate limit: query `ai_conversations` đếm msgs trong 60 giây — block nếu ≥ 10
- [ ] Concurrent request limit: check in-flight placeholder rows — block nếu ≥ 2
- [ ] Message deduplication: check cùng message trong 10 giây — return cached nếu có

### 2.3 Context loading

- [ ] Implement `mapAssistantContext(assistantContext)` → `BackendContextType`
- [ ] Implement `loadContextData(supabase, userId, contextType, extras)`:
  - [ ] `lesson`: load lesson content + course outline + user progress
  - [ ] `dashboard`: load enrolled courses + completion stats + streak
  - [ ] `course_discovery`: load user goal + interests + catalog summary
  - [ ] `career`: load career track interest + current level
  - [ ] `activity`: load recent activity (hackathons, projects, achievements)
  - [ ] `profile_review`: load full profile + learning summary
  - [ ] `global`: load user profile summary (fallback)

### 2.4 RAG

- [ ] Implement `semanticSearch(supabase, query, contentCategories[])` dùng pgvector
- [ ] Filter `knowledge_chunks` theo `content_category` phù hợp với `contextType`
- [ ] Limit: top 5 chunks, similarity threshold 0.75

### 2.5 Complexity classifier & model routing

- [ ] Implement `classifyComplexity(message, context)` → `"simple" | "medium" | "complex"`
- [ ] Routing rule: non-lesson context → Haiku ONLY
- [ ] Routing rule: Free + Student → Haiku ONLY (bất kể context)
- [ ] Routing rule: Pro + Bootcamp + lesson context → Haiku default, Sonnet nếu `complex`
- [ ] Routing rule: nếu `QuotaResult.throttled = true` → force Haiku

### 2.6 System prompt builder

- [ ] Implement Cora persona base prompt (tên, tone, ngôn ngữ VN/EN theo user)
- [ ] Implement 6 context blocks: `lesson`, `dashboard`, `course_discovery`, `career`, `activity`, `profile_review`
- [ ] Append RAG chunks vào context block

### 2.7 Streaming & save

- [ ] Call Anthropic/OpenAI API với streaming (provider abstraction layer)
- [ ] Insert assistant placeholder row trước khi stream (cho concurrent limit check)
- [ ] Stream response về client qua SSE hoặc ReadableStream
- [ ] Sau khi stream xong: update placeholder với content đầy đủ
- [ ] Increment `ai_usage_daily.message_count` và `ai_usage_monthly.message_count`
- [ ] Track `cost_usd` vào `ai_usage_monthly` (estimate dựa trên token count)
- [ ] Async: trigger `update-memory` Edge Function (learning profile)
- [ ] Gọi `maybeTitleSession()` sau message đầu tiên của session

### 2.8 Provider abstraction

- [ ] Implement `AIProvider` interface (Anthropic + OpenAI compatible)
- [ ] Load provider từ DB config hoặc env var
- [ ] `buildAnthropicMessage()` và `buildOpenAIMessage()` từ cùng input type

---

## Phase 3 — Edge Function: `corelia-api` (Payments)

- [ ] Thêm `"ai_subscription"` vào `PaymentPurpose` type
- [ ] Implement `handleAiSubscriptionCheckout()` — validate tier + duration, compute amount từ price table, save pending transaction
- [ ] Thêm route `POST /payments/ai-subscription/checkout` vào router
- [ ] Thêm branch `ai_subscription` trong `grantPaymentAccessForTransaction()`:
  - [ ] Validate `amount_vnd` khớp `AI_SUBSCRIPTION_PRICES[tier][months]`
  - [ ] Insert vào `ai_subscriptions`
  - [ ] Update `profiles.tier`
- [ ] Xử lý `ORDER_REFUND` / `CHARGEBACK` trong IPN handler → revoke subscription + downgrade tier

---

## Phase 4 — Frontend: Hooks & State

### 4.1 `useCoraAI` hook

- [ ] Tạo `src/hooks/useCoraAI.ts` (hoặc `src/components/course-ai/useCoraAI.ts`)
- [ ] Props: `{ assistantContext, lessonId?, sessionId? }`
- [ ] State: `messages`, `isLoading`, `isStreaming`, `error`, `quotaInfo`
- [ ] `sendMessage(text)` — gọi `ai-tutor` Edge Function, append streaming tokens
- [ ] `loadHistory()` — load conversation history theo `lessonId` hoặc `sessionId`
- [ ] `loadMoreHistory(cursor)` — cursor pagination cho lesson history
- [ ] Handle HTTP 429 quota exceeded → set `error.type = 'quota_exceeded'`
- [ ] Handle daily throttle flag → show throttle warning (không block)

### 4.2 Session management

- [ ] `createSession(contextType)` → insert vào `ai_chat_sessions`, return `sessionId`
- [ ] `loadRecentSessions(contextType?)` → 5 sessions gần nhất
- [ ] Auto-create session khi GlobalCoraAssistant / DashboardPanel mở lần đầu
- [ ] Persist `sessionId` trong component state (không localStorage — session per mount)

### 4.3 Payments client

- [ ] Thêm `createAiSubscriptionCheckout()` vào `src/lib/payments.ts`
- [ ] Thêm `getMyAiSubscription()` — query `ai_subscriptions` active
- [ ] Thêm `AiSubscription` type export

### 4.4 Auth store

- [ ] Thêm `aiSubscription: AiSubscription | null` vào `authStore`
- [ ] Thêm `loadAiSubscription()` action
- [ ] Tính `daysUntilExpiry` computed value

---

## Phase 5 — Frontend: UI Components

### 5.1 CoraShell — conversation mode

- [ ] Thêm `ConversationHistory` component (`src/components/course-ai/ConversationHistory.tsx`)
  - [ ] User bubble (right-aligned, primary bg)
  - [ ] Assistant bubble (left-aligned, surface-raised bg)
  - [ ] `StreamingText` component cho message đang stream
  - [ ] `MarkdownContent` component cho message đã hoàn thành
  - [ ] Auto-scroll to bottom khi có message mới
  - [ ] "Load older messages" button khi có cursor (lesson history)
- [ ] Thêm `SessionSwitcher` dropdown — 5 sessions gần nhất, icon ở header CoraShell
- [ ] `QuotaExceededPrompt` component — hiện trong footer khi `error.type = 'quota_exceeded'`
- [ ] Daily throttle banner — strip nhỏ trong footer khi `throttled = true`

### 5.2 CourseAiTutorPanel

- [ ] Thêm `lessonId` prop
- [ ] Wire `useCoraAI({ assistantContext: 'lesson', lessonId })`
- [ ] Chuyển body từ static cards → `ConversationHistory`
- [ ] Bật textarea (hiện đang disabled)
- [ ] Empty state: hiện suggestion chips từ `getAssistantSurfaceMeta('lesson')`

### 5.3 DashboardAiAssistantPanel

- [ ] Wire `useCoraAI({ assistantContext: 'home', sessionId })`
- [ ] Chuyển body từ static → `ConversationHistory`
- [ ] Bật textarea
- [ ] Session auto-create khi component mount

### 5.4 GlobalCoraAssistant

- [ ] Wire `useCoraAI({ assistantContext: resolveAssistantContext(pathname), sessionId })`
- [ ] Bật textarea
- [ ] Session auto-create khi panel mở lần đầu
- [ ] Hiện expiry badge nếu `daysUntilExpiry ≤ 7`
- [ ] Đổi context khi route thay đổi (reset session, load mới)

### 5.5 Trang AccountCoraRoute

- [ ] Tạo `src/pages/account/AccountCoraRoute.tsx`
- [ ] Hiện current subscription card (`CurrentSubscriptionCard`)
- [ ] Tier selector (Student / Pro / Bootcamp) với feature list
- [ ] Duration selector (1 / 6 / 12 tháng) với savings badge
- [ ] CTA button → `createAiSubscriptionCheckout()` → `submitSePayCheckoutForm()`
- [ ] AI transaction history (filter `payment_transactions` by purpose `ai_subscription`)
- [ ] Thêm route `/account/cora` vào `src/App.tsx`
- [ ] Thêm redirect `/upgrade/cora` → `/account/cora`

### 5.6 CheckoutSuccess

- [ ] Thêm case `ai_subscription` vào `src/pages/CheckoutSuccess.tsx`
- [ ] Poll verify → redirect `/account/cora?payment=success`
- [ ] Hiện success toast / confirmation

---

## Phase 6 — Knowledge Base (RAG Data)

- [ ] Viết seed script `scripts/seed-knowledge.ts`
- [ ] Seed `lesson` chunks: extract từ course content DB
- [ ] Seed `course_catalog` chunks: tên, mô tả, tags, prerequisite của mọi course
- [ ] Seed `career_track` chunks: lộ trình career, skill mapping
- [ ] Seed `platform_guide` chunks: FAQ, hướng dẫn dùng platform
- [ ] Chạy embedding generation qua Anthropic / OpenAI Embeddings API
- [ ] Tạo Edge Function `seed-knowledge` (admin-only) để re-index khi content thay đổi

---

## Phase 7 — Expiry & Monitoring

- [ ] Implement SQL function `expire_ai_subscriptions()` (xem Section 8.1)
- [ ] Schedule với `pg_cron`: chạy hàng ngày 00:00 UTC
- [ ] Tạo `ai_cost_anomaly` view (xem Section 4.5)
- [ ] Expiry reminder: Edge Function `cron-expiry-reminder` — email 7 ngày trước hết hạn
- [ ] Admin query doc: hướng dẫn chạy weekly cost anomaly check

---

## Phase 8 — Testing & QA

- [ ] Unit test `checkQuota()`: free tier hard block, daily throttle, monthly cap
- [ ] Unit test `classifyComplexity()`: simple vs complex routing
- [ ] Unit test `mapAssistantContext()`: tất cả route → context type
- [ ] Integration test: gửi message → stream → save → quota increment
- [ ] Integration test: monthly cap exceeded → 429 → QuotaExceededPrompt
- [ ] Integration test: ai_subscription checkout → IPN → tier upgrade
- [ ] Integration test: refund IPN → subscription cancelled → tier downgrade
- [ ] E2E: user mua Student plan → dùng hết 500 msgs → thấy upgrade prompt
- [ ] Anti-cheat test: >10 msgs/60s → rate limited
- [ ] Anti-cheat test: input 2001 chars → rejected

---

## Phụ thuộc triển khai

| Task | Cần hoàn thành trước |
|------|---------------------|
| Edge Function ai-tutor | Phase 1 migrations |
| useCoraAI hook | Edge Function ai-tutor |
| ConversationHistory UI | useCoraAI hook |
| CourseAiTutorPanel wiring | ConversationHistory + useCoraAI |
| GlobalCoraAssistant wiring | useCoraAI + Session management |
| AccountCoraRoute | payments.ts client + ai_subscriptions table |
| CheckoutSuccess ai_subscription | AccountCoraRoute + corelia-api handler |
| Expiry cron | ai_subscriptions table |
| Knowledge base seed | pgvector migration |
| RAG trong ai-tutor | Knowledge base seeded |

---

*Cập nhật file này khi scope thay đổi. Không xóa item đã tick.*
