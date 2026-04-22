# Corelia — Brand & Design Direction 2.0
### "Ink & Signal" — Học. Kết nối. Tạo nên. / Learn. Connect. Ship.

> **Mục đích / Purpose.** Tài liệu này audit trạng thái hiện tại của ứng dụng Corelia, đề xuất một hướng identity mới (refresh) và hệ design direction thống nhất cho ba trụ sản phẩm: **Online Learn** (khóa học tự học), **Offline Cohort** (lớp học trực tiếp theo kỳ), và **Hackathon / Contest** (cuộc thi build). Tài liệu này là bạn đồng hành của `STYLE_GUIDE.md` hiện tại — không thay thế, mà mở rộng và định hướng v2.
>
> *This document audits the current Corelia app, proposes a refreshed brand identity, and a unified design direction across three product pillars. It is a companion to — not a replacement for — the existing `STYLE_GUIDE.md`.*

---

## 0. TL;DR

**VI.** Corelia hiện là một app học trực tuyến có thêm *offline cohort* và *hackathon*, đang dùng theme **Midnight Blue** (Electric Blue + Deep Navy). Hệ thống đã khá bài bản (OKLCH tokens, shadcn + base-ui, Phosphor icons, Tailwind v4) nhưng identity cảm thấy "SaaS corporate chung chung" — chưa đặc biệt, chưa phản ánh được bản chất "campus có 3 khu" của sản phẩm. Đề xuất refresh theo concept **"Ink & Signal"**: neutral **ấm** (thay vì blue-tinted), **một brand signal** duy nhất đậm tính nhận diện, và **ba accent pillar** để phân biệt Learn / Cohort / Hackathon.

**EN.** Corelia is an online learning app that also runs offline cohorts and hackathons. Its current *Midnight Blue* system is solid technically but reads as "generic SaaS blue". The refresh proposes **"Ink & Signal"**: warm neutrals, one distinctive brand signal, and three pillar accents — giving Learn, Cohort, and Hackathon their own voice while staying one family.

---

## 1. Audit hiện trạng / Current State Audit

### 1.1 Cấu trúc sản phẩm đang tồn tại

Từ code `App.tsx`, `/src/pages/*`, schema Firestore và `STYLE_GUIDE.md`, Corelia đang là một hệ **3 pillar** rõ ràng:

| Pillar | Routes | Personas chính | Bản chất UX |
|---|---|---|---|
| **Learn (Online)** | `/courses`, `/courses/:id`, `/learn/:courseId/...` | Học viên tự học, giảng viên độc lập | Consumption — dài, sâu, cần focus, có progress & streak |
| **Cohort (Offline)** | `/cohorts`, `/cohorts/:id`, `/instructor/cohorts/*` | Học viên đăng ký kỳ, *offline academy manager*, đối tác | Schedule-driven — lịch tuần, địa điểm, điểm danh, recording |
| **Hackathon (Contest)** | `/contests`, `/contests/:id`, `/instructor/contests/*` | Team thi, *contest manager*, ban giám khảo | Event-driven — countdown, submission, leaderboard, judging |

Ngoài ra có: **Account/Billing** (SePay — thanh toán VN), **Instructor workspace** (Courses / Cohorts / Contests CRUD + Partner Finance), **Admin**, **Achievements** (gamification).

### 1.2 Điểm mạnh của design system hiện tại

1. **Token discipline tốt.** Dùng `oklch()` P3 cho mọi màu, có `primary-container` / `on-primary-container` kiểu M3. Không hardcode `slate-*` hay `#hex`.
2. **Cấu trúc file rõ.** `globals.css` chỉ một file, `@theme inline` của Tailwind v4 map đúng chuẩn, dark mode bằng `.dark` class + `next-themes`.
3. **Component baseline vững.** shadcn `base-lyra` + `@base-ui/react` (không Radix) + Phosphor duotone — lựa chọn hiện đại, ít vendor lock.
4. **Radius mix-and-match thông minh.** Button `rounded-none` + Card `rounded-lg` tạo "visual tension" kiểu M3 Expressive — đã đúng hướng.
5. **Wrapper chuẩn có document.** `max-w-[1990px]` ultra-wide, quy tắc chống double-wrapper đã được ghi rõ.

### 1.3 Vấn đề nhận diện được

Kỹ thuật thì mạnh, nhưng về **brand**:

