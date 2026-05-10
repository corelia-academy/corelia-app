# Redesign — Hackathon Detail Page

> Route gộp về `/hackathons/[slug]` (bỏ `/overview`, `/timeline`, `/prizes`, `/partners`, `/rules`, `/faqs`, redirect 301 về anchor).
> Stack: React + Vite + Tailwind + shadcn/ui. Schema dùng jsonb pattern (`hackathons.document`, `hackathon_locales.data`).

---

## 1. Issue cần fix (theo thứ tự ưu tiên)

1. **Data integrity** — banner ảnh sai theme (Sui blockchain ↔ AI hackathon), 3 nguồn date không khớp, status `Đang diễn ra` sau khi date đã qua. Root cause: `hackathons.status` đang được set thủ công.
2. **Route fragmentation** — 6 routes (`/overview`, `/timeline`, ...) mỗi click load lại full page. Gộp về single page.
3. **CTA chính bị giấu** — "Đăng ký bằng hồ sơ của tôi" trong sidebar, dưới wall-of-text 5 đoạn. Đưa lên hero + sticky bottom bar mobile.
4. **Workspace banner full-width** chiếm prime real estate cho organizer. Thay bằng FAB.

---

## 2. Status — source of truth

Bỏ dùng `hackathons.status` cho lifecycle (giữ nó cho `draft` | `published`). Compute lifecycle từ datetime trong `document`:

```ts
// hooks/useHackathonStatus.ts
export type HackathonLifecycle =
  | 'draft' | 'upcoming' | 'registration_open'
  | 'in_progress' | 'judging' | 'ended'

export function useHackathonStatus(h: Hackathon): HackathonLifecycle {
  if (h.status === 'draft') return 'draft'
  const now = Date.now()
  const d = h.document
  if (now < new Date(d.registrationOpenAt).getTime())  return 'upcoming'
  if (now < new Date(d.registrationCloseAt).getTime()) return 'registration_open'
  if (now < new Date(d.submissionCloseAt).getTime())   return 'in_progress'
  if (d.judgingEndAt && now < new Date(d.judgingEndAt).getTime()) return 'judging'
  return 'ended'
}
```

Mọi badge / countdown / CTA derive từ hook này. Không hardcode text như `"Contest kết thúc sau 7 giờ"`.

---

## 3. Schema — `hackathons.document` jsonb shape

```ts
type HackathonDocument = {
  // Hero
  title: string
  tagline: string
  bannerImageUrl: string | null   // organizer upload, fallback: gradient theo track
  format: 'online' | 'offline' | 'hybrid'
  trackId: string                  // FK → career_tracks.id (track chính của hackathon)

  // Lifecycle datetimes (UTC ISO)
  registrationOpenAt: string
  registrationCloseAt: string
  startAt: string
  submissionCloseAt: string
  judgingEndAt?: string

  // Content
  about: string                    // markdown
  rules: string[]
  judgingCriteria: { name: string; weight: number }[]
  prizeTiers: { rank: number; amountVnd: number; perks: string[] }[]
  prizePoolText: string
  milestones: { name: string; datetime: string; type: 'kickoff'|'deadline'|'demo'|'announce' }[]
  mentors: { name: string; role: string; org?: string; avatarUrl?: string; linkUrl?: string }[]
  judges:  { name: string; role: string; org?: string; avatarUrl?: string; linkUrl?: string }[]
  partners: { name: string; logoUrl: string; tier: 'title'|'gold'|'supporter'; websiteUrl?: string }[]
  faqs: { q: string; a: string }[]

  // Related learning — drive learner vào course funnel
  officialCourseId?: string        // FK → courses.id (khóa học do hackathon tổ chức, nếu có)
  relatedCourseIds: string[]       // FK → courses.id (khóa phù hợp)
  relatedCareerTrackIds: string[]  // FK → career_tracks.id (tracks phù hợp ngoài track chính)

  // Additional resources
  resources: {
    id: string
    type: 'livestream' | 'video' | 'image' | 'document' | 'event' | 'link'
    title: string
    url: string
    description?: string
    thumbnailUrl?: string
    startsAt?: string              // cho livestream / event
    endsAt?: string
    pinned?: boolean               // pin lên top khi in_progress
  }[]

  // Badges (mint sau khi event kết thúc)
  badges: {
    id: string
    name: string                   // VD "Top 1 Builder", "Best Use of AI", "Participant"
    description: string
    imageUrl: string               // preview NFT artwork
    criteria: 'participation' | 'submission' | 'top_1' | 'top_2' | 'top_3'
            | 'mentor_pick' | 'best_in_track' | 'custom'
    customCriteriaText?: string    // bắt buộc khi criteria === 'custom'
  }[]
}
```

