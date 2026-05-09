# Corelia Design System — Premium Edition v2

> Rules-only cheatsheet. AI và dev tra trước khi viết UI. Mọi class string trong file này copy được trực tiếp.
>
> **v2 — Premium Dark-First.** Thay đổi lớn so với v1: dark mode là primary context, elevation bằng luminance thay shadow, typography chặt hơn, 5-layer surface system, premium patterns mới.

---

## 0. AI Rules — Đọc trước

- KHÔNG hardcode màu: `#xxx`, `bg-[#xxx]`, `rgb()`. Luôn dùng token mục 1.
- KHÔNG hardcode spacing lẻ: `p-[15px]`, `mt-[22px]`. Chỉ scale Tailwind mặc định.
- KHÔNG hardcode font-size: `text-[15px]`. Chỉ 7 cấp ở mục 2.
- KHÔNG hardcode z-index: `z-[999]`. Chỉ scale 0–50 ở mục 6.
- KHÔNG mix icon library. Chỉ `lucide-react`.
- KHÔNG có 2 Primary button trong cùng viewport.
- KHÔNG trộn Anh-Việt trong cùng 1 page (trừ tên riêng / thuật ngữ kỹ thuật).
- KHÔNG animate `width / height / padding`. Chỉ animate `transform / opacity / color`.
- KHÔNG xoá focus ring của interactive elements.
- KHÔNG dùng `<Badge>` cho filter — Badge không có interactive state.
- KHÔNG dùng `shadow-lg` làm elevation chính — dùng luminance scale (mục 5).
- KHÔNG dùng `white` thuần cho text — dùng `text-foreground` (off-white có undertone).
- KHÔNG để background thuần `black` — luôn có indigo undertone (mục 1).
- KHÔNG dùng `rounded-2xl` trở lên — trông playful, không premium.
- Mọi list / grid PHẢI có empty state + loading state.
- Mọi icon-only button PHẢI có `aria-label`.
- Mọi input PHẢI hỗ trợ 5 states: default, focus, error, disabled, readonly.
- Mọi touch target trên mobile ≥ 44×44px.
- Test 375px trước khi ship.

---

## 1. Color Tokens

### 1a. CSS Variables (`globals.css`)

Dark mode là **primary**. Light mode là optional override.