1. **Identity "nhìn giống ai cũng được".** Electric Blue + deep navy là palette tiêu chuẩn của khoảng 60% SaaS 2023–2025. Không đọng lại trong đầu người dùng.
2. **Không có visual language phân biệt 3 pillar.** Trang Cohort, Contest, Courses dùng gần như y hệt color & pattern. Người dùng phải đọc header mới biết đang ở đâu.
3. **Neutral quá lạnh.** Blue-tinted white (`#EEF2FF`) + blue-gray muted foreground → cảm giác "dashboard ops tool", không hợp với vibe "học tập + cộng đồng".
4. **Typography một-tầng.** Chỉ Google Sans + JetBrains Mono — không có display face hay serif accent cho hero moment. Kết quả là hero và body cảm thấy cùng một trọng lượng.
5. **Không có illustration / photography system.** Trang Home dùng hình thumbnail + icon, chưa có hướng dẫn ảnh chụp (cho Cohort — ảnh thật người học IRL) hay illustration (cho Hackathon — hero energy).
6. **Logo & brand mark vắng mặt.** Chưa thấy logo token trong repo (`/public` chỉ có favicon). Brand chưa có signature visual.
7. **Tone of voice chưa chuẩn hoá.** Copy hiện tại mix "Khoá offline / Cohort đang mở / Đã kết thúc" — đúng nghĩa nhưng thiếu tính cách.

---

## 2. Brand Positioning & Narrative

### 2.1 Mission (đề xuất)

**VI:** *"Corelia là sân ga của những người muốn học để xây. Chúng tôi ghép khoá học tự học, cohort trực tiếp và sân chơi hackathon thành một hành trình duy nhất — để người học ra khỏi đây không chỉ có chứng chỉ, mà có sản phẩm, cộng đồng và một version mới của chính mình."*

**EN:** *"Corelia is a campus for people who learn in order to build. We weave self-paced courses, in-person cohorts, and hackathons into one journey — so learners leave with not just certificates, but products, community, and a new version of themselves."*

### 2.2 Brand promise — 3 verbs

| Verb | Pillar | Promise |
|---|---|---|
| **Learn** | Online courses | *Học không phải để xem hết video. Học để làm được.* |
| **Connect** | Offline cohort | *Bạn không học một mình. Bạn học cùng một phòng.* |
| **Ship** | Hackathon | *Ý tưởng chỉ có giá trị khi ra mắt. Chúng tôi cho bạn 48 giờ + sân khấu.* |

### 2.3 Audience / Personas

1. **"Minh" — Self-learner (25, dev junior).** Cần skill mới, hay bỏ dở khoá. Cần friction thấp, checkpoint ngắn, sản phẩm cuối.
2. **"Linh" — Cohort student (22, sinh viên năm cuối).** Cần cam kết, bạn đồng hành, môi trường IRL. Trả tiền cho cộng đồng và mentor, không chỉ kiến thức.
3. **"Team Pixel" — 3 người hackathon.** Cần brief ngắn, deadline rõ, sân chơi để launch. Tham gia cả online và offline final.
4. **"Thầy Tùng" — Instructor / Partner academy.** Cần tool để vận hành lớp, điểm danh, doanh thu, invoice (SePay). UX của họ phải sharp, density cao.
5. **"Giám khảo Trang" — Contest judge.** Cần workflow chấm điểm nhanh trên mobile, xem submission, cho nhận xét.

### 2.4 Campus metaphor — 3 khu vực

Để identity có story duy nhất và dễ nhớ, dùng ẩn dụ **"Corelia Campus"**:

- 🕮 **Library** — khu Learn. Yên tĩnh, tập trung, đủ ánh sáng. Màu sắc trầm hơn, typography dễ đọc, animation nhỏ.
- 🔥 **Studio** — khu Cohort. Ấm, tụ họp, có bảng trắng và ghế sofa. Ảnh thật, màu ấm, typography có chất editorial.
- ⚡ **Arena** — khu Hackathon. Sân khấu, đèn, tiếng đếm ngược. Màu neon, typography bold, motion mạnh.

Ba khu vực cùng một campus → chia sẻ **neutrals và signal**, chỉ đổi **accent + motion**.

---

## 3. Visual Identity Refresh — "Ink & Signal"

### 3.1 Khái niệm cốt lõi

- **Ink** = neutral ấm (gần ink mực in sách), dùng cho text, bg, card. Không xanh-hoá, không trắng tuyệt đối.
- **Signal** = một màu duy nhất, rực, để "xi nhan" thương hiệu (button CTA chính, logo accent, focus ring, link).
- **3 Pillar Accents** = màu phụ dành riêng cho Learn / Cohort / Hackathon, chỉ xuất hiện trong ngữ cảnh pillar tương ứng.

Triết lý: *99% UI là Ink, 1% là Signal.* Chính sự hạn chế là cái tạo ra identity.

### 3.2 Logo concept

Wordmark **"corelia"** — chữ thường, custom-spaced, chữ "o" đầu là một **vòng tròn ba cung** (ba pillar), một cung ngắt mảnh để tạo cảm giác "mở" như một quỹ đạo. Có thể tách:

- **Full wordmark** — header, email, footer, docs.
- **Lockup với tagline** — landing pages, print.
- **Monogram "C"** (mark only) — favicon, avatar, app icon, merchandise, stamp cho certificate.

Nguyên tắc:
1. Logo **luôn** trên nền Ink (light hoặc dark), không được đặt trên nền Signal.
2. Clearspace = chiều cao chữ "o".
3. Min size: 16px mark, 64px wordmark.
4. Không stretch, không outline, không drop-shadow.
5. Pillar context: monogram có thể đổi màu cung theo pillar đang active (subtle — dùng 10–15% opacity).

