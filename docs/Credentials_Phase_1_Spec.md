# Corelia Academy — Credentials Phase 1 Spec

> Spec **Phase 1** chỉ tập trung vào 3 loại credential cơ bản, đều là OCB (Open Campus Badge). Không bao gồm Career Track Certification, Bootcamp, Offline 6-Month, hay UniHackFest (sẽ làm ở phase sau).

---

## Mục lục

1. [Scope Phase 1](#1-scope-phase-1)
2. [OpenCampus Integration](#2-opencampus-integration)
3. [Schema](#3-schema)
4. [Flow theo từng scope](#4-flow-theo-từng-scope)
5. [UI Admin](#5-ui-admin)
6. [UI Learner](#6-ui-learner)
7. [Roadmap Implementation](#7-roadmap-implementation)
8. [Open Questions](#8-open-questions)

---

## 1. Scope Phase 1

3 loại credential, **tất cả đều OCB**:

| Loại                 | Scope config                 | achievementType | collectionSymbol       |
| -------------------- | ---------------------------- | --------------- | ---------------------- |
| Course completion    | Setting trong từng khoá học  | `Badge`         | `corelia-courses`      |
| Mini Hackathon award | Setting trong từng hackathon | `Award`         | `corelia-hackathons`   |
| Activity milestone   | Setting global trong admin   | `Badge`         | `corelia-achievements` |

### 1.1 Vì sao Phase 1 đơn giản hơn full spec

- **Tất cả OCB** → không cần `name`/`email` của learner trong payload, không bắt buộc `holderOcId` strict (có thể dùng `holderAddress`)
- **Không có exam/payment** → không cần Stripe, voucher, MCQ engine, project review
- **100% async mint qua Edge Function** → architecture đồng nhất
- **3 scope khác nhau nhưng dùng chung 1 schema base** (`credential_templates`) — code tái sử dụng cao

### 1.2 Khác biệt cốt lõi giữa 3 scope

**Course completion:** 1 course = 1 template. Trigger **auto** khi học viên đạt điều kiện hoàn thành (% lesson + bài tập optional).

**Mini Hackathon:** 1 hackathon = nhiều template (winner/finalist/participant — tuỳ Tuong định nghĩa). Trigger **manual** — admin chọn user nhận award sau khi judge.

**Activity milestone:** Không gắn với course/hackathon cụ thể, là badge global. Trigger **auto** dựa trên event (login streak, complete 5 courses…) hoặc **manual** (admin grant cho special case).

---

## 2. OpenCampus Integration

### 2.1 Endpoints

```
Staging:    POST https://api.vc.staging.opencampus.xyz/issuer/vc
Production: POST https://api.vc.opencampus.xyz/issuer/vc

Header: X-API-KEY: <api_key_của_Corelia>
```

Lưu URL + API key trong `system_settings` (qua Supabase Vault), không hardcode.

### 2.2 Payload OCB chuẩn (dùng chung cho cả 3 scope)

```json
{
  "credentialPayload": {
    "validFrom": "2026-05-09T00:00:00.000Z",
    "awardedDate": "2026-05-09T00:00:00.000Z",
    "description": "<description từ template>",
    "image": "https://app.corelia.academy/brand/corelia-logo-1300.png",
    "credentialSubject": {
      "type": "Person",
      "image": "<image_url từ template>",
      "profileUrl": "https://app.corelia.academy/u/<username>",
      "achievement": {
        "name": "<name từ template>",
        "identifier": "<identifier_prefix>:<user_id>",
        "description": "<description>",
        "achievementType": "<Badge | Award>"
      },
      "ext:OC_CUSTOM:custom": {
        "ext:OC_CUSTOM:corelia:scope_type": "course | hackathon | activity_milestone",
        "ext:OC_CUSTOM:corelia:scope_id": "<course_id | hackathon_id | milestone_id>"
      }
    }
  },
  "collectionSymbol": "<corelia-courses | corelia-hackathons | corelia-achievements>",
  "holderOcId": "<oc_id nếu có>",
  "holderAddress": "<wallet address fallback nếu chưa có OC ID>",
  "issuerReferenceId": "<identifier_prefix>:<user_id>"
}
```

### 2.3 Lưu ý cốt lõi

- `identifier` tối đa **50 ký tự**
- `issuerReferenceId` **unique vĩnh viễn cho mỗi (issuer, network)** — mint trùng = lỗi
- `issuerReferenceId` luôn **deterministic** (build từ logic), không random — để idempotent
- `holderOcId` HOẶC `holderAddress` cho OCB — ưu tiên `holderOcId` nếu user đã connect OC, fallback `holderAddress`

---

## 3. Schema

### 3.1 Bảng base: `credential_templates`

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
  image_url           text not null,                  -- ảnh badge/award (4:3 hoặc 3:4)
  
  -- On-chain config
  achievement_type    text not null check (achievement_type in ('Badge', 'Award')),
  identifier_prefix   text not null,                  -- 'corelia:ai-fund', 'corelia:hackq2:winner'
  collection_symbol   text not null,                  -- 'corelia-courses' | 'corelia-hackathons' | 'corelia-achievements'
  
  -- Custom metadata (extra fields cho ext:OC_CUSTOM)
  custom_metadata     jsonb default '{}',
  
  -- Trigger
  trigger_type        text not null check (trigger_type in ('auto', 'manual')),
  trigger_rule        jsonb,  -- format khác nhau theo scope_type, xem 3.2
  
  -- Network override (null = dùng DEFAULT_MINT_NETWORK)
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

### 3.2 Format `trigger_rule` theo scope

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
// Auto - login streak
{ "event": "login_streak", "days": 30 }

// Auto - course count
{ "event": "courses_completed", "count": 5 }

// Auto - track-specific
{ "event": "courses_completed_in_track", "track": "ai", "count": 3 }

// Manual
{ "manual": true }
```

### 3.3 Bảng issuances

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
  
  -- Manual grant tracking (cho hackathon + activity milestone manual)
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

### 3.4 Trigger updated_at

```sql
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger _credential_templates_updated before update on credential_templates
  for each row execute function set_updated_at();
create trigger _credential_issuances_updated before update on credential_issuances
  for each row execute function set_updated_at();
```

### 3.5 System settings

```sql
-- Nếu chưa có bảng này:
create table system_settings (
  key     text primary key,
  value   text not null,
  updated_at timestamptz not null default now()
);

insert into system_settings (key, value) values
  ('default_mint_network', 'staging'),
  ('opencampus_staging_endpoint', 'https://api.vc.staging.opencampus.xyz/issuer/vc'),
  ('opencampus_mainnet_endpoint', 'https://api.vc.opencampus.xyz/issuer/vc'),
  ('mint_retry_max_count', '3'),
  ('mint_retry_backoff_base_seconds', '60');
```

API key OpenCampus lưu trong **Supabase Vault**, không phải `system_settings`.

---

## 4. Flow theo từng scope

### 4.1 Course Badge (auto trigger)

```
Trigger: User hoàn thành activity trong course
  ↓
Edge Function `check_course_completion(user_id, course_id)`:
  1. Tìm credential_template active của course_id
     SELECT * FROM credential_templates 
     WHERE scope_type='course' AND course_id=? AND is_active=true
  2. Đánh giá trigger_rule:
     - completion_pct = (lessons_completed / total_lessons) * 100
     - Nếu require_assignment_pass: check assignment_submissions
     - Nếu fail rule → return, không mint
  3. Check duplicate:
     issuer_reference_id = template.identifier_prefix || ':' || user_id
     SELECT FROM credential_issuances WHERE issuer_reference_id=? AND network=?
     Nếu đã có (status='minted' hoặc 'pending') → return
  4. Tạo row pending → enqueue mint job
  ↓
Mint Job (`mint_credential(issuance_id)`):
  5. Build OC payload từ template + user info
  6. POST OpenCampus
  7. Update status='minted' + oc_credential_id, hoặc status='failed' + error_message
  ↓
On success: Email user "Bạn vừa nhận huy hiệu hoàn thành"
On fail (non-duplicate): retry với exponential backoff (60s, 120s, 240s)
```

### 4.2 Hackathon Award (manual trigger)

```
Trigger: Admin click "Grant award" trong admin panel hackathon
  ↓
Admin chọn:
  - Hackathon (ví dụ "Mini Hackathon Q2 2026")
  - Template (ví dụ "Winner template" của hackathon đó)
  - User(s) nhận award (multi-select, có thể bulk grant)
  - Reason (optional, lưu vào granted_reason)
  ↓
For each user:
  1. issuer_reference_id = template.identifier_prefix || ':' || user_id
  2. Check duplicate (giống course flow)
  3. Tạo row pending với granted_by, granted_reason → enqueue mint job
  ↓
Mint Job: giống Course flow (4.1, bước 5–7)
  ↓
Email user: "Bạn vừa nhận giải thưởng <name> từ <hackathon>!"
```

### 4.3 Activity Milestone (auto + manual)

**Auto trigger:**

```
Mỗi khi có event quan trọng (course_completed, daily_login...), 
backend gọi `check_activity_milestones(user_id, event_type)`:

  1. Lấy tất cả templates active scope='activity_milestone' với trigger_type='auto'
     và trigger_rule.event = event_type
  2. For each template:
     a. Đánh giá rule (vd: count courses completed by user trong track 'ai')
     b. Nếu thoả → check duplicate → tạo issuance pending → enqueue mint
  3. Done
```

**Manual trigger:** Admin vào page Activity Milestones → click "Grant" → chọn user → flow giống Hackathon (4.2).

**Event types cần backend emit:**

```javascript
// Khi user hoàn thành course
emitEvent('course_completed', { user_id, course_id, track });

// Cron daily kiểm tra streak
emitEvent('login_streak_updated', { user_id, days: streak_days });

// Khi user submit project
emitEvent('project_submitted', { user_id, project_id });
```

Mỗi event handler call `check_activity_milestones(user_id, event_type)`.

---

## 5. UI Admin

### 5.1 Tab "Chứng nhận" trong Course edit

(Đã có UI chỗ này theo screenshot Tuong gửi — chỉ cần fill content)

```jsx
<Card>
  <Switch label="Cấp huy hiệu khi hoàn thành" 
          checked={template?.is_active} 
          onChange={toggleActive} />
  
  {template?.is_active && (
    <>
      <FormSection title="Nội dung huy hiệu">
        <Input label="Tên" placeholder="AI Fundamentals" 
               value={template.name} />
        <Textarea label="Mô tả" 
                  placeholder="Hoàn thành 100% bài học khoá Lập trình AI cơ bản"
                  value={template.description} />
        <ImageUpload label="Ảnh huy hiệu (4:3 hoặc 3:4, ≥800px)" 
                     value={template.image_url} />
      </FormSection>
      
      <FormSection title="Điều kiện cấp">
        <Input type="number" label="% bài học hoàn thành" 
               defaultValue={100} 
               value={template.trigger_rule.completion_pct} />
        <Switch label="Yêu cầu pass bài tập cuối khoá" 
                checked={template.trigger_rule.require_assignment_pass} />
        {requireAssignment && (
          <Input type="number" label="Điểm bài tập tối thiểu" 
                 defaultValue={70} 
                 value={template.trigger_rule.min_assignment_score} />
        )}
      </FormSection>
      
      <FormSection title="Identifier (advanced)">
        <Input label="Identifier prefix" 
               placeholder="corelia:ai-fund"
               helpText="Tối đa 40 ký tự, lowercase, hyphen-separated. Sẽ append :user_id cho mỗi học viên."
               value={template.identifier_prefix} />
      </FormSection>
      
      <Button>Lưu cấu hình huy hiệu</Button>
    </>
  )}
</Card>
```

**Hardcode trong form (không cho admin sửa):**
- `scope_type = 'course'`
- `course_id = current course id`
- `achievement_type = 'Badge'`
- `collection_symbol = 'corelia-achievements'`
- `trigger_type = 'auto'`

### 5.2 Tab "Giải thưởng" trong Hackathon edit

Page này 2 phần: **Templates** (cấu hình các loại award) + **Grant** (cấp award cho user):

```jsx
<Tabs>
  <Tab label="Templates giải thưởng">
    <Toolbar>
      <Button>+ Thêm template (Winner / Finalist / Participant / custom)</Button>
    </Toolbar>
    
    <Table>
      {templates.map(t => (
        <Row>
          <Cell>{t.hackathon_role}</Cell>
          <Cell>{t.name}</Cell>
          <Cell><img src={t.image_url} className="w-12" /></Cell>
          <Cell>{t.is_active ? 'Active' : 'Draft'}</Cell>
          <Cell>{countIssuances(t.id)} đã cấp</Cell>
          <Cell><Edit /> <Toggle /></Cell>
        </Row>
      ))}
    </Table>
  </Tab>
  
  <Tab label="Cấp giải thưởng">
    <FormSection>
      <Select label="Template" 
              options={templates.filter(t => t.is_active)} />
      
      <UserMultiSelect label="Học viên nhận giải" 
                       placeholder="Tìm theo tên/email..." />
      
      <Textarea label="Lý do (optional, lưu vào audit log)" />
      
      <Button variant="primary">Cấp giải thưởng & mint on-chain</Button>
    </FormSection>
    
    <Section title="Lịch sử cấp">
      <Table>
        {recentIssuances.map(i => (
          <Row>
            <Cell>{i.user.name}</Cell>
            <Cell>{i.template.name}</Cell>
            <Cell>{i.granted_by.name}</Cell>
            <Cell>{formatDate(i.created_at)}</Cell>
            <Cell><StatusBadge status={i.status} /></Cell>
          </Row>
        ))}
      </Table>
    </Section>
  </Tab>
</Tabs>
```

**Modal khi tạo template (giống course nhưng có thêm role):**

```jsx
<Modal>
  <Select label="Vai trò" 
          options={['winner', 'finalist', 'participant', 'custom']} />
  <Input label="Tên giải" placeholder="Winner — Mini Hackathon Q2 2026" />
  <Textarea label="Mô tả" />
  <ImageUpload label="Ảnh giải" />
  <Input label="Identifier prefix" placeholder="corelia:hackq2:winner" />
  <Switch label="Active" />
</Modal>
```

### 5.3 Page Admin Settings → "Activity Milestones" (mới)

Page riêng, không gắn course/hackathon nào:

```jsx
<Layout>
  <Header>
    <h1>Activity Milestones</h1>
    <Button variant="primary">+ Thêm milestone</Button>
  </Header>
  
  <Table>
    {milestones.map(m => (
      <Row>
        <Cell><img src={m.image_url} className="w-10" /></Cell>
        <Cell>{m.name}</Cell>
        <Cell>{describeRule(m.trigger_rule)}</Cell>
        {/* "Hoàn thành 5 khoá học" or "Streak 30 ngày" */}
        <Cell><Badge>{m.trigger_type}</Badge></Cell>
        <Cell>{countIssuances(m.id)} đã cấp</Cell>
        <Cell>{m.is_active ? 'Active' : 'Draft'}</Cell>
        <Cell>
          <Edit /> <Toggle />
          {m.trigger_type === 'manual' && <Button>Grant</Button>}
        </Cell>
      </Row>
    ))}
  </Table>
</Layout>
```

**Modal tạo/sửa milestone:**

```jsx
<Modal>
  <FormSection title="Nội dung">
    <Input label="Tên milestone" placeholder="Người học bền bỉ" />
    <Textarea label="Mô tả" placeholder="Login 30 ngày liên tiếp" />
    <ImageUpload label="Ảnh badge" />
    <Input label="Identifier prefix" placeholder="corelia:streak-30" />
  </FormSection>
  
  <FormSection title="Loại trigger">
    <RadioGroup value={triggerType}>
      <Radio value="auto">Tự động (theo rule)</Radio>
      <Radio value="manual">Thủ công (admin grant)</Radio>
    </RadioGroup>
  </FormSection>
  
  {triggerType === 'auto' && (
    <FormSection title="Rule trigger">
      <Select label="Event" options={[
        { value: 'login_streak', label: 'Login streak' },
        { value: 'courses_completed', label: 'Hoàn thành N khoá học' },
        { value: 'courses_completed_in_track', label: 'Hoàn thành N khoá trong track' },
        { value: 'projects_submitted', label: 'Submit N project' }
      ]} />
      
      {event === 'login_streak' && (
        <Input type="number" label="Số ngày" placeholder="30" />
      )}
      {event === 'courses_completed' && (
        <Input type="number" label="Số khoá" placeholder="5" />
      )}
      {event === 'courses_completed_in_track' && (
        <>
          <Select label="Track" options={['app', 'ai', 'blockchain']} />
          <Input type="number" label="Số khoá" placeholder="3" />
        </>
      )}
    </FormSection>
  )}
  
  <Switch label="Active" />
  <Button>Lưu</Button>
</Modal>
```

**Default milestones suggest seed:**

| Tên                  | Rule                                      | Image idea    |
| -------------------- | ----------------------------------------- | ------------- |
| Người học chăm chỉ   | login_streak: 7 ngày                      | Lửa nhỏ       |
| Người học bền bỉ     | login_streak: 30 ngày                     | Lửa lớn       |
| Tân binh             | courses_completed: 1                      | Sao 1 cánh    |
| Học viên năng nổ     | courses_completed: 5                      | Sao 5 cánh    |
| App Developer        | courses_completed_in_track: app, 3        | Icon ứng dụng |
| AI Developer         | courses_completed_in_track: ai, 3         | Icon AI       |
| Blockchain Developer | courses_completed_in_track: blockchain, 3 | Icon block    |
| First Project        | projects_submitted: 1                     | Icon code     |

---

## 6. UI Learner

### 6.1 Profile page — Section "Huy hiệu & Giải thưởng"

```jsx
<Section title="Huy hiệu & Giải thưởng">
  <Tabs>
    <Tab label={`Khoá học (${courseBadges.length})`}>
      <Grid cols={4}>
        {courseBadges.map(b => (
          <BadgeCard 
            image={b.template.image_url}
            name={b.template.name}
            mintedAt={b.minted_at}
            ocLink={getExplorerLink(b.oc_credential_id, b.network)}
          />
        ))}
      </Grid>
    </Tab>
    <Tab label={`Giải thưởng (${awards.length})`}>
      {/* Grid hackathon awards */}
    </Tab>
    <Tab label={`Thành tích (${milestones.length})`}>
      {/* Grid activity milestones */}
    </Tab>
  </Tabs>
</Section>
```

### 6.2 Notification toast khi mint thành công

```
🎉 Bạn vừa nhận huy hiệu "AI Fundamentals"!
[Xem trên blockchain] [Chia sẻ]
```

### 6.3 Email template (Resend)

3 email cần build:

1. `course_badge_minted` — Hoàn thành course
2. `hackathon_award_minted` — Nhận giải hackathon
3. `activity_milestone_minted` — Đạt thành tích

Mỗi email: tên badge + ảnh + link explorer + CTA "Xem trên profile."

---

## 7. Roadmap Implementation

**Phase 1A — Foundation (4 ngày)**

- Day 1: Schema migration (credential_templates + credential_issuances + system_settings + triggers)
- Day 2: Edge Function `mint_credential` + retry queue + test với staging API
- Day 3: Email templates Resend (3 email)
- Day 4: Profile page section "Huy hiệu & Giải thưởng" cho learner

**Phase 1B — Course Badge (2 ngày)**

- Day 5: Tab "Chứng nhận" trong course edit (UI đã có sẵn theo screenshot, chỉ cần wire data)
- Day 6: Edge Function `check_course_completion` + integrate vào event "lesson completed" / "assignment graded"

**Phase 1C — Hackathon Award (2 ngày)**

- Day 7: Tab "Giải thưởng" trong hackathon edit (templates + grant UI)
- Day 8: Logic manual grant + bulk grant

**Phase 1D — Activity Milestone (2 ngày)**

- Day 9: Page admin Activity Milestones + modal CRUD
- Day 10: Edge Function `check_activity_milestones` + event emitters trong các flow hiện tại

**Tổng: 10 ngày làm việc.** Mỗi sub-phase ship được ra staging và demo trong Corelia Devlog.

### Order priority gợi ý

Build **1A → 1B → 1D → 1C**.

Lý do đảo 1C/1D: Activity Milestone có volume cao hơn Hackathon (mọi user đều có thể hit milestone, hackathon chỉ vài event/năm). Build 1D trước có user data + on-chain mint thực tế nhanh hơn để debug. Hackathon 1C build sau, lúc đó pipeline mint đã chạy ổn.

---

## 8. Open Questions

1. **API key OpenCampus:** Tuong đã có chưa? Nếu chưa, ping team OpenCampus để xin key staging trước (mainnet thường cần KYC issuer, mất vài tuần).

2. **`hackathons` table đã tồn tại chưa?** Nếu chưa, schema bảng `hackathons` cần build trước (basic: id, name, slug, start_date, end_date, status...).

3. **Wallet connect cho học viên:** Để có `holderAddress` fallback khi học viên chưa có OC ID, Corelia cần flow connect ví EVM (RainbowKit/wagmi). Học viên course đơn online thường không có ví → cần cân nhắc hoặc bắt buộc OC ID, hoặc có ví mặc định.

4. **Default milestones seed:** Đề xuất 8 milestone ở section 5.3. Tuong muốn launch với đủ 8, hay khởi đầu 3–4 cái rồi thêm dần?

5. **Image source cho 8 milestone:** Tuong tự design trong Canva, hay cần mình suggest concept/prompt cho AI image gen?

---

## Appendix A: Naming convention `identifier_prefix`

```
Course:               corelia:<course_slug>
Hackathon (winner):   corelia:<hackathon_slug>:winner
Hackathon (finalist): corelia:<hackathon_slug>:finalist
Hackathon (partic.):  corelia:<hackathon_slug>:partic
Activity milestone:   corelia:<milestone_slug>
```

Examples:
```
corelia:ai-fund                  → corelia:ai-fund:user_12345
corelia:hackq2:winner            → corelia:hackq2:winner:user_12345
corelia:streak-30                → corelia:streak-30:user_12345
corelia:courses-5                → corelia:courses-5:user_12345
```

Mỗi prefix tối đa 40 ký tự (để chừa ~10 ký tự cho `:user_id` suffix, total ≤50).

## Appendix B: System settings cần config

```
default_mint_network              = 'staging' | 'mainnet'
opencampus_staging_endpoint       = 'https://api.vc.staging.opencampus.xyz/issuer/vc'
opencampus_mainnet_endpoint       = 'https://api.vc.opencampus.xyz/issuer/vc'
mint_retry_max_count              = '3'
mint_retry_backoff_base_seconds   = '60'
corelia_logo_url                  = 'https://app.corelia.academy/brand/corelia-logo-1300.png'
```

API key lưu trong **Supabase Vault**:
```
opencampus_api_key_staging
opencampus_api_key_mainnet
```

---

*Spec này chỉ cover Phase 1. Career Track Cert (MCQ + Project + Stripe), Bootcamp, Offline 6-Month, UniHackFest sẽ ở phase sau, dựa trên foundation `credential_templates` + `credential_issuances` đã có.*