```css
:root {
  --radius: 0.5rem;
  --content-px: clamp(1rem, 3vw, 2rem);
  --app-max-width: 80rem;

  /* ==========================================
     LIGHT MODE: DORA Aesthetic (Warm Sand + Slate)
     ========================================== */
  
  /* ── Background & Surfaces ── */
  /* Nền màu Cát Ấm nhạt (Warm Sand) - Đặc trưng của thiết kế gốc */
  --background: oklch(0.965 0.012 75); 
  /* Chữ màu Xanh Slate Đậm - Sắc nét, cực kỳ dễ đọc */
  --foreground: oklch(0.20 0.04 235); 
  --foreground-muted: oklch(0.55 0.03 235); 
  --foreground-subtle: oklch(0.70 0.02 235); 
  
  /* Thẻ Card Trắng Thuần: Tự động tách lớp nổi bật trên nền cát */
  --card: oklch(1 0 0); 
  --card-foreground: oklch(0.20 0.04 235);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.20 0.04 235);

  /* ── Brand Colors (Deep Slate Blue) ── */
  --primary: oklch(0.25 0.05 235); /* Màu của khối "Calculated ROI" */
  --primary-foreground: oklch(1 0 0); 
  --primary-muted: color-mix(in oklch, var(--primary) 10%, transparent);
  --primary-container: oklch(0.93 0.015 235); 
  --on-primary-container: oklch(0.20 0.04 235);

  /* ── Secondary / Muted (Cho các tab, badge đang active) ── */
  --secondary: oklch(0.93 0.01 75); /* Nền xám be đậm hơn nền tảng */
  --secondary-foreground: oklch(0.25 0.04 235); 
  --muted: oklch(0.93 0.01 75);
  --muted-foreground: oklch(0.55 0.03 235); 
  --accent: oklch(0.93 0.01 75);
  --accent-foreground: oklch(0.20 0.04 235);
  --accent-muted: color-mix(in oklch, var(--accent) 15%, transparent);

  /* ── Semantic Colors (Đã tinh chỉnh UX) ── */
  --destructive: oklch(0.58 0.16 35); /* San hô đậm (Deep Coral) - Không bị chói */
  --destructive-foreground: oklch(1 0 0);
  --destructive-muted: color-mix(in oklch, var(--destructive) 10%, transparent);
  
  --success: oklch(0.60 0.12 150); /* Xanh ngọc trầm */
  --success-foreground: oklch(1 0 0);
  --success-muted: color-mix(in oklch, var(--success) 10%, transparent);
  
  /* 🚨 UX WARNING FIX: 
     --warning: Cam vàng đậm (Dùng làm viền, chữ hoặc icon) 
     --warning-muted: Vàng pastel nhạt (Dùng làm nền banner) */
  --warning: oklch(0.65 0.16 65); /* Deep Gold/Amber -> Đọc rất rõ */
  --warning-foreground: oklch(1 0 0); 
  --warning-muted: oklch(0.96 0.04 85); /* Nền banner màu vàng êm dịu */

  /* ── Borders & Inputs ── */
  --border: oklch(0.88 0.015 75); /* Viền màu be nhạt, tinh tế nhưng rõ khối */
  --border-subtle: oklch(0.92 0.01 75); 
  --border-strong: oklch(0.75 0.02 75);
  --input: oklch(0.88 0.015 75);
  --ring: oklch(0.25 0.05 235);

  /* ── Shadows ── */
  --elevation-1: 0 1px 2px 0 oklch(0.2 0.04 235 / 0.05);
  --elevation-2: 0 4px 6px -1px oklch(0.2 0.04 235 / 0.08), 0 2px 4px -2px oklch(0 0 0 / 0.04);
  --elevation-3: var(--elevation-2);
  --legacy-card-shadow: (legacy) — DS v2 ưu tiên surface elevation hơn shadow

  /* ── Sidebar ── */
  --sidebar: oklch(0.98 0.005 75);
  --sidebar-foreground: oklch(0.20 0.04 235);
  --sidebar-primary: oklch(0.25 0.05 235);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.93 0.01 75);
  --sidebar-accent-foreground: oklch(0.20 0.04 235);
  --sidebar-border: oklch(0.88 0.015 75);
  --sidebar-ring: oklch(0.25 0.05 235);

  /* ── Corelia DS v2 surfaces ── */
  --surface-base: var(--card);
  --surface-raised: oklch(0.98 0.005 75);
  --surface-overlay: oklch(0.96 0.01 75);
  --surface-float: var(--popover);
}

.dark {
  /* ==========================================
     DARK MODE: Slate Navy Sâu Thẳm + Điểm nhấn Gold
     ========================================== */
  --content-px: clamp(1rem, 3vw, 2rem);
  --app-max-width: 80rem; 

  /* ── Background & Surfaces ── */
  --background: oklch(0.18 0.03 240); /* Navy Slate Đậm */
  --foreground: oklch(0.95 0.01 75); /* Trắng ngà (Warm Off-white) -> Chống lóa */
  --foreground-muted: oklch(0.65 0.02 240); 
  --foreground-subtle: oklch(0.50 0.02 240); 
  
  --card: oklch(0.22 0.035 240); /* Card sáng hơn nền một chút để tạo độ nổi */
  --card-foreground: oklch(0.95 0.01 75);
  --popover: oklch(0.22 0.035 240);
  --popover-foreground: oklch(0.95 0.01 75);

  /* ── Brand Colors ── */
  --primary: oklch(0.82 0.12 95); /* Màu Vàng Gold đặc trưng trên nền tối */
  --primary-foreground: oklch(0.18 0.03 240); /* Chữ đen/navy trên nền vàng */
  --primary-muted: color-mix(in oklch, var(--primary) 15%, transparent);
  --primary-container: oklch(0.28 0.04 240); 
  --on-primary-container: oklch(0.82 0.12 95);

  /* ── Secondary / Muted ── */
  --secondary: oklch(0.26 0.03 240); 
  --secondary-foreground: oklch(0.95 0.01 75);
  --muted: oklch(0.26 0.03 240);
  --muted-foreground: oklch(0.65 0.02 240); 
  --accent: oklch(0.26 0.03 240);
  --accent-foreground: oklch(0.95 0.01 75);
  --accent-muted: color-mix(in oklch, var(--accent) 15%, transparent);

  /* ── Semantic Colors (Chỉnh rực lên một chút cho Dark Mode) ── */
  --destructive: oklch(0.68 0.15 35); /* Coral sáng hơn */
  --destructive-foreground: oklch(0.18 0.03 240);
  --destructive-muted: color-mix(in oklch, var(--destructive) 15%, transparent);
  
  --success: oklch(0.70 0.13 150); 
  --success-foreground: oklch(0.18 0.03 240);
  --success-muted: color-mix(in oklch, var(--success) 15%, transparent);
  
  /* Warning: Gold trên nền Dark Mode tương phản CỰC TỐT tự nhiên */
  --warning: oklch(0.85 0.14 85); 
  --warning-foreground: oklch(0.18 0.03 240); 
  --warning-muted: oklch(0.28 0.06 85); /* Nền banner vàng sẫm */

  /* ── Borders & Inputs ── */
  --border: oklch(0.28 0.025 240); 
  --border-subtle: oklch(0.24 0.02 240); 
  --border-strong: oklch(0.40 0.03 240);
  --input: oklch(0.28 0.025 240);
  --ring: oklch(0.82 0.12 95);

  /* ── Shadows ── */
  --elevation-1: 0 1px 2px 0 oklch(0 0 0 / 0.35);
  --elevation-2: 0 4px 6px -1px oklch(0 0 0 / 0.40), 0 2px 4px -2px oklch(0 0 0 / 0.30);
  --elevation-3: var(--elevation-2);
  --legacy-card-shadow: (legacy) — DS v2 ưu tiên surface elevation hơn shadow

  /* ── Sidebar ── */
  --sidebar: oklch(0.16 0.03 240); 
  --sidebar-foreground: oklch(0.95 0.01 75);
  --sidebar-primary: oklch(0.82 0.12 95);
  --sidebar-primary-foreground: oklch(0.18 0.03 240);
  --sidebar-accent: oklch(0.24 0.03 240);
  --sidebar-accent-foreground: oklch(0.95 0.01 75);
  --sidebar-border: oklch(0.28 0.025 240);
  --sidebar-ring: oklch(0.82 0.12 95);

  /* ── Corelia DS v2 surfaces ── */
  --surface-base: oklch(0.18 0.03 240);
  --surface-raised: oklch(0.22 0.035 240);
  --surface-overlay: oklch(0.26 0.035 240);
  --surface-float: oklch(0.30 0.035 240);
}
```

