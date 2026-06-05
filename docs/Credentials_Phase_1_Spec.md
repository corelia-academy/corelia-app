# Corelia Academy — Credentials Spec (Phase 1 + OCA Update)

> Spec này cover **Phase 1** đầy đủ: OCB (Open Campus Badge) và OCA (Open Campus Achievement), bao gồm in-app notifications, transactional email, và thumbnail image cho frontend display.
>
> *Career Track Certification (MCQ + Project + Stripe), Bootcamp paid, Offline 6-Month, UniHackFest sẽ ở phase sau.*

---

## Mục lục

1. [Credential Types — OCB vs OCA](#1-credential-types--ocb-vs-oca)
2. [Program Format Mapping](#2-program-format-mapping)
3. [OpenCampus Payload](#3-opencampus-payload)
4. [Schema](#4-schema)
5. [Notification & Email Flow](#5-notification--email-flow)
6. [Flow theo từng scope](#6-flow-theo-từng-scope)
7. [UI Admin](#7-ui-admin)
8. [UI Learner](#8-ui-learner)
9. [Roadmap Implementation](#9-roadmap-implementation)
10. [Open Questions](#10-open-questions)

---

## 1. Credential Types — OCB vs OCA

OpenCampus hỗ trợ hai loại credential khác nhau ở infrastructure level:

| Thuộc tính | OCB (Open Campus Badge) | OCA (Open Campus Achievement) |
|---|---|---|
| `collectionSymbol` trong payload | `"ocbadge"` (bắt buộc) | **Bỏ trống** — OC platform tự default sang OCA |
| `name` + `email` trong `credentialSubject` | Không có | **Bắt buộc** (khi có) |
| `achievementType` hợp lệ | `Badge`, `Award` | `MicroCredential`, `Diploma`, `CertificateOfCompletion` |
| Phù hợp cho | Huy hiệu, giải hackathon, milestones | Chứng chỉ hoàn thành khoá học, văn bằng |

### 1.1 Cách phân biệt trong code

```typescript
const isOCA = !template.collection_symbol;
// collection_symbol = 'ocbadge' → OCB
// collection_symbol = NULL      → OCA
```

Constraint trong DB đảm bảo nhất quán:
- OCB: `collection_symbol = 'ocbadge'` và `achievement_type IN ('Badge', 'Award')`
- OCA: `collection_symbol IS NULL` và `achievement_type IN ('MicroCredential', 'Diploma', 'CertificateOfCompletion')`

---

## 2. Program Format Mapping

Mỗi loại chương trình Corelia map sang một VC type cụ thể:

| Chương trình | Scope | VC Type | `collectionSymbol` | `achievementType` |
|---|---|---|---|---|
| Online eLearning (tự học) | `course` | OCB Badge | `ocbadge` | `Badge` |
| Career Track Certificate | `course` | OCA MicroCredential | `null` | `MicroCredential` |
| Offline 6-Month Program | `course` | OCA Diploma | `null` | `Diploma` |
| Bootcamp | `course` | OCA CertificateOfCompletion | `null` | `CertificateOfCompletion` |
| Hackathon (winner/finalist/participant) | `hackathon` | OCB Award | `ocbadge` | `Award` |
| Activity Milestone | `activity_milestone` | OCB Badge | `ocbadge` | `Badge` |

> **Lưu ý:** `scope_type = 'course'` có thể là **OCB hoặc OCA** tuỳ cấu hình template. Admin chọn loại khi setup template cho từng khoá học.

---

## 3. OpenCampus Payload

### 3.1 Endpoints

```
Staging:    POST https://api.vc.staging.opencampus.xyz/issuer/vc
Mainnet:    POST https://api.vc.opencampus.xyz/issuer/vc

Header: X-API-KEY: <api_key_của_Corelia>
```

Lưu URL + API key trong `system_settings` và **Supabase Vault**, không hardcode.

### 3.2 Image specs

Có **3 loại ảnh** khác nhau với mục đích khác nhau:

| Trường | Vị trí trong payload | Kích thước | Mục đích |
|---|---|---|---|
| `credentialPayload.image` | Institution logo | **1300 × 1300 px** (vuông, tối thiểu) | Logo Corelia trong VC header |
| `credentialSubject.image` | Badge/cert art | **1600 × 1200 px** (4:3 landscape) hoặc **1200 × 1600 px** (3:4 portrait) | Ảnh full-res gửi lên OpenCampus |
| `thumbnail_url` (DB only) | Không gửi lên OC | **800 × 600 px** hoặc **600 × 800 px** | Preview cho in-app cards và notification bell |

> `thumbnail_url` **chỉ lưu trong DB** (`credential_templates.thumbnail_url`), không xuất hiện trong OC payload. Frontend dùng `thumbnail_url ?? image_url` làm fallback.

### 3.3 Payload mẫu — OCB Badge (Course online / Activity Milestone)

```json
{
  "credentialPayload": {
    "validFrom": "2026-05-09T00:00:00.000Z",
    "awardedDate": "2026-05-09T00:00:00.000Z",
    "description": "Hoàn thành khoá học AI Fundamentals với 100% bài học",
    "image": "https://app.corelia.academy/brand/corelia-logo-1300.png",
    "credentialSubject": {
      "type": "Person",
      "image": "https://cdn.corelia.academy/badges/ai-fund-1600x1200.png",
      "profileUrl": "https://app.corelia.academy/u/nguyenvana",
      "achievement": {
        "name": "AI Fundamentals",
        "identifier": "c9a2f3b1d4e5c6a7b8d9e0f1a2b3c4d5e6f7a8b9",
        "description": "Hoàn thành khoá học AI Fundamentals với 100% bài học",
        "achievementType": "Badge"
      },
      "ext:OC_CUSTOM:custom": {
        "ext:OC_CUSTOM:corelia:scope_type": "course",
        "ext:OC_CUSTOM:corelia:scope_id": "uuid-course-id"
      }
    }
  },
  "collectionSymbol": "ocbadge",
  "holderOcId": "oc_user123",
  "issuerReferenceId": "corelia:ai-fund:abc123def456"
}
```

### 3.4 Payload mẫu — OCA CertificateOfCompletion (Bootcamp)

```json
{
  "credentialPayload": {
    "validFrom": "2026-05-09T00:00:00.000Z",
    "awardedDate": "2026-05-09T00:00:00.000Z",
    "description": "Hoàn thành Bootcamp Blockchain Development của Corelia Academy",
    "image": "https://app.corelia.academy/brand/corelia-logo-1300.png",
    "credentialSubject": {
      "type": "Person",
      "name": "Nguyễn Văn A",
      "email": "nguyenvana@gmail.com",
      "image": "https://cdn.corelia.academy/certs/blockchain-bootcamp-1200x1600.png",
      "profileUrl": "https://app.corelia.academy/u/nguyenvana",
      "achievement": {
        "name": "Blockchain Development Bootcamp",
        "identifier": "c9a2f3b1d4e5c6a7b8d9e0f1a2b3c4d5e6f7a8b9",
        "description": "Hoàn thành Bootcamp Blockchain Development của Corelia Academy",
        "achievementType": "CertificateOfCompletion"
      },
      "ext:OC_CUSTOM:custom": {
        "ext:OC_CUSTOM:corelia:scope_type": "course",
        "ext:OC_CUSTOM:corelia:scope_id": "uuid-course-id"
      }
    }
  },
  "holderOcId": "oc_user123",
  "issuerReferenceId": "corelia:blockchain-bootcamp:abc123def456"
}
```

> OCA: **không có `collectionSymbol`** trong payload, **có `name` + `email`** trong `credentialSubject`.

### 3.5 Payload mẫu — OCA MicroCredential (Career Track)

```json
{
  "credentialPayload": {
    "validFrom": "2026-05-09T00:00:00.000Z",
    "awardedDate": "2026-05-09T00:00:00.000Z",
    "description": "Hoàn thành AI Career Track — 5 khoá học chuyên sâu về AI",
    "image": "https://app.corelia.academy/brand/corelia-logo-1300.png",
    "credentialSubject": {
      "type": "Person",
      "name": "Nguyễn Văn A",
      "email": "nguyenvana@gmail.com",
      "image": "https://cdn.corelia.academy/certs/ai-career-track-1200x1600.png",
      "profileUrl": "https://app.corelia.academy/u/nguyenvana",
      "achievement": {
        "name": "AI Career Track Certificate",
        "identifier": "c9a2f3b1d4e5c6a7b8d9e0f1a2b3c4d5e6f7a8b9",
        "description": "Hoàn thành AI Career Track — 5 khoá học chuyên sâu về AI",
        "achievementType": "MicroCredential"
      },
      "ext:OC_CUSTOM:custom": {
        "ext:OC_CUSTOM:corelia:scope_type": "course",
        "ext:OC_CUSTOM:corelia:scope_id": "uuid-course-id"
      }
    }
  },
  "holderOcId": "oc_user123",
  "issuerReferenceId": "corelia:ai-career-track:abc123def456"
}
```

### 3.6 Payload mẫu — OCB Award (Hackathon Winner)

```json
{
  "credentialPayload": {
    "validFrom": "2026-05-09T00:00:00.000Z",
    "awardedDate": "2026-05-09T00:00:00.000Z",
    "description": "Giải nhất Mini Hackathon Q2 2026 — Corelia Academy",
    "image": "https://app.corelia.academy/brand/corelia-logo-1300.png",
    "credentialSubject": {
      "type": "Person",
      "image": "https://cdn.corelia.academy/badges/hackq2-winner-1600x1200.png",
      "profileUrl": "https://app.corelia.academy/u/nguyenvana",
      "achievement": {
        "name": "Winner — Mini Hackathon Q2 2026",
        "identifier": "c9a2f3b1d4e5c6a7b8d9e0f1a2b3c4d5e6f7a8b9",
        "description": "Giải nhất Mini Hackathon Q2 2026 — Corelia Academy",
        "achievementType": "Award"
      },
      "ext:OC_CUSTOM:custom": {
        "ext:OC_CUSTOM:corelia:scope_type": "hackathon",
        "ext:OC_CUSTOM:corelia:scope_id": "uuid-hackathon-id"
      }
    }
  },
  "collectionSymbol": "ocbadge",
  "holderOcId": "oc_user123",
  "issuerReferenceId": "corelia:hackq2:winner:abc123def456"
}
```

### 3.7 Payload mẫu — OCB Badge (Activity Milestone)

```json
{
  "credentialPayload": {
    "validFrom": "2026-05-09T00:00:00.000Z",
    "awardedDate": "2026-05-09T00:00:00.000Z",
    "description": "Đạt streak 30 ngày học liên tiếp trên Corelia Academy",
    "image": "https://app.corelia.academy/brand/corelia-logo-1300.png",
    "credentialSubject": {
      "type": "Person",
      "image": "https://cdn.corelia.academy/badges/streak-30-1600x1200.png",
      "profileUrl": "https://app.corelia.academy/u/nguyenvana",
      "achievement": {
        "name": "Người học bền bỉ",
        "identifier": "c9a2f3b1d4e5c6a7b8d9e0f1a2b3c4d5e6f7a8b9",
        "description": "Đạt streak 30 ngày học liên tiếp trên Corelia Academy",
        "achievementType": "Badge"
      },
      "ext:OC_CUSTOM:custom": {
        "ext:OC_CUSTOM:corelia:scope_type": "activity_milestone",
        "ext:OC_CUSTOM:corelia:scope_id": "uuid-template-id"
      }
    }
  },
  "collectionSymbol": "ocbadge",
  "holderOcId": "oc_user123",
  "issuerReferenceId": "corelia:streak-30:abc123def456"
}
```

### 3.8 Deterministic IDs

```typescript
// issuerReferenceId — plain string, ≤128 chars, unique per (issuer, network)
issuerReferenceId = `${identifier_prefix}:${userId.replace(/-/g, "")}`
// vd: "corelia:ai-fund:abc123def456..."

// achievementIdentifier — sha256 truncated to ≤50 chars
achievementIdentifier = sha256(`${identifier_prefix}:${userId}`).slice(0, 50)
```

Quy tắc:
- `issuerReferenceId` **phải unique vĩnh viễn** cho mỗi (issuer, network) — OC trả `duplicate` error nếu trùng, xử lý như đã mint thành công
- `identifier` tối đa **50 ký tự**
- `identifier_prefix` tối đa **40 ký tự** (để chừa chỗ cho sha256 suffix)
- Luôn **deterministic** — build từ logic, không random

---

## 4. Schema

### 4.1 Bảng `credential_templates`

Polymorphic — phục vụ cả 3 scope:

```sql
create table credential_templates (
  id                  uuid primary key default gen_random_uuid(),

  -- Scope discriminator
  scope_type          text not null check (scope_type in (
    'course', 'hackathon', 'activity_milestone'
  )),

  -- Scope FKs (chỉ 1 NOT NULL tuỳ scope_type)
  course_id           uuid references courses(id) on delete cascade,
  hackathon_id        uuid references hackathons(id) on delete cascade,
  hackathon_role      text,  -- 'winner' | 'finalist' | 'participant' | custom

  -- Content
  name                text not null,
  description         text not null,

  -- Image URLs (xem mục 3.2 cho spec kích thước)
  image_url           text not null,      -- Full-res cho OC payload (1600×1200 hoặc 1200×1600)
  thumbnail_url       text,               -- Preview cho frontend (800×600 hoặc 600×800). NULL = fallback về image_url

  -- On-chain config
  -- NULL = OCA (không gửi collectionSymbol, OC platform tự default)
  -- 'ocbadge' = OCB (gửi collectionSymbol: 'ocbadge')
  collection_symbol   text check (collection_symbol IS NULL OR collection_symbol = 'ocbadge'),

  achievement_type    text not null check (achievement_type in (
    'Badge', 'Award',                               -- OCB types
    'MicroCredential', 'Diploma', 'CertificateOfCompletion'  -- OCA types
  )),

  -- Cross-validation: OCB achievement types chỉ dùng với OCB collection_symbol, và ngược lại
  constraint vctype_consistency check (
    (collection_symbol = 'ocbadge' AND achievement_type IN ('Badge', 'Award'))
    OR
    (collection_symbol IS NULL AND achievement_type IN ('MicroCredential', 'Diploma', 'CertificateOfCompletion'))
  ),

  identifier_prefix   text not null,      -- vd: 'corelia:ai-fund', max 40 chars

  -- Custom metadata (extra fields cho ext:OC_CUSTOM)
  custom_metadata     jsonb default '{}',

  -- Trigger
  trigger_type        text not null check (trigger_type in ('auto', 'manual')),
  trigger_rule        jsonb,

  -- Network override (null = dùng DEFAULT_MINT_NETWORK từ system_settings)
  network_override    text check (network_override in ('staging', 'mainnet')),

  is_active           bool not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Constraint: scope_type khớp với FK
  constraint scope_consistency check (
    (scope_type = 'course' and course_id is not null and hackathon_id is null) or
    (scope_type = 'hackathon' and hackathon_id is not null and course_id is null and hackathon_role is not null) or
    (scope_type = 'activity_milestone' and course_id is null and hackathon_id is null)
  )
);

create index on credential_templates (scope_type, is_active);
create index on credential_templates (course_id) where course_id is not null;
create index on credential_templates (hackathon_id) where hackathon_id is not null;

-- Course chỉ có 1 template active tại 1 thời điểm
create unique index unique_active_course_template
  on credential_templates (course_id)
  where scope_type = 'course' and is_active = true;
```

### 4.2 Format `trigger_rule` theo scope

**Course (auto):**
```json
{
  "completion_pct": 100,
  "require_assignment_pass": true,
  "min_assignment_score": 70
}
```

**Hackathon (manual):** `trigger_rule = null` — admin trực tiếp grant.

**Activity milestone (auto hoặc manual):**
```json
{ "event": "login_streak", "days": 30 }
{ "event": "courses_completed", "count": 5 }
{ "event": "courses_completed_in_track", "track": "ai", "count": 3 }
{ "manual": true }
```

### 4.3 Bảng `credential_issuances`

```sql
create table credential_issuances (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references credential_templates(id),
  user_id               uuid not null references users(id),

  -- Context refs (tuỳ scope, optional cho audit)
  course_id             uuid references courses(id),
  hackathon_id          uuid references hackathons(id),

  -- On-chain data
  issuer_reference_id   text not null,
  network               text not null check (network in ('staging', 'mainnet')),

  status                text not null check (status in ('pending', 'minted', 'failed')),

  oc_request_payload    jsonb,
  oc_response           jsonb,
  oc_credential_id      text,

  minted_at             timestamptz,
  error_message         text,
  retry_count           int not null default 0,

  -- Manual grant tracking (hackathon + activity milestone manual)
  granted_by            uuid references users(id),
  granted_reason        text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (issuer_reference_id, network)
);

create index on credential_issuances (user_id, status);
create index on credential_issuances (template_id);
create index on credential_issuances (status, created_at);  -- retry queue
```

### 4.4 Bảng `user_notifications`

Dùng cho in-app notification bell:

```sql
create table user_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  type        text not null,  -- vd: 'oc_credential_minted'
  payload     jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index on user_notifications (user_id, read_at) where read_at is null;
```

**Payload structure cho `oc_credential_minted`:**
```json
{
  "credential_name": "AI Fundamentals",
  "scope_type": "course",
  "image_url": "https://cdn.corelia.academy/badges/ai-fund-800x600.png",
  "oc_credential_id": "vc_abc123",
  "is_oca": false
}
```

> `image_url` trong notification payload là **thumbnail** (800×600), không phải full-res.

### 4.5 System settings

```sql
insert into system_settings (key, value) values
  ('default_mint_network',              'staging'),
  ('opencampus_staging_endpoint',       'https://api.vc.staging.opencampus.xyz/issuer/vc'),
  ('opencampus_mainnet_endpoint',       'https://api.vc.opencampus.xyz/issuer/vc'),
  ('mint_retry_max_count',              '3'),
  ('mint_retry_backoff_base_seconds',   '60'),
  ('corelia_logo_url',                  'https://app.corelia.academy/brand/corelia-logo-1300.png'),
  ('app_base_url',                      'https://app.corelia.academy');
```

API key OpenCampus lưu trong **Supabase Vault**:
```
OPENCAMPUS_API_KEY_STAGING
OPENCAMPUS_API_KEY_MAINNET
```

---

## 5. Notification & Email Flow

Mỗi khi mint thành công (kể cả duplicate xử lý như success), hệ thống trigger song song 2 luồng:

```
mintCredentialOnce(issuanceId)
  → POST OpenCampus API
  → success (hoặc duplicate)
    ↓
  Promise.all([
    sendMintEmail(...)        // Transactional email qua Resend
    insertCredentialNotification(...)   // In-app notification bell
  ])
```

Cả hai đều **non-blocking đối với mint result** — email/notification fail không ảnh hưởng status `minted`.

### 5.1 Email kinds

| Kind | Trigger | Nội dung |
|---|---|---|
| `course` | Course scope + OCB Badge | "Bạn vừa nhận Open Campus Badge (OCB)..." |
| `course_oca` | Course scope + OCA | "Bạn vừa nhận Open Campus Achievement (OCA) / Certificate of Completion..." |
| `hackathon` | Hackathon scope | "Bạn vừa nhận giải thưởng hackathon..." |
| `milestone` | Activity milestone scope | "Bạn vừa đạt thành tích..." |

Logic resolve kind:
```typescript
function resolveMintEmailKind(scopeType: string, isOCA: boolean): CredentialMintEmailKind {
  if (scopeType === "hackathon") return "hackathon";
  if (scopeType === "activity_milestone") return "milestone";
  // course: phân biệt OCB vs OCA
  return isOCA ? "course_oca" : "course";
}
```

### 5.2 Email content

Mỗi email gồm:
- Subject line phù hợp với loại credential
- Ảnh badge/cert (`image_url` từ template — full-res, hiển thị max 300px wide trong email)
- Tên credential
- Link đến profile page (`/u/<username>` hoặc `/account`)
- CTA button: "Xem thành tích của tôi →"
- Hỗ trợ i18n: EN + VI (detect từ `user_metadata.locale`)

### 5.3 In-app notification bell

Notification hiển thị trong bell icon ở navbar:
- Thumbnail ảnh 48×48px (dùng `thumbnail_url` từ template, fallback về `image_url`)
- Title: "Bạn vừa nhận được chứng chỉ!" (OCA) hoặc "Bạn vừa nhận được huy hiệu!" (OCB)
- Body: tên credential
- Link: `/account/achievements` (đánh dấu read khi click)

---

## 6. Flow theo từng scope

### 6.1 Course Credential (auto trigger)

```
Trigger: User hoàn thành activity trong course
  ↓
Edge Function check_course_completion(user_id, course_id):
  1. Tìm credential_template active của course_id
  2. Đánh giá trigger_rule (completion_pct, assignment_pass...)
  3. Check duplicate: issuer_reference_id đã tồn tại với status='minted'/'pending'?
     → Nếu có: return
  4. Tạo row pending → gọi mintCredentialOnce(issuance_id)
  ↓
mintCredentialOnce(issuance_id):
  5. Build OC payload (OCB hoặc OCA tuỳ collection_symbol)
  6. POST OpenCampus API
  7. Update status='minted' + oc_credential_id
  8. Promise.all([sendMintEmail, insertCredentialNotification])
  ↓
On fail (non-duplicate): retry với exponential backoff (60s, 120s, 240s)
```

**Payload logic theo loại course:**
- `collection_symbol = 'ocbadge'` → OCB Badge: không gửi `name`/`email`, có `collectionSymbol`
- `collection_symbol = NULL` → OCA (MicroCredential / CertificateOfCompletion / Diploma): gửi `name` + `email`, không có `collectionSymbol`

### 6.2 Hackathon Award (manual trigger)

```
Trigger: Admin click "Grant award" trong admin panel hackathon
  ↓
Admin chọn:
  - Template (winner/finalist/participant — đều là OCB Award)
  - User(s) nhận award (multi-select, bulk grant)
  - Reason (optional, lưu vào granted_reason)
  ↓
For each user:
  1. issuer_reference_id = template.identifier_prefix + ':' + userId (no dashes)
  2. Check duplicate → tạo row pending → mintCredentialOnce
  ↓
mintCredentialOnce: giống Course flow (bước 5–8)
```

Tất cả hackathon template đều là **OCB Award** (`collection_symbol = 'ocbadge'`, `achievement_type = 'Award'`).

### 6.3 Activity Milestone (auto + manual)

**Auto trigger:**
```
Mỗi khi có event quan trọng, backend gọi check_activity_milestones(user_id, event_type):
  1. Lấy tất cả templates active với scope='activity_milestone' và trigger_type='auto'
     và trigger_rule.event = event_type
  2. For each template:
     a. Đánh giá rule
     b. Nếu thoả → check duplicate → tạo issuance pending → mintCredentialOnce
```

**Manual trigger:** Admin vào Activity Milestones → Grant → chọn user → flow giống Hackathon.

**Event types cần emit:**
```typescript
emitEvent('course_completed', { user_id, course_id, track });
emitEvent('login_streak_updated', { user_id, days: streak_days });
emitEvent('project_submitted', { user_id, project_id });
```

---

## 7. UI Admin

### 7.1 Tab "Chứng nhận" trong Course edit

Form config template cho course, với dropdown chọn loại VC:

```jsx
<Card>
  <Switch label="Cấp chứng nhận khi hoàn thành"
          checked={template?.is_active}
          onChange={toggleActive} />

  {template?.is_active && (
    <>
      <FormSection title="Loại chứng nhận">
        <Select label="VC Type" options={[
          { value: 'ocb_badge',     label: 'OCB Badge — Khoá học online tự học' },
          { value: 'oca_micro',     label: 'OCA MicroCredential — Career Track' },
          { value: 'oca_diploma',   label: 'OCA Diploma — Chương trình 6 tháng' },
          { value: 'oca_cert',      label: 'OCA CertificateOfCompletion — Bootcamp' },
        ]} />
        {/* Tự động set collection_symbol + achievement_type từ selection */}
      </FormSection>

      <FormSection title="Nội dung">
        <Input label="Tên" placeholder="AI Fundamentals" />
        <Textarea label="Mô tả" />
        <ImageUpload label="Ảnh badge/cert (full-res cho OC payload)"
                     helpText="1600×1200 px (landscape) hoặc 1200×1600 px (portrait)" />
        <ImageUpload label="Thumbnail preview (cho in-app display)"
                     helpText="800×600 px hoặc 600×800 px. Để trống = dùng ảnh trên làm fallback." />
      </FormSection>

      <FormSection title="Điều kiện cấp">
        <Input type="number" label="% bài học hoàn thành" defaultValue={100} />
        <Switch label="Yêu cầu pass bài tập cuối khoá" />
        {requireAssignment && (
          <Input type="number" label="Điểm tối thiểu" defaultValue={70} />
        )}
      </FormSection>

      <FormSection title="Identifier (advanced)">
        <Input label="Identifier prefix"
               placeholder="corelia:ai-fund"
               helpText="Tối đa 40 ký tự. Sẽ dùng để tạo issuerReferenceId unique cho mỗi học viên." />
      </FormSection>

      <Button>Lưu cấu hình</Button>
    </>
  )}
</Card>
```

### 7.2 Tab "Giải thưởng" trong Hackathon edit

Hai phần: **Templates** + **Grant**. Tất cả template hackathon đều là OCB Award (admin không cần chọn loại).

### 7.3 Page Activity Milestones

Tất cả milestone template đều là OCB Badge. Xem spec gốc section 5.3 để biết seed milestones gợi ý.

---

## 8. UI Learner

### 8.1 Trang Achievements (`/account/achievements`)

Tabs phân loại:
- **OCA** — course credentials loại OCA (MicroCredential, Diploma, CertificateOfCompletion)
- **Badges** — hackathon awards + course OCB badges + activity milestones

Mỗi BadgeCard hiển thị:
- `thumbnail_url ?? image_url` (preview nhỏ)
- Tên credential
- Type chip: `OCA`, `Badge`, `Milestone`, hoặc hackathon_role nếu có
- Ngày nhận
- Link "Xem trên OpenCampus" → `https://id.opencampus.xyz/public/credentials?id=<oc_credential_id>`

### 8.2 Notification Bell

Khi nhận credential mới:
- Badge nhỏ đỏ trên bell icon
- Click bell → dropdown list thông báo
- Mỗi notification: thumbnail 48px + title + tên badge + link `/account/achievements`

### 8.3 Email nhận được

User nhận 1 email transactional qua Resend ngay sau khi mint thành công. Nội dung tuỳ loại credential (xem mục 5.2).

---

## 9. Roadmap Implementation

**Phase 1A — Foundation (4 ngày)**
- Day 1: Schema migration (credential_templates với các column mới + credential_issuances + user_notifications)
- Day 2: Edge Function `mintCredentialOnce` — OCB và OCA payload builder, retry queue
- Day 3: Email templates Resend (4 kinds: course_ocb, course_oca, hackathon, milestone)
- Day 4: Profile/Achievements page UI learner

**Phase 1B — Course Credential (2 ngày)**
- Day 5: Tab "Chứng nhận" trong course edit — hỗ trợ chọn OCB/OCA type
- Day 6: Edge Function `check_course_completion` + event integration

**Phase 1C — Hackathon Award (2 ngày)**
- Day 7: Tab "Giải thưởng" trong hackathon edit
- Day 8: Manual grant + bulk grant logic

**Phase 1D — Activity Milestone (2 ngày)**
- Day 9: Page admin Activity Milestones + CRUD
- Day 10: Edge Function `check_activity_milestones` + event emitters

**Build order gợi ý:** 1A → 1B → 1D → 1C

Activity Milestone (1D) có volume cao hơn (mọi user đều có thể hit milestone). Build 1D trước để có data thực tế và debug pipeline mint sớm hơn trước khi làm hackathon 1C.

---

## 10. Open Questions

1. **API key OpenCampus:** Đã có key staging chưa? Nếu chưa, ping team OpenCampus — mainnet key thường cần KYC issuer (mất vài tuần).

2. **OCA và PII:** OCA payload gửi `name` + `email` lên OpenCampus EduChain. Cần confirm với user rằng data này sẽ on-chain (immutable). Nên có consent UI trước khi mint OCA lần đầu.

3. **Wallet / OC ID requirement:** OCB có thể dùng `holderAddress` fallback. OCA sẽ như thế nào nếu user chưa có OC ID và chưa connect wallet? Có allow mint mà không có `holderOcId`/`holderAddress` không?

4. **Default milestones seed:** 8 milestones gợi ý ở spec gốc (streak 7/30 ngày, complete 1/5 courses, AI/App/Blockchain Developer, First Project). Launch đủ 8 hay start nhỏ?

5. **`thumbnail_url` cho templates hiện tại:** Templates đã có trước khi migrate sẽ có `thumbnail_url = NULL` → fallback về `image_url`. Nếu `image_url` là full-res 1600×1200, frontend sẽ load ảnh lớn cho notification bell. Cần update thumbnail sau khi migrate.

6. **`hackathons` table:** Đã tồn tại chưa? Schema bảng cần có trước khi làm Phase 1C.

---

## Appendix A: Naming convention `identifier_prefix`

```
Course (online/career/bootcamp): corelia:<course_slug>
Hackathon winner:                corelia:<hackathon_slug>:winner
Hackathon finalist:              corelia:<hackathon_slug>:finalist
Hackathon participant:           corelia:<hackathon_slug>:partic
Activity milestone:              corelia:<milestone_slug>
```

Examples:
```
corelia:ai-fund          → issuerReferenceId: corelia:ai-fund:abc123def456...
corelia:hackq2:winner    → issuerReferenceId: corelia:hackq2:winner:abc123def456...
corelia:streak-30        → issuerReferenceId: corelia:streak-30:abc123def456...
```

Mỗi `identifier_prefix` tối đa **40 ký tự** (để total `issuerReferenceId` không quá dài).

## Appendix B: System settings cần config

```
default_mint_network              = 'staging' | 'mainnet'
opencampus_staging_endpoint       = 'https://api.vc.staging.opencampus.xyz/issuer/vc'
opencampus_mainnet_endpoint       = 'https://api.vc.opencampus.xyz/issuer/vc'
mint_retry_max_count              = '3'
mint_retry_backoff_base_seconds   = '60'
corelia_logo_url                  = 'https://app.corelia.academy/brand/corelia-logo-1300.png'
app_base_url                      = 'https://app.corelia.academy'
```

API key trong **Supabase Vault** (không phải system_settings):
```
OPENCAMPUS_API_KEY_STAGING
OPENCAMPUS_API_KEY_MAINNET
```

## Appendix C: Credential type quick reference

| `collection_symbol` | `achievement_type` | Loại | Phù hợp cho |
|---|---|---|---|
| `ocbadge` | `Badge` | OCB | Course online, Activity milestone |
| `ocbadge` | `Award` | OCB | Hackathon |
| `null` | `MicroCredential` | OCA | Career Track |
| `null` | `Diploma` | OCA | Offline 6-month program |
| `null` | `CertificateOfCompletion` | OCA | Bootcamp |

---

*Spec cover Phase 1 đầy đủ bao gồm OCB và OCA. Career Track paid (Stripe), Bootcamp commercial, và UniHackFest sẽ ở phase sau, dùng chung foundation `credential_templates` + `credential_issuances` đã có.*
