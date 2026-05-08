# Hackathon Roles & Permissions — System Design

**Project:** Corelia Academy — Hackathon Platform **Stack:** React + Vite + TailwindCSS + shadcn/ui · Supabase · Stripe · Resend **Mô hình:** Multi-tenant **gated** platform (cần được Corelia approve mới tạo hackathon được) **Status:** Draft v3

### Changelog

- **v3 (2026-05-08):** Thêm Organizer Onboarding flow (cần submit application để được quyền tạo hackathon) + Platform Super Admin role. Project mặc định public ngay khi submit (không đợi judging xong).
- **v2:** Quyết định 5 câu hỏi mở: submission public + project entity riêng, anonymous judging, scoring theo barem, 1 user profile global, payout manual.
- **v1:** Initial draft.

---

## 1. Mục tiêu

- Hỗ trợ đầy đủ các format hackathon hiện có của Corelia (Mini Hackathons, UniHackFest, Public Hackathons)
- Cho phép co-organize với đối tác bên ngoài (UEF, CommandOSS, sponsor)
- **Gate-keep việc tạo hackathon:** chỉ những user được Corelia approve mới tạo được, để giữ chất lượng platform
- Tách bạch giữa *organize* / *judge* / *mentor* / *participate*
- Submission mặc định public ngay khi nộp → build portfolio cho participant
- Audit được mọi action nhạy cảm

---

## 2. Cấu trúc 3 tầng: Platform + Organization + Hackathon

```
Platform (Corelia Academy)
   ├── Platform-level role: Super Admin (Corelia team only)
   │
   ├── Organizer Applications (pending → approved/rejected)
   │
   └── Organizations (vd: Corelia, UEF, CommandOSS — chỉ tạo được sau khi approved)
          ├── Org-level roles: Owner, Admin, Member
          └── Hackathons
                 └── Hackathon-level roles: Admin, Co-organizer, Judge, Mentor, ...

User Profile (global, xuyên suốt platform)
   ├── Projects (portfolio public)
   ├── Hackathon participations
   ├── Badges & on-chain credentials
   └── Org memberships

```

**Lý do gate organization creation:**

- Tránh spam org/hackathon kém chất lượng làm loãng platform
- Đảm bảo organizer đủ năng lực tổ chức (đặc biệt khi có prize money thật)
- Corelia control được brand quality + có cơ hội partnership/co-marketing

---

## 3. Platform-level Role: Super Admin

Đây là role internal của Corelia team, không expose ra UI public.

**Quyền:**

- Approve / reject `organizer_applications`
- Suspend / deactivate organization (vi phạm policy)
- View system-wide audit log
- Manage feature flags, platform settings
- Access mọi org/hackathon ở mode read-only (cho support/debug)
- Force-transfer org ownership trong trường hợp khẩn cấp (vd: Owner mất account)

**KHÔNG có quyền:**

- Trực tiếp edit content của hackathon (tránh xung đột với organizer)
- Xem PII của user nếu không có ticket support cụ thể

**Implementation:** Dựa vào flag trong `auth.users.app_metadata.role = 'platform_admin'` hoặc bảng riêng `platform_admins`. Không assign qua UI thông thường — gán bằng SQL trực tiếp hoặc qua admin panel nội bộ.

```sql
create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz default now(),
  notes text
);

create or replace function is_platform_admin(p_user_id uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from platform_admins where user_id = p_user_id);
$$;

```

---

## 4. Organizer Onboarding Flow

### 4.1 Flow tổng quát

```
User register
    ↓
[default: Participant — tham gia hackathon được, KHÔNG tạo được]
    ↓
User submit Organizer Application
    ↓
[status: pending]
    ↓
Platform Super Admin review (1-7 ngày SLA)
    ↓
    ├── Approved → tự động tạo Organization, user là Owner
    │                 → giờ có quyền tạo hackathon
    └── Rejected → user nhận email, có thể re-apply sau 30 ngày

```

### 4.2 Application form

User cần submit:

- **Org info:** tên tổ chức, website, logo, social links
- **Use case:** tổ chức loại hackathon gì (online/offline, scale, target audience)
- **Experience:** đã từng tổ chức event gì chưa (link/proof)
- **Planned hackathon:** dự kiến hackathon đầu tiên (timeline, format, prize budget)
- **Verification:** business registration / university affiliation / personal portfolio
- **Estimated participants:** dự kiến bao nhiêu người tham gia
- **Reference:** ai có thể vouch (optional)