### 1b. Token Map

| Use case             | Token class                                 |
| -------------------- | ------------------------------------------- |
| Page bg              | `bg-surface-base`                           |
| Card default         | `bg-surface-base`                           |
| Card hover / raised  | `bg-surface-raised`                         |
| Dropdown, popover    | `bg-surface-overlay`                        |
| Modal, dialog        | `bg-surface-float`                          |
| Text chính           | `text-foreground`                           |
| Text phụ             | `text-foreground-muted`                     |
| Hint / placeholder   | `text-foreground-subtle`                    |
| Primary CTA          | `bg-primary text-primary-foreground`        |
| Primary ghost / soft | `bg-primary-muted text-primary`             |
| Accent               | `bg-accent text-accent-foreground`          |
| Accent soft          | `bg-accent-muted text-accent`               |
| Border default       | `border-border`                             |
| Divider nhẹ          | `border-border-subtle`                      |
| Border emphasis      | `border-border-strong`                      |
| Error                | `text-destructive` / `bg-destructive-muted` |
| Success              | `text-success` / `bg-success-muted`         |
| Warning              | `text-warning` / `bg-warning-muted`         |

### 1c. Elevation Scale (luminance tăng dần)

```
bg-surface-base (10%)
  → bg-surface-base (13%)        ← card mặc định
    → bg-surface-raised (16%)    ← card hover, sticky header
      → bg-surface-overlay (20%) ← dropdown, popover
        → bg-surface-float (24%) ← modal, dialog
```

Rule: element nằm trên layer nào dùng layer sáng hơn ngay trên đó. KHÔNG dùng shadow tạo depth trong dark mode.

---

## 2. Typography (7 cấp)