`hackathon_registrations.document` thêm:
```ts
{
  status: 'pending' | 'approved' | 'rejected',
  awardedBadgeIds?: string[],     // do organizer assign sau Demo Day
  mintedBadgeIds?: string[],      // subset đã mint on-chain (endpoint sẽ có sau)
  ...
}
```

`approvedProfileCount` = `select count(*) from hackathon_registrations where hackathon_id = ? and document->>'status' = 'approved'`. Cache qua RPC, **chỉ render khi ≥ 5** để tránh anti-social proof.

---

## 4. Page structure

```
<HackathonPage>
  <Hero />                          ← status badge, countdown, title, meta, primary CTA, share
  <QuickStats />                    ← 4 cells: prize · approved count · duration · format
  <SubNav sticky />                 ← #about #timeline #resources #prizes #learn #people #rules #partners #faq
  <About id="about" />
  <Timeline id="timeline" />
  <Resources id="resources" />      ← livestream, video, image, document, event (ẩn nếu rỗng)
  <PrizesAndBadges id="prizes" />   ← prize tiers + badges + on-chain credential block
  <Track />                         ← track chính, banner full-width gradient
  <RelatedLearning id="learn" />    ← official course + related courses + related tracks
  <People id="people" />            ← mentors + judges (ẩn nếu rỗng)
  <Rules id="rules" />
  <Partners id="partners" />        ← ẩn nếu rỗng
  <Faq id="faq" />
  <FinalCTA />
  {isOrganizer && <AdminWorkspaceFAB />}
  <MobileStickyCta />               ← chỉ mobile, hide khi cuộn tới FinalCTA
</HackathonPage>
```

---

## 5. Hero spec

Layout desktop: 12-col grid, 7/5 split. Trái = text + CTA. Phải = banner image (square aspect) hoặc gradient fallback theo track.
Layout mobile: stack text → CTA → image (16:9 thumb).

**Status badge** (top of text col):

| lifecycle           | bg / text                | dot    |
| ------------------- | ------------------------ | ------ |
| `upcoming`          | zinc-100 / zinc-700      | static |
| `registration_open` | emerald-50 / emerald-700 | pulse  |
| `in_progress`       | amber-50 / amber-700     | pulse  |
| `judging`           | violet-50 / violet-700   | pulse  |
| `ended`             | zinc-100 / zinc-500      | none   |

**Countdown** — derive target từ lifecycle:
- `upcoming` → `registrationOpenAt`, label "Mở đăng ký sau"
- `registration_open` → `registrationCloseAt`, label "Đóng đăng ký sau"
- `in_progress` → `submissionCloseAt`, label "Hết giờ nộp bài sau"
- `judging` → `judgingEndAt`, label "Công bố kết quả sau"
- `ended` → ẩn

Update mỗi 60s; khi còn < 1h → 1s tick + đổi màu `text-red-600`.

**Primary CTA** — text theo `lifecycle × userState`:

| lifecycle × user                     | CTA                          |
| ------------------------------------ | ---------------------------- |
| `upcoming` × any                     | "Nhận thông báo khi mở"      |
| `registration_open` × guest          | "Đăng nhập để đăng ký"       |
| `registration_open` × not_registered | "Đăng ký bằng hồ sơ của tôi" |
| `registration_open` × pending        | "Đang chờ duyệt" (disabled)  |
| `registration_open` × approved       | "Vào dashboard"              |
| `in_progress` × approved             | "Nộp bài"                    |
| `in_progress` × submitted            | "Xem bài đã nộp"             |
| `judging` × any                      | "Xem các bài dự thi"         |
| `ended` × any                        | "Xem người chiến thắng"      |

`userState` derive từ `hackathon_registrations.document.status` của current user.

**Share button**: copy link toast + dropdown (Facebook/X/Threads/LinkedIn).

---

## 6. Section specs