### 4.3 Review criteria (cho Corelia team)

Checklist ngầm:

- Có legitimate org/identity không (tránh fake)
- Có experience tổ chức event không (hoặc có team support)
- Use case có phù hợp với platform không (developer education focus)
- Có conflict với existing org không
- Prize budget có realistic không (nếu lớn → cần verify thêm)

### 4.4 Schema

```sql
create table organizer_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid references auth.users(id) on delete cascade,
  org_name text not null,
  org_website text,
  org_logo_url text,
  org_social_links jsonb default '{}',
  use_case text not null, -- mô tả dự định
  experience text,
  planned_hackathon jsonb, -- {title, format, timeline, expected_participants, prize_budget}
  verification_docs jsonb, -- urls of uploaded docs
  reference_contacts jsonb,

  status text default 'pending', -- pending, under_review, approved, rejected, withdrawn
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text, -- internal notes
  rejection_reason text, -- shown to applicant
  next_apply_allowed_at timestamptz, -- 30 ngày sau reject

  created_org_id uuid references organizations(id), -- linked sau khi approved

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on organizer_applications (status);
create index on organizer_applications (applicant_id);

```

### 4.5 Approval automation

```sql
-- Function chạy khi platform admin approve application
create or replace function approve_organizer_application(p_application_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_app organizer_applications;
  v_org_id uuid;
begin
  -- Verify caller is platform admin
  if not is_platform_admin(auth.uid()) then
    raise exception 'Only platform admins can approve applications';
  end if;

  select * into v_app from organizer_applications where id = p_application_id;

  if v_app.status != 'pending' and v_app.status != 'under_review' then
    raise exception 'Application is not in reviewable state';
  end if;

  -- Tạo org
  insert into organizations (slug, name, logo_url)
  values (
    lower(regexp_replace(v_app.org_name, '[^a-zA-Z0-9]+', '-', 'g')),
    v_app.org_name,
    v_app.org_logo_url
  )
  returning id into v_org_id;

  -- Applicant trở thành Owner của org mới
  insert into org_members (org_id, user_id, role)
  values (v_org_id, v_app.applicant_id, 'owner');

  -- Update application status
  update organizer_applications
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      created_org_id = v_org_id
  where id = p_application_id;

  -- Log
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'organizer_application.approved', 'application', p_application_id,
          jsonb_build_object('org_id', v_org_id, 'applicant_id', v_app.applicant_id));

  return v_org_id;
end;
$$;

```

### 4.6 Edge cases

- **Re-apply sau reject:** Block insert mới nếu `next_apply_allowed_at > now()` cho cùng `applicant_id`
- **Multiple applications:** 1 user chỉ có 1 application `pending` cùng lúc
- **Withdraw:** Applicant có thể tự rút trước khi review
- **Org name conflict:** Slug unique check khi approve, nếu conflict → admin chỉnh slug khi approve

---

## 5. Org-level Roles


| Role       | Quyền chính                                                                   |
| ---------- | ----------------------------------------------------------------------------- |
| **Owner**  | Toàn quyền + transfer ownership + delete org + quản lý billing                |
| **Admin**  | Tạo/xoá hackathon thuộc org, quản lý mentor pool, judge pool, sponsor profile |
| **Member** | Được hiển thị trong "team" của org (dùng cho branding), không có quyền edit   |


Mỗi org bắt buộc có đúng 1 Owner. Owner muốn rời phải transfer trước.

**Owner gốc = applicant của approved application.**

---

## 6. Hackathon-level Roles

### 6.1 Tổng quan


| Role               | Số lượng  | Scope                     | Mục đích                                              |
| ------------------ | --------- | ------------------------- | ----------------------------------------------------- |
| **Admin**          | 1-3       | Full hackathon            | Chỉnh sửa mọi setting của hackathon                   |
| **Co-organizer**   | 0-10      | Full trừ delete/ownership | Đối tác đồng tổ chức (vd: UEF cho UniHackFest)        |
| **Partner Viewer** | 0-20      | Read-only + sponsor block | Sponsor xem analytics, edit branding của họ           |
| **Judge**          | 5-30      | Theo track + round        | Chấm điểm submission                                  |
| **Mentor**         | 10-50     | Theo track (optional)     | Hỗ trợ team trong quá trình thi                       |
| **Reviewer**       | 0-10      | Pre-screening only        | Duyệt application trước khi accept (public hackathon) |
| **Volunteer**      | 0-30      | Check-in / logistics      | Staff offline event, không thấy data nhạy cảm         |
| **Captain**        | 1 / team  | Trong team                | Đại diện team submit, invite member                   |
| **Participant**    | unlimited | Trong team của họ         | Thi đấu, submit (qua captain)                         |