| Cấp     | Class                                                                   | Dùng cho             |
| ------- | ----------------------------------------------------------------------- | -------------------- |
| Display | `text-3xl font-semibold tracking-tight leading-tight`                   | Hero, số lớn         |
| H1      | `text-2xl font-semibold tracking-tight`                                 | Tiêu đề trang        |
| H2      | `text-lg font-semibold tracking-tight`                                  | Section / card title |
| Label   | `text-sm font-medium`                                                   | Field label          |
| Body    | `text-sm leading-relaxed`                                               | Nội dung             |
| Caption | `text-xs text-foreground-muted`                                         | Metadata, hint       |
| Eyebrow | `text-xs font-semibold uppercase tracking-widest text-foreground-muted` | Nhãn nhỏ trên H1/H2  |

- H1 và H2 PHẢI có `tracking-tight`.
- `tracking-widest` chỉ cho Eyebrow.
- Tối đa 2 font-weight / màn hình: `font-normal` + `font-semibold`.
- ALL CAPS chỉ cho Eyebrow và table header.
- Gradient text chỉ cho Display — xem mục 18a.

### Font Stack

```css
body {
  font-family: 'Inter', 'SF Pro Text', system-ui, sans-serif;
  font-feature-settings: 'cv11', 'ss01';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

> Thiếu `antialiased` → chữ trông thô và nặng trên nền tối.

---

## 3. Spacing (bội số 4px)

| Vị trí            | Class               |
| ----------------- | ------------------- |
| Icon trong button | `gap-2`             |
| Padding button    | `px-3 py-1.5`       |
| Padding card      | `p-4` / `p-6` (lớn) |
| List item gap     | `gap-3`             |
| Section gap       | `gap-6` / `gap-8`   |
| Label ↔ input     | `space-y-1.5`       |
| Form field gap    | `space-y-4`         |

---

## 4. Border Radius

| Class               | Dùng cho                    |
| ------------------- | --------------------------- |
| `rounded-sm` (2px)  | Badge, chip nhỏ             |
| `rounded` (4px)     | Input, tag nhỏ              |
| `rounded-md` (6px)  | Button                      |
| `rounded-lg` (10px) | Card, panel                 |
| `rounded-xl` (14px) | Modal, large card           |
| `rounded-full`      | Avatar, filter pill, toggle |

`rounded-2xl` trở lên không dùng — trông playful, không premium.

---

## 5. Elevation — Luminance thay Shadow

| Layer        | Surface              | Border                 | Dùng cho                |
| ------------ | -------------------- | ---------------------- | ----------------------- |
| Page         | `bg-surface-base`    | —                      | Nền trang               |
| Card default | `bg-surface-base`    | `border-border-subtle` | Card, panel             |
| Card raised  | `bg-surface-raised`  | `border-border`        | Hover, sticky header    |
| Popover      | `bg-surface-overlay` | `border-border`        | Dropdown, tooltip       |
| Modal        | `bg-surface-float`   | `border-border-strong` | Dialog, command palette |

- `shadow-none` — card trong dark mode.
- `shadow-sm` — card trong light mode.
- `shadow-lg` — CHỈ modal trong light mode.

---

## 6. Z-index Scale

| Class  | Layer                        |
| ------ | ---------------------------- |
| `z-0`  | Content                      |
| `z-10` | Sticky header / sidebar      |
| `z-20` | Dropdown / popover / tooltip |
| `z-30` | Modal backdrop               |
| `z-40` | Modal content                |
| `z-50` | Toast / notification         |

---

## 7. Responsive

| Range      | Layout            | Padding |
| ---------- | ----------------- | ------- |
| <640px     | 1 cột stack       | `px-4`  |
| 640–1024px | 2 cột             | `px-6`  |
| >1024px    | Sidebar + content | `px-8`  |

- Container: `max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8`
- Grid list: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Mobile touch target ≥ 44×44px.

---

## 8. Icons (lucide-react)

| Vị trí                  | Size      |
| ----------------------- | --------- |
| Inline text, breadcrumb | `w-3 h-3` |
| Trong button            | `w-4 h-4` |
| Sidebar, icon button    | `w-5 h-5` |
| Empty state hero        | `w-8 h-8` |

---

## 9. Animation — Premium Easing

| Class                                                               | Use                 |
| ------------------------------------------------------------------- | ------------------- |
| `transition-colors duration-150 ease-out`                           | Hover/focus default |
| `transition-all duration-200 ease-out hover:bg-surface-raised`      | Card hover          |
| `animate-in fade-in duration-200`                                   | Fade in             |
| `animate-in slide-in-from-bottom-2 duration-300 ease-out`           | Modal slide         |
| `animate-in slide-in-from-left-4 duration-300 ease-out`             | Sidebar drawer      |
| `transition-transform duration-200 ease-out hover:-translate-y-0.5` | Card lift           |

- `ease-out` mặc định — premium hơn `ease-in-out`.
- Duration tối đa 300ms.
- Reduced-motion handled ở mục 19.

---

## 10. Components

### Button

```
Primary:     bg-primary text-primary-foreground rounded-md px-3 py-1.5
             text-sm font-medium transition-colors duration-150
             hover:opacity-90 active:opacity-80