### 6.1. About
Card với `prose` markdown render từ `document.about`. Sau đó 3-card row "Vì sao tham gia": **Build sản phẩm thật**, **Mentor 1:1**, **Demo Day với quỹ**.

### 6.2. Timeline
Vertical timeline `<ol>`. Mỗi milestone = dot + line + tên + datetime VN format + status pill (Done / Live / Upcoming). "Add to Google Calendar" cho item upcoming. Data từ `document.milestones`.

### 6.3. Resources
Featured zone trên cùng: nếu có resource type `livestream` với `startsAt ≤ now ≤ endsAt`, render big card với LIVE pulse badge + CTA "Xem livestream". Pinned resources cũng hiện ở đây.

Bên dưới: grid `grid-cols-2 md:grid-cols-3 gap-4`. Mỗi card = thumbnail + type icon (lucide: `Radio` / `Play` / `Image` / `FileText` / `Calendar` / `ExternalLink`) + title + open button. Click → `target="_blank" rel="noopener"`.

Optional filter pills: All / Livestream / Video / Image / Document / Event.

**Ẩn cả section nếu `resources.length === 0`**. Đây là section sống động nhất khi `in_progress`.

### 6.4. Prizes + Badges (merged)

**Sub 1 — Giải thưởng chính**: `grid grid-cols-1 md:grid-cols-3` cho 3 tier. Top 1 scale-105 + gradient gold. Mỗi card: rank icon + amountVnd + perks list.

**Sub 2 — Badges**: grid `grid-cols-2 md:grid-cols-4 gap-4`. Mỗi card:
- Square NFT preview image (rounded-xl, ring-1)
- Name (font-medium)
- Criteria pill: `Top 1` / `Top 2` / `Top 3` / `Mentor pick` / `Best in track` / `Participant` / `Submission` / custom text
- 1-line description
- Click → modal mở rộng

**Sub 3 — User's earned badges** (chỉ render khi `lifecycle === 'ended'` và current user có `awardedBadgeIds`):
- Highlight banner "Bạn đã nhận được X badge từ hackathon này"
- Mỗi badge: big preview + "Mint badge" button (disabled cho tới khi endpoint mint có; show tooltip "Sẽ mở mint sau Demo Day")
- Khi `mintedBadgeIds` đã chứa badge id → button đổi thành "Xem trên explorer" (link tới EDU Chain explorer).

**Sub 4 — On-chain credential block** (giữ nguyên):
> Mọi participant approved đều nhận on-chain participation badge. Top winners thêm winner badge. Mint trên EDU Chain (OpenCampus), verifiable lifetime.

### 6.5. Track
Join `career_tracks` qua `document.trackId`. Card full-width gradient theo track:
- Icon + tên track + 1-line desc + CTA "Xem các khóa học cùng track →" tới `/career-tracks/[slug]`.

### 6.6. Related Learning

3 sub-blocks, render chỉ khi có data tương ứng:

**(a) Khóa học của hackathon** (`officialCourseId` có giá trị):
- Highlight card lớn full-width
- Badge "Khóa học chính thức của hackathon"
- Course thumbnail + title + instructor + duration + CTA "Tham gia khóa học" → `/courses/[slug]`
- Data: join `courses` + `course_locales` qua `officialCourseId`

**(b) Khóa học phù hợp** (`relatedCourseIds.length > 0`):
- Heading "Khóa học giúp bạn chuẩn bị"
- Horizontal scroll snap hoặc `grid grid-cols-1 md:grid-cols-3 gap-4`
- Course card: thumbnail + title + instructor + duration + price/free badge

**(c) Career tracks phù hợp** (`relatedCareerTrackIds.length > 0`):
- Heading "Career tracks liên quan"
- 1-2 cards full-width: track name + description + "Xem track →"

Ẩn cả section `#learn` khi cả 3 sub-block đều rỗng.

### 6.7. People
2 sub-grid: **Mentor 1:1** và **Giám khảo Demo Day**. Avatar 80px + tên + role + org + link. Click → modal bio. **Ẩn cả section nếu cả 2 array rỗng**.

### 6.8. Rules
List với icon `CheckCircle2` (lucide, emerald-600). Sau rules: subsection "Tiêu chí chấm điểm" — stacked bar visualization từ `document.judgingCriteria`.