### 6.2 Chi tiết từng role

#### Admin (hackathon-level)

- Tạo/edit toàn bộ hackathon settings (rules, timeline, prizes, tracks)
- Add/remove mọi role khác (trừ org Owner)
- Disqualify team
- Override điểm của judge (có audit log)
- Publish kết quả
- Mark payout đã hoàn thành (manual)
- Export data
- **KHÔNG có quyền:** delete hackathon (chỉ Org Owner/Admin)
- **Có quyền đặc biệt:** xem identity thật của team kể cả khi anonymous judging bật

#### Co-organizer

Như Admin, **TRỪ:**

- Không xoá Admin khác
- Không transfer ownership
- Không thay đổi billing/Stripe settings
- Không delete hackathon

#### Partner Viewer (Sponsor Tier)

- Xem analytics dashboard
- Xem danh sách team (tên, track, project title)
- Edit phần sponsor profile của riêng họ
- Push 1 announcement có brand của họ (rate limit)
- Export danh sách participant đã opt-in

#### Judge

Permission scope theo:

- **Track:** App / AI / Blockchain
- **Round:** Pre-screening / Semi-final / Final
- **Excluded teams:** Auto-flag CoI

Quyền:

- Xem submission của team được assign
- Chấm điểm theo rubric của track (barem cố định)
- Comment private / public
- KHÔNG thấy điểm của judge khác trước khi submit
- **Mặc định KHÔNG thấy danh tính team** trong UI judging nếu anonymous bật — chỉ thấy `display_id`

#### Mentor

- Xem mọi project
- Comment trên project / submission draft
- Được team request 1-1 session
- Tự claim hoặc được assign
- KHÔNG thấy submission cuối / điểm số
- Mentor **luôn thấy** danh tính team

#### Reviewer (Pre-screening)

- Xem application của participant
- Approve / Reject / Waitlist

#### Volunteer / Staff

- Check-in participant (qua QR)
- Xem danh sách team + chỗ ngồi

#### Captain (Team-level)

- Invite / remove member
- Submit final project (chỉ captain)
- Transfer captaincy
- Edit team profile, chọn track

#### Participant

- Edit profile (global)
- Xem submission của team mình
- KHÔNG submit final

---

## 7. Database Schema (Supabase / PostgreSQL)

### 7.1 Core tables

```sql
-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  status text default 'active', -- active, suspended, deactivated
  created_from_application uuid references organizer_applications(id),
  created_at timestamptz default now()
);

create table org_members (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz default now(),
  primary key (org_id, user_id)
);

-- Global User Profile
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  links jsonb default '{}',
  skills text[],
  location text,
  is_organizer boolean default false, -- true sau khi có 1 approved application
  created_at timestamptz default now()
);

-- Hackathons
create table hackathons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  judging_end_at timestamptz,
  status text default 'draft',
  visibility text default 'public',
  format text,
  config jsonb default '{}', -- {anonymous_judging, allow_multi_team, ...}
  created_at timestamptz default now(),
  unique (org_id, slug)
);

-- Tracks
create table tracks (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid references hackathons(id) on delete cascade,
  name text not null,
  description text,
  rubric jsonb not null
);

```

### 7.2 Role assignment

```sql
create table hackathon_roles (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid references hackathons(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in (
    'admin', 'co_organizer', 'partner_viewer',
    'judge', 'mentor', 'reviewer', 'volunteer'
  )),
  config jsonb default '{}',
  invited_by uuid references auth.users(id),
  invited_at timestamptz default now(),
  status text default 'pending',
  unique (hackathon_id, user_id, role)
);

create index on hackathon_roles (hackathon_id, role) where status = 'active';
create index on hackathon_roles (user_id) where status = 'active';

```

### 7.3 Project + Team + Submission

**Project default public ngay khi tạo, không phụ thuộc vào status hackathon.**

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  tagline text,
  description text,
  cover_image_url text,
  repo_url text,
  demo_url text,
  video_url text,
  tech_stack text[],
  visibility text default 'public', -- public, unlisted, private (user choose)
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (created_by, slug)
);