Secondary:   bg-surface-raised text-foreground border border-border
             rounded-md px-3 py-1.5 text-sm font-medium
             transition-colors duration-150 hover:bg-surface-overlay

Outline:     bg-transparent text-foreground border border-border
             rounded-md px-3 py-1.5 text-sm font-medium
             transition-colors duration-150 hover:bg-surface-raised

Ghost:       text-foreground-muted rounded-md px-3 py-1.5 text-sm font-medium
             transition-colors duration-150
             hover:text-foreground hover:bg-surface-raised

Destructive: bg-destructive text-primary-foreground rounded-md px-3 py-1.5
             text-sm font-medium transition-colors duration-150 hover:opacity-90
```

1 Primary / viewport. Icon-only PHẢI có `aria-label`.

### Badge

```
Beginner:     bg-success-muted text-success border border-success/20
              rounded-sm px-2 py-0.5 text-xs font-medium

Intermediate: bg-warning-muted text-warning border border-warning/20
              rounded-sm px-2 py-0.5 text-xs font-medium

Advanced:     bg-destructive-muted text-destructive border border-destructive/20
              rounded-sm px-2 py-0.5 text-xs font-medium
```

Không dùng cho filter — dùng Filter Pill.

### Filter Pill (interactive, multi-select)

```
Base:    rounded-full px-3 py-1 text-xs font-medium border transition-colors duration-150

Active:  bg-primary-muted text-primary border-primary/30

Default: bg-transparent text-foreground-muted border-border
         hover:border-border-strong hover:text-foreground
```

### Tabs (exclusive — khác Filter Pill)

```
Container: flex gap-6 border-b border-border-subtle

Active:    text-foreground border-b-2 border-primary pb-2 text-sm font-medium

Default:   text-foreground-muted border-b-2 border-transparent pb-2 text-sm
           hover:text-foreground transition-colors duration-150
```

### Tooltip

```
px-2 py-1 text-xs bg-surface-float text-foreground
border border-border rounded-md shadow-lg z-20
Delay: 200ms
```

Bắt buộc cho icon-only action không có visible label.

### Breadcrumb

```
Wrapper:  flex items-center gap-1 text-xs text-foreground-muted
Sep:      <ChevronRight className="w-3 h-3" />
Active:   text-foreground font-medium
Parent:   text-foreground-muted (không in đậm)
```

Đặt phía trên `<h1>`.

### Form Field

Cấu trúc: Label → Input → helper (`text-xs text-foreground-muted`) → error (`text-xs text-destructive`).
Wrapper: `space-y-1.5`. Required: `<span className="text-destructive">*</span>` sau label.
Placeholder = gợi ý format, KHÔNG thay thế label.

### Input States

| State    | Class                                               |
| -------- | --------------------------------------------------- |
| Default  | `bg-surface-base border-border text-foreground`     |
| Focus    | `border-primary ring-2 ring-primary/15`             |
| Error    | `border-destructive ring-2 ring-destructive/15`     |
| Disabled | `opacity-40 cursor-not-allowed bg-surface-base`     |
| Readonly | `bg-surface-base cursor-default border-border-subtle` |

### Empty State (bắt buộc)

```
Wrapper:  flex flex-col items-center gap-3 py-16 text-center
Icon:     w-5 h-5 text-foreground-subtle trong w-10 h-10 rounded-full bg-surface-raised
Title:    text-sm font-medium text-foreground
Sub:      text-xs text-foreground-muted
CTA:      <Button size="sm" variant="outline">
```

### Loading State

- Biết layout → `<Skeleton className="bg-surface-raised animate-pulse rounded-md" />`
- Inline → `<Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />`

### Toast / Feedback

| Tình huống          | Pattern                             |
| ------------------- | ----------------------------------- |
| Success action      | Toast bottom-right, auto-dismiss 3s |
| Error inline (form) | Error text dưới field               |
| Error page-level    | Alert banner phía trên content      |
| Destructive action  | Dialog xác nhận (KHÔNG toast)       |
| System info         | Banner top, dismissable             |

```
Toast: bg-surface-float border border-border text-foreground
       text-sm rounded-lg px-4 py-3 shadow-lg
