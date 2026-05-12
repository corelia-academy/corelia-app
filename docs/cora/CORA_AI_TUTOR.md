# Corelia Academy — Cora AI Tutor
## Kế Hoạch Implementation Hoàn Chỉnh

> Stack: React + Vite · Supabase (DB, Auth, Edge Functions, pgvector) · TypeScript
> AI: Claude Haiku 4.5 · Claude Sonnet 4.6 · Provider abstraction
> Last updated: May 2026

---

# MỤC LỤC

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Component Architecture](#2-component-architecture)
3. [AssistantContext & Surface Map](#3-assistantcontext--surface-map)
4. [Provider Abstraction Layer](#4-provider-abstraction-layer)
5. [Model Selection & Routing](#5-model-selection--routing)
6. [Database Schema](#6-database-schema)
7. [Cora — System Prompt](#7-cora--system-prompt)
8. [Edge Functions](#8-edge-functions)
9. [Long-term Memory](#9-long-term-memory)
10. [React Integration — useCoraAI Hook](#10-react-integration--usecoraai-hook)
11. [Quota & Cost System](#11-quota--cost-system)
12. [Implementation Phases](#12-implementation-phases)
13. [Cost Model](#13-cost-model)
14. [Test Cases](#14-test-cases)

---

# 1. Tổng Quan Kiến Trúc

```
┌──────────────────────────────────────────────────────────────────────┐
│                     React App (Vite)                                  │
│                                                                        │
│  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────┐  │
│  │DashboardAiAssis- │  │ CourseAiTutorPanel  │  │GlobalCoraAssis-  │  │
│  │tantPanel         │  │ (CourseDetail +     │  │tant              │  │
│  │(Home / context:  │  │  Learn pages /      │  │(all other routes /│  │
│  │  "home")         │  │  context: "lesson") │  │ context: varies) │  │
│  └──────────────────┘  └────────────────────┘  └──────────────────┘  │
│           │                      │                       │             │
│           └──────────────────────┴───────────────────────┘             │
│                                  │                                      │
│                        useCoraAI(context, lessonId?)                   │
│                        CoraShell (shared brand wrapper)                │
└──────────────────────────────────┬───────────────────────────────────-─┘
                                   │ supabase.functions.invoke('ai-tutor')
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                             │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │                     ai-tutor (main)                          │     │
│  │                                                              │     │
│  │  Auth → Quota → Context Loader → Route → Prompt → AI → Save │     │
│  │  (context loader branches theo assistantContext)             │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  ┌──────────────────────┐   ┌───────────────────────────────────┐     │
│  │  update-memory       │   │  seed-knowledge (admin script)    │     │
│  │  (async, post-       │   └───────────────────────────────────┘     │
│  │   session)           │                                              │
│  └──────────────────────┘                                              │
└──────────────────────────────────┬───────────────────────────────────-─┘
                                   │
               ┌───────────────────┼──────────────────┐
               ▼                   ▼                  ▼
     ┌──────────────┐    ┌───────────────┐   ┌──────────────┐
     │  Supabase    │    │ Claude Haiku  │   │Claude Sonnet │
     │ PostgreSQL   │    │    4.5        │   │    4.6       │
     │ + pgvector   │    │ (simple Q)    │   │ (complex Q)  │
     └──────────────┘    └───────────────┘   └──────────────┘
```

**Luồng xử lý 1 message:**
```
User gửi câu hỏi
  → [1]  Auth check (JWT)
  → [2]  Quota check (tier limit)
  → [3]  Load user profile (tier, level, goal, streak)
  → [4]  Branch theo assistantContext:
          "lesson"   → load lesson + course + progress
          "home"     → load enrolled courses + completion stats
          "courses"  → load user goal + interests
          "career"   → load track interest + level
          others     → load user profile summary
  → [5]  Load user learning profile (weak/strong topics, summary)
  → [6]  Load conversation history (last 8 messages của session này)
  → [7]  RAG search (knowledge_chunks theo context)
  → [8]  Classify question complexity → route model
  → [9]  Build system prompt (Cora persona + context block phù hợp)
  → [10] Call AI API (streaming)
  → [11] Save conversation + update quota
  → [12] Async: update learning profile
```

---

# 2. Component Architecture

## 2.1 Các component hiện có

Tất cả code nằm trong `src/components/course-ai/`.

### `CoraShell` — Brand wrapper dùng chung
File: `src/components/course-ai/CoraShell.tsx`

Shell thuần UI, không biết gì về AI logic. Nhận slots:
- `eyebrow` — label nhỏ phía trên logo
- `title` / `status` / `description` — header content
- `body` — content area (conversation history, context cards, suggestions)
- `footer` — input area (textarea + caption)
- `onRequestHide` — optional, hiện nút ẩn panel

Khi AI được kết nối, body nhận conversation history và footer bật textarea.

### `CourseAiTutorPanel` — Tutor trong course
File: `src/components/course-ai/CourseAiTutorPanel.tsx`

Props: `courseTitle`, `lessonTitle?`, `className?`

Dùng ở:
- `src/pages/course-details/CourseDetail.tsx` — sidebar tab, khi user đang xem info khoá học (không có lesson cụ thể)
- `src/pages/learn/Learn.tsx` — sidebar tab, khi user đang học bài, truyền thêm `lessonTitle`

AI context: `"lesson"`. Khi AI được kết nối cần thêm `lessonId` vào props và truyền xuống hook.

### `DashboardAiAssistantPanel` — Copilot trên Home
File: `src/pages/home/components/DashboardAiAssistantPanel.tsx`

Props: `focusCards` (active courses), `courseCatalog`

Dùng ở: `src/pages/home/` (dashboard).

AI context: `"home"`. Hiển thị tiến độ active course + suggested course + suggestions. Khi AI được kết nối, body chuyển thành conversation history.

### `GlobalCoraAssistant` — Sticky assistant cho các trang còn lại
File: `src/components/course-ai/GlobalCoraAssistant.tsx`

Mounted trong `MainLayout.tsx` — luôn render trừ khi route đã có dedicated surface.

Hai dạng hiển thị:
- Desktop (≥ xl): fixed card bottom-right `(360px wide)`
- Mobile: FAB button → Sheet từ bottom

AI context: lấy từ `resolveAssistantContext(pathname)` — thay đổi theo route đang xem.

### `BinarySidebarTabs` — Tab switcher trong sidebar
File: `src/components/course-ai/BinarySidebarTabs.tsx`

Generic component. Dùng để switch giữa "Thông tin khoá" và "Cora AI Tutor" trong sidebar của CourseDetail + Learn.

### `context.ts` — Context types & surface metadata
File: `src/components/course-ai/context.ts`

Định nghĩa `AssistantContext` enum và mapping sang i18n keys + CTA actions.
Hàm `resolveAssistantContext(pathname)` là nguồn sự thật duy nhất cho việc route nào → context gì.

### `visibility.ts` — Quy tắc hiển thị GlobalCoraAssistant
File: `src/components/course-ai/visibility.ts`

Ba hàm:
- `hasDedicatedCoraSurface(pathname)` — true khi trang đã có Cora panel riêng (home, course detail, learn)
- `isLearnerFacingAiRoute(pathname)` — true khi trang này benefit từ global assistant
- `shouldShowGlobalCoraAssistant(pathname)` — kết hợp 2 hàm trên

## 2.2 Quy tắc consistency của UI

`CoraShell` là nền tảng chung. Mọi surface đều dùng cùng:
- Logo `Cora_AI_Tutor.svg`
- Status chip (hiện: "UI preview", sau: "● Live")
- Input footer với textarea
- Suggestion chips pattern

Chỉ thay đổi `body` theo từng surface. Khi AI được kết nối, body chuyển từ "static cards + suggestions" sang "conversation history + suggestions khi chat trống".

## 2.3 Thứ tự ưu tiên surface

```
Route "/"              → DashboardAiAssistantPanel (in-page, không có global)
Route "/courses/:slug" → CourseAiTutorPanel in sidebar (không có global)
Route "/learn/:..."    → CourseAiTutorPanel in sidebar (không có global)
Tất cả route khác      → GlobalCoraAssistant (sticky card / FAB)
  - /courses, /search
  - /career, /career/:...
  - /hackathons, /hackathons/:...
  - /projects
  - /achievements
  - /account, /account/:...
  - /u/:username
```

---

# 3. AssistantContext & Surface Map

## 3.1 AssistantContext type (từ `context.ts`)

```typescript
export type AssistantContext =
  | "home"          // Dashboard — tiến độ học, gợi ý tiếp theo
  | "courses"       // Thư viện khoá học — tìm/so sánh khoá
  | "career"        // Career tracks — chọn lộ trình
  | "hackathons"    // Hackathon/activities — gợi ý tham gia
  | "projects"      // Projects — bước tiếp theo
  | "achievements"  // Thành tích + chứng chỉ
  | "search"        // Tìm kiếm — refine query
  | "profile"       // Hồ sơ công khai của user khác
  | "account"       // Account settings của chính mình
  | "default";      // Fallback
```

Context `"lesson"` không nằm trong enum này vì `CourseAiTutorPanel` luôn có `courseTitle` + `lessonTitle` — lesson context được implicit qua props, không qua pathname. Backend nhận `assistantContext: "lesson"` khi có `lessonId`.

## 3.2 Backend context_type

Mapping từ UI context sang backend `context_type` trong DB:

| AssistantContext (UI) | backend context_type | Dữ liệu cần load |
|-----------------------|---------------------|-----------------|
| (implicit: lessonId có) | `"lesson"` | lesson + course + progress |
| `"home"` | `"dashboard"` | enrolled courses, completions, streak |
| `"courses"` / `"search"` | `"course_discovery"` | user goal + interests, course catalog RAG |
| `"career"` | `"career"` | track interest, user level, track metadata |
| `"hackathons"` / `"projects"` | `"activity"` | user level, active skills |
| `"achievements"` / `"account"` / `"profile"` | `"profile_review"` | credentials, badges, completion rate |
| `"default"` | `"global"` | user profile summary chỉ |

## 3.3 Data mỗi context cần

### context_type: lesson
- Lesson: title, topic, concepts, level, content_type, youtube info
- Course: title, author, author_type, track
- User: progress %, streak
- RAG: knowledge_chunks theo lesson.topic

### context_type: dashboard
- Enrolled courses + completion % của từng khoá
- Total lessons completed / total
- User: level, goal, streak, weak_topics, strong_topics
- RAG: không cần

### context_type: course_discovery
- User: goal, track_interest, category_interests, level
- RAG: knowledge_chunks với content_category = 'course_catalog'

### context_type: career
- User: level, track_interest
- RAG: knowledge_chunks với content_category = 'career_track' (track descriptions, prerequisites)

### context_type: activity
- User: level, active skills (inferred từ enrolled courses)
- RAG: knowledge_chunks với content_category = 'activity' (hackathon/project guides)

### context_type: profile_review
- User: credentials, badge list, completion rate, total questions asked
- Learning profile: strong/weak topics, ai_summary
- RAG: không cần

### context_type: global
- User: level, goal, streak
- RAG: không cần (generic assistant)

---

# 4. Provider Abstraction Layer

## 4.1 Tại sao cần abstraction

Không hardcode Anthropic vào business logic. Cần switch provider vì:
- Pricing thay đổi → migrate không cần redeploy
- Provider downtime → fallback tức thì
- Admin switch qua UI, không touch code

## 4.2 Provider Config — Supabase

```sql
create table ai_provider_config (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null check (provider in ('anthropic', 'openai')),
  is_active     boolean default false,
  simple_model  text not null,
  complex_model text not null,
  updated_at    timestamptz default now(),
  updated_by    uuid references auth.users(id)
);

create unique index one_active_provider
  on ai_provider_config(is_active)
  where is_active = true;

insert into ai_provider_config (provider, is_active, simple_model, complex_model) values
  ('anthropic', true,
   'claude-haiku-4-5-20251001', 'claude-sonnet-4-6'),
  ('openai', false,
   'gpt-4o-mini', 'gpt-4o');

create table ai_provider_audit (
  id          uuid primary key default gen_random_uuid(),
  changed_to  text not null,
  changed_by  uuid references auth.users(id),
  reason      text,
  created_at  timestamptz default now()
);

alter table ai_provider_config enable row level security;
create policy "admin_write" on ai_provider_config for all
  using (exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));
```

## 4.3 Provider Adapter

```typescript
// supabase/functions/ai-tutor/provider.ts

export type Provider = 'anthropic' | 'openai';

export interface ProviderConfig {
  provider: Provider;
  simpleModel: string;
  complexModel: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

let _cachedConfig: ProviderConfig | null = null;

export async function getProviderConfig(supabase): Promise<ProviderConfig> {
  if (_cachedConfig) return _cachedConfig;

  const { data } = await supabase
    .from('ai_provider_config')
    .select('provider, simple_model, complex_model')
    .eq('is_active', true)
    .single();

  _cachedConfig = {
    provider:     data?.provider      || 'anthropic',
    simpleModel:  data?.simple_model  || 'claude-haiku-4-5-20251001',
    complexModel: data?.complex_model || 'claude-sonnet-4-6',
  };

  setTimeout(() => { _cachedConfig = null; }, 60_000);
  return _cachedConfig;
}

export async function streamAI(
  config: ProviderConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  onDelta: (text: string) => void,
  onDone: (totalTokens: number) => void
): Promise<void> {
  return config.provider === 'anthropic'
    ? _streamAnthropic(systemPrompt, messages, model, maxTokens, onDelta, onDone)
    : _streamOpenAI(systemPrompt, messages, model, maxTokens, onDelta, onDone);
}

async function _streamAnthropic(systemPrompt, messages, model, maxTokens, onDelta, onDone) {
  const { default: Anthropic } = await import('npm:@anthropic-ai/sdk@0.27.0');
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  const stream = client.messages.stream({
    model, max_tokens: maxTokens, system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content }))
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      onDelta(chunk.delta.text);
    }
  }
  const final = await stream.finalMessage();
  onDone(final.usage.input_tokens + final.usage.output_tokens);
}

async function _streamOpenAI(systemPrompt, messages, model, maxTokens, onDelta, onDone) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')!}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens, stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ]
    })
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let totalTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data:'));
    for (const line of lines) {
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
        if (parsed.usage) {
          totalTokens = parsed.usage.prompt_tokens + parsed.usage.completion_tokens;
        }
      } catch { /* ignore */ }
    }
  }
  onDone(totalTokens);
}
```

## 4.4 Model Cost Tracking

```typescript
// supabase/functions/ai-tutor/models.ts

export const MODEL_COST_PER_1M: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.00,  output: 5.00  },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'gpt-4o-mini':               { input: 0.15,  output: 0.60  },
  'gpt-4o':                    { input: 2.50,  output: 10.00 },
};

export function estimateCost(model: string, input: number, output: number): number {
  const r = MODEL_COST_PER_1M[model] || { input: 0, output: 0 };
  return (input / 1_000_000) * r.input + (output / 1_000_000) * r.output;
}
```

## 4.5 Secrets Setup

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENAI_API_KEY=sk-proj-...
```

---

# 5. Model Selection & Routing

## 5.1 Routing Logic

```typescript
// supabase/functions/ai-tutor/router.ts

type QuestionComplexity = 'simple' | 'medium' | 'complex';

interface RoutingResult {
  model: string;
  maxTokens: number;
  complexity: QuestionComplexity;
}

function classifyByRules(message: string): QuestionComplexity | null {
  const lower = message.toLowerCase();

  const simplePatterns = [
    /^(là gì|what is|what's|định nghĩa|explain)\b/i,
    /^(cho.*(ví dụ|example))/i,
    /syntax.*của/i,
    /cú pháp/i,
    /tóm tắt bài/i,
    /^(cảm ơn|thanks|ok|được rồi)/i,
    /nên học gì tiếp/i,
    /khoá nào phù hợp/i,
    /mình đang ở đâu/i,
  ];
  if (simplePatterns.some(p => p.test(lower))) return 'simple';

  const complexPatterns = [
    /debug|lỗi|error|không chạy|fix|bug/i,
    /review.*code|code.*review/i,
    /tại sao.*không|why.*not|why.*doesn't/i,
    /architecture|kiến trúc|design pattern/i,
    /optimize|tối ưu|performance/i,
    /smart contract|blockchain|solidity|move|soroban/i,
    /machine learning|neural network|transformer|embedding/i,
    /so sánh.*và|compare.*and|difference between/i,
  ];
  if (complexPatterns.some(p => p.test(lower))) return 'complex';

  if (message.includes('```') || message.split('\n').length > 5) return 'complex';
  if (message.length > 300) return 'complex';

  return null;
}

async function classifyByAI(message: string, anthropic): Promise<QuestionComplexity> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [{
      role: 'user',
      content: `Classify this question: "${message}"
Reply with exactly one word: simple, medium, or complex.
- simple: definitions, syntax, basic examples, navigation questions
- medium: how-to, comparisons, follow-up questions
- complex: debugging, code review, architecture, advanced concepts`
    }]
  });

  const result = response.content[0].type === 'text'
    ? response.content[0].text.trim().toLowerCase()
    : 'medium';

  return (result as QuestionComplexity) || 'medium';
}

export async function routeToModel(
  message: string,
  userTier: string,
  providerConfig: ProviderConfig,
  anthropic
): Promise<RoutingResult> {
  if (userTier === 'free' || userTier === 'student') {
    return { model: providerConfig.simpleModel, maxTokens: 500, complexity: 'simple' };
  }

  let complexity = classifyByRules(message);
  if (!complexity) {
    complexity = await classifyByAI(message, anthropic);
  }

  return {
    simple:  { model: providerConfig.simpleModel,  maxTokens: 400, complexity: 'simple'  },
    medium:  { model: providerConfig.simpleModel,  maxTokens: 600, complexity: 'medium'  },
    complex: { model: providerConfig.complexModel, maxTokens: 1000, complexity: 'complex' },
  }[complexity];
}
```

**Kết quả dự kiến:**
```
~65% câu hỏi → Haiku (simple/medium) — định nghĩa, gợi ý, navigation
~35% câu hỏi → Sonnet (complex) — debug, review code, so sánh sâu
Cost reduction: 55-65% so với dùng Sonnet toàn bộ
```

---

# 6. Database Schema

## 6.1 Full Migration

```sql
-- ── Extensions ────────────────────────────────────────────────────────
create extension if not exists vector;

-- ── Courses ───────────────────────────────────────────────────────────
alter table courses add column if not exists
  author_type text default 'community'
  check (author_type in ('corelia', 'community', 'self'));
alter table courses add column if not exists track text;
alter table courses add column if not exists category text;
alter table courses add column if not exists subcategory text;

-- ── Chapters ──────────────────────────────────────────────────────────
create table if not exists chapters (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid references courses(id) on delete cascade,
  title       text not null,
  order_index int default 0,
  created_at  timestamptz default now()
);

-- ── Lessons ───────────────────────────────────────────────────────────
create table if not exists lessons (
  id               uuid primary key default gen_random_uuid(),
  chapter_id       uuid references chapters(id) on delete cascade,
  course_id        uuid references courses(id) on delete cascade,
  title            text not null,
  topic            text not null,
  concepts         text[] default '{}',
  level            text default 'beginner',
  content_type     text default 'video_youtube'
                   check (content_type in ('video_youtube','video_upload','text','mixed')),
  youtube_url      text,
  youtube_channel  text,
  youtube_title    text,
  timestamp_start  int,
  timestamp_end    int,
  text_content     text,
  order_index      int default 0,
  has_progress     boolean default false,
  created_at       timestamptz default now()
);

-- ── Lesson Progress ────────────────────────────────────────────────────
create table if not exists lesson_completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  lesson_id    uuid references lessons(id) on delete cascade,
  course_id    uuid references courses(id) on delete cascade,
  completed_at timestamptz default now(),
  unique(user_id, lesson_id)
);

-- ── AI Chat Sessions ───────────────────────────────────────────────────
-- Dùng để group messages thành threads có thể navigate lại.
-- Lesson context không cần session (dùng lesson_id là đủ để group).
-- Non-lesson context dùng session_id để phân biệt các cuộc trò chuyện.
create table ai_chat_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  context_type    text not null
                  check (context_type in (
                    'dashboard', 'course_discovery', 'career',
                    'activity', 'profile_review', 'global'
                  )),
  title           text,          -- tự generate từ tin nhắn đầu (optional)
  message_count   int default 0,
  last_message_at timestamptz default now(),
  created_at      timestamptz default now()
);

create index ai_chat_sessions_user_idx
  on ai_chat_sessions(user_id, context_type, last_message_at desc);

-- ── AI Conversations ───────────────────────────────────────────────────
-- lesson_id nullable: lesson context truyền lesson_id, global context truyền session_id.
-- Hai field không thể đồng thời có giá trị.
create table ai_conversations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  lesson_id        uuid references lessons(id) on delete cascade,      -- lesson context
  session_id       uuid references ai_chat_sessions(id) on delete cascade, -- non-lesson
  context_type     text not null default 'lesson'
                   check (context_type in (
                     'lesson', 'dashboard', 'course_discovery',
                     'career', 'activity', 'profile_review', 'global'
                   )),
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  model_used       text,
  complexity       text,
  tokens_used      int default 0,
  cached           boolean default false,
  created_at       timestamptz default now(),
  check (
    (lesson_id is not null and session_id is null) or
    (lesson_id is null and session_id is not null)
  )
);

create index ai_conversations_lesson_idx
  on ai_conversations(user_id, lesson_id, created_at desc)
  where lesson_id is not null;

create index ai_conversations_session_idx
  on ai_conversations(session_id, created_at desc)
  where session_id is not null;

-- ── Daily Usage (Quota) ────────────────────────────────────────────────
create table ai_usage_daily (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  date          date not null default current_date,
  message_count int default 0,
  tokens_used   int default 0,
  cost_usd      numeric(10,6) default 0,
  unique(user_id, date)
);

-- ── Tier Limits ────────────────────────────────────────────────────────
create table tier_limits (
  tier            text primary key,
  daily_messages  int,
  haiku_only      boolean default true,
  label_vi        text,
  label_en        text
);

insert into tier_limits values
  ('free',      5,   true,  'Miễn phí', 'Free'),
  ('student',   50,  true,  'Học viên', 'Student'),
  ('pro',       200, false, 'Pro',       'Pro'),
  ('bootcamp',  999, false, 'Bootcamp',  'Bootcamp')
on conflict do nothing;

-- ── Knowledge Base (RAG) ───────────────────────────────────────────────
-- content_category phân biệt loại knowledge để RAG đúng theo context.
create table knowledge_chunks (
  id               uuid primary key default gen_random_uuid(),
  topic            text not null,
  subtopic         text,
  content          text not null,
  embedding        vector(1536),
  source           text default 'corelia',
  track            text,
  content_category text default 'lesson'
                   check (content_category in (
                     'lesson',         -- giải thích concept trong bài học
                     'course_catalog', -- metadata khoá học (title, desc, track, level)
                     'career_track',   -- mô tả track, prerequisites, outcomes
                     'activity',       -- hackathon/project guides
                     'platform_guide'  -- hướng dẫn dùng platform
                   )),
  created_at       timestamptz default now()
);

create index knowledge_embedding_idx
  on knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ── User Learning Profile (Long-term Memory) ──────────────────────────
create table user_learning_profile (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade unique,
  weak_topics     text[] default '{}',
  strong_topics   text[] default '{}',
  common_mistakes jsonb  default '[]',
  learning_style  text,
  ai_summary      text,
  total_questions int default 0,
  updated_at      timestamptz default now()
);

create table learning_observations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  lesson_id   uuid references lessons(id),
  session_id  uuid references ai_chat_sessions(id),
  topic       text,
  observation text,
  insight     text,
  created_at  timestamptz default now()
);

-- ── Profiles (thêm columns) ───────────────────────────────────────────
alter table profiles add column if not exists
  tier text default 'free' check (tier in ('free','student','pro','bootcamp'));
alter table profiles add column if not exists
  user_level text default 'beginner';
alter table profiles add column if not exists
  track_interest text;
alter table profiles add column if not exists
  category_interests text[] default '{}';
alter table profiles add column if not exists
  user_goal text;
alter table profiles add column if not exists
  streak_days int default 0;
alter table profiles add column if not exists
  onboarding_completed boolean default false;

-- ── RLS Policies ──────────────────────────────────────────────────────
alter table ai_chat_sessions       enable row level security;
alter table ai_conversations       enable row level security;
alter table ai_usage_daily         enable row level security;
alter table knowledge_chunks       enable row level security;
alter table user_learning_profile  enable row level security;
alter table learning_observations  enable row level security;

create policy "own_sessions"           on ai_chat_sessions       for all using (auth.uid() = user_id);
create policy "own_conversations"      on ai_conversations        for all using (auth.uid() = user_id);
create policy "own_usage"              on ai_usage_daily          for all using (auth.uid() = user_id);
create policy "own_profile"            on user_learning_profile   for all using (auth.uid() = user_id);
create policy "own_observations"       on learning_observations   for all using (auth.uid() = user_id);
create policy "knowledge_public_read"  on knowledge_chunks        for select using (true);
```

---

# 7. Cora — System Prompt

## 7.1 Master Prompt Template (base — dùng cho mọi context)

```
You are Cora — the AI Tutor of Corelia Academy, a hands-on programming education
platform for developers, incubated by OpenCampus with on-chain credentials via EDU Chain.

━━━ LEARNER ━━━
Name: {{user_name}}
Self-assessed level: {{user_level}}
Goal: {{user_goal || "Not specified"}}
Streak: {{streak_days}} days{{streak_days >= 7 ? " 🔥" : ""}}

{{— context block được inject theo surface bên dưới —}}

{{— long-term memory block nếu có —}}

━━━ RULES ━━━
• Reply in the same language the user writes in (Vietnamese or English)
• Friendly mentor tone — practical over theoretical
• Code always in markdown code blocks with correct language tag
• Under 250 words unless debugging or code review
• After long answers → suggest one hands-on action
• Never make things up — say so if unsure
• Never judge skill level
```

## 7.2 Context Block: Lesson (CourseAiTutorPanel)

Inject khi `context_type = "lesson"`.

```
━━━ CURRENT LESSON ━━━
Course: {{course_title}} (by {{course_author}} · {{course_author_type}})
Track: {{track}}
Lesson: {{lesson_title}}
Topic: {{lesson_topic}}
Concepts: {{concepts.join(', ')}}
Content type: {{content_type}}
Level: {{level}}
Progress: {{progress}}% through the course

{{content_type === 'video_youtube' ?
"━━━ VIDEO CONTEXT ━━━
YouTube: \"{{youtube_title}}\" by {{youtube_channel}}
You do NOT have the transcript. Explain from your own knowledge.
Bridge the language gap and deepen understanding beyond the video." : ""}}

{{course_author_type === 'self' ?
"━━━ NOTE ━━━
This is {{user_name}}'s own course. Act as a study partner." : ""}}
{{course_author_type === 'community' ?
"━━━ NOTE ━━━
Community course — respect the author's approach. No negative remarks." : ""}}

Your role: lesson tutor. Use Socratic method for debugging.
Never spoil quiz/exercise answers — ask leading questions instead.
```

## 7.3 Context Block: Dashboard (DashboardAiAssistantPanel)

Inject khi `context_type = "dashboard"`.

```
━━━ LEARNING OVERVIEW ━━━
Active courses: {{active_courses.map(c => c.title + " (" + c.progress + "%)").join(' | ')}}
Total lessons completed: {{total_completed}} / {{total_lessons}}
Currently enrolled: {{enrolled_count}} courses

Your role: learning progress advisor.
Help the user understand where they are, what to prioritize, and how to reach their goal.
Be specific — reference actual course names and numbers when relevant.
```

## 7.4 Context Block: Course Discovery (GlobalCoraAssistant — courses/search routes)

Inject khi `context_type = "course_discovery"`.

```
━━━ PLATFORM CONTEXT ━━━
You have access to Corelia's course catalog below.
Help the user find courses matching their goal, level, and interests.

User interests: {{category_interests.join(', ') || "not specified"}}
Track preference: {{track_interest || "exploring"}}

━━━ COURSE CATALOG ━━━
{{rag_course_results}}

Your role: course discovery advisor.
Make specific recommendations. Name exact courses. Explain tradeoffs.
```

## 7.5 Context Block: Career Advisor (GlobalCoraAssistant — career routes)

Inject khi `context_type = "career"`.

```
━━━ CAREER CONTEXT ━━━
Available tracks: App Development · AI Development · Blockchain & Web3
User's current track interest: {{track_interest || "undecided"}}

━━━ TRACK INFORMATION ━━━
{{rag_track_results}}

Your role: career path advisor.
Help the user choose a track, understand prerequisites, and plan their learning path.
```

## 7.6 Context Block: Activity Advisor (GlobalCoraAssistant — hackathons/projects)

Inject khi `context_type = "activity"`.

```
━━━ ACTIVITY CONTEXT ━━━
User level: {{user_level}}
Skills being built (from enrolled courses): {{active_skills.join(', ') || "not specified"}}

Your role: activity advisor.
Help the user find suitable hackathons/projects and prepare for them.
Reference their current skill level honestly — don't oversell what they're ready for.
```

## 7.7 Context Block: Profile Review (achievements/account/profile routes)

Inject khi `context_type = "profile_review"`.

```
━━━ LEARNING PROFILE ━━━
Courses completed: {{completed_courses_count}}
Completion rate: {{completion_rate}}%
Credentials earned: {{credential_count}}
Questions asked to Cora: {{total_ai_questions}}

Strong topics: {{strong_topics.join(', ') || "not enough data yet"}}
Topics to improve: {{weak_topics.join(', ') || "not enough data yet"}}

Your role: profile advisor.
Explain achievements, identify gaps, and suggest next steps to strengthen the profile.
```

## 7.8 Long-term Memory Block (inject thêm vào mọi context khi profile tồn tại)

```
━━━ LEARNING HISTORY ━━━
{{ai_summary}}
Strong: {{strong_topics.join(', ')}}
Needs attention: {{weak_topics.join(', ')}}
Learning style: {{learning_style || "unknown"}}
→ Adapt your explanation style accordingly.
```

## 7.9 Prompt Builder (TypeScript)

```typescript
// supabase/functions/ai-tutor/prompt-builder.ts

export type BackendContextType =
  | 'lesson'
  | 'dashboard'
  | 'course_discovery'
  | 'career'
  | 'activity'
  | 'profile_review'
  | 'global';

export interface UserBase {
  userName: string;
  userLevel: string;
  userGoal?: string;
  streakDays: number;
  trackInterest?: string;
  categoryInterests?: string[];
}

export interface LessonData {
  courseTitle: string;
  courseAuthorName: string;
  courseAuthorType: 'corelia' | 'community' | 'self';
  track: string;
  lessonTitle: string;
  lessonTopic: string;
  concepts: string[];
  contentType: string;
  youtubeChannel?: string;
  youtubeTitle?: string;
  level: string;
  progress: number;
}

export interface DashboardData {
  activeCourses: { title: string; progress: number }[];
  totalCompleted: number;
  totalLessons: number;
  enrolledCount: number;
}

export interface ProfileData {
  completedCoursesCount: number;
  completionRate: number;
  credentialCount: number;
  totalAiQuestions: number;
}

export interface LearningProfile {
  aiSummary?: string;
  strongTopics?: string[];
  weakTopics?: string[];
  learningStyle?: string;
}

export function buildSystemPrompt(params: {
  contextType: BackendContextType;
  user: UserBase;
  profile: LearningProfile | null;
  knowledge: string[];
  lessonData?: LessonData;
  dashboardData?: DashboardData;
  profileData?: ProfileData;
  activeSkills?: string[];
}): string {
  const { contextType, user, profile, knowledge } = params;

  let prompt = `You are Cora — the AI Tutor of Corelia Academy, a hands-on programming education platform for developers, incubated by OpenCampus with on-chain credentials via EDU Chain.

━━━ LEARNER ━━━
Name: ${user.userName}
Level: ${user.userLevel}
Goal: ${user.userGoal || 'Not specified'}
Streak: ${user.streakDays} days${user.streakDays >= 7 ? ' 🔥' : ''}`;

  // ── Context block per surface ────────────────────────────────────────
  if (contextType === 'lesson' && params.lessonData) {
    const l = params.lessonData;
    prompt += `\n\n━━━ CURRENT LESSON ━━━
Course: ${l.courseTitle} (by ${l.courseAuthorName} · ${l.courseAuthorType})
Track: ${l.track}
Lesson: ${l.lessonTitle}
Topic: ${l.lessonTopic}
Concepts: ${l.concepts.join(', ')}
Level: ${l.level}
Progress: ${l.progress}% through the course`;

    if (l.contentType === 'video_youtube') {
      prompt += `\n\n━━━ VIDEO CONTEXT ━━━
YouTube: "${l.youtubeTitle}" by ${l.youtubeChannel}
You do NOT have the transcript. Explain from your own knowledge.
Bridge the language gap and deepen understanding beyond the video.`;
    }

    if (l.courseAuthorType === 'self') {
      prompt += `\n\n━━━ NOTE ━━━
This is ${user.userName}'s own course. Act as a study partner.`;
    } else if (l.courseAuthorType === 'community') {
      prompt += `\n\n━━━ NOTE ━━━
Community course — respect the author's approach. No negative remarks.`;
    }

    prompt += `\n\nYour role: lesson tutor. Use Socratic method for debugging. Never spoil quiz/exercise answers.`;
  }

  else if (contextType === 'dashboard' && params.dashboardData) {
    const d = params.dashboardData;
    const courseList = d.activeCourses.map(c => `${c.title} (${c.progress}%)`).join(' | ');
    prompt += `\n\n━━━ LEARNING OVERVIEW ━━━
Active courses: ${courseList || 'none yet'}
Total lessons completed: ${d.totalCompleted} / ${d.totalLessons}
Currently enrolled: ${d.enrolledCount} courses

Your role: learning progress advisor. Reference actual course names when relevant.`;
  }

  else if (contextType === 'course_discovery') {
    prompt += `\n\n━━━ PLATFORM CONTEXT ━━━
Help the user find courses matching their goal, level, and interests.
User interests: ${user.categoryInterests?.join(', ') || 'not specified'}
Track preference: ${user.trackInterest || 'exploring'}`;
    if (knowledge.length > 0) {
      prompt += `\n\n━━━ COURSE CATALOG ━━━\n${knowledge.join('\n---\n')}`;
    }
    prompt += `\n\nYour role: course discovery advisor. Make specific recommendations by name.`;
  }

  else if (contextType === 'career') {
    prompt += `\n\n━━━ CAREER CONTEXT ━━━
Available tracks: App Development · AI Development · Blockchain & Web3
User's track interest: ${user.trackInterest || 'undecided'}`;
    if (knowledge.length > 0) {
      prompt += `\n\n━━━ TRACK INFORMATION ━━━\n${knowledge.join('\n---\n')}`;
    }
    prompt += `\n\nYour role: career path advisor. Help choose a track and plan learning path.`;
  }

  else if (contextType === 'activity') {
    prompt += `\n\n━━━ ACTIVITY CONTEXT ━━━
Skills being built: ${params.activeSkills?.join(', ') || 'not specified'}

Your role: activity advisor. Match activities to current skill level honestly.`;
  }

  else if (contextType === 'profile_review' && params.profileData) {
    const p = params.profileData;
    prompt += `\n\n━━━ LEARNING PROFILE ━━━
Courses completed: ${p.completedCoursesCount}
Completion rate: ${p.completionRate}%
Credentials earned: ${p.credentialCount}
Questions asked to Cora: ${p.totalAiQuestions}
Strong topics: ${profile?.strongTopics?.join(', ') || 'not enough data yet'}
Topics to improve: ${profile?.weakTopics?.join(', ') || 'not enough data yet'}

Your role: profile advisor. Explain achievements, identify gaps, suggest next steps.`;
  }

  // ── Long-term memory (all contexts) ─────────────────────────────────
  if (profile?.aiSummary) {
    prompt += `\n\n━━━ LEARNING HISTORY ━━━
${profile.aiSummary}
Strong: ${profile.strongTopics?.join(', ') || 'none yet'}
Needs attention: ${profile.weakTopics?.join(', ') || 'none yet'}
Style: ${profile.learningStyle || 'unknown'}
→ Adapt your explanation accordingly.`;
  }

  // ── Non-lesson RAG knowledge ─────────────────────────────────────────
  if (contextType !== 'lesson' && contextType !== 'course_discovery' && contextType !== 'career' && knowledge.length > 0) {
    prompt += `\n\n━━━ REFERENCE ━━━\n${knowledge.join('\n---\n')}`;
  }

  prompt += `\n\n━━━ RULES ━━━
• Reply in the same language the user writes in
• Friendly mentor tone — practical over theoretical
• Code always in markdown code blocks with correct language tag
• Under 250 words unless debugging or code review
• After long answers → suggest one hands-on action
• Never make things up — say so if unsure
• Never judge skill level`;

  return prompt;
}
```

---

# 8. Edge Functions

## 8.1 Main: ai-tutor

```typescript
// supabase/functions/ai-tutor/index.ts

import Anthropic from 'npm:@anthropic-ai/sdk@0.27.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildSystemPrompt, type BackendContextType } from './prompt-builder.ts';
import { routeToModel } from './router.ts';
import { getProviderConfig, streamAI } from './provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // ── 1. Auth ────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse('unauthorized', 401, corsHeaders);

    // ── 2. Parse request ───────────────────────────────────────────────
    // assistantContext: từ context.ts AssistantContext → map sang BackendContextType
    // lessonId: optional, chỉ khi context là lesson
    // sessionId: optional, dùng cho non-lesson contexts (gửi từ client)
    const {
      message,
      assistantContext,  // AssistantContext từ frontend
      lessonId,          // optional: chỉ khi CourseAiTutorPanel
      sessionId,         // optional: client tạo/gửi cho non-lesson
      stream = true
    } = await req.json();

    if (!message?.trim()) return errorResponse('missing_message', 400, corsHeaders);

    // Map AssistantContext → BackendContextType
    const contextType: BackendContextType = lessonId
      ? 'lesson'
      : mapAssistantContext(assistantContext);

    // ── 3. Quota check ─────────────────────────────────────────────────
    const quota = await checkAndIncrementQuota(supabase, user.id);
    if (!quota.allowed) {
      return new Response(JSON.stringify({
        error: 'quota_exceeded',
        used: quota.used,
        limit: quota.limit,
        tier: quota.tier
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 4. Load context (branches theo contextType) ────────────────────
    const [userProfile, learningProfile, history, contextData] = await Promise.all([
      loadUserProfile(supabase, user.id),
      loadLearningProfile(supabase, user.id),
      loadConversationHistory(supabase, user.id, { lessonId, sessionId }),
      loadContextData(supabase, user.id, contextType, lessonId),
    ]);

    // ── 5. RAG search ──────────────────────────────────────────────────
    const knowledge = await searchKnowledge(supabase, message, contextType, contextData);

    // ── 6. Route model ─────────────────────────────────────────────────
    const providerConfig = await getProviderConfig(supabase);
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
    const routing = await routeToModel(message, quota.tier, providerConfig, anthropic);

    // ── 7. Build system prompt ─────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      contextType,
      user: userProfile,
      profile: learningProfile,
      knowledge,
      ...contextData,
    });

    const messages = [
      ...history,
      { role: 'user' as const, content: message }
    ];

    // ── 8. Stream AI ───────────────────────────────────────────────────
    let fullResponse = '';
    let totalTokens = 0;

    const readable = new ReadableStream({
      async start(controller) {
        await streamAI(
          providerConfig,
          systemPrompt,
          messages,
          routing.model,
          routing.maxTokens,
          (delta) => {
            fullResponse += delta;
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ delta })}\n\n`
              )
            );
          },
          (tokens) => { totalTokens = tokens; }
        );

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();

        // ── 9. Save + async memory update ───────────────────────────
        await saveConversation(supabase, {
          userId: user.id,
          lessonId,
          sessionId,
          contextType,
          question: message,
          answer: fullResponse,
          tokens: totalTokens,
          routing,
        });
        updateLearningProfile(supabase, user.id, lessonId ?? sessionId, anthropic);
      }
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Cora error:', error);
    return errorResponse('internal_error', 500, corsHeaders);
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────

function mapAssistantContext(ctx: string): BackendContextType {
  const map: Record<string, BackendContextType> = {
    home:         'dashboard',
    courses:      'course_discovery',
    search:       'course_discovery',
    career:       'career',
    hackathons:   'activity',
    projects:     'activity',
    achievements: 'profile_review',
    account:      'profile_review',
    profile:      'profile_review',
    default:      'global',
  };
  return map[ctx] ?? 'global';
}

async function loadUserProfile(supabase, userId) {
  const { data } = await supabase.from('profiles')
    .select('display_name, tier, user_level, track_interest, category_interests, user_goal, streak_days')
    .eq('id', userId).single();
  return {
    userName:           data?.display_name || 'Learner',
    userLevel:          data?.user_level || 'beginner',
    userGoal:           data?.user_goal,
    streakDays:         data?.streak_days || 0,
    trackInterest:      data?.track_interest,
    categoryInterests:  data?.category_interests || [],
    tier:               data?.tier || 'free',
  };
}

async function loadLearningProfile(supabase, userId) {
  const { data } = await supabase.from('user_learning_profile')
    .select('ai_summary, strong_topics, weak_topics, learning_style')
    .eq('user_id', userId).single();
  return data;
}

async function loadConversationHistory(supabase, userId, {
  lessonId, sessionId
}: { lessonId?: string; sessionId?: string }) {
  const query = supabase.from('ai_conversations')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (lessonId) {
    query.eq('lesson_id', lessonId);
  } else if (sessionId) {
    query.eq('session_id', sessionId);
  } else {
    return [];
  }

  const { data } = await query;
  return (data || []).reverse().map(m => ({ role: m.role, content: m.content }));
}

async function loadContextData(supabase, userId, contextType: BackendContextType, lessonId?: string) {
  if (contextType === 'lesson' && lessonId) {
    const [{ data: lessonData }, enrollmentData] = await Promise.all([
      supabase.from('lessons').select(`
        title, topic, concepts, level, content_type,
        youtube_channel, youtube_title,
        course:courses(id, title, author_name, author_type, track)
      `).eq('id', lessonId).single(),
      null
    ]);

    const courseId = lessonData?.course?.id;
    const [{ count: completed }, { count: total }] = await Promise.all([
      supabase.from('lesson_completions').select('*', { count: 'exact', head: true })
        .eq('user_id', userId).eq('course_id', courseId),
      supabase.from('lessons').select('*', { count: 'exact', head: true })
        .eq('course_id', courseId)
    ]);

    return {
      lessonData: {
        courseTitle:      lessonData?.course?.title,
        courseAuthorName: lessonData?.course?.author_name || 'Community',
        courseAuthorType: lessonData?.course?.author_type || 'community',
        track:            lessonData?.course?.track,
        lessonTitle:      lessonData?.title,
        lessonTopic:      lessonData?.topic,
        concepts:         lessonData?.concepts || [],
        contentType:      lessonData?.content_type,
        youtubeChannel:   lessonData?.youtube_channel,
        youtubeTitle:     lessonData?.youtube_title,
        level:            lessonData?.level,
        progress:         total ? Math.round((completed / total) * 100) : 0,
      }
    };
  }

  if (contextType === 'dashboard') {
    const { data: enrollments } = await supabase
      .from('lesson_completions')
      .select('course_id, courses(title)')
      .eq('user_id', userId);

    const courseProgress: Record<string, { title: string; completed: number }> = {};
    (enrollments || []).forEach((e: any) => {
      const id = e.course_id;
      if (!courseProgress[id]) courseProgress[id] = { title: e.courses?.title || '', completed: 0 };
      courseProgress[id].completed++;
    });

    const { data: totals } = await supabase
      .from('lessons')
      .select('course_id', { count: 'exact' })
      .in('course_id', Object.keys(courseProgress));

    const totalByCtotal: Record<string, number> = {};
    (totals || []).forEach((t: any) => {
      totalByCtotal[t.course_id] = (totalByCtotal[t.course_id] || 0) + 1;
    });

    const activeCourses = Object.entries(courseProgress)
      .map(([id, c]) => ({
        title: c.title,
        progress: Math.round((c.completed / (totalByCtotal[id] || 1)) * 100)
      }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 5);

    return {
      dashboardData: {
        activeCourses,
        totalCompleted: enrollments?.length || 0,
        totalLessons: Object.values(totalByCtotal).reduce((s, v) => s + v, 0),
        enrolledCount: Object.keys(courseProgress).length,
      }
    };
  }

  if (contextType === 'activity') {
    const { data: enrollments } = await supabase
      .from('lesson_completions')
      .select('lessons(topic, concepts)')
      .eq('user_id', userId)
      .limit(30);

    const skillSet = new Set<string>();
    (enrollments || []).forEach((e: any) => {
      if (e.lessons?.topic) skillSet.add(e.lessons.topic);
      (e.lessons?.concepts || []).forEach((c: string) => skillSet.add(c));
    });

    return { activeSkills: [...skillSet].slice(0, 15) };
  }

  if (contextType === 'profile_review') {
    const { data: learning } = await supabase
      .from('user_learning_profile')
      .select('total_questions')
      .eq('user_id', userId).single();

    const [{ count: completedCourses }, { count: totalCompletions }] = await Promise.all([
      supabase.rpc('count_completed_courses', { p_user_id: userId }),
      supabase.from('lesson_completions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

    return {
      profileData: {
        completedCoursesCount: completedCourses || 0,
        completionRate: 0,
        credentialCount: 0,
        totalAiQuestions: learning?.total_questions || 0,
      }
    };
  }

  return {};
}

async function searchKnowledge(supabase, message, contextType: BackendContextType, contextData: any) {
  const categoryMap: Partial<Record<BackendContextType, string>> = {
    lesson:           'lesson',
    course_discovery: 'course_catalog',
    career:           'career_track',
    activity:         'activity',
  };
  const category = categoryMap[contextType];
  if (!category) return [];

  const topic = contextData.lessonData?.lessonTopic;
  const query = supabase.from('knowledge_chunks')
    .select('content')
    .eq('content_category', category)
    .limit(3);

  if (category === 'lesson' && topic) {
    query.eq('topic', topic);
  }

  const { data } = await query;
  return (data || []).map((k: any) => k.content);
}

async function saveConversation(supabase, params: {
  userId: string;
  lessonId?: string;
  sessionId?: string;
  contextType: BackendContextType;
  question: string;
  answer: string;
  tokens: number;
  routing: any;
}) {
  const { userId, lessonId, sessionId, contextType, question, answer, tokens, routing } = params;
  const base = {
    user_id: userId,
    context_type: contextType,
    model_used: routing.model,
    complexity: routing.complexity,
    ...(lessonId ? { lesson_id: lessonId } : { session_id: sessionId })
  };

  await supabase.from('ai_conversations').insert([
    { ...base, role: 'user', content: question },
    { ...base, role: 'assistant', content: answer, tokens_used: tokens }
  ]);

  if (sessionId) {
    await supabase.from('ai_chat_sessions')
      .update({ message_count: supabase.rpc('increment', { x: 2 }), last_message_at: new Date().toISOString() })
      .eq('id', sessionId);
  }
}

async function checkAndIncrementQuota(supabase, userId) {
  const { data: profile } = await supabase.from('profiles')
    .select('tier').eq('id', userId).single();
  const tier = profile?.tier || 'free';

  const { data: limits } = await supabase.from('tier_limits')
    .select('daily_messages').eq('tier', tier).single();

  const today = new Date().toISOString().split('T')[0];
  const { data: usage } = await supabase.from('ai_usage_daily')
    .upsert({ user_id: userId, date: today, message_count: 0 }, { onConflict: 'user_id,date' })
    .select('message_count').single();

  const count = usage?.message_count || 0;
  const limit = limits?.daily_messages || 5;

  if (count >= limit) return { allowed: false, used: count, limit, tier };

  await supabase.from('ai_usage_daily')
    .update({ message_count: count + 1 })
    .eq('user_id', userId).eq('date', today);

  return { allowed: true, used: count, limit, tier };
}

function errorResponse(message: string, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

## 8.2 Async: update-learning-profile

```typescript
// supabase/functions/update-learning-profile/index.ts
// Trigger sau session (unmount lesson, close non-lesson chat)

Deno.serve(async (req) => {
  const { userId, lessonId, sessionId } = await req.json();

  const query = supabase.from('ai_conversations')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at')
    .limit(30);

  if (lessonId) query.eq('lesson_id', lessonId);
  else if (sessionId) query.eq('session_id', sessionId);

  const { data: messages } = await query;
  if (!messages || messages.length < 4) return new Response('ok');

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  const analysis = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Analyze this tutoring conversation. Return JSON only, no markdown:
{
  "weak_topics": ["topics the learner struggled with"],
  "strong_topics": ["topics the learner understood well"],
  "mistakes": [{"topic": "...", "mistake": "brief description"}],
  "learning_style": "needs_examples|prefers_theory|learns_by_doing|mixed|null",
  "summary": "2 sentences about this learner's pattern and needs"
}
Conversation:
${messages.map((m: any) => `${m.role}: ${m.content}`).join('\n').slice(0, 3000)}`
    }]
  });

  try {
    const text = analysis.content[0].type === 'text' ? analysis.content[0].text : '{}';
    const insights = JSON.parse(text.replace(/```json|```/g, '').trim());

    const { data: existing } = await supabase.from('user_learning_profile')
      .select('*').eq('user_id', userId).single();

    const mergeTopics = (a: string[] = [], b: string[] = []) =>
      [...new Set([...a, ...b])].slice(0, 20);

    await supabase.from('user_learning_profile').upsert({
      user_id: userId,
      weak_topics:    mergeTopics(existing?.weak_topics, insights.weak_topics),
      strong_topics:  mergeTopics(existing?.strong_topics, insights.strong_topics),
      common_mistakes: [...(existing?.common_mistakes || []), ...(insights.mistakes || [])].slice(0, 20),
      learning_style: insights.learning_style || existing?.learning_style,
      ai_summary:     insights.summary,
      total_questions: (existing?.total_questions || 0) + Math.floor(messages.length / 2),
      updated_at:     new Date().toISOString()
    }, { onConflict: 'user_id' });

  } catch (e) {
    console.error('Profile update failed:', e);
  }

  return new Response('ok');
});
```

---

# 9. Long-term Memory

## 9.1 Schema

Đã có trong Section 6: `user_learning_profile` + `learning_observations`.

`learning_observations` giờ có thêm `session_id` để track non-lesson observations.

## 9.2 Inject vào Prompt

Đã có trong `buildSystemPrompt()` — Section 7.

## 9.3 Trigger update từ React

```typescript
// Lesson context — trigger khi unmount Learn page
useEffect(() => {
  return () => {
    if (messages.length >= 4) {
      supabase.functions.invoke('update-learning-profile', {
        body: { userId: user.id, lessonId }
      });
    }
  };
}, []);

// Non-lesson context — trigger khi đóng GlobalCoraAssistant hoặc route change
useEffect(() => {
  return () => {
    if (messages.length >= 4 && sessionId) {
      supabase.functions.invoke('update-learning-profile', {
        body: { userId: user.id, sessionId }
      });
    }
  };
}, []);
```

---

# 10. React Integration — useCoraAI Hook

## 10.1 Hook chính

Hook duy nhất, dùng cho tất cả surfaces. Context + lessonId quyết định mode.

```typescript
// src/hooks/useCoraAI.ts

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { AssistantContext } from '@/components/course-ai/context';

export interface CoraMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  complexity?: string;
  isStreaming?: boolean;
  timestamp: Date;
}

export interface CoraQuotaInfo {
  used: number;
  limit: number;
  tier: string;
}

interface UseCoraAIOptions {
  assistantContext: AssistantContext;
  lessonId?: string;           // CourseAiTutorPanel: bắt buộc khi có lesson
  sessionId?: string;          // Non-lesson: tạo trước hoặc nhận từ hook
  autoCreateSession?: boolean; // default true cho non-lesson context
}

export function useCoraAI({
  assistantContext,
  lessonId,
  sessionId: externalSessionId,
  autoCreateSession = true,
}: UseCoraAIOptions) {
  const [messages, setMessages]     = useState<CoraMessage[]>([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [quota, setQuota]           = useState<CoraQuotaInfo | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [sessionId, setSessionId]   = useState<string | undefined>(externalSessionId);
  const streamingIdRef              = useRef<string | null>(null);

  // Load history khi mount
  useEffect(() => {
    if (lessonId || sessionId) {
      loadHistory();
    }
  }, [lessonId, sessionId]);

  // Auto-create session cho non-lesson context
  useEffect(() => {
    if (!lessonId && !sessionId && autoCreateSession) {
      createSession();
    }
  }, [lessonId]);

  const createSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const contextTypeMap: Record<string, string> = {
      home: 'dashboard', courses: 'course_discovery', search: 'course_discovery',
      career: 'career', hackathons: 'activity', projects: 'activity',
      achievements: 'profile_review', account: 'profile_review', profile: 'profile_review',
      default: 'global',
    };

    const { data } = await supabase.from('ai_chat_sessions').insert({
      user_id: user.id,
      context_type: contextTypeMap[assistantContext] ?? 'global',
    }).select('id').single();

    if (data?.id) setSessionId(data.id);
  };

  const loadHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const query = supabase.from('ai_conversations')
      .select('id, role, content, complexity, created_at')
      .eq('user_id', user.id)
      .order('created_at')
      .limit(20);

    if (lessonId) query.eq('lesson_id', lessonId);
    else if (sessionId) query.eq('session_id', sessionId);

    const { data } = await query;
    if (data) {
      setMessages(data.map(m => ({
        id: m.id, role: m.role, content: m.content,
        complexity: m.complexity, timestamp: new Date(m.created_at)
      })));
    }
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userMsg: CoraMessage = {
      id: crypto.randomUUID(), role: 'user', content, timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    streamingIdRef.current = assistantId;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: content,
            assistantContext,
            lessonId,
            sessionId,
            stream: true,
          })
        }
      );

      if (response.status === 429) {
        const data = await response.json();
        setError(`Hết quota hôm nay (${data.used}/${data.limit}). Reset lúc 00:00.`);
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        setIsLoading(false);
        return;
      }

      setMessages(prev => [...prev, {
        id: assistantId, role: 'assistant', content: '',
        isStreaming: true, timestamp: new Date()
      }]);

      const reader = response.body!.getReader();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = new TextDecoder().decode(value).split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') break;
          try {
            const { delta } = JSON.parse(raw);
            accumulated += delta;
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: accumulated } : m
            ));
          } catch { /* ignore */ }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m
      ));

    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
      setMessages(prev => prev.filter(m => m.id !== userMsg.id && m.id !== assistantId));
    } finally {
      setIsLoading(false);
      streamingIdRef.current = null;
    }
  }, [assistantContext, lessonId, sessionId, isLoading]);

  return { messages, isLoading, quota, error, sessionId, sendMessage };
}
```

## 10.2 Cách dùng trong từng surface

```typescript
// CourseAiTutorPanel — lesson context
const cora = useCoraAI({ assistantContext: 'default', lessonId });

// DashboardAiAssistantPanel — home context
const cora = useCoraAI({ assistantContext: 'home' });

// GlobalCoraAssistant — context theo route
const context = resolveAssistantContext(pathname);
const cora = useCoraAI({ assistantContext: context });
```

## 10.3 Wiring vào CoraShell

Khi AI connected, `body` của CoraShell render conversation history thay vì static cards:

```typescript
body={
  cora.messages.length > 0
    ? <ConversationHistory messages={cora.messages} />
    : <StaticContextCards {...} />  // current placeholder
}
footer={
  <>
    <textarea
      disabled={cora.isLoading || !sessionReady}
      value={input}
      onChange={e => setInput(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          cora.sendMessage(input);
          setInput('');
        }
      }}
      placeholder="Hỏi Cora điều gì đó…"
    />
    {cora.error && <p className="text-xs text-destructive">{cora.error}</p>}
  </>
}
```

## 10.4 Suggested Questions — dynamic theo context

```typescript
// src/lib/suggestedQuestions.ts

export function getSuggestedQuestions(params: {
  context: AssistantContext;
  lessonTopic?: string;
  userLevel?: string;
  activeCourseTitle?: string;
}): string[] {
  const { context, lessonTopic, userLevel, activeCourseTitle } = params;

  // Lesson context: suggestions liên quan đến bài học
  if (context === 'default' && lessonTopic) {
    return [
      `Giải thích "${lessonTopic}" đơn giản hơn`,
      `Cho mình xem ví dụ thực tế của ${lessonTopic}`,
      `Tóm tắt các điểm chính của bài này`,
      `Mình nên luyện tập gì tiếp sau bài này?`,
    ];
  }

  // Dùng i18n suggestions từ context.ts cho tất cả context còn lại
  // (đã có trong coraWidget.suggestions.{context})
  return [];
}
```

---

# 11. Quota & Cost System

> Phân tích chi tiết unit economics, pricing VND, và storage cost:
> **`docs/cora/CORA_MONETIZATION.md`**

## 11.1 Tier Configuration

Quota dùng **monthly cap** thay vì daily — tự nhiên hơn với learner behavior.

| Tier     | Msgs/tháng | Model                   | Giá/tháng (VND) |
|----------|-----------|-------------------------|-----------------|
| Free     | 50        | Haiku only              | 0               |
| Student  | 500       | Haiku only              | 99,000          |
| Pro      | 2,000     | Haiku + Sonnet routing  | 299,000         |
| Bootcamp | unlimited | Sonnet priority         | 1,990,000       |

Quota áp dụng cho **tất cả** surfaces (lesson + global cộng lại).

```sql
-- Schema: dùng ai_usage_monthly thay vì ai_usage_daily
-- (rename + change date column to month text "2026-05")
-- Xem migration details trong CORA_MONETIZATION.md Section 4.3
```

## 11.2 Gross Margin (tóm tắt)

```
Student  99,000 VND → cost ~8,985 VND  → margin 90.9% ✅
Pro     299,000 VND → cost ~29,860 VND → margin 90.0% ✅
Bootcamp 1,990,000 VND → cost ~90,350 VND → margin 95.5% ✅✅

Storage cost: ~$0/user (negligible ở dưới 100K users)
Full analysis: CORA_MONETIZATION.md Section 2-3
```

## 11.3 Analytics Queries

```sql
-- Context type distribution
select context_type, count(*) as total
from ai_conversations
where created_at > now() - interval '7 days'
group by context_type order by total desc;

-- Usage per surface today
select context_type, count(distinct user_id) as active_users, count(*) as messages
from ai_conversations
where created_at > current_date
group by context_type;

-- Top questions by context
select context_type, content, count(*) as freq
from ai_conversations
where role = 'user' and created_at > now() - interval '30 days'
group by context_type, content
order by freq desc limit 20;
```

---

# 12. Implementation Phases

## Phase 1 — DB Foundation
- [ ] Chạy full migration SQL (Section 6)
- [ ] Enable pgvector extension
- [ ] Tạo `ai_chat_sessions` table
- [ ] `ai_conversations.lesson_id` nullable + thêm `context_type`, `session_id`
- [ ] Insert `tier_limits` + `ai_provider_config` data

## Phase 2 — Edge Function Core
- [ ] Tạo `supabase/functions/ai-tutor/` với `index.ts`, `prompt-builder.ts`, `router.ts`, `provider.ts`
- [ ] Test lesson context (gọi từ `CourseAiTutorPanel` với `lessonId`)
- [ ] Test dashboard context (gọi từ `DashboardAiAssistantPanel`)
- [ ] Deploy + test via curl

## Phase 3 — Hook & Wiring
- [ ] Tạo `src/hooks/useCoraAI.ts`
- [ ] Wire vào `CourseAiTutorPanel` — bật textarea, hiện conversation
- [ ] Wire vào `DashboardAiAssistantPanel`
- [ ] Wire vào `GlobalCoraAssistant` — tạo session, bật input
- [ ] Error states: quota exceeded, network error

## Phase 4 — Non-lesson Contexts
- [ ] Seed `knowledge_chunks` với course catalog (`content_category = 'course_catalog'`)
- [ ] Seed career track metadata (`content_category = 'career_track'`)
- [ ] Test `course_discovery` context (GlobalCoraAssistant trên `/courses`)
- [ ] Test `career` context (GlobalCoraAssistant trên `/career`)

## Phase 5 — Memory & Optimization
- [ ] Deploy `update-learning-profile` function
- [ ] Trigger từ React khi unmount (lesson) hoặc route change (non-lesson)
- [ ] Onboarding flow 4 bước cho user mới (collect `user_goal`, `track_interest`, `user_level`)
- [ ] Semantic cache với pgvector embeddings (optional, sau khi có volume)

## Phase 6 — Monetization (xem `CORA_MONETIZATION.md`)
- [ ] Migration: `ai_subscriptions` table + `ai_usage_monthly` (rename từ daily)
- [ ] Backend: `handleAiSubscriptionCheckout` + `grant_access.ts` branch
- [ ] Frontend: `src/lib/payments.ts` mở rộng + `AccountCoraRoute`
- [ ] Route `/account/cora` — upgrade/renewal page
- [ ] Quota upsell UI khi 429
- [ ] Expiry cron job (downgrade sau hết hạn)

---

# 13. Cost Model

> Phân tích đầy đủ (bao gồm storage, payment processing fee, VND pricing, break-even):
> **`docs/cora/CORA_MONETIZATION.md`**

```
500 active users (tóm tắt):
  100 Free     → 225,000 VND AI cost/month    | revenue: 0
  300 Student  → 2,695,500 VND cost/month     | revenue: 29,700,000 VND
   80 Pro      → 2,388,800 VND cost/month     | revenue: 23,920,000 VND
   20 Bootcamp → 1,807,000 VND cost/month     | revenue: 39,800,000 VND

Total cost:    ~7,116,300 VND/month (~$285)
Total revenue: 93,420,000 VND/month (~$3,737)
Portfolio margin: 92.4% ✅✅✅

Storage cost tại 500 users sau 12 tháng: ~660 MB → $0 thêm (trong 8 GB Supabase Pro)
```

---

# 14. Test Cases

```
── Lesson Context (CourseAiTutorPanel) ──
✅ Câu hỏi đơn giản → route Haiku → response < 2s
✅ Debug code → route Sonnet → quality cao hơn
✅ YouTube lesson: hỏi "video nói gì?" → Cora giải thích topic, không bịa transcript
✅ Community course → Cora không phán xét nội dung
✅ Self course → Cora đóng vai study partner
✅ Quiz/exercise → Cora dùng Socratic method, không spoil đáp án
✅ Lesson history load lại khi user quay về bài học

── Dashboard Context (DashboardAiAssistantPanel) ──
✅ "Tôi đang ở đâu?" → Cora mention đúng tên khoá đang học và % tiến độ
✅ "Nên học gì tiếp?" → Cora gợi ý dựa trên enrolled courses và weak topics

── Course Discovery Context (GlobalCoraAssistant — /courses) ──
✅ "Khoá nào phù hợp cho beginner React?" → Cora trả về tên khoá cụ thể từ catalog
✅ "So sánh 2 khoá X và Y" → Cora so sánh dựa trên RAG, không bịa

── Career Context (GlobalCoraAssistant — /career) ──
✅ "Nên học track nào trước?" → Cora hỏi lại về goal, sau đó gợi ý track cụ thể

── Global / Non-lesson ──
✅ Session được tạo khi user mở chat lần đầu
✅ History persist khi user quay lại trang (cùng sessionId)
✅ User free tier hỏi câu thứ 6 → quota_exceeded error rõ ràng

── Language ──
✅ Câu hỏi tiếng Anh → Cora trả lời tiếng Anh
✅ Câu hỏi tiếng Việt → Cora trả lời tiếng Việt

── Memory ──
✅ User có learning profile → Cora adapt theo weak topics
✅ User streak 7+ → Cora mention nhẹ để motivate
✅ Sau session đủ messages → profile được update async
```

---

*Document này là single source of truth cho Cora AI Tutor — Corelia Academy.*
*Cập nhật khi có thay đổi về component structure, schema, hoặc prompt.*