> *Trong repo: suggest tạo `/public/brand/corelia-wordmark.svg`, `corelia-mark.svg`, `corelia-wordmark-dark.svg`. File SVG cuối tài liệu có phần gợi ý code.*

### 3.3 Color System v2

#### 3.3.1 Ink (neutrals ấm)

| Token | Light | Dark | Công năng |
|---|---|---|---|
| `--ink-0` | `#FFFFFF` | `#0A0C12` | Card highest, modal |
| `--ink-50` (bg) | `#F7F5EF` warm paper | `#0E1220` deep ink | Nền trang |
| `--ink-100` (card) | `#FDFBF5` | `#141826` | Card resting |
| `--ink-200` (elevated) | `#F1EDE3` | `#1C2033` | Card hover, elevated |
| `--ink-500` (muted fg) | `#6B6558` warm slate | `#94908A` | Mô tả, meta |
| `--ink-900` (fg) | `#141217` near-ink | `#F2EFE6` off-paper | Heading, body |

Khác biệt chính so với Midnight Blue hiện tại: **không blue-tint, mà warm-tint (vàng nhạt/ấm).** Tạo cảm giác "giấy" cho Learn, "gỗ studio" cho Cohort, làm tương phản với Signal neon ở Hackathon.

#### 3.3.2 Signal — brand color duy nhất

**Cobalt Signal** `#3B5CFF` (oklch: `0.58 0.22 268`)
- Một màu xanh cobalt hơi ngả tím — đặc hơn electric blue hiện tại, ít đụng hàng, vẫn đọc là "digital + trust".
- Dark mode lift: `#7A8CFF` (`oklch: 0.72 0.17 268`).
- Luôn dùng **đặc** (không /10, không gradient), ngoại trừ focus-ring (ring/40).

> *Khi nào dùng Signal?* Button primary CTA toàn app, focus ring, link chính, logo mark cung "active", loading indicator, progress bar "on track".

#### 3.3.3 Pillar Accents

Mỗi pillar có **một** màu chính + **một** tonal container (M3 style).

| Pillar | Accent | Light hex | Dark hex | Tonal container (light) |
|---|---|---|---|---|
| **Learn** | Cobalt *(= Signal)* | `#3B5CFF` | `#7A8CFF` | `#E4E8FF` |
| **Cohort** | Saffron *(ấm, IRL)* | `#E8A317` | `#FFC94A` | `#FBF1D8` |
| **Hackathon** | Neon Lime *(build)* | `#B6F04C` | `#C8F96A` | `#ECFBC9` |

Logic:
- **Learn = Signal.** Vì Learn là trụ lớn nhất (volume) và là "default". Người học mặc định ở đây.
- **Cohort = Saffron.** Gợi warmth, lớp học IRL, ánh đèn buổi chiều, bia sau workshop. Rất Việt Nam.
- **Hackathon = Neon Lime.** Energy, "builder green", gợi terminal, tương phản mạnh với Ink.

#### 3.3.4 Semantic (không đổi — đã ổn)

`success = emerald-600/500`, `warning = amber-500`, `destructive = red-500` — giữ nguyên theo STYLE_GUIDE hiện tại. **Lưu ý:** Hackathon's Neon Lime ≠ success Emerald. Emerald trầm hơn, Lime sáng hơn — không nhầm nhau.

#### 3.3.5 Chart palette

Refresh chart cho dễ phân biệt trong report analytics:

```
chart-1: Cobalt Signal #3B5CFF
chart-2: Saffron #E8A317
chart-3: Neon Lime #B6F04C
chart-4: Teal #1F9E8F
chart-5: Clay #C7593B (warm red/terracotta — dùng cho negative delta)
```

### 3.4 Typography

**Refresh: hệ 3 tầng**

1. **Display / Hero** — `"Instrument Serif"` (Google Fonts, free) hoặc `"Fraunces"` với optical size.
   - Dùng cho: Hero H1 landing / pillar landing / quote / certificate.
   - Cảm giác: editorial, literary — đối trọng với UI sans.
   - Weight dùng: 400 regular. Không bold.
2. **UI / Body** — `"Google Sans Variable"` (giữ nguyên).
   - Dùng cho: toàn bộ UI, body text, nav, form.
3. **Mono / Code** — `"JetBrains Mono Variable"` (giữ nguyên).
   - Dùng cho: code, số thống kê `tabular-nums`, countdown hackathon.

Quy tắc:

| Role | Font | Class |
|---|---|---|
| Pillar landing H1 | Instrument Serif | `text-4xl md:text-6xl font-normal tracking-tight` |
| Page H1 | Google Sans | `text-2xl sm:text-3xl font-normal tracking-tight` |
| Section heading | Google Sans | `text-lg font-medium` |
| Body | Google Sans | `text-[15px] leading-7` |
| Mono / code / countdown | JetBrains Mono | `font-mono tabular-nums` |
| Quote (editorial) | Instrument Serif | `italic text-xl leading-relaxed` |