```

### Dialog / Modal

```
Backdrop:  bg-black/50 backdrop-blur-sm fixed inset-0 z-30
Container: bg-surface-float border border-border-strong rounded-xl z-40
```

Width: `max-w-sm` confirm / `max-w-md` form / `max-w-2xl` complex / `max-w-screen-lg` fullscreen.
Header `p-6 pb-0` → Body `p-6 space-y-4` → Footer `p-6 pt-0 flex justify-end gap-2`.
Close: `<Button size="icon" variant="ghost" aria-label="Đóng">`.

### Table

```
Wrapper: rounded-lg border border-border overflow-hidden
Head:    bg-surface-raised
th:      px-4 py-3 text-left text-xs font-medium
         text-foreground-muted uppercase tracking-wider
Body:    divide-y divide-border-subtle bg-surface-base
Row:     hover:bg-surface-raised transition-colors duration-150
Empty:   <td colSpan={n} className="py-16 text-center text-sm text-foreground-muted">
```

### Clickable Card

```
cursor-pointer transition-all duration-200 ease-out
hover:bg-surface-raised hover:-translate-y-0.5
```

KHÔNG dùng `hover:shadow-md` trong dark mode.

### Avatar / Image

```
Avatar:    w-10 h-10 rounded-full bg-surface-raised overflow-hidden shrink-0
           object-cover + onError fallback
Thumbnail: aspect-video w-full rounded-lg bg-surface-raised overflow-hidden
Banner:    aspect-[3/1]
```

---

## 11. Course Card (Corelia-specific)

**Card wrapper:**
```
bg-surface-base border border-border-subtle rounded-lg overflow-hidden
hover:bg-surface-raised hover:border-border
transition-all duration-200 ease-out hover:-translate-y-0.5 cursor-pointer
```

**Cấu trúc:**
```
[Thumbnail — aspect-video]
[Progress h-1 bg-accent — chỉ khi enrolled, sát trên body]
[Body — p-4 space-y-2]
  1. Level Badge (rounded-sm)
  2. Title: text-sm font-semibold leading-snug line-clamp-2 tracking-tight
  3. Instructor: text-xs text-foreground-muted
  4. Footer: flex justify-between items-center
       Price:    text-sm font-semibold text-foreground
                 (text-accent nếu miễn phí)
       Duration: text-xs text-foreground-muted
```

---

## 12. Progress

### Progress Bar

```
Track: relative h-2 w-full rounded-full bg-surface-raised overflow-hidden
Fill:  h-full bg-primary transition-all duration-500 ease-out
       style={{ width: `${pct}%` }}

