# Cora AI — Monetization, Chat History & Payment Integration

> Liên quan: `docs/cora/CORA_AI_TUTOR.md` · `docs/COURSE_OWNERSHIP_REVENUE_SEPAY.md`
> Stack: SePay (existing) · Supabase · React
> Last updated: May 2026

---

# MỤC LỤC

1. [Chat History — Lưu và Hiển thị](#1-chat-history--lưu-và-hiển-thị)
2. [Storage Cost Analysis](#2-storage-cost-analysis)
3. [Unit Economics — Worst-case Margin Analysis](#3-unit-economics--worst-case-margin-analysis)
4. [VND Pricing — Guaranteed 10-20% Floor](#4-vnd-pricing--guaranteed-10-20-floor)
5. [Anti-Cheat System](#5-anti-cheat-system)
6. [Payment Integration — AI Subscription](#6-payment-integration--ai-subscription)
7. [Upgrade & Renewal Page](#7-upgrade--renewal-page)
8. [Expiry & Downgrade Flow](#8-expiry--downgrade-flow)

---

# 1. Chat History — Lưu và Hiển thị

## 1.1 Hai loại history khác nhau

### Lesson history (CourseAiTutorPanel)
- **Group by**: `lesson_id` — mọi message trong cùng bài học là 1 thread
- **Load**: khi user mở lesson → auto load 20 messages gần nhất
- **Retention**: vô thời hạn — history của bài học là "study notes" của user
- **UI**: scroll từ trên xuống, giống một cuộc trò chuyện tiếp tục không bao giờ reset

### Non-lesson history (GlobalCoraAssistant + DashboardAiAssistantPanel)
- **Group by**: `session_id` — mỗi lần mở Cora tạo 1 session mới
- **Load**: load session hiện tại (20 messages); có thể browse sessions cũ
- **Retention**: 90 ngày rolling (cron job cleanup), xem Section 2.3
- **UI**: session hiện tại hiển thị conversation; sidebar/dropdown list sessions cũ

## 1.2 Retention Policy

```sql
-- Cron job hàng ngày: xóa non-lesson conversations cũ hơn 90 ngày
delete from ai_conversations
where context_type != 'lesson'
  and created_at < now() - interval '90 days';

-- Xóa sessions rỗng
delete from ai_chat_sessions
where last_message_at < now() - interval '90 days';
```

Lesson history không xóa — storage cost negligible (xem Section 2).

## 1.3 UI Pattern — Session List

Khi GlobalCoraAssistant panel mở lần đầu → tạo session mới.
Khi user click "Xem lịch sử" → dropdown 5 sessions gần nhất.

```typescript
// Session list item
interface SessionListItem {
  id: string;
  context_type: string;
  title: string | null;        // tự generate từ tin nhắn đầu, hoặc null
  message_count: number;
  last_message_at: string;
}

// Load 5 sessions gần nhất của user
async function loadRecentSessions(userId: string, contextType?: string) {
  const query = supabase.from('ai_chat_sessions')
    .select('id, context_type, title, message_count, last_message_at')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(5);

  if (contextType) query.eq('context_type', contextType);
  const { data } = await query;
  return data ?? [];
}
```

## 1.4 Auto-title Session

Sau tin nhắn đầu của user, extract title ngắn từ nội dung đó:

```typescript
// Trong Edge Function, sau khi save conversation
async function maybeTitleSession(supabase, sessionId: string, firstUserMessage: string) {
  const { data: session } = await supabase.from('ai_chat_sessions')
    .select('title, message_count')
    .eq('id', sessionId).single();

  // Chỉ title lần đầu (message_count = 1 sau insert đầu)
  if (session?.title || (session?.message_count ?? 0) > 2) return;

  // Truncate message làm title
  const title = firstUserMessage.slice(0, 60).trim() +
    (firstUserMessage.length > 60 ? '…' : '');

  await supabase.from('ai_chat_sessions')
    .update({ title })
    .eq('id', sessionId);
}
```

## 1.5 Pagination cho Lesson History

Lesson history dài theo thời gian. Load lazy:

```typescript
const PAGE_SIZE = 20;

async function loadLessonHistoryPage(
  userId: string,
  lessonId: string,
  before?: string  // cursor: created_at của message đầu tiên đang hiện
) {
  const query = supabase.from('ai_conversations')
    .select('id, role, content, complexity, created_at')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (before) query.lt('created_at', before);

  const { data } = await query;
  return (data ?? []).reverse();
}
```

User click "Load older messages" → truyền `created_at` của message cũ nhất đang hiện.

## 1.6 History trong CoraShell

Khi AI connected:
- **Body**: replace "static context cards" bằng `<ConversationHistory messages={...} />`
- **Empty state**: hiện suggestion chips như hiện tại
- **Session switcher**: icon nhỏ ở header area, dropdown 5 sessions

```typescript
// ConversationHistory component pattern
function ConversationHistory({ messages }: { messages: CoraMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">
      {messages.map(msg => (
        <div key={msg.id}
          className={msg.role === 'user'
            ? 'flex justify-end'
            : 'flex justify-start'
          }
        >
          <div className={cn(
            "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
            msg.role === 'user'
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-surface-raised text-foreground rounded-bl-sm"
          )}>
            {msg.isStreaming
              ? <StreamingText content={msg.content} />
              : <MarkdownContent content={msg.content} />
            }
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

---

# 2. Storage Cost Analysis

## 2.1 Message Size Estimates

| Field | Avg size |
|-------|---------|
| User message | 200 chars ≈ 200 bytes |
| Assistant message | 600 chars ≈ 600 bytes |
| Metadata per row (id, timestamps, fk, enums) | ~150 bytes |
| **1 exchange (user + assistant)** | **~1.15 KB** |
| With DB index overhead (~2.5×) | **~2.9 KB effective** |

## 2.2 Storage Per User Per Month

Giả định active usage (không phải max quota):

| Tier | Active msgs/month | Exchanges | Raw | + Index overhead |
|------|------------------|-----------|-----|-----------------|
| Free | ~30 | 15 | 17 KB | **44 KB** |
| Student | ~60 | 30 | 35 KB | **87 KB** |
| Pro | ~100 | 50 | 57 KB | **143 KB** |
| Bootcamp | ~200 | 100 | 115 KB | **288 KB** |

## 2.3 Total Storage at Scale

**500 users (launch scale):**
```
100 Free     × 44 KB  =  4.4 MB
300 Student  × 87 KB  = 26.1 MB
 80 Pro      × 143 KB = 11.4 MB
 20 Bootcamp × 288 KB =  5.8 MB
─────────────────────────────────
Month 1:  ~47.7 MB

Lesson history (không xóa):
  Avg 10 exchanges/lesson × 3 lessons/user/month = 87 KB/user
  500 users: +43.5 MB/month cumulative

Sau 12 tháng (lesson history accumulated):
  Conversations: 47.7 MB × 12 = ~572 MB  (non-lesson 90d rolling = ~140 MB steady)
  Lesson history: 43.5 MB × 12 = ~522 MB
  Total: ~660 MB
```

**Supabase Pro plan** ($25/month) bao gồm **8 GB** storage.
Ở 500 users sau 1 năm, chỉ dùng ~8% quota storage → **storage cost = $0 thêm**.

**10,000 users:**
```
Storage/month: ~954 MB conversation + ~870 MB lesson history
After 12 months: ~22 GB total
Additional storage beyond 8 GB: 14 GB × $0.021/GB = $0.29/month thêm
→ Negligible even at 10K users.
```

## 2.4 Vector Embeddings (Semantic Cache)

Nếu implement semantic cache trong Phase 5:
- Mỗi embedding: 1536 dimensions × 4 bytes = 6 KB
- 10,000 cached Q&A: 60 MB
- 50,000 cached: 300 MB

Vẫn nằm trong 8 GB Supabase Pro. Không cần tính thêm chi phí riêng.

## 2.5 Storage Cost Per User (kết luận)

```
Dưới 10,000 users: storage cost ≈ $0/user/month
Từ 10,000-100,000 users:
  Additional storage: ~$0.021 × (users × 2.7 MB/month) / 1024
  = $0.021 × 2.7 MB × 100,000 / 1024 / 1024 = ~$5.4/month
  Per user: $0.000054/month → cộng vào unit cost của mọi tier là không đáng kể.

Kết luận: Storage KHÔNG phải chi phí cần pricing vào gói AI ở quy mô dưới 100K users.
Chi phí thực sự cần tính: AI API call + payment processing fee.
```

---

# 3. Unit Economics — Worst-case Margin Analysis

> **Nguyên tắc**: tính theo worst-case (100% user max out), không phải average.
> Margin trên average đẹp nhưng không bảo vệ được khi bị abuse.

## 3.0 Vấn đề cốt lõi với doc trước

Doc trước tính theo "active usage" (~60-100 msgs/month). Nhưng nếu dùng **daily cap**:

```
Student: 50 msgs/ngày × 30 ngày = 1,500 msgs/month WORST CASE
AI cost worst case: 1,500 × $0.003 = $4.50 = 112,500 VND
Revenue: 99,000 VND
→ LỖ 13,500 VND/user ❌

Pro: 200 msgs/ngày × 30 = 6,000 msgs/month WORST CASE
  Với 65% Haiku + 35% Sonnet routing:
  6,000 × $0.00895 = $53.70 = 1,342,500 VND
Revenue: 299,000 VND
→ LỖ 1,043,500 VND/user ❌❌❌ (thảm họa)
```

**Kết luận: daily cap KHÔNG đủ kiểm soát chi phí. Phải dùng monthly cap.**

## 3.1 Assumptions

```
VND/USD: 25,000 VND = $1
SePay fee: 1.5% + 3,000 VND/transaction
AI cost: GPT-5.4 mini ~$0.0034/msg, GPT-5.4 full ~$0.011/msg (blended ~$0.0045/msg)
  (dựa trên ~500 input + 300 output tokens/message trung bình)
Infra (Supabase Pro amortized): ~1,500 VND/user/month ở 500 users
Storage: ~$0 (xem Section 2)

Model routing rule (bắt buộc để kiểm soát cost):
  - Free + Student: GPT-5.4 mini ONLY mọi context (haiku_only = true)
  - Pro + Bootcamp: GPT-5.4 mini default, GPT-5.4 full chỉ khi classify = "complex" (~35%)
  - Rolling 3h soft cap → force GPT-5.4 mini dù tier Pro/Bootcamp
```

## 3.2 Worst-case per tier (monthly cap, 100% maxout)

### Free — 50 msgs/month, Haiku only

```
AI cost:      50 × $0.003 = $0.15 = 3,750 VND
Payment fee:  0 VND
Infra:        1,500 VND
──────────────────────────────
Total cost:   5,250 VND
Revenue:      0 VND
Loss:         -5,250 VND/user (acceptable — acquisition cost)
```

### Student — 700 msgs/month, GPT-5.4 mini only, 79,000 VND/month

```
AI cost:      700 × $0.0034 = $2.38 = 59,500 VND
Payment fee:  79,000 × 1.5% + 3,000 = 4,185 VND
Infra:        1,500 VND
──────────────────────────────
Total cost:   65,185 VND
Revenue:      79,000 VND
Profit:       13,815 VND
Margin:       17.5% ✅ (worst case)
```

### Pro — 1,000 msgs/month, GPT-5.4 blended routing, 149,000 VND/month

```
Usage split (conservative):
  Non-lesson (global, dashboard, career): 60% = 600 msgs → mini only
  Lesson context: 40% = 400 msgs → 65% mini + 35% full (routing)

AI cost:
  600 × $0.0034 = $2.04 = 51,000 VND
  400 × (65% × $0.0034 + 35% × $0.011) = 400 × $0.00605 = $2.42 = 60,500 VND
  Total AI: ~112,500 VND ($4.50)

Payment fee:  149,000 × 1.5% + 3,000 = 5,235 VND
Infra:        1,500 VND
──────────────────────────────
Total cost:   119,235 VND
Revenue:      149,000 VND
Profit:       29,765 VND
Margin:       20% ✅ (worst case)
```

### Bootcamp — 2,000 msgs/month, GPT-5.4 blended routing, 399,000 VND/month

```
Usage split:
  Non-lesson: 60% = 1,200 msgs → mini only
  Lesson: 40% = 800 msgs → 65% mini + 35% full

AI cost:
  1,200 × $0.0034 = $4.08 = 102,000 VND
  800 × $0.00605 = $4.84 = 121,000 VND
  Total AI: ~225,000 VND ($9.00)

Payment fee:  399,000 × 1.5% + 3,000 = 8,985 VND
Infra:        1,500 VND
──────────────────────────────
Total cost:   235,485 VND
Revenue:      399,000 VND
Profit:       163,515 VND
Margin:       41% ✅✅
```

## 3.3 Sensitivity: nếu GPT-5.4 full routing tăng

Scenario: Pro users hỏi nhiều câu phức tạp hơn, full model routing tăng lên 60% cho lesson.

```
Pro worst case với full routing 60% lesson:
  600 msgs non-lesson × $0.0034 = 51,000 VND
  400 msgs lesson × (40% × $0.0034 + 60% × $0.011) = 400 × $0.008 = 80,000 VND
  Total AI: 131,000 VND
  + 5,235 + 1,500 = 137,735 VND
  Revenue: 149,000 VND
  Margin: 7.6% ← gần sàn 10% ⚠️
```

**→ Nếu monitoring cho thấy full model ratio vượt 55% → cần tăng giá Pro lên 199,000 VND.**

## 3.4 Break-even toàn hệ thống tại 500 users

```
100 Free     → cost:  525,000 VND       | revenue:         0 VND
300 Student  → cost: 19,555,500 VND     | revenue: 23,700,000 VND
 80 Pro      → cost:  9,538,800 VND     | revenue: 11,920,000 VND
 20 Bootcamp → cost:  4,709,700 VND     | revenue:  7,980,000 VND
───────────────────────────────────────────────────────────────────
Total cost (worst case): 34,329,000 VND/month
Total revenue:           43,600,000 VND/month
Net contribution:         9,271,000 VND/month
Portfolio margin:            21.3% ✅ (worst case — mọi user max out)

Infra overhead:
  Supabase Pro: 625,000 VND
  Misc: 250,000 VND
  Total: 875,000 VND

Net sau infra: 8,396,000 VND/month
Real margin: 19.3% — AN TOÀN ngay cả worst case ✅
```

Note: margin thấp hơn bản tính trước vì đây là giá tiêu dùng thực tế (79k/149k/399k), không phải 99k/299k/1.99M. Portfolio margin 19-21% ở worst-case là acceptable cho consumer SaaS.
Trên trung bình (70% usage): margin ~45%.

---

# 4. VND Pricing — Guaranteed 10-20% Floor

## 4.1 Price floor calculation

Để đảm bảo **tối thiểu 20% margin ngay cả worst case**, lấy total cost worst case ÷ 0.80:

| Tier | Total cost worst case | Price floor (÷0.85) | Giá hiện tại | Margin worst case |
|------|----------------------|---------------------|--------------|-------------------|
| Free | 5,250 VND | — (loss leader) | 0 | N/A |
| Student | 65,185 VND | **76,688 VND** | **79,000 VND** | 17.5% ✅ |
| Pro | 119,235 VND | **140,276 VND** | **149,000 VND** | 20% ✅ |
| Bootcamp | 235,485 VND | **277,041 VND** | **399,000 VND** | 41% ✅✅ |

Giá Student và Pro gần sàn. Buffer thực đến từ average usage (~70% max): margin trung bình 40%+.

**Safety trigger**: nếu GPT-5.4 full ratio của Pro vượt 55% (theo `ai_usage_log` analytics) → tăng giá Pro lên **199,000 VND** để restore buffer về 25%+.

## 4.2 Dual quota — monthly hard cap + rolling 3h soft cap

Chỉ monthly cap không đủ: user có thể gửi nhiều msgs liên tiếp trong vài giờ để "test system" hoặc chạy script. Dual quota chặn cả hai hướng.

| Tier | Monthly hard cap | Rolling 3h soft cap | Mục đích soft cap |
|------|-----------------|---------------------|-------------------|
| Free | 50 msgs | 5 msgs/3h | Ngăn tạo nhiều account chạy script |
| Student | 700 msgs | 70 msgs/3h | Ngăn "binge" toàn bộ quota 1 ngày |
| Pro | 1,000 msgs | 100 msgs/3h | Giữ GPT-5.4 cost trong ngưỡng an toàn |
| Bootcamp | 2,000 msgs | 200 msgs/3h | Ngăn bot; 200/3h = học rất intensively |

Soft cap là **silent throttle** — khi vượt rolling 3h cap, response vẫn trả về bình thường nhưng dùng model tiết kiệm hơn. **Không hiển thị thông báo gì cho user.** Chỉ monthly cap mới hard-block và hiển thị QuotaExceededPrompt.

```typescript
// Quota check — accessGuards.ts (simplified)
// Enforcement mode kiểm soát bởi tier_limits.quota_unit ('message' | 'token' | 'both')

async function checkQuota(db, userId: string): Promise<QuotaResult> {
  const thisMonth = new Date().toISOString().slice(0, 7);   // "2026-05"
  const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  // 4 queries song song
  const [profileRes, limitsRes, monthlyRes, rollingTokenRes] = await Promise.all([
    db.from('profiles').select('tier').eq('id', userId).single(),
    db.from('tier_limits').select(
      'monthly_messages, rolling_3h_soft_cap, haiku_only, monthly_tokens, rolling_3h_tokens, quota_unit'
    ).eq('tier', tier).single(),
    db.from('ai_usage_monthly')
      .upsert({ user_id: userId, month: thisMonth, message_count: 0 }, { onConflict: 'user_id,month' })
      .select('message_count, tokens_used').single(),
    db.from('ai_usage_log')
      .select('input_tokens, output_tokens')
      .eq('user_id', userId)
      .gte('created_at', windowStart),
  ]);

  const quotaUnit = limitsRes.data?.quota_unit ?? 'message';
  const monthlyTokensUsed = monthlyRes.data?.tokens_used ?? 0;
  const rollingTokensUsed = (rollingTokenRes.data ?? [])
    .reduce((s: number, r: { input_tokens: number; output_tokens: number }) => s + r.input_tokens + r.output_tokens, 0);

  // Enforcement logic theo quota_unit
  const allowed =
    quotaUnit === 'message' ? (monthlyLimit == null || monthlyUsed < monthlyLimit) :
    quotaUnit === 'token'   ? (monthlyTokensLimit == null || monthlyTokensUsed < monthlyTokensLimit) :
    // 'both': block nếu BẤT KỲ counter vượt
    (monthlyLimit == null || monthlyUsed < monthlyLimit) &&
    (monthlyTokensLimit == null || monthlyTokensUsed < monthlyTokensLimit);

  const throttled =
    quotaUnit === 'message' ? (windowSoftCap != null && windowUsed >= windowSoftCap) :
    quotaUnit === 'token'   ? (rollingTokensCap != null && rollingTokensUsed >= rollingTokensCap) :
    (windowSoftCap != null && windowUsed >= windowSoftCap) ||
    (rollingTokensCap != null && rollingTokensUsed >= rollingTokensCap);

  return {
    allowed, throttled, haikuOnly: limits?.haiku_only || throttled,
    monthlyUsed, monthlyLimit, windowUsed, windowSoftCap, windowHours: 3, tier,
    quotaUnit, monthlyTokensUsed, monthlyTokensLimit,
    rollingTokensUsed, rollingTokensCap: limits?.rolling_3h_tokens ?? null,
  };
}
```

## 4.3 DB Schema (cập nhật)

```sql
-- Giữ ai_usage_daily (đã có) + thêm ai_usage_monthly
create table if not exists ai_usage_monthly (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  month         text not null,        -- "2026-05"
  message_count int default 0,
  tokens_used   int default 0,
  cost_usd      numeric(10,6) default 0,
  unique(user_id, month)
);

-- Cập nhật tier_limits (migration 20260522000000_token_quota_phase1.sql)
alter table tier_limits
  add column if not exists monthly_messages     int,
  add column if not exists rolling_3h_soft_cap  int,
  add column if not exists price_vnd_monthly    int default 0,
  add column if not exists monthly_tokens       int,
  add column if not exists rolling_3h_tokens    int,
  add column if not exists quota_unit           text not null default 'message'
    check (quota_unit in ('message','token','both'));

UPDATE public.tier_limits SET monthly_messages=50,   rolling_3h_soft_cap=5,   haiku_only=true,  price_vnd_monthly=0,
  monthly_tokens=100000,   rolling_3h_tokens=10000,  quota_unit='message' WHERE tier='free';
UPDATE public.tier_limits SET monthly_messages=700,  rolling_3h_soft_cap=70,  haiku_only=true,  price_vnd_monthly=79000,
  monthly_tokens=1400000,  rolling_3h_tokens=140000, quota_unit='message' WHERE tier='student';
UPDATE public.tier_limits SET monthly_messages=1000, rolling_3h_soft_cap=100, haiku_only=false, price_vnd_monthly=149000,
  monthly_tokens=2000000,  rolling_3h_tokens=200000, quota_unit='message' WHERE tier='pro';
UPDATE public.tier_limits SET monthly_messages=2000, rolling_3h_soft_cap=200, haiku_only=false, price_vnd_monthly=399000,
  monthly_tokens=4000000,  rolling_3h_tokens=400000, quota_unit='message' WHERE tier='bootcamp';
```

## 4.4 Giá chính thức và messaging

> Chỉ bán **1 tháng** và **1 năm**. Mặc định chọn **1 năm** (higher conversion). Không còn gói 6 tháng.

| Tier | 1 tháng | 1 năm | Tiết kiệm | Quota tháng | Tokens/tháng | Soft cap/3h |
|------|---------|-------|-----------|-------------|--------------|-------------|
| **Free** | 0 | — | — | 50 | 100K | 5 |
| **Student** | 79,000 VND | 690,000 VND | ~27% | 700 | 1.4M | 70 |
| **Pro** | 149,000 VND | 1,290,000 VND | ~28% | 1,000 | 2M | 100 |
| **Bootcamp** | 399,000 VND | 3,490,000 VND | ~27% | 2,000* | 4M | 200 |

*Bootcamp hiển thị là "Không giới hạn*" trong UI với fair-use footnote (~2.000 câu/tháng).
Token quota chỉ dùng nội bộ để enforce — không hiển thị trong UI.

```
Free:     "50 câu hỏi miễn phí mỗi tháng — không cần thẻ"
Student:  "~23 cuộc hội thoại mỗi ngày"
Pro:      "~33 cuộc hội thoại mỗi ngày, model AI mạnh hơn"
Bootcamp: "Không giới hạn* — cho người học intensively"
```

**Framing UX:** Không hiển thị quota như giới hạn. Dùng framing tích cực:
- < 70% dùng: "Cora đã trả lời X câu hỏi tháng này"
- 70–99% dùng: "🔥 Bạn đang học rất chăm!"
- ≥ 100% dùng: "🎓 Tháng học rất hiệu quả!" + reset date + tier upgrade cards

**Lưu ý**: UI không bao giờ hiển thị raw token count. Khi `quota_unit = 'token'` UX vẫn dùng framing tích cực dựa trên `usedPct`, không show số tokens.

## 4.5 Monitoring triggers tự động

```sql
-- View theo dõi cost anomaly per user
create or replace view ai_cost_anomaly as
select
  u.user_id,
  p.tier,
  m.month,
  m.message_count,
  t.monthly_messages as tier_cap,
  round(m.message_count::numeric / nullif(t.monthly_messages, 0) * 100, 1) as pct_used,
  m.cost_usd,
  -- Flag nếu AI cost > 2× worst-case cho tier (GPT-5.4 pricing)
  -- Student worst case $2.38, Pro $4.50, Bootcamp $9.00
  case
    when p.tier = 'student'  and m.cost_usd > 5.00 then true
    when p.tier = 'pro'      and m.cost_usd > 9.00 then true
    when p.tier = 'bootcamp' and m.cost_usd > 18.00 then true
    else false
  end as cost_anomaly
from ai_usage_monthly m
join profiles p on p.id = m.user_id
join tier_limits t on t.tier = p.tier
join auth.users u on u.id = m.user_id
where m.month = to_char(now(), 'YYYY-MM');

-- Query admin chạy weekly để kiểm tra
select * from ai_cost_anomaly where cost_anomaly = true order by cost_usd desc;
```

---

# 2026-05-14 Pricing Reset *(Superseded by 2026-05-19)*

> **Deprecated** — Giá trong section này đã bị override bởi section 2026-05-19.
> Giữ lại để tham chiếu lịch sử định giá và reasoning ban đầu.

## Pricing direction mới

- Giữ trần giá consumer-friendly: `99k / 199k / 499k` mỗi tháng cho `Student / Pro / Bootcamp`
- Không dùng `daily soft cap` làm mental model chính nữa
- Chuyển sang `monthly hard cap + rolling 3-hour soft cap`, gần hơn với cách ChatGPT đang truyền đạt usage windows
- Vẫn giữ monthly hard cap để khóa worst-case cost

## Official pricing đề xuất

| Tier | Monthly | 6-Month | 12-Month | Monthly hard cap | Rolling 3-hour soft cap |
|------|---------|---------|----------|------------------|-------------------------|
| Free | 0 | — | — | 40 msgs | 6 msgs / 3h |
| Student | 99,000 VND | 499,000 VND | 890,000 VND | 250 msgs | 20 msgs / 3h |
| Pro | 199,000 VND | 999,000 VND | 1,790,000 VND | 700 msgs | 50 msgs / 3h |
| Bootcamp | 499,000 VND | 2,490,000 VND | 4,490,000 VND | 1,800 msgs | 120 msgs / 3h |

## Product reasoning

- `Student 99k` đủ rẻ để learner mua theo impulse, nhưng quota 250/tháng vẫn dư cho phần lớn hành vi học thật.
- `Pro 199k` là nấc hợp lý nhất cho user muốn dùng AI nhiều hơn nhưng chưa sẵn sàng vượt 200k/tháng.
- `Bootcamp 499k` nên là ceiling cho learner plan. Cao hơn mức này sẽ chuyển từ “assistant hỗ trợ học” sang “commitment mua tool”, dễ làm giảm conversion mạnh.

## Quota reasoning

- `Rolling 3-hour soft cap` giúp UX giống ChatGPT hơn: user hiểu rằng mình đang ở một usage window ngắn, thay vì bị báo “hôm nay hết nhịp”.
- `Monthly hard cap` vẫn là lớp kiểm soát cost thực sự.
- Soft cap chỉ throttle xuống model tiết kiệm hơn, không hard-block.

## Deprecation note

- Giá `Bootcamp 1,990,000 VND/month` được xem là deprecated cho learner-facing product.
- Nếu sau này có nhu cầu high-touch AI plan thật sự, nên tách thành một SKU riêng kiểu `Team / Mentor / Cohort`, không nên nhét chung vào ladder `Student / Pro / Bootcamp`.

---

# 2026-05-19 Pricing & UX Overhaul

> Bản này **override** toàn bộ giá cũ trong doc (99k/199k/499k, gói 6 tháng, v.v.).
> Lý do: switch từ Anthropic Claude sang OpenAI GPT-5.4 mini/full, margin thực tế cao hơn trước.
> Cũng thay đổi UX từ "limitation framing" sang "achievement framing".

## AI Model: OpenAI GPT-5.4

| Model | Input | Output | Chi phí/msg (~500 in + 300 out tokens) |
|-------|-------|--------|-----------------------------------------|
| GPT-5.4 mini | $0.75/1M | $4.50/1M | ~$0.0034/msg |
| GPT-5.4 full | $2.50/1M | $15.00/1M | ~$0.011/msg |
| Blended Pro/Bootcamp (90% mini + 10% full) | — | — | ~$0.0045/msg |

Dùng OpenAI Responses API (SSE). Actual token usage capture từ `response.completed` event.
Fallback estimate: `chars / 4` khi stream bị gián đoạn (ghi `ai_usage_log.estimated = true`).

**Routing:**
- Free + Student: GPT-5.4 mini only (`haiku_only = true`)
- Pro + Bootcamp: GPT-5.4 mini default, GPT-5.4 full cho câu hỏi complex (~35%)

## Pricing chính thức (supersedes 2026-05-14)

| Tier | 1 tháng | 1 năm | API budget (75% doanh thu) | Msgs/tháng | Soft cap/3h |
|------|---------|-------|--------------------------|------------|-------------|
| Free | 0đ | — | — | **50** | 5 |
| Student | **79.000đ** | **690.000đ** | $2.33/tháng | **700** | 70 |
| Pro | **149.000đ** | **1.290.000đ** | $4.39/tháng | **1.000** | 100 |
| Bootcamp | **399.000đ** | **3.490.000đ** | $11.74/tháng | **2.000*** | 200 |

*Bootcamp hiển thị "Không giới hạn*" trong UI (fair-use cap ẩn trong footnote).

**Chu kỳ:** Chỉ 1 tháng và 1 năm. Mặc định chọn 1 năm.

## Unit economics mới

**Student worst case (700 msgs/tháng, GPT-5.4 mini):**
```
AI cost: 700 × $0.0034 = $2.38 = 59,500 VND
SePay fee: 79,000 × 1.5% + 3,000 = 4,185 VND
Infra: 1,500 VND
Total: 65,185 VND  |  Revenue: 79,000 VND  |  Margin: 17.5% ✅
```

**Pro worst case (1,000 msgs/tháng, blended):**
```
AI cost: 1,000 × $0.0045 = $4.50 = 112,500 VND
SePay fee: 149,000 × 1.5% + 3,000 = 5,235 VND
Infra: 1,500 VND
Total: 119,235 VND  |  Revenue: 149,000 VND  |  Margin: 20% ✅
```

**Bootcamp worst case (2,000 msgs/tháng, blended):**
```
AI cost: 2,000 × $0.0045 = $9.00 = 225,000 VND
SePay fee: 399,000 × 1.5% + 3,000 = 8,985 VND
Infra: 1,500 VND
Total: 235,485 VND  |  Revenue: 399,000 VND  |  Margin: 41% ✅✅
```

## UX philosophy: Achievement không phải Limitation

| Cũ (limitation) | Mới (achievement) |
|-----------------|-------------------|
| "45 / 50 messages" | "Cora đã trả lời 45 câu hỏi tháng này" |
| "5 messages remaining" | "🔥 Bạn đang học rất chăm!" |
| Throttle badge "chế độ tiết kiệm" | *(im lặng — soft cap ẩn hoàn toàn)* |
| Hết quota: warning icon đỏ | "🎓 Tháng học rất hiệu quả!" |
| CTA: "Xem gói Cora" | Inline tier cards với giá và câu hỏi/tháng |

## Token-based Quota Rollout (2026-05-22)

Enforcement mode switch không cần redeploy — chỉ cần UPDATE DB:

| Phase | Thời điểm | quota_unit | Hành động |
|-------|-----------|------------|-----------|
| Week 0 | Deploy | `'message'` | Capture token data, không đổi enforcement |
| Week 1–4 | Monitor | `'both'` | Dual enforce — block nếu BẤT KỲ counter vượt |
| Week 5+ | Switch | `'token'` | Token-only enforcement |
| Rollback | Bất kỳ lúc | `'message'` | `UPDATE tier_limits SET quota_unit='message'` |

Token limits: Free 100K · Student 1.4M · Pro 2M · Bootcamp 4M tokens/tháng.
Ratio: ~2,000 tokens/message (500 input + 300 output + overhead).

## Upgrade / Downgrade rules

- **Nâng cấp (upgrade)**: luôn được phép. Gói mới bắt đầu ngay, gói cũ bị supersede.
- **Gia hạn cùng tier**: thời hạn extend từ `expires_at` hiện tại (không mất ngày còn lại).
- **Hạ cấp (downgrade)**: bị block trong khi gói còn active. Frontend disable tier thấp hơn.
- `ai_subscriptions.status` mới: `active | expired | cancelled | superseded`.

---

# 5. Anti-Cheat System

> Mục tiêu: ngăn một user tiêu tốn AI cost vượt quota đã tính trong unit economics.
> Không cần bảo mật hoàn hảo — chỉ cần đủ tốn công để abuse không còn lợi.

## 5.1 Input length cap

**Giới hạn 2,000 ký tự/message** — validate ở cả client và Edge Function.

Lý do: không có lý do gì để 1 tin nhắn dài hơn ~400 từ trong context học. Tin nhắn dài đồng nghĩa prompt engineering, context stuffing, hoặc "gom" nhiều câu hỏi vào 1 lần để lách quota.

```typescript
// Edge Function — validate trước khi process
const MAX_INPUT_CHARS = 2000;

if (!userMessage || typeof userMessage !== 'string') {
  return json({ message: 'Tin nhắn không hợp lệ' }, 400);
}
if (userMessage.length > MAX_INPUT_CHARS) {
  return json({ message: `Tin nhắn tối đa ${MAX_INPUT_CHARS} ký tự` }, 400);
}

// Client — disable send button
const isOverLimit = message.length > MAX_INPUT_CHARS;
```

## 5.2 Rate limiting — short burst protection

Dual quota (Section 4.2) ngăn abuse theo ngày/tháng. Rate limiting ngăn burst trong vài phút — mục tiêu chính là script/bot.

**10 messages/minute per user_id** — tracked trong memory hoặc Supabase KV.

```typescript
// Edge Function — sliding window rate limit
// Dùng Supabase để track, không cần Redis ở scale hiện tại

async function checkRateLimit(supabase, userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60_000).toISOString();

  const { count } = await supabase
    .from('ai_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', windowStart);

  return (count ?? 0) < 10;  // false = blocked
}

// Trong main handler:
const underRateLimit = await checkRateLimit(db, user.id);
if (!underRateLimit) {
  return json({ message: 'Bạn đang gửi quá nhiều tin nhắn, vui lòng chờ 1 phút.' }, 429);
}
```

> **Tại sao không Redis?** Ở scale ≤500 users, query `ai_conversations` đủ nhanh (index trên `user_id, created_at`). Chỉ migrate sang Redis/Upstash khi >5,000 concurrent users.

## 5.3 Email verification gate

**Yêu cầu xác thực email trước khi gọi AI API bất kỳ.**

Supabase Auth theo mặc định có thể cho phép đăng ký chưa verify email. Cần chặn ở Edge Function:

```typescript
// Trong verifyBearerUser() hoặc ngay sau khi verify user:
const { data: { user } } = await db.auth.getUser();

if (!user?.email_confirmed_at) {
  return json({
    message: 'Vui lòng xác thực email trước khi sử dụng Cora AI.',
    code: 'email_unverified',
  }, 403);
}
```

Mục đích: mỗi throwaway email account bây giờ cần 1 real mailbox → tăng chi phí tạo multiple accounts từ gần 0 lên có chi phí thực.

## 5.4 Concurrent request limit

**Tối đa 2 requests đang xử lý đồng thời per user_id.**

Không cần track chính xác — dùng `in_progress_requests` trong memory context của Edge Function, hoặc Supabase lock pattern:

```typescript
// Simple approach: check nếu user có message 'in_flight' (role = 'assistant', content = null)
// được insert khi bắt đầu, updated khi stream xong

const { count: inFlight } = await supabase
  .from('ai_conversations')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('role', 'assistant')
  .is('content', null)  // placeholder chưa có content = đang stream
  .gte('created_at', new Date(Date.now() - 120_000).toISOString());  // < 2 min old

if ((inFlight ?? 0) >= 2) {
  return json({ message: 'Bạn đang có yêu cầu đang xử lý, vui lòng đợi.' }, 429);
}
```

## 5.5 Message deduplication

**Cùng 1 message gửi trong 10 giây → return cached response, không tốn quota.**

Ngăn double-click, network retry spam, và một số bot pattern đơn giản.

```typescript
async function findDuplicateMessage(
  supabase,
  userId: string,
  message: string
): Promise<string | null> {
  const windowStart = new Date(Date.now() - 10_000).toISOString();

  // Tìm user message giống hệt trong 10 giây qua
  const { data: prev } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'user')
    .eq('content', message)
    .gte('created_at', windowStart)
    .limit(1)
    .maybeSingle();

  if (!prev) return null;

  // Tìm assistant response tương ứng
  const { data: reply } = await supabase
    .from('ai_conversations')
    .select('content')
    .eq('user_id', userId)
    .eq('role', 'assistant')
    .gt('id', prev.id)  // phải sau user message
    .not('content', 'is', null)
    .limit(1)
    .maybeSingle();

  return reply?.content ?? null;
}

// Trong handler:
const cached = await findDuplicateMessage(db, user.id, userMessage);
if (cached) {
  // Không increment quota, return cached
  return json({ content: cached, cached: true });
}
```

## 5.6 Subscription integrity — không thể forge tier

**Backend validate `(tier, amount_vnd)` khớp với bảng giá cố định.**

Trong `handleAiSubscriptionCheckout` (Section 6.4):

```typescript
// Backend tự tính amount từ tier + duration — KHÔNG tin amount từ client
const amountVnd = AI_SUBSCRIPTION_PRICES[tier]?.[durationMonths];
if (!amountVnd) {
  return json({ message: 'Tier hoặc thời hạn không hợp lệ' }, 400);
}

// Khi IPN về, verify lại:
// amount trong IPN == amount trong payment_transaction (đã save từ backend)
// Không bao giờ dùng amount từ IPN để quyết định tier
```

Trong `grantPaymentAccessForTransaction`, thêm validation:

```typescript
const expectedAmount = AI_SUBSCRIPTION_PRICES[meta.tier]?.[meta.duration_months];
if (!expectedAmount || tx.amount_vnd !== expectedAmount) {
  throw new Error(`Amount mismatch: expected ${expectedAmount}, got ${tx.amount_vnd}`);
}
```

**DB constraint**: chỉ 1 active subscription per user tại 1 thời điểm:

```sql
-- Partial unique index: không cho phép 2 active subscriptions cùng user
create unique index ai_subscriptions_one_active_per_user
  on ai_subscriptions(user_id)
  where status = 'active';
```

Khi user mua subscription mới trong khi còn active → logic cần `deactivate` cái cũ trước khi insert mới (nếu upgrade), hoặc đợi hết hạn rồi mới active (nếu renew).

## 5.7 Refund & chargeback → immediate downgrade

Khi SePay gửi IPN với `ORDER_REFUND` hoặc chargeback signal:

```typescript
// Trong handleSePayIpn, thêm case:
if (notificationType === 'ORDER_REFUND' || notificationType === 'CHARGEBACK') {
  const orderId = payload.order?.order_invoice_number;
  if (!orderId) return json({ message: 'Missing order ID' }, 400);

  // Void transaction
  await db.from('payment_transactions')
    .update({ status: 'cancelled', updated_at: nowIso() })
    .eq('id', orderId);

  // Revoke AI subscription
  const { data: tx } = await db.from('payment_transactions')
    .select('user_id, purpose, provider_payload')
    .eq('id', orderId).single();

  if (tx?.purpose === 'ai_subscription') {
    await db.from('ai_subscriptions')
      .update({ status: 'cancelled' })
      .eq('payment_transaction_id', orderId);

    // Check nếu còn subscription khác active
    const { count } = await db.from('ai_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', tx.user_id)
      .eq('status', 'active');

    if ((count ?? 0) === 0) {
      await db.from('profiles')
        .update({ tier: 'free', updated_at: nowIso() })
        .eq('id', tx.user_id);
    }
  }
}
```

## 5.8 Free tier fingerprinting (detect, không block)

Với Free tier, tạo nhiều account để lách quota là risk thực. Không nên block (false positive cao) nhưng nên detect để manual review.

Collect ở frontend khi user đăng ký/login:

```typescript
// Không cần thư viện phức tạp — simple signals
const fingerprint = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  language: navigator.language,
  platform: navigator.platform,
  screenRes: `${screen.width}×${screen.height}`,
  colorDepth: screen.colorDepth,
};

// Save vào profiles.signup_fingerprint (jsonb) khi register
// Nếu cùng fingerprint + free tier dùng nhiều account → flag cho admin review
```

Query admin để detect:

```sql
select
  signup_fingerprint->>'timezone' as tz,
  signup_fingerprint->>'screenRes' as res,
  count(distinct id) as account_count,
  sum(case when tier = 'free' then 1 else 0 end) as free_accounts
from profiles
where signup_fingerprint is not null
group by 1, 2
having count(distinct id) > 2 and free_accounts > 1
order by free_accounts desc;
```

**Policy**: không auto-ban. Nếu 3+ free accounts cùng fingerprint → disable newest accounts thủ công sau review.

## 5.9 Cost anomaly alert (reference)

Xem **Section 4.5** — `ai_cost_anomaly` view theo dõi user nào vượt 2× expected cost. Query admin chạy weekly. Nếu user nào consistently trigger anomaly sau nhiều tháng → manual investigation.

## 5.10 Tóm tắt defense layers

| Layer | Mục tiêu | Mechanism |
|-------|----------|-----------|
| Input length cap | Ngăn context stuffing | 2,000 char limit client + server |
| Rate limit (burst) | Ngăn script/bot | 10 msgs/minute per user |
| Email verification | Tăng chi phí tạo account | Require `email_confirmed_at` |
| Dual quota | Kiểm soát cost worst case | Monthly hard cap + rolling 3-hour soft cap |
| Concurrent limit | Ngăn parallel abuse | Max 2 in-flight per user |
| Deduplication | Ngăn retry spam | Cache 10s window |
| Amount validation | Ngăn tier forgery | Backend-computed amount, DB constraint |
| Refund downgrade | Thu hồi access ngay | IPN ORDER_REFUND handler |
| Fingerprinting | Detect multi-account | Flag, không auto-ban |
| Cost anomaly | Early warning | ai_cost_anomaly view |

---

# 6. Payment Integration — AI Subscription

## 6.1 Tổng quan

Payment system hiện tại (`src/lib/payments.ts`, `supabase/functions/corelia-api/payments/`) xử lý:
- `course_purchase` → `course_payment_access`
- `certificate_fee` → `course_payment_access`

Cần thêm:
- `ai_subscription` purpose → `ai_subscriptions` table

Không cần tạo infrastructure mới — extend SePay flow hiện có.

## 6.2 Schema mới

```sql
-- Subscription records cho AI tiers
create table ai_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete cascade,
  tier                   text not null check (tier in ('student', 'pro', 'bootcamp')),
  duration_months        int not null,         -- 1, 6, hoặc 12
  price_vnd              int not null,
  started_at             timestamptz not null,
  expires_at             timestamptz not null,
  payment_transaction_id text not null,        -- FK: payment_transactions.id
  status                 text not null default 'active'
                         check (status in ('active', 'expired', 'cancelled')),
  auto_renew             boolean default false, -- cho phase 2 khi có auto-billing
  created_at             timestamptz default now()
);

create index ai_subscriptions_user_idx on ai_subscriptions(user_id, status, expires_at desc);

-- RLS
alter table ai_subscriptions enable row level security;
create policy "own_ai_subscriptions" on ai_subscriptions
  for select using (auth.uid() = user_id);
-- Insert/update chỉ qua service role (Edge Function)
```

## 6.3 Types mới trong `payments/types.ts`

```typescript
// Thêm vào PaymentPurpose
export type PaymentPurpose =
  | "course_purchase"
  | "certificate_fee"
  | "ai_subscription";  // NEW

// Metadata cho ai_subscription purpose
export type AiSubscriptionMeta = {
  tier: "student" | "pro" | "bootcamp";
  duration_months: 1 | 6 | 12;
};
```

## 6.4 Handler mới — `handleAiSubscriptionCheckout`

Thêm vào `supabase/functions/corelia-api/payments/handlers.ts`:

```typescript
const AI_SUBSCRIPTION_PRICES: Record<
  "student" | "pro" | "bootcamp",
  Partial<Record<1 | 12, number>>
> = {
  student:  { 1: 79000,   12: 690000  },
  pro:      { 1: 149000,  12: 1290000 },
  bootcamp: { 1: 399000,  12: 3490000 },
};

export async function handleAiSubscriptionCheckout(
  req: Request,
  db: SupabaseClient
): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const tier = body.tier as "student" | "pro" | "bootcamp";
    const durationMonths = Number(body.durationMonths) as 1 | 6 | 12;
    const successUrl = String(body.successUrl ?? "");
    const errorUrl   = String(body.errorUrl ?? "");
    const cancelUrl  = String(body.cancelUrl ?? "");

    if (!["student", "pro", "bootcamp"].includes(tier)) {
      return json({ message: "Tier không hợp lệ" }, 400);
    }
    if (![1, 12].includes(durationMonths)) {
      return json({ message: "Thời hạn không hợp lệ (chỉ 1 hoặc 12 tháng)" }, 400);
    }

    const callbackAllowlist = paymentCallbackOriginAllowlistFromEnv();
    if (
      !isValidPaymentCallbackUrl(successUrl, callbackAllowlist) ||
      !isValidPaymentCallbackUrl(errorUrl, callbackAllowlist) ||
      !isValidPaymentCallbackUrl(cancelUrl, callbackAllowlist)
    ) {
      return json({ message: "Callback URLs không hợp lệ" }, 400);
    }

    const amountVnd = AI_SUBSCRIPTION_PRICES[tier][durationMonths];
    const orderId = `CORA-${Date.now()}-${randomHex(6)}`;
    const createdAt = nowIso();

    // Save pending transaction với metadata
    const { error: insErr } = await db.from("payment_transactions").insert({
      id: orderId,
      user_id: user.id,
      course_id: null,                          // null cho AI subscription
      purpose: "ai_subscription",
      amount_vnd: amountVnd,
      provider: "sepay",
      status: "pending",
      provider_payload: { tier, duration_months: durationMonths }, // metadata
      created_at: createdAt,
      updated_at: createdAt,
    });
    if (insErr) throw new Error(insErr.message);

    const merchantId = requireEnv("SEPAY_MERCHANT_ID");
    const secretKey  = requireEnv("SEPAY_SECRET_KEY");

    const tierLabels = { student: "Học viên", pro: "Pro", bootcamp: "Bootcamp" };
    const durationLabels = { 1: "1 tháng", 12: "12 tháng" };

    const fields: Record<string, string> = {
      merchant:             merchantId,
      operation:            "PURCHASE",
      payment_method:       "BANK_TRANSFER",
      order_amount:         String(amountVnd),
      currency:             "VND",
      order_invoice_number: orderId,
      order_description:    `Cora AI ${tierLabels[tier]} - ${durationLabels[durationMonths]}`,
      customer_id:          user.id,
      success_url:          successUrl,
      error_url:            errorUrl,
      cancel_url:           cancelUrl,
    };
    const signature = await buildSePaySignature(fields, secretKey);

    return json({
      checkout_url: sepayCheckoutInitUrl(),
      order_id: orderId,
      fields: { ...fields, signature },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] ai-subscription checkout", e);
    return json({ message: "Không tạo được phiên thanh toán." }, 500);
  }
}
```

## 6.5 Grant access — `grant_access.ts`

Thêm branch cho `ai_subscription` trong `grantPaymentAccessForTransaction`:

```typescript
// Trong grantPaymentAccessForTransaction, thêm:
if (tx.purpose === "ai_subscription") {
  const meta = tx.provider_payload as { tier: string; duration_months: number };
  const tier = meta?.tier;
  const months = Number(meta?.duration_months ?? 1);

  if (!["student", "pro", "bootcamp"].includes(tier) || months < 1) {
    throw new Error("Invalid ai_subscription metadata in transaction");
  }

  // Upgrade starts immediately; same-tier renewal extends from existing expiry
  const TIER_RANK = { student: 1, pro: 2, bootcamp: 3 } as const;
  const { data: currentActive } = await db.from("ai_subscriptions")
    .select("tier, expires_at")
    .eq("user_id", tx.user_id).eq("status", "active")
    .order("expires_at", { ascending: false }).limit(1).maybeSingle();

  const isUpgrade = currentActive?.tier && tier !== currentActive.tier
    && (TIER_RANK[tier as keyof typeof TIER_RANK] ?? 0) > (TIER_RANK[currentActive.tier as keyof typeof TIER_RANK] ?? 0);

  if (currentActive?.tier && tier !== currentActive.tier && !isUpgrade) {
    throw new Error("Downgrade not allowed on active subscription");
  }

  const startBase = (!isUpgrade && currentActive?.expires_at
    && Date.parse(currentActive.expires_at) > Date.parse(updatedAt))
    ? currentActive.expires_at : updatedAt;

  const expiresAt = new Date(Date.parse(startBase));
  expiresAt.setMonth(expiresAt.getMonth() + months);

  if (isUpgrade && currentActive) {
    await db.from("ai_subscriptions").update({ status: "superseded" })
      .eq("user_id", tx.user_id).eq("status", "active");
  }

  const { error: subErr } = await db.from("ai_subscriptions").insert({
    user_id: tx.user_id,
    tier,
    duration_months: months,
    price_vnd: tx.amount_vnd,
    started_at: updatedAt,
    expires_at: expiresAt.toISOString(),
    payment_transaction_id: orderId,
    status: "active",
  });
  if (subErr) throw new Error(subErr.message);

  const { error: profileErr } = await db.from("profiles")
    .update({ tier, updated_at: updatedAt })
    .eq("id", tx.user_id);
  if (profileErr) throw new Error(profileErr.message);

  return;
}
```

## 6.6 IPN handler (đã có) xử lý ai_subscription

`handleSePayIpn` trong handlers.ts gọi `grantPaymentAccessForTransaction` cho mọi `ORDER_PAID`.
Không cần thay đổi IPN handler — chỉ cần thêm branch trong `grantPaymentAccessForTransaction`.

## 6.7 Frontend — `payments.ts` mở rộng

```typescript
// src/lib/payments.ts — thêm:

export type AiSubscriptionTier = "student" | "pro" | "bootcamp";
export type AiSubscriptionDurationMonths = 1 | 12; // 6-month option removed

export interface AiSubscription {
  id: string;
  user_id: string;
  tier: AiSubscriptionTier;
  duration_months: AiSubscriptionDuration;
  price_vnd: number;
  started_at: string;
  expires_at: string;
  status: "active" | "expired" | "cancelled";
}

interface CreateAiSubscriptionCheckoutInput {
  tier: AiSubscriptionTier;
  durationMonths: AiSubscriptionDuration;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
}

export async function createAiSubscriptionCheckout(
  payload: CreateAiSubscriptionCheckoutInput
): Promise<CreateSePayCheckoutResponse> {
  const endpoint = coreliaEdgeUrl("payments.ai-subscription.checkout");
  const token = await getAccessToken();
  requireAccessToken(token);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...supabaseFunctionHeaders(token),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({})) as Partial<
    CreateSePayCheckoutResponse & { message?: string }
  >;
  if (!res.ok || !data.checkout_url || !data.order_id) {
    throw new Error(data.message || "Không tạo được phiên thanh toán.");
  }
  return { checkout_url: data.checkout_url, order_id: data.order_id, fields: data.fields! };
}

export async function getMyAiSubscription(): Promise<AiSubscription | null> {
  const { data, error } = await supabase
    .from("ai_subscriptions")
    .select("*")
    .eq("status", "active")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as AiSubscription;
}
```

## 6.8 Route mới trong corelia-api

Trong router của `corelia-api/index.ts`, thêm:

```typescript
if (path === "/payments/ai-subscription/checkout" && method === "POST") {
  return handleAiSubscriptionCheckout(req, db);
}
```

---

# 7. Upgrade & Renewal Page

## 7.1 Route

```
/account/cora        — trang quản lý Cora AI subscription
/upgrade/cora        — redirect → /account/cora (cho deep links từ quota exceeded)
```

Thêm vào `src/App.tsx`:
```tsx
<Route path="account">
  {/* ... existing account routes ... */}
  <Route path="cora" element={<AccountCoraRoute />} />
</Route>
<Route path="upgrade/cora" element={<Navigate to="/account/cora" replace />} />
```

## 7.2 AccountCoraRoute — layout

```
┌─────────────────────────────────────────────────────┐
│  Cora AI Tutor                                       │
│  Quản lý gói AI của bạn                              │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ GÓI HIỆN TẠI                                    │ │
│  │ Pro · Hết hạn 30/06/2026 · 847/2000 msgs dùng  │ │
│  │ [Gia hạn ngay]                                  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  NÂNG CẤP GÓI                                        │
│                                                      │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐        │
│  │ Student   │  │ Pro ●     │  │ Bootcamp  │        │
│  │ 79k/tháng │  │ 149k/tháng│  │ 399k/th   │        │
│  │ ~23 hội   │  │ ~33 hội   │  │ Không giới│        │
│  │ thoại/ngày│  │ thoại/ngày│  │ hạn*      │        │
│  └───────────┘  └───────────┘  └───────────┘        │
│                                                      │
│  CHỌN THỜI HẠN                                       │
│  ○ 1 tháng  — 149,000 VND                            │
│  ● 12 tháng — 1,290,000 VND  ← mặc định             │
│                                                      │
│  [Thanh toán qua SePay — 149,000 VND]                │
│                                                      │
│  LỊCH SỬ GIAO DỊCH AI                                │
│  ┌──────────────────────────────────────────────┐    │
│  │ 01/05/2026  Pro 1 tháng   199,000 VND  paid  │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## 7.3 Component Structure

```typescript
// src/pages/account/AccountCoraRoute.tsx

import { useState, useEffect } from 'react';
import { createAiSubscriptionCheckout, submitSePayCheckoutForm, getMyAiSubscription } from '@/lib/payments';
import { toast } from 'sonner';

type Tier = 'student' | 'pro' | 'bootcamp';
type Duration = 1 | 6 | 12;

const PRICES: Record<Tier, Record<Duration, number>> = {
  student:  { 1: 79000,   12: 690000  },
  pro:      { 1: 149000,  12: 1290000 },
  bootcamp: { 1: 399000,  12: 3490000 },
};

const SAVINGS: Record<Duration, number> = { 1: 0, 12: 27 };

const TIER_FEATURES: Record<Tier, { sessions: string; model: string; history: string }> = {
  student:  { sessions: '~23 cuộc hội thoại/ngày', model: 'GPT-5.4 mini',            history: 'Lịch sử 90 ngày' },
  pro:      { sessions: '~33 cuộc hội thoại/ngày', model: 'GPT-5.4 mini + full',      history: 'Lịch sử đầy đủ' },
  bootcamp: { sessions: 'Không giới hạn*',          model: 'GPT-5.4 mini + full',      history: 'Lịch sử đầy đủ + export' },
};

export function AccountCoraRoute() {
  const [selectedTier, setSelectedTier] = useState<Tier>('pro');
  const [selectedDuration, setSelectedDuration] = useState<Duration>(12);
  const [submitting, setSubmitting] = useState(false);
  const [currentSub, setCurrentSub] = useState<AiSubscription | null>(null);

  useEffect(() => {
    getMyAiSubscription().then(setCurrentSub);
  }, []);

  const handleCheckout = async () => {
    setSubmitting(true);
    try {
      const base = window.location.origin;
      const checkout = await createAiSubscriptionCheckout({
        tier: selectedTier,
        durationMonths: selectedDuration,
        successUrl: `${base}/checkout/success/ai_subscription/${selectedTier}`,
        errorUrl:   `${base}/account/cora?payment=error`,
        cancelUrl:  `${base}/account/cora?payment=cancel`,
      });

      window.sessionStorage.setItem('corelia:lastCheckout', JSON.stringify({
        orderId: checkout.order_id,
        purpose: 'ai_subscription',
        tier: selectedTier,
        durationMonths: selectedDuration,
        createdAt: Date.now(),
      }));

      submitSePayCheckoutForm(checkout);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tạo được phiên thanh toán.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayPrice = PRICES[selectedTier][selectedDuration];
  const saving = SAVINGS[selectedDuration];

  return (
    <div className="space-y-6">
      {/* Current subscription status */}
      {currentSub && <CurrentSubscriptionCard sub={currentSub} />}

      {/* Tier selector */}
      <TierSelector selected={selectedTier} onChange={setSelectedTier} />

      {/* Duration selector */}
      <DurationSelector
        selected={selectedDuration}
        onChange={setSelectedDuration}
        tier={selectedTier}
        prices={PRICES[selectedTier]}
      />

      {/* CTA */}
      <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {formatVndPrice(displayPrice)}
              {saving > 0 && (
                <span className="ml-2 text-xs text-primary">Tiết kiệm {saving}%</span>
              )}
            </p>
            <p className="text-xs text-foreground-muted">
              Thanh toán qua SePay · Kích hoạt ngay sau xác nhận
            </p>
          </div>
          <Button
            onClick={handleCheckout}
            disabled={submitting}
            className="shrink-0"
          >
            {submitting ? 'Đang chuyển hướng…' : 'Thanh toán qua SePay'}
          </Button>
        </div>
      </div>

      {/* Transaction history */}
      <AiTransactionHistory />
    </div>
  );
}
```

## 7.4 CheckoutSuccess — thêm case ai_subscription

```typescript
// src/pages/CheckoutSuccess.tsx — thêm case
// Route: /checkout/success/ai_subscription/:tier

if (purpose === 'ai_subscription') {
  // Poll verify endpoint (tương tự course purchase)
  const result = await verifyAiSubscription({ orderId });
  if (result.status === 'active') {
    // Redirect về account/cora với success state
    navigate('/account/cora?payment=success');
  }
}
```

## 7.5 Quota exceeded → Upsell

Khi AI trả về lỗi `quota_exceeded`, hiển thị upgrade prompt trong chat:

```typescript
// Trong useCoraAI hook, khi status 429:
if (response.status === 429) {
  const data = await response.json();
  setError({
    type: 'quota_exceeded',
    used: data.used,
    limit: data.limit,
    tier: data.tier,
  });
  // UI sẽ render UpgradePrompt thay vì error text
}
```

```typescript
// UpgradePrompt component — inline trong CoraShell footer
function QuotaExceededPrompt({ tier, used, limit }: { tier: string; used: number; limit: number }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
      <p className="font-medium text-foreground">
        Đã dùng hết {used}/{limit} tin nhắn tháng này
      </p>
      <p className="mt-0.5 text-xs text-foreground-muted">
        {tier === 'free' ? 'Nâng cấp để tiếp tục học cùng Cora' : 'Gia hạn để tiếp tục'}
      </p>
      <Button
        render={<NavLink to="/account/cora" />}
        nativeButton={false}
        size="sm"
        className="mt-2 w-full"
      >
        {tier === 'free' ? 'Xem gói Cora AI' : 'Gia hạn ngay'}
      </Button>
    </div>
  );
}
```

---

# 8. Expiry & Downgrade Flow

## 8.1 Cron job kiểm tra hết hạn

Dùng `pg_cron` hoặc Supabase scheduled functions (Phase 2).

```sql
-- Chạy hàng ngày lúc 00:00 UTC
-- Downgrade users có subscription expired
create or replace function expire_ai_subscriptions()
returns void language plpgsql as $$
begin
  -- Mark expired subscriptions
  update ai_subscriptions
  set status = 'expired'
  where status = 'active'
    and expires_at < now();

  -- Downgrade profiles
  update profiles
  set tier = 'free'
  where id in (
    select user_id from ai_subscriptions
    where status = 'expired'
    and expires_at > now() - interval '1 day'  -- expired trong 24h qua
  )
  and id not in (
    select user_id from ai_subscriptions
    where status = 'active'  -- còn subscription khác active
  );
end;
$$;
```

## 8.2 Expiry reminder email (Phase 2)

7 ngày trước khi hết hạn → trigger email qua Supabase Edge Function cron:

```typescript
// supabase/functions/cron-expiry-reminder/index.ts
const expiringSoon = await db.from('ai_subscriptions')
  .select('user_id, tier, expires_at')
  .eq('status', 'active')
  .gte('expires_at', new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString())
  .lte('expires_at', new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString());

// Send email via Resend/Postmark với link đến /account/cora
```

## 8.3 Subscription status trong UI

Thêm Cora subscription status vào `authStore` hoặc load on demand trong `/account`:

```typescript
// src/stores/authStore.ts — thêm
interface AuthState {
  // ... existing
  aiSubscription: AiSubscription | null;
  loadAiSubscription: () => Promise<void>;
}
```

Hiển thị expiry badge ở `GlobalCoraAssistant` khi còn ≤ 7 ngày:

```typescript
// Trong GlobalCoraAssistant hoặc CoraShell
{daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
  <div className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
    Hết hạn {daysUntilExpiry === 0 ? 'hôm nay' : `sau ${daysUntilExpiry} ngày`}
  </div>
)}
```

---

## Tóm tắt phụ thuộc implementation

| Task | Phụ thuộc vào |
|------|--------------|
| `ai_subscriptions` table | Migration |
| `ai_usage_monthly` (rename) | Migration |
| New payment handler | `payments/handlers.ts` + router |
| `grant_access.ts` branch | Handler mới |
| `payments.ts` client | Handler deployed |
| `AccountCoraRoute` | payments.ts + router |
| CheckoutSuccess ai_subscription | AccountCoraRoute |
| Expiry cron | Subscriptions table + pg_cron |
| Quota upsell UI | useCoraAI hook |

---

*Document này là nguồn sự thật cho Cora AI monetization và payment integration.*
*Update khi có thay đổi về pricing, payment flow, hoặc tier limits.*