> *Lý do thêm serif:* education brands (Maven, Reforge, Lenny's Newsletter, On Deck) đang dùng serif để tạo "literary authority". Với Corelia thiên về học thuật + cộng đồng, một display serif sẽ tạo signature rõ rệt mà không phá UI density.

### 3.5 Iconography

- **Chính:** `@phosphor-icons/react`, **weight duotone cho UI label**, **regular/bold cho action**, **fill cho active state**. *(Giữ theo STYLE_GUIDE hiện tại.)*
- **Size scale:** `size-4` inline text, `size-5` section label, `size-6` CTA icon, `size-8+` empty state.
- **Pillar icon pinning** (mới): mỗi pillar có một icon đại diện thống nhất:
  - Learn → `BookOpen` (duotone)
  - Cohort → `UsersThree` (duotone) *(hoặc `Chalkboard` nếu muốn nhấn IRL)*
  - Hackathon → `Lightning` (fill) *(bỏ `Trophy` — quá cliché)*
- **Custom glyphs** (đề xuất): thiết kế riêng 6–8 custom icon SVG cho concept đặc trưng (certificate ribbon, streak flame, judge scale, cohort schedule-grid, hackathon-countdown). Bộ này cần cùng stroke-width (1.5px) và cùng radius để hoà với Phosphor.

### 3.6 Illustration & Photography

Hiện trạng: chưa có hướng rõ. Đề xuất **3 kênh visual**, mỗi pillar ưu tiên một loại:

| Pillar | Loại visual chính | Style guideline |
|---|---|---|
| **Learn** | *Isometric flat illustration* | Line 1.5px, palette = Ink + Signal + 1 Pillar accent, không gradient, không 3D render. Gợi ý tham khảo: Framer, Vercel, Resend. |
| **Cohort** | *Photography thật — người học IRL* | Shot cohort thật, ánh sáng tự nhiên chiều tối, grain nhẹ, crop 3:2. Không stock photo. Overlay Saffron 8% cho ảnh header. |
| **Hackathon** | *High-contrast editorial* | Mix: ảnh chụp team đang build + screenshot submission + typo lớn Neon Lime. Có thể animated (Lottie). Vibe giống Buildspace / Devpost. |

Quy tắc chung:
1. Không dùng stock photo generic (handshake, city skyline, abstract blue).
2. Không AI-generated art trong header/hero. AI-generated chỉ dùng cho background pattern (chấp nhận được).
3. Mọi ảnh có alt text tiếng Việt đầy đủ.
4. Hero image luôn dưới 240KB (use AVIF > WebP > JPG).

### 3.7 Motion Principles

3 lớp motion, mỗi pillar inherit một "tone":

- **Quiet (Learn)** — fade + translate nhỏ (8px), 200ms, ease `cubic-bezier(0.2, 0, 0, 1)`. Không bounce.
- **Warm (Cohort)** — spring nhẹ, scale 1.00 → 1.02, 260ms, ease `cubic-bezier(0.34, 1.56, 0.64, 1)` (subtle overshoot). Cảm giác "chào mừng".
- **Sharp (Hackathon)** — snap, 120ms, linear-in ease-out. Stagger 30ms giữa items. Countdown dùng `step-end` để nhảy số (không smooth).

Rules:
- `prefers-reduced-motion` luôn fallback sang instant hoặc ≤ 80ms.
- Không dùng parallax, không dùng full-page scroll hijack.
- Skeleton loading dùng shimmer nhẹ (15% opacity sweep), không pulse.

### 3.8 Tone of Voice

**Nguyên tắc chung (VI + EN)**

1. **Nói "bạn", không nói "quý khách/quý học viên".** Corelia là campus, không phải ngân hàng.
2. **Mệnh đề ngắn hơn câu dài.** Ưu tiên <= 12 từ.
3. **Động từ trước, danh từ sau.** "Bắt đầu bài học" > "Tiến hành học tập bài học".
4. **Số cụ thể > tính từ.** "6 tuần, 12 buổi" > "chương trình ngắn gọn".
5. **Không sáo rỗng.** Tránh "đột phá", "tiên phong", "tối ưu hóa trải nghiệm người dùng".
6. **Tiếng Anh không gượng.** "Start learning" > "Begin your learning journey".

**Ví dụ copy — before / after**

| Ngữ cảnh | ❌ Before | ✅ After (VI) | ✅ After (EN) |
|---|---|---|---|
| Empty state Courses | "Hiện chưa có khóa học nào trong hệ thống." | "Chưa có khoá. Chọn một chủ đề để bắt đầu." | "No courses yet. Pick a topic to start." |
| Error 403 | "Quý khách không có quyền truy cập." | "Bạn chưa được cấp quyền vào trang này." | "You don't have access to this page." |
| CTA Cohort | "Tiến hành đăng ký" | "Giữ chỗ" | "Save my seat" |
| CTA Hackathon | "Tham gia cuộc thi" | "Vào giải" | "Enter" |
| Success toast | "Cập nhật thông tin thành công." | "Đã lưu." | "Saved." |

**Pillar-specific voice**

- **Learn** — rõ, tường minh, không màu mè. "3 bài, 45 phút, bắt đầu nhé?"
- **Cohort** — ấm, mời gọi, cá nhân. "Thứ 7 này Linh đứng lớp. Hẹn bạn 19h."
- **Hackathon** — ngắn, energetic, dùng imperative. "48 giờ. Build. Ship."

---

## 4. Design Tokens v2 (drop-in cho Tailwind v4)

> *Phần này có thể paste thẳng vào `globals.css` dưới block `:root` hiện tại. Migration plan ở mục 9.*

### 4.1 Root tokens (light)

```css
:root {
  /* ── Ink (warm neutrals) ── */
  --background: oklch(0.967 0.012 86);        /* #F7F5EF warm paper */
  --foreground: oklch(0.18 0.015 278);        /* #141217 near-ink */
  --card: oklch(0.985 0.008 90);              /* #FDFBF5 */
  --card-elevated: oklch(0.945 0.017 84);     /* #F1EDE3 */
  --muted: oklch(0.945 0.012 86);
  --muted-foreground: oklch(0.5 0.018 70);    /* warm slate */
  --border: oklch(0.9 0.015 82);
  --border-subtle: oklch(0.935 0.012 85);

  /* ── Signal (Cobalt) ── */
  --primary: oklch(0.58 0.22 268);            /* #3B5CFF cobalt */
  --primary-foreground: oklch(0.985 0 0);
  --primary-container: oklch(0.94 0.07 268);  /* #E4E8FF */
  --on-primary-container: oklch(0.3 0.17 268);
  --ring: oklch(0.58 0.22 268);

  /* ── Pillars ── */
  --learn: var(--primary);
  --learn-container: var(--primary-container);
  --on-learn-container: var(--on-primary-container);

  --cohort: oklch(0.755 0.155 74);            /* #E8A317 saffron */
  --cohort-container: oklch(0.94 0.045 82);   /* #FBF1D8 */
  --on-cohort-container: oklch(0.35 0.11 75);

  --hackathon: oklch(0.89 0.23 125);          /* #B6F04C lime */
  --hackathon-container: oklch(0.95 0.12 125);/* #ECFBC9 */
  --on-hackathon-container: oklch(0.25 0.08 125);

  /* ── Semantic (giữ) ── */
  --success: oklch(0.596 0.145 163);
  --warning: oklch(0.769 0.188 70);
  --destructive: oklch(0.577 0.245 27);

  /* ── Radius (giữ) ── */
  --radius: 0.5rem;

  /* ── Motion tokens (mới) ── */
  --motion-quiet: 200ms cubic-bezier(0.2, 0, 0, 1);
  --motion-warm: 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
  --motion-sharp: 120ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 4.2 Dark tokens

```css
.dark {
  --background: oklch(0.155 0.02 278);        /* #0E1220 deep ink */
  --foreground: oklch(0.95 0.012 90);         /* #F2EFE6 off-paper */
  --card: oklch(0.205 0.025 278);             /* #141826 */
  --card-elevated: oklch(0.245 0.03 278);     /* #1C2033 */
  --muted: oklch(0.245 0.03 278);
  --muted-foreground: oklch(0.66 0.02 82);
  --border: oklch(0.285 0.03 278);
  --border-subtle: oklch(0.23 0.025 278);

  --primary: oklch(0.72 0.17 268);            /* #7A8CFF */
  --primary-foreground: oklch(0.14 0.025 278);
  --primary-container: oklch(0.29 0.095 268);
  --on-primary-container: oklch(0.88 0.08 268);
  --ring: oklch(0.72 0.17 268);

  --cohort: oklch(0.82 0.14 76);              /* #FFC94A */
  --cohort-container: oklch(0.3 0.075 76);
  --on-cohort-container: oklch(0.9 0.08 82);

  --hackathon: oklch(0.92 0.22 125);          /* #C8F96A */
  --hackathon-container: oklch(0.34 0.11 125);
  --on-hackathon-container: oklch(0.94 0.18 125);
}
```

### 4.3 Tailwind `@theme inline` bổ sung

Thêm vào block `@theme inline`:

```css
@theme inline {
  /* ...tokens hiện có... */
  --color-learn: var(--learn);
  --color-learn-container: var(--learn-container);
  --color-on-learn-container: var(--on-learn-container);
  --color-cohort: var(--cohort);
  --color-cohort-container: var(--cohort-container);
  --color-on-cohort-container: var(--on-cohort-container);
  --color-hackathon: var(--hackathon);
  --color-hackathon-container: var(--hackathon-container);
  --color-on-hackathon-container: var(--on-hackathon-container);
  --color-card-elevated: var(--card-elevated);
  --font-display: "Instrument Serif", Georgia, serif;
}
```

### 4.4 Quy tắc dùng pillar token

```tsx
// Pillar badge
<span className="rounded-full bg-cohort-container text-on-cohort-container text-[11px] px-2 py-0.5">
  Offline Cohort
</span>

// Pillar CTA (secondary — pillar context only)
<Button className="bg-hackathon text-on-hackathon-container hover:brightness-95">
  Submit project
</Button>

// Đầu page pillar (hero bar)
<div className="h-1 w-full bg-cohort" />
```

**Quan trọng:** pillar accent chỉ dùng trong ngữ cảnh pillar đó (ví dụ trang Cohort, card Cohort, filter "offline"). Không dùng Saffron trên trang Course. Điều này giữ identity "một signal" không bị loãng.

---

## 5. Component & Pattern Library

### 5.1 Patterns giữ nguyên (đã ổn trong v1)

Card `rounded-lg`, Button sharp/round mix, Progress bar track rounded-full, Section label uppercase + duotone icon, Breadcrumb, Header sticky backdrop-blur — tất cả giữ.

### 5.2 Patterns cần refine

**5.2.1 Pillar Hero Bar (mới)**

Mọi trang pillar top-level (`/courses`, `/cohorts`, `/contests`) bắt đầu bằng một thanh accent 2–4px rộng full-width, cộng serif H1. Giúp user "biết ngay mình ở đâu" mà không cần đọc.

```tsx
<div aria-hidden className="h-1 w-full bg-cohort" />
<header className="mx-auto max-w-[1990px] px-4 pt-10 pb-6 sm:px-6">
  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
    Offline · Cohort
  </p>
  <h1 className="mt-2 font-display text-5xl tracking-tight text-foreground">
    Học cùng một phòng.
  </h1>
</header>
```

**5.2.2 Lesson Player (Learn)**

- Column layout: `grid lg:grid-cols-[280px_1fr_320px]` — sidebar curriculum, video/reading, notes/discussion.
- Reading mode: `max-w-[72ch]`, leading `7`, font-size `[17px]`, serif optional cho long-form article.
- Progress pill floating top-right: số phút còn lại, % done, streak ngày.
- *Focus mode* toggle: ẩn sidebar, full-width center, dim chrome 40%.

**5.2.3 Cohort Schedule Card**

- Grid tuần (Mon–Sun) chạy ngang, mỗi ô là một buổi.
- Buổi đã xong → `bg-card-elevated` + tick success.
- Buổi sắp tới → `border-cohort border-l-2` + countdown `font-mono`.
- Buổi đang diễn ra → `bg-cohort-container text-on-cohort-container` + LIVE dot animated.
- Có nút "Thêm vào Google Calendar" (icon + hover).

**5.2.4 Hackathon Countdown (Contest)**

- Full-bleed block trên trang ContestDetail khi `status === "running"`.
- `font-mono tabular-nums` size 72–96px, màu Neon Lime trên Ink bg.
- Stagger animation: 00 01 02 03 04 05 flip from top.
- Dưới đếm ngược: link "Submit project" sharp rectangle button, `bg-hackathon text-on-hackathon-container`.

**5.2.5 Leaderboard (Contest)**

- Bảng rank kiểu "podium" 3 đầu + list từ 4 xuống.
- Rank 1–3 có card lớn hơn, avatar tròn stacked, Neon Lime accent.
- Rank 4+ row density cao, `tabular-nums`, có sparkline điểm theo thời gian.
- Filter: round, track, team size. Sticky filter bar.

**5.2.6 Submission Card (Contest)**

- Thumbnail project 16:9 + title serif + 3 chips (tech stack).
- Hover: reveal demo video auto-play muted.
- Click: expand to modal có iframe demo + README + team.

**5.2.7 Certificate / Badge (Achievements)**

- Template giấy craft: Paper bg + Ink text + Signal dấu seal.
- Monogram "C" ở góc, ribbon Neon Lime nếu là hackathon winner, Saffron nếu là cohort completion, Signal nếu là course completion.
- Xuất PNG + PDF (1240×1754 A4 portrait), có QR verify `/verify/:certId`.

### 5.3 Dashboard / Home restructure

Home hiện tại load cả courses + contests + offline cohorts trong một feed → khá dày. Đề xuất layout mới:

```
┌─────────────────────────────────────────────────────────┐
│ Greeting row (first name + today's line + streak)       │
├─────────────────────────────────────────┬───────────────┤
│ "Tiếp tục học" — 1–2 focus card ngang   │ Upcoming      │
│ (auto-pick last lesson / live cohort)   │ - Cohort today│
│                                          │ - Contest 3d │
├──────────┬──────────┬─────────────────────┴───────────────┤
│ 3 pillar tiles (Learn / Cohort / Hackathon) — equal weight  │
│ mỗi tile: icon + 1 số KPI + 1 CTA                             │
├──────────────────────────────────────────────────────────┤
│ Recommended courses (carousel 4 items)                    │
├──────────────────────────────────────────────────────────┤
│ Community highlights (recent submissions, alumni stories)  │
└──────────────────────────────────────────────────────────┘
```

Nguyên tắc: mỗi lần mở Home, user thấy **một** next-step rõ ràng (focus card), không phải danh sách dài.

---

## 6. Information Architecture & Navigation

### 6.1 Top-level nav (proposed)

```
Home  ·  Learn  ·  Cohorts  ·  Hackathon  ·  (divider)  ·  [Instructor/Admin]  ·  Avatar
```

- **Học / Learn** thay cho "Courses" → nhất quán với động từ pillar.
- **Hackathon** thay cho "Contests" → brand-friendly hơn với giới builder.
- Role-based items (Instructor, Admin) chỉ xuất hiện với role phù hợp, ngăn cách bằng divider `·`.

### 6.2 Sidebar strategy

- Instructor workspace: giữ sidebar hiện tại, refine label.
- Learn (lesson view): sidebar curriculum collapsible, default open desktop, closed mobile.
- Cohort detail: sidebar right có "Buổi tới + Người học trong cohort", sticky.
- Contest detail: sidebar right có countdown + submit button + team info.

### 6.3 Breadcrumb

Giữ hiện tại. Thêm **pillar-colored dot** trước breadcrumb để user biết context:

```tsx
<div className="mb-3 flex items-center gap-2">
  <span className="size-1.5 rounded-full bg-cohort" />
  <Breadcrumb>...</Breadcrumb>
</div>
```

### 6.4 Empty states

Mỗi pillar có empty state riêng, giọng riêng (xem mục 3.8):

- **Learn empty**: "Chưa có khoá. Chọn một chủ đề để bắt đầu." + CTA "Xem catalog"
- **Cohort empty**: "Chưa có cohort nào mở. Thả email, chúng tôi sẽ báo." + email input
- **Hackathon empty**: "Không có giải đang chạy. Giải kế: *Build Summer '26* — khởi động T6/2026." + CTA "Đặt nhắc"

Illustration cho mỗi empty state theo style mục 3.6.

### 6.5 Onboarding flow (đề xuất mới)

Sau sign-up, hỏi 3 câu:

1. **"Bạn muốn học về gì?"** — multi-select topic (→ personalize Home).
2. **"Mục tiêu của bạn?"** — radio: Learn skill / Find cohort / Build project / Earn certificate.
3. **"Đã từng tham gia hackathon?"** — yes / no / curious (→ gate hackathon tab nếu curious, có onboarding nhẹ).

Tổng 30s. Không hỏi nhiều hơn. Cá nhân hoá Home dashboard ngay lần đầu.

---

## 7. Accessibility & Inclusivity

1. **Contrast:** tất cả Ink-foreground vs Ink-background ≥ 7:1 (AAA). Cohort Saffron trên Ink-900 đạt 4.6:1 — **chỉ dùng Saffron cho background container, không dùng làm text lớn trên bg thường.** Neon Lime chỉ dùng trên Ink dark (contrast 12:1), không dùng trên paper.
2. **Focus ring:** 2px outline Signal + 2px offset. Không bỏ outline.
3. **Keyboard:** tab-order đi từ top-left xuống bottom-right logic, Skip-to-content link ở top.
4. **Reduced motion:** respect `prefers-reduced-motion`. Countdown flip → jump.
5. **Localization:**
   - VI là ngôn ngữ primary. Toàn bộ microcopy phải qua VN native review.
   - Date/time dùng `toLocaleDateString("vi-VN")`. Countdown, currency SePay dùng `vi-VN` formatter.
   - Không hard-code "days / hours" — dùng i18n key.
6. **Screen reader:** mọi icon decorative phải `aria-hidden`, icon có ngữ nghĩa phải có `aria-label`.
7. **Pillar identity không chỉ dựa vào màu** — luôn kèm icon + label text.

---

## 8. Merchandise, Print & Ecosystem

*Tuỳ chọn — nếu roadmap có IRL cohort & hackathon IRL, nên có từ đầu.*

- **Cohort welcome kit**: tote bag Paper + tag Saffron + sổ tay Ink cover + 1 sticker monogram.
- **Hackathon swag**: áo đen monogram Neon Lime nhỏ, sticker slap "shipped @ Corelia".
- **Certificate print**: giấy ngà, wordmark foil Signal. 280 g/m² uncoated.
- **Email templates** (3 template: transactional, cohort weekly, hackathon brief) — HTML inline, web-safe fallback, responsive.
- **Social templates**: OG image 1200×630, Instagram story 1080×1920, LinkedIn banner 1584×396. Mỗi template có biến `pillar` để auto-recolor.

---

## 9. Migration Roadmap

### P0 — Tuần 1–2 (token groundwork)

- [ ] Thêm pillar tokens vào `globals.css` (mục 4) — backward compat, không phá gì.
- [ ] Thêm Instrument Serif font (preload) + class `font-display`.
- [ ] Thiết kế wordmark + mark (SVG) vào `/public/brand/`.
- [ ] Cập nhật `STYLE_GUIDE.md` cross-link sang `BRAND_DIRECTION_v2.md`.

### P1 — Tuần 3–6 (applied refresh)

- [ ] Dần chuyển `--background`, `--foreground`, `--muted-*` sang warm neutrals (feature flag: `__INK_V2__`, A/B test 2 tuần).
- [ ] Cập nhật Home page theo layout mục 5.3.
- [ ] Refactor Pillar Landing (Courses / Cohorts / Contests) — hero bar + display serif H1.
- [ ] Thêm pillar-colored dot vào Breadcrumb.
- [ ] Rebuild Contest Countdown + Leaderboard.

### P2 — Tuần 7–12 (identity deepening)

- [ ] Custom icon set (6–8 glyph).
- [ ] Cohort photography shoot (1–2 buổi real cohort).
- [ ] Certificate generator service (PNG + PDF + QR verify).
- [ ] Onboarding flow (mục 6.5).
- [ ] Merch + print template kit.

### P3 — Tháng 4+

- [ ] Illustration library (10+ scene cho Learn).
- [ ] Lottie motion library (3 animations: welcome, complete, submit).
- [ ] Email template set.
- [ ] Brand playbook v2 cho đối tác học viện offline (Cohort partner).

---

## 10. Appendix

### 10.1 Logo SVG scaffold

```svg
<svg viewBox="0 0 120 32" xmlns="http://www.w3.org/2000/svg" fill="none">
  <!-- "c" with tri-arc "o" -->
  <circle cx="14" cy="16" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="10 4 10 4 10 4" stroke-linecap="round"/>
  <text x="28" y="22" font-family="Instrument Serif, Georgia, serif" font-size="22" fill="currentColor">corelia</text>
</svg>
```

### 10.2 Pillar selector helper (suggested hook)

```ts
// src/lib/pillar.ts
export type Pillar = "learn" | "cohort" | "hackathon";

export function pillarTheme(p: Pillar) {
  return {
    accent: `bg-${p}`,
    container: `bg-${p}-container text-on-${p}-container`,
    barClass: `h-1 w-full bg-${p}`,
  };
}
```

### 10.3 Tên mẫu copy (cho designer/writer)

- Home greeting: "Chào Minh. Hôm nay học 25 phút nhé?"
- Streak: "Streak 7 ngày — đừng gãy hôm nay."
- Cohort reminder: "7h tối nay Linh đứng lớp. Hẹn bạn ở Studio 3, Nguyễn Trãi."
- Hackathon alert: "Còn 03:12:45 đến deadline. Bạn đã push lần cuối 48 phút trước."

### 10.4 Checklist brand review (dùng mỗi lần ship UI mới)

1. [ ] Không dùng màu hardcode (`blue-500`, `#hex`).
2. [ ] Pillar accent dùng đúng context.
3. [ ] Signal (`--primary`) chỉ có mặt ở CTA chính / focus ring / logo cung active.
4. [ ] Contrast text ≥ 4.5:1 (body), ≥ 3:1 (large).
5. [ ] Reduced motion được respect.
6. [ ] Có alt text VN đầy đủ.
7. [ ] Copy VN đã qua review (xem mục 3.8 checklist).
8. [ ] Icon decorative có `aria-hidden`.
9. [ ] Không double wrapper.
10. [ ] Không dùng `min-h-screen` thừa.

---

## 11. Câu hỏi để lại (cần quyết định)

1. **Tên brand** — giữ "Corelia" hay đổi? (giả định: giữ.)
2. **Logo direction** — text-only wordmark vs có mark? (đề xuất: cả hai, mark cho favicon/app.)
3. **Primary Signal** — Cobalt `#3B5CFF` hay giữ Electric Blue cũ `#1D4ED8`? (đề xuất: Cobalt, khác biệt hơn.)
4. **Serif display** — Instrument Serif (miễn phí) hay Fraunces hay PP Editorial? (đề xuất: Instrument Serif để bắt đầu, upgrade sau nếu brand scale.)
5. **Saffron vs Terracotta** cho Cohort — Saffron tươi hơn, Terracotta trầm hơn. (đề xuất: Saffron để tạo năng lượng "buổi chiều ấm".)
6. **Neon Lime vs Electric Magenta** cho Hackathon. (đề xuất: Neon Lime, vibe builder/terminal, dễ pair với Ink.)
7. **A/B test kế hoạch** — refresh dần từng page hay big-bang? (đề xuất: dần, per-route, feature flag.)

> *Trả lời 7 câu trên là chốt được identity. Mỗi câu có "đề xuất" — nếu đồng ý hết, bạn có thể ship P0 ngay tuần sau.*

---

**Tác giả đề xuất / Proposed by.** Direction này được sinh từ audit tại `/Users/terrrancrypt/Work/corelia-app` ngày 20/04/2026. Tài liệu là **sống** — cập nhật khi có quyết định mới về identity.

**File liên quan trong repo:**
- `docs/STYLE_GUIDE.md` — style guide v1 hiện tại (giữ, chạy song song cho tới khi P1 xong).
- `src/styles/globals.css` — nơi sẽ thêm pillar tokens.
- `public/brand/` — thư mục cần tạo cho wordmark/mark SVG.