Card variant (enrolled): h-1 bg-accent
```

### Progress Ring

- SVG 2 circle: bg `stroke="var(--surface-raised)"`, fg `stroke="var(--primary)"`
- Sizes: `w-8 h-8` inline / `w-16 h-16` card / `w-24 h-24` hero
- Stroke width 8% diameter. Fill bằng `strokeDasharray` + `strokeDashoffset`.
- Center text: `text-sm font-semibold text-foreground`

---

## 13. Link

| Vị trí           | Class                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Body text        | `text-primary underline underline-offset-4 hover:opacity-80`                 |
| Navigation       | `text-foreground hover:text-primary transition-colors duration-150`          |
| Phụ / breadcrumb | `text-foreground-muted hover:text-foreground transition-colors duration-150` |

---

## 14. Ngôn ngữ UI (tiếng Việt nhất quán)

| Nên dùng           | Không dùng                |
| ------------------ | ------------------------- |
| Tổng quan khoá học | Overview / Description    |
| Đối tượng học viên | Target Audience           |
| Chương trình học   | Curriculum                |
| Tiếp tục học       | Continue Learning         |
| Đăng ký            | Sign up / Register (trộn) |

Ngoại lệ: tên riêng, brand, thuật ngữ kỹ thuật (blockchain, SDK, API...).

---

## 15. Scrollbar

```css
::-webkit-scrollbar         { width: 6px; height: 6px; }
::-webkit-scrollbar-track   { background: transparent; }
::-webkit-scrollbar-thumb   { background: var(--border); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }
```

Horizontal chip scroller: `scrollbar-hidden`.

---

## 16. Accessibility

- Contrast text thường ≥ 4.5:1, text lớn ≥ 3:1.
- `text-foreground` (93% oklch) trên dark background đạt ~12:1.
- `text-foreground-muted` trên `bg-surface-base` phải test ≥ 4.5:1.
- Focus ring: `ring-2 ring-primary/40 ring-offset-2 ring-offset-background`.
- Link phải có text mô tả — KHÔNG dùng "Xem thêm" / "Click here" đơn lẻ.
- Touch target mobile ≥ 44×44px.
- Tab order tự nhiên top-to-bottom, left-to-right.

---

## 17. Pre-ship Checklist

- [ ] Token màu, không hardcode
- [ ] Spacing bội số 4px
- [ ] Chỉ 1 Primary button / viewport
- [ ] Empty + loading state cho list/grid
- [ ] Input đủ 5 states
- [ ] Dark mode test (primary context)
- [ ] 375px không vỡ
- [ ] Icon-only button có `aria-label`
- [ ] Touch target ≥ 44px (mobile)
- [ ] UI tiếng Việt nhất quán
- [ ] Z-index trong scale 0–50
- [ ] Avatar / thumbnail có fallback ảnh
- [ ] Không mix icon library
- [ ] `antialiased` trên `<body>`
- [ ] Elevation dùng luminance — KHÔNG dùng shadow trong dark mode
- [ ] `backdrop-blur` chỉ cho modal, không cho card
- [ ] Gradient text chỉ cho Display level
- [ ] Border Glow chỉ cho 1–2 featured item / page

---

## 18. Premium Patterns (mới trong v2)

### 18a. Gradient Text — Display only

```tsx
{/* Neutral fade */}
<span className="bg-gradient-to-r from-foreground to-foreground-muted bg-clip-text text-transparent">
  2,400+
</span>

{/* Primary tinted */}
<span className="bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">
  Học lập trình
</span>
```

Tối đa 1 / section.

### 18b. Border Glow — Featured card only

```tsx
<div className="border border-primary/20 hover:border-primary/50 transition-colors duration-300
                [box-shadow:0_0_0_1px_oklch(68%_0.20_255_/_0.08)]
                hover:[box-shadow:0_0_0_1px_oklch(68%_0.20_255_/_0.20)]">
```

Tối đa 1–2 featured item / page.

### 18c. Glass Surface — Modal & floating panel only

```tsx
{/* Backdrop */}
<div className="bg-black/50 backdrop-blur-sm fixed inset-0 z-30" />

{/* Floating panel */}
<div className="bg-surface-float/90 backdrop-blur-md border border-border rounded-xl">
```

`backdrop-blur` có chi phí render — không dùng cho card grid.

### 18d. Gradient Divider

```tsx
<div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
```

### 18e. Shimmer Skeleton

```css
@keyframes shimmer {
  from { opacity: 0.5; }
  to   { opacity: 1; }
}
.animate-shimmer {
  animation: shimmer 1.5s ease-in-out infinite alternate;
}
```

```tsx
<div className="bg-surface-raised rounded-md animate-shimmer" />
```

---

## 19. Global CSS (`globals.css`)

```css
html { scroll-behavior: smooth; }

::selection {
  background: oklch(68% 0.20 255 / 25%);
  color: inherit;
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

::-webkit-scrollbar         { width: 6px; height: 6px; }
::-webkit-scrollbar-track   { background: transparent; }
::-webkit-scrollbar-thumb   { background: var(--border); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }

@keyframes shimmer {
  from { opacity: 0.5; }
  to   { opacity: 1; }
}
.animate-shimmer {
  animation: shimmer 1.5s ease-in-out infinite alternate;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

*Material Design 3 · Lucide Icons · OKLCH · WebAIM Contrast Checker · Dark-first v2*