create table project_collaborators (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'contributor',
  show_in_portfolio boolean default true,
  primary key (project_id, user_id)
);

create index on project_collaborators (user_id) where show_in_portfolio = true;

-- Teams
create table teams (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid references hackathons(id) on delete cascade,
  track_id uuid references tracks(id),
  name text not null,
  display_id text not null, -- vd: 'A4F2', dùng khi anonymous judging
  captain_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  unique (hackathon_id, name),
  unique (hackathon_id, display_id)
);

create table team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (team_id, user_id)
);

-- Submissions = link project ↔ hackathon
-- Khi tạo submission, project tự động public (default visibility)
create table submissions (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid references hackathons(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  is_final boolean default false,
  submitted_at timestamptz,
  submitted_by uuid references auth.users(id),
  unique (team_id, hackathon_id)
);

-- Portfolio view
create view user_portfolio as
select
  p.*,
  pc.user_id as portfolio_user_id,
  s.hackathon_id,
  h.title as hackathon_title,
  (select award_type from hackathon_awards where submission_id = s.id) as award
from projects p
join project_collaborators pc on pc.project_id = p.id
left join submissions s on s.project_id = p.id
left join hackathons h on h.id = s.hackathon_id
where pc.show_in_portfolio = true
  and p.visibility = 'public';

```

**Flow khi team submit final:**

1. Captain tạo project (hoặc chọn project có sẵn)
2. Project mặc định `visibility = 'public'` — team có thể chuyển `unlisted`/`private` nếu muốn
3. Captain link project vào team submission → submission record tạo ra
4. Project xuất hiện public ngay trên `/projects/{slug}` và trong portfolio của collaborators
5. Trong UI judging interface, judge thấy view ẩn danh nếu `anonymous_judging = true`

### 7.4 Scoring (rubric-based, không normalize)

```sql
create table scores (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  judge_id uuid references auth.users(id),
  round text not null,
  rubric_scores jsonb not null,
  comment_private text,
  comment_public text,
  submitted_at timestamptz default now(),
  unique (submission_id, judge_id, round)
);

create or replace function compute_score_total(
  p_rubric_scores jsonb,
  p_rubric jsonb
) returns numeric language plpgsql immutable as $$
declare
  total numeric := 0;
  criterion jsonb;
  score numeric;
  weight numeric;
begin
  for criterion in select * from jsonb_array_elements(p_rubric)
  loop
    score := (p_rubric_scores ->> (criterion ->> 'id'))::numeric;
    weight := coalesce((criterion ->> 'weight')::numeric, 1);
    total := total + (coalesce(score, 0) * weight);
  end loop;
  return total;
end;
$$;

create view leaderboard as
select
  s.id as submission_id,
  s.team_id,
  t.name as team_name,
  t.display_id,
  count(sc.id) as judge_count,
  avg(compute_score_total(sc.rubric_scores, tr.rubric)) as avg_score
from submissions s
join teams t on t.id = s.team_id
join tracks tr on tr.id = t.track_id
left join scores sc on sc.submission_id = s.id and sc.round = 'final'
where s.is_final = true
group by s.id, s.team_id, t.name, t.display_id;

```

### 7.5 Awards & Manual Payout

```sql
create table hackathon_awards (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid references hackathons(id) on delete cascade,
  submission_id uuid references submissions(id) on delete cascade,
  award_type text not null,
  prize_label text,
  prize_amount numeric,
  prize_currency text default 'VND',
  awarded_at timestamptz default now(),
  awarded_by uuid references auth.users(id)
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  award_id uuid references hackathon_awards(id) on delete cascade,
  recipient_user_id uuid references auth.users(id),
  amount numeric not null,
  currency text default 'VND',
  status text default 'pending',
  payment_method text,
  payment_reference text,
  notes text,
  paid_at timestamptz,
  marked_paid_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index on payouts (status);
create index on payouts (recipient_user_id);

```

### 7.6 Audit log

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid references hackathons(id),
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

create index on audit_logs (hackathon_id, created_at desc);

```

---

## 8. Permission check — RLS Pattern

### 8.1 Helper functions

```sql
create or replace function has_hackathon_role(
  p_hackathon_id uuid,
  p_user_id uuid,
  p_roles text[]
) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from hackathon_roles
    where hackathon_id = p_hackathon_id
      and user_id = p_user_id
      and role = any(p_roles)
      and status = 'active'
  )
  or exists (
    select 1
    from hackathons h
    join org_members om on om.org_id = h.org_id
    where h.id = p_hackathon_id
      and om.user_id = p_user_id
      and om.role in ('owner', 'admin')
  );
$$;

create or replace function is_team_member(p_team_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from team_members
    where team_id = p_team_id and user_id = p_user_id
  );
$$;

create or replace function is_anonymous_judging(p_hackathon_id uuid)
returns boolean language sql stable as $$
  select coalesce((config->>'anonymous_judging')::boolean, false)
  from hackathons where id = p_hackathon_id;
$$;

-- Có quyền tạo hackathon không (qua org membership)
create or replace function can_create_hackathon(p_user_id uuid, p_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from org_members
    where user_id = p_user_id
      and org_id = p_org_id
      and role in ('owner', 'admin')
  );
$$;

```

### 8.2 Anonymous judging — view ẩn danh trong UI judging

```sql
create or replace view submissions_for_judge as
select
  s.id,
  s.hackathon_id,
  s.team_id,
  t.display_id,
  case
    when is_anonymous_judging(s.hackathon_id)
      and not has_hackathon_role(s.hackathon_id, auth.uid(), array['admin', 'co_organizer'])
    then null
    else t.name
  end as team_name,
  s.project_id,
  case
    when is_anonymous_judging(s.hackathon_id)
      and not has_hackathon_role(s.hackathon_id, auth.uid(), array['admin', 'co_organizer'])
    then null
    else p.created_by
  end as project_owner,
  p.title,
  p.description,
  p.repo_url,
  p.demo_url,
  p.video_url,
  s.submitted_at,
  s.is_final
from submissions s
join teams t on t.id = s.team_id
join projects p on p.id = s.project_id;

```

**⚠️ Trade-off quan trọng:**

Vì project default public ngay khi submit, anonymous judging chỉ có hiệu lực **trong UI judging interface**. Project vẫn xuất hiện ở `/projects/{slug}` với đầy đủ thông tin team (qua portfolio public). Judge nếu cố tình search ra `/projects/{slug}` thì vẫn thấy danh tính.

**Đây là honor system:**

- UI judging hide identity → judge không vô tình bị bias
- Nhưng không bullet-proof — không ngăn được judge có ý đồ xấu
- Nếu cần strict anonymous: option tương lai là cho team submit dạng "unlisted" trong lúc judging, public sau khi finished. Hiện tại giữ nguyên decision public mặc định cho đơn giản.

**Mitigation:**

- Code of conduct cho judge ký khi accept invite
- Audit log mọi request đến `/projects/{slug}` từ judge trong thời gian judging
- Admin review nếu có nghi ngờ

### 8.3 RLS policies chính

```sql
-- Organizer applications
alter table organizer_applications enable row level security;

create policy "applicant sees own application"
on organizer_applications for select
using (applicant_id = auth.uid());

create policy "applicant creates own application"
on organizer_applications for insert
with check (applicant_id = auth.uid());

create policy "platform admin manages all"
on organizer_applications for all
using (is_platform_admin(auth.uid()));

-- Hackathons: chỉ org member tạo được
alter table hackathons enable row level security;

create policy "public hackathons visible"
on hackathons for select
using (visibility = 'public' and status != 'draft');

create policy "org members see all org hackathons"
on hackathons for select
using (
  exists (
    select 1 from org_members
    where org_id = hackathons.org_id and user_id = auth.uid()
  )
);

create policy "only org owner/admin create hackathons"
on hackathons for insert
with check (can_create_hackathon(auth.uid(), org_id));

-- Submissions
alter table submissions enable row level security;

create policy "team can view own submission"
on submissions for select
using (is_team_member(team_id, auth.uid()));

create policy "judges/mentors/admins can view"
on submissions for select
using (
  has_hackathon_role(
    hackathon_id, auth.uid(),
    array['admin', 'co_organizer', 'judge', 'mentor']
  )
);

create policy "only captain can submit"
on submissions for insert
with check (
  exists (
    select 1 from teams
    where id = team_id and captain_id = auth.uid()
  )
);

-- Projects: public visibility = ai cũng xem được
alter table projects enable row level security;

create policy "public projects visible to all"
on projects for select
using (visibility = 'public');

create policy "collaborators see own projects regardless of visibility"
on projects for select
using (
  exists (
    select 1 from project_collaborators
    where project_id = projects.id and user_id = auth.uid()
  )
);

-- Scores
alter table scores enable row level security;

create policy "judge sees own scores"
on scores for select using (judge_id = auth.uid());

create policy "admins see all scores"
on scores for select
using (
  has_hackathon_role(
    (select hackathon_id from submissions where id = submission_id),
    auth.uid(),
    array['admin', 'co_organizer']
  )
);

-- Payouts
alter table payouts enable row level security;

create policy "recipient sees own payouts"
on payouts for select using (recipient_user_id = auth.uid());

create policy "admin manages payouts"
on payouts for all
using (
  has_hackathon_role(
    (select h.id
     from hackathon_awards a
     join submissions s on s.id = a.submission_id
     join hackathons h on h.id = s.hackathon_id
     where a.id = payouts.award_id),
    auth.uid(),
    array['admin', 'co_organizer']
  )
);

```

### 8.4 Performance tips

- Index `hackathon_roles (user_id, hackathon_id, role) where status = 'active'`
- Cache role lookup ở client bằng React Query, key = `[hackathonId, userId]`
- Anonymous view dùng `case ... when` thay vì 2 view riêng → giảm query path
- Lấy role 1 lần ở layout level rồi truyền qua context

---

## 9. Edge cases

### 9.1 Conflict of Interest cho Judge

Auto-flag dựa trên co-membership trong team trước đó. Lưu vào `hackathon_roles.config.excluded_teams`.

### 9.2 Captain rời team

- Còn member khác → auto promote member join sớm nhất
- Chỉ còn 1 captain → team bị disband

### 9.3 1 user trong nhiều team cùng 1 hackathon

- Mặc định cấm. Validate ở insert vào `team_members`
- Exception: `hackathons.config.allow_multi_team`

### 9.4 Judge cũng là participant

Cấm cứng. Validate khi accept judge invite và khi user join team.

### 9.5 Anonymous judging — leak identity

- UI cảnh báo team trước submit
- Auto-scan description có chứa tên team / username không
- Repo URL không strip được, UI cảnh báo
- Honor system + audit log access pattern

### 9.6 Hackathon bị xoá

- Soft delete, giữ data 90 ngày
- **Project KHÔNG bị xoá** — chỉ unlink khỏi hackathon
- Audit log giữ vĩnh viễn

### 9.7 User xoá account

- Project: chuyển ownership cho collaborator còn lại, hoặc anonymize
- Profile soft delete, scores giữ nguyên

### 9.8 Project xoá khi đã submit

- Block xoá nếu hackathon còn `judging` — phải withdraw submission trước
- Sau finished: cho xoá nhưng giữ submission record

### 9.9 Organizer application — Platform admin off-duty

- SLA 7 ngày — nếu không review trong 7 ngày, auto-escalate (notify all platform admins)
- Có queue dashboard cho platform admin team

### 9.10 Org bị suspend

- Hackathon đang ongoing → freeze, không accept submission mới
- Hackathon đã finished → vẫn public read-only
- Owner nhận email thông báo + lý do + appeal process

### 9.11 Re-apply organizer sau reject

- `next_apply_allowed_at = now() + 30 days` (default)
- Platform admin có thể override nếu muốn (vd: cho re-apply ngay với điều kiện)

---

## 10. Invitation Flow

### 10.1 States

```
pending  →  active  →  removed
   ↓
declined

```

### 10.2 Email template (Resend)

- `judge_invitation.html`
- `mentor_invitation.html`
- `co_organizer_invitation.html`
- `organizer_application_received.html`
- `organizer_application_approved.html`
- `organizer_application_rejected.html`

Token-based magic link (single-use, expire 7 ngày):

```
https://app.corelia.academy/invite/accept?token={jwt}

```

### 10.3 Bulk invite

Admin/Co-organizer upload CSV: `email, role, track, round`.

---

## 11. Audit & Compliance

Mọi action sau **bắt buộc** ghi vào `audit_logs`:

- `organizer_application.submitted`, `organizer_application.approved`, `organizer_application.rejected`
- `org.created`, `org.suspended`, `org.deactivated`
- `role.assigned`, `role.removed`, `role.modified`
- `score.submitted`, `score.overridden`, `score.deleted`
- `team.disqualified`
- `submission.locked`, `submission.unlocked`
- `hackathon.published`, `hackathon.deleted`
- `award.granted`, `award.revoked`
- `payout.created`, `payout.marked_paid`, `payout.cancelled`
- `anonymous_judging.toggled`
- `project.access_during_judging` (track judge views project public page trong lúc judging)

---

## 12. User Profile (Cross-hackathon)

Profile global xuyên suốt platform, hiển thị ở `/u/{username}`:

```
/u/{username}
├── About (bio, skills, location)
├── Portfolio (projects công khai)
│   ├── Project linked với hackathon → có badge "Winner @ UniHackFest 2026"
│   └── Project standalone
├── Hackathons participated (timeline)
├── Badges & Credentials
│   ├── On-chain badges (OpenCampus / EDU Chain)
│   └── Achievement badges
├── Org memberships (nếu là organizer)
└── "Apply to be Organizer" button (nếu chưa apply)

```

**Privacy controls cho user:**

- `show_in_portfolio` per project (opt-out)
- Profile visibility: public / unlisted / private
- Hide hackathon participation (nếu thua cuộc)

**Profile auto-update khi:**

- Win/finalist 1 hackathon → award badge tự động
- Submit project → add vào portfolio
- Hoàn thành mentorship → add vào "Mentorships"
- Approved organizer → set `is_organizer = true`

---

## 13. Roadmap đề xuất

### Phase 1 — MVP (Mini Hackathon nội bộ Corelia)

- Org-level: Owner, Admin (Corelia self-host, chưa cần organizer onboarding)
- Hackathon-level: Admin, Judge, Captain, Participant
- Single track, single round, basic rubric scoring
- Project entity với public-on-submit
- Manual payout tracking

### Phase 2 — Public Hackathon ready (Corelia tự tổ chức + đối tác cụ thể)

- Co-organizer, Partner Viewer, Mentor
- Multi-track, multi-round
- Reviewer (pre-screening)
- Anonymous judging (UI-level, honor system)
- Sponsor analytics dashboard
- Bulk invite
- Public project showcase + portfolio page

### Phase 3 — UniHackFest scale (open ecosystem)

- **Organizer Onboarding Flow** (application + Platform Super Admin review)
- **Platform-level role + admin panel**
- Volunteer / staff role
- Offline check-in (QR)
- CoI auto-detection
- Cross-org partnership
- On-chain badge minting (OpenCampus/EDU Chain)
- Auto-scan anonymity leak

### Phase 4 — Platform features

- Reusable judge/mentor pool ở org-level
- Template hackathon (clone settings + rubric)
- API public cho sponsor tích hợp
- Mobile app cho participant
- Standalone project upload

**Note:** Organizer Onboarding ở Phase 3 vì Phase 1-2 Corelia tự tổ chức là chính, chưa cần gate-keep. Khi mở public cho user khác tạo hackathon mới cần.

---

## 14. Decisions Log (đã chốt)


| Câu hỏi                           | Quyết định                                                  | Ảnh hưởng                                                                                              |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Submission visibility sau judging | **Public mặc định ngay khi submit**, không đợi judging xong | `projects.visibility` default `public` ngay từ đầu, anonymous judging chỉ áp dụng UI judging interface |
| Anonymous judging                 | **Có support**, config per hackathon, UI-level              | Honor system — không bullet-proof vì project public, cần code of conduct + audit                       |
| Score normalization               | **Không normalize**, dùng rubric cố định + weighted average | Đơn giản, rubric phải define trước, khớp 3 track của Corelia                                           |
| Cross-hackathon profile           | **1 profile duy nhất** xuyên suốt platform                  | `profiles` table global, portfolio aggregate, badges tích lũy                                          |
| Prize payout                      | **Manual** (không Stripe Connect)                           | `payouts` table track status, admin mark thủ công                                                      |
| Ai được tạo hackathon             | **Phải submit application + Platform admin approve**        | Cần `organizer_applications` table, Platform Super Admin role, approval flow + email notification      |


---

## 15. Tham khảo

- [Devpost Roles](https://help.devpost.com/) — pattern cho judge/organizer + project showcase
- [HackerEarth Hackathon Manager](https://www.hackerearth.com/) — pattern cho enterprise hackathon
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [GitHub Org Permissions](https://docs.github.com/en/organizations) — pattern cho Owner/Admin separation
- [Substack / Medium Publication Approval](https://substack.com/) — pattern cho gated content creation