### 6.9. Partners
Tier hierarchy: title (1 logo lớn) → gold (medium) → supporter (small grid). Grayscale default, color on hover. **Ẩn nếu rỗng**.

### 6.10. FAQ
shadcn `<Accordion type="single" collapsible>`. Data từ `document.faqs`.

### 6.11. Final CTA
Full-bleed gradient theo track. Heading "Sẵn sàng build?" + primary CTA + share + add to calendar.

---

## 7. SubNav

Sticky `<nav>` xuất hiện sau khi scroll qua hero. `IntersectionObserver` highlight item của section trong viewport. Click → `scrollIntoView({behavior:'smooth'})` với offset = nav height.

Section nào ẩn (resources/people/partners/learn rỗng) → ẩn item tương ứng khỏi SubNav.

Right side (desktop): mini countdown + mini CTA button (luôn truy cập được khi đọc nội dung dài).

Mobile: horizontal scroll, snap-x.

---

## 8. Mobile

- **Sticky bottom bar** (height 64px, `bg-white/95 backdrop-blur border-t`):
  ```
  [⏱ 5h 23m]   [   Đăng ký ngay   ]
  ```
  Hide khi scroll tới `<FinalCTA />` (tránh duplicate).
- Hero text-first; banner image → 16:9 thumbnail dưới text.

---

## 9. Admin Workspace

FAB thay banner full-width. Render khi `profiles.role === 'admin'` hoặc user thuộc `hackathon_access_invites` của hackathon này.

```tsx
<button className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg ...">
  <Settings className="w-4 h-4" /> Workspace
</button>
```

Click → `/hackathons/[slug]/workspace`.

Trên mobile, FAB nằm trên sticky bottom bar (z-50, offset bottom-20).

**Workspace UI cần cover** (ngoài các tính năng hiện có):
- **Resources manager**: add/edit/remove resource (livestream, video, image, document, event). Pin/unpin. Upload file qua Bunny CDN cho media.
- **Badges manager**: CRUD badges (name, description, image upload, criteria). Preview NFT artwork.
- **Badge assignment** (chỉ enable khi `lifecycle === 'judging'` hoặc `ended`): bảng users đã `approved` × badges, multi-select cell, save → update `awardedBadgeIds` trong từng registration.
- **Mint trigger**: button per (user, badge) gọi mint endpoint (sẽ có sau). Khi success → cập nhật `mintedBadgeIds`. Hiện status pending/minted/failed.
- **Linking**: chọn `officialCourseId`, `relatedCourseIds[]`, `relatedCareerTrackIds[]` qua searchable select component. Validate FK tồn tại + published.

---

## 10. Cleanup hành vi cũ

- ❌ Bỏ banner image default "MiniHackathon Build on Sui". Bắt buộc upload (`document.bannerImageUrl`); fallback gradient theo track.
- ❌ Bỏ email user inline raw. Dùng avatar + email mask `t***@gmail.com` trong tooltip.
- ❌ Bỏ "1 đội đã được duyệt" khi count < 5.
- ❌ Bỏ duplicate giữa "Quy định & yêu cầu" (overview) và "Luật & điều kiện" (tab) — gộp vào 1 section `#rules`.
- ❌ Bỏ "Bước tiếp theo" card sparse → thay bằng inline timeline.

---

## 11. Implementation order

1. `useHackathonStatus` hook → fix root cause inconsistency.
2. Migrate routes `/timeline` `/prizes` `/partners` `/rules` `/faqs` → 301 redirect tới anchor trên `/hackathons/[slug]`.
3. Hero refactor (status badge, countdown, dynamic CTA, share).
4. SubNav sticky + IntersectionObserver + auto-hide ẩn item rỗng.
5. Section components theo thứ tự giá trị: Timeline → Resources → Prizes+Badges → Track → RelatedLearning → People → Rules.
6. QuickStats với threshold count ≥ 5.
7. Mobile sticky bottom CTA.
8. AdminWorkspaceFAB thay banner.
9. Workspace UI: resources manager, badges manager + assignment, course/track linking. (Mint trigger để placeholder, enable khi endpoint có.)
10. A11y pass: countdown `aria-live="polite"`, focus visible, semantic `<ol>` cho timeline, color contrast ≥ AA.

Mỗi step PR riêng, kèm screenshot before/after.