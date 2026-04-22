# Corelia App — Style Guide & Design System

> **Dành cho AI:** Đây là tài liệu chuẩn tham chiếu khi viết hoặc chỉnh sửa bất kỳ trang/component nào. Tuân thủ chặt chẽ mọi quy tắc dưới đây.

---

## 1. Tổng quan kiến trúc style

| Yếu tố | Giá trị |
|---|---|
| Framework CSS | **Tailwind CSS v4** (cấu hình qua `@theme inline` trong `globals.css`, không có `tailwind.config.ts`) |
| Component library | **shadcn/ui** – style `"base-lyra"`, baseColor `"neutral"` |
| UI primitives | **@base-ui/react** (không dùng Radix) |
| Variant system | **class-variance-authority (CVA)** |
| Font chính | **Google Sans Variable** → `font-sans` |
| Font mono | **JetBrains Mono Variable** → `font-mono` |
| Icon library | **@phosphor-icons/react** (chính) + `lucide-react` (phụ) |
| Dark mode | Class-based: `<html class="dark">` — dùng `next-themes` |
| Color space | **oklch()** cho toàn bộ token màu |
| Theme provider | `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>` |

---

## 2. Color Tokens (CSS Variables)

> **Hệ thống màu: ⚡ Midnight Blue — Google M3 Expressive** — Electric Blue-700 làm brand primary, Deep Navy làm nền tối, Blue-50 làm nền sáng. Cảm giác Linear/Notion/Vercel. Tất cả dùng `oklch()` P3-gamut color space.

### 2.1 Bảng màu tham chiếu

| Token | Light | Dark | Mục đích |
|---|---|---|---|
| `--primary` | `#1D4ED8` blue-700 electric | `#60A5FA` blue-400 vivid | Button CTA, icon active, focus ring |
| `--primary-container` | `#DBEAFE` blue-100 tint | deep blue P-30 | Active lesson bg, tonal selection |
| `--on-primary-container` | `#1E3A8A` blue-900 | light blue P-90 | Text trên primary-container |
| `--success` | `#059669` emerald-600 | `#10B981` emerald-500 | Progress bar, tick hoàn thành |
| `--destructive` | `#EF4444` red-500 | red sáng | Lỗi, xóa |
| `--warning` | `#F59E0B` amber-500 | amber sáng | Cảnh báo |
| `--background` | `#EEF2FF` blue-50 cool | `#0D1B2E` deep navy | Nền toàn trang |
| `--card` | `#FFFFFF` white | `#162032` card navy | Nền card, sidebar, dropdown |
| `--foreground` | `#0D1524` navy-black | `#EEF2FF` off-white cool | Tiêu đề, nội dung chính |
| `--muted-foreground` | blue-gray-500 | blue-tinted slate-400 | Mô tả, meta, placeholder |
| `--border` | blue-tinted border | dark navy border | Viền phân cách |

### 2.2 Light Mode (`:root`) — oklch values

```css
--background: oklch(0.975 0.007 252)         /* #EEF2FF blue-50 cool  */
--foreground: oklch(0.175 0.04 259)          /* #0D1524 navy-black     */
--card: oklch(1 0 0)                          /* #FFFFFF pure white     */
--primary: oklch(0.55 0.25 252)              /* #1D4ED8 blue-700       */
--primary-foreground: oklch(0.985 0 0)
--primary-container: oklch(0.928 0.05 252)   /* #DBEAFE blue-100 P-90  */
--on-primary-container: oklch(0.3 0.18 252)  /* #1E3A8A blue-900 P-10  */
--muted: oklch(0.963 0.01 252)               /* blue-tinted neutral-100 */
--muted-foreground: oklch(0.545 0.042 254)   /* blue-gray-500           */
--destructive: oklch(0.577 0.245 27.325)     /* #EF4444 red-500         */
--success: oklch(0.596 0.145 163.225)        /* #059669 emerald-600     */
--warning: oklch(0.769 0.188 70.08)          /* #F59E0B amber-500       */
--border: oklch(0.918 0.016 252)             /* blue-tinted border      */
--border-subtle: oklch(0.946 0.01 252)       /* very subtle blue border */
--ring: oklch(0.55 0.25 252)                 /* electric blue ring      */
```

### 2.3 Dark Mode (`.dark`) — oklch values

```css
--background: oklch(0.145 0.04 263)          /* #0D1B2E deep navy              */
--foreground: oklch(0.962 0.006 252)         /* #EEF2FF off-white cool         */
--card: oklch(0.188 0.036 260)               /* #162032 card navy              */
--primary: oklch(0.635 0.245 252)            /* #60A5FA blue-400 vivid         */
--primary-foreground: oklch(0.12 0.03 260)  /* dark text on bright blue       */
--primary-container: oklch(0.265 0.075 255)  /* dark blue container P-30       */
--on-primary-container: oklch(0.87 0.09 252) /* light blue text P-90           */
--muted: oklch(0.258 0.04 260)              /* dark blue-gray                  */
--muted-foreground: oklch(0.672 0.04 254)   /* blue-tinted muted text          */
--success: oklch(0.696 0.17 162.48)         /* #10B981 emerald-500             */
--border: oklch(0.288 0.04 258)             /* dark navy border (SOLID)        */
--border-subtle: oklch(0.228 0.034 261)     /* barely-there border             */
--ring: oklch(0.635 0.245 252)              /* blue-400 focus ring             */
```

> **Quy tắc 4 cốt lõi (Midnight Blue E-learning):**
> 1. **Không dùng #000 hay #FFF thuần** — Light: blue-50 bg + white card. Dark: deep navy bg + card navy. Chưa bao giờ đen/trắng thuần.
> 2. **Dark mode: navy layering** — `#0D1B2E` bg → `#162032` card → `#1F2E42` elevated. Tạo depth bằng lightness increment, không phải shadow.
> 3. **Semantic màu nhất quán** — `success` = emerald, `warning` = amber, `destructive` = red. Không tự chọn màu khác.
> 4. **M3 Tonal Container** — Dùng `bg-primary-container text-on-primary-container` cho active state (lesson đang xem, selection). Không hardcode `bg-blue-100` hay `bg-primary/10`.

### 2.4 Quy tắc sử dụng màu

- **KHÔNG dùng** màu hardcode (`gray-700`, `slate-200`, `indigo-600` trực tiếp). **PHẢI dùng** token semantic
- Primary button CTA: `bg-primary text-primary-foreground` → tự ra Indigo
- Active lesson / selected item: `bg-primary-container text-on-primary-container` (M3 tonal)
- Progress bar fill: `bg-success` hoặc `bg-primary` (không còn dùng `bg-foreground/80`)
- Badge success: `bg-success/15 text-success` (cả 2 mode)
- Badge warning: `bg-warning/15 text-warning` (cả 2 mode)
- Trạng thái cảnh báo inline: vẫn dùng amber Tailwind class nếu cần fine-grained: `border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100`
- Trạng thái thành công inline: `bg-success/10 text-success` hoặc `bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300`
- Badge label trên thumbnail: `bg-foreground/80 text-background` (vẫn giữ)
- Nền muted section: `bg-muted/50` hoặc `bg-muted/40`
- Icon active/highlight: `text-primary`

---

## 3. Typography

### 3.1 Font

```css
--font-sans: 'Google Sans Variable', ui-sans-serif, system-ui, ...
--font-mono: 'JetBrains Mono Variable', monospace
```

### 3.2 Type Scale (chuẩn cho app này)

| Role | Classes Tailwind | Ghi chú |
|---|---|---|
| Page title (H1) | `text-2xl font-normal tracking-tight text-foreground sm:text-3xl` | Nhẹ, không bold |
| Page title bold | `text-2xl font-semibold tracking-tight text-foreground sm:text-3xl` | Dùng cho trang detail |
| Section heading | `text-lg font-medium text-foreground` | |
| Section label | `text-sm font-medium uppercase tracking-wide text-muted-foreground` | Với icon duotone size-5 |
| Card title (H2/H3) | `text-[15px] font-medium leading-snug text-foreground` | |
| Body / mô tả | `text-[15px] text-muted-foreground` | |
| Meta / label nhỏ | `text-[13px] text-muted-foreground` | |
| Caption / badge | `text-[12px] text-muted-foreground` | |
| Micro tag | `text-[11px] font-medium` | Badge trên thumbnail |
| Số thống kê lớn | `text-xl font-medium tabular-nums text-foreground` | |
| Nav link | `text-[13px] font-medium` | |

> **M3 Expressive:** Typography tạo hierarchy. H1 dùng `font-normal` (không heavy) để nhẹ nhàng; các action nổi bật dùng `font-semibold` có màu tương phản cao.

### 3.3 Line clamp

- 1 dòng: `line-clamp-1`
- 2 dòng: `line-clamp-2`

---

## 4. Spacing & Layout

### 4.1 Wrapper trang chuẩn

```tsx
// Mọi trang top-level đều bắt đầu bằng:
<div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
```

> `max-w-[1990px]` — ultra-wide support. `min-w-0` — tránh overflow trong flex/grid.

> **⛔ KHÔNG được bọc thêm wrapper ngoài** với `min-h-screen` hay `bg-background` — body đã có `bg-background`, và wrapper trên đã xử lý height. Thêm wrapper ngoài → double container = spacing thừa.

### 4.2 Trang có sidebar 2 cột

```tsx
<div className="grid gap-8 lg:grid-cols-[1fr_340px]">
  <main className="min-w-0">...</main>
  <aside className="lg:sticky lg:top-20 lg:self-start space-y-5">...</aside>
</div>
```

### 4.3 Trang Home (layout 2 cột có sidebar)

```tsx
// Chỉ 1 wrapper duy nhất, không cần wrapper ngoài
<div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
  <div className="grid w-full grid-cols-1 gap-8 sm:gap-10 lg:grid-cols-[1fr_minmax(300px,380px)] lg:items-start">
```

### 4.4 Grid card chuẩn

```tsx
// 2 cột tablet+:
<div className="grid gap-4 sm:grid-cols-2">

// 3 cột desktop:
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

### 4.5 Khoảng cách section

- Giữa các section: `mb-10 sm:mb-12`
- Giữa header section và nội dung: `mb-4`
- Trong card: `p-4` (compact) hoặc `p-5`/`p-6` (detail)

### 4.6 Quy tắc chống spacing dư thừa ⚠️

| Trường hợp | ❌ Sai | ✅ Đúng |
|---|---|---|
| Section đầu tiên trong page wrapper | `mt-6` (double với `py-6`) | Không có `mt-*`, để wrapper `py` tự xử lý |
| Hero section sau page wrapper | `mt-6 mb-10` | `mb-10` (bỏ `mt-*`) |
| Wrapper có sẵn `space-y-5` | `<div className="mt-0 ...">` bọc ngoài | Đặt element trực tiếp vào `space-y-*` |
| Outer div bọc page | `min-h-screen bg-background` | Bỏ outer div; `body` đã có `bg-background` |
| Conditional element trong aside | Bọc trong `div` khi conditional `false` | Render trực tiếp với `{condition && <Comp />}` |

---

## 5. Border Radius

```css
--radius: 0.5rem         /* base = 8px */
--radius-sm: calc(var(--radius) * 0.6)  /* ~5px */
--radius-md: calc(var(--radius) * 0.8)  /* ~6.4px */
--radius-lg: var(--radius)               /* 8px → rounded-lg */
--radius-xl: calc(var(--radius) * 1.4)  /* ~11px */
--radius-2xl: calc(var(--radius) * 1.8) /* ~14.4px */
--radius-3xl: calc(var(--radius) * 2.2) /* ~17.6px */
--radius-4xl: calc(var(--radius) * 2.6) /* ~20.8px */
```

### Quy tắc radius

| Element | Radius |
|---|---|
| Button (mặc định) | `rounded-none` (sharp) |
| Button tròn đặc biệt (CTA hero) | `rounded-full` (thêm manual) |
| Card / container | `rounded-lg` |
| Badge trên thumbnail | `rounded-md` |
| Tag / chip inline | `rounded-md` hoặc `rounded-full` |
| Input | `rounded-lg` |
| Skeleton | `rounded-none` |
| Tooltip, Dropdown | `rounded-none` |
| Section hero đặc biệt | `rounded-2xl` |
| Sub-card trong panel | `rounded-xl` |
| Progress bar track | `rounded-full` |
| Avatar | `rounded-full` |

> **M3 Expressive tactic #1:** Mix round + square tạo visual tension. Button sharp (`rounded-none`) tương phản với card rounded (`rounded-lg`).

---

## 6. Shadows & Elevation

Dùng token, không dùng hardcode Tailwind shadow. Hệ thống 4 mức theo M3:

```tsx
shadow-card         // base card — resting state
shadow-elevation-1  // subtle lift — hover light
shadow-elevation-2  // elevated — hover card, dropdown
shadow-elevation-3  // floating — modal, dialog, toast
```

### Hover elevation pattern (chuẩn):

```tsx
className="... shadow-card transition-[box-shadow,border-color] hover:border-border hover:shadow-elevation-2"
```

> **M3 Elevation Tiers:** `elevation-1` = barely perceptible (tonal), `elevation-2` = noticeable lift (4dp), `elevation-3` = clear float (8dp). Dark mode shadows cần chroma cao hơn (0.3 vs 0.08) để visible trên dark surface.

---

## 7. Button Component

### Variants

| Variant | Dùng khi |
|---|---|
| `default` | CTA chính, form submit |
| `outline` | Action phụ, cancel |
| `secondary` | Action trung tính |
| `ghost` | Link-like trong card, nav inline |
| `destructive` | Xóa, hành động nguy hiểm |
| `link` | Link text thuần |

### Sizes

| Size | Height | Dùng khi |
|---|---|---|
| `xs` | h-6 | Badge action nhỏ |
| `sm` | h-7 | Action trong card (`-ml-2 w-fit` khi ghost) |
| `default` | h-8 | Mặc định |
| `lg` | h-9 | CTA chính trên trang |
| `icon` | size-8 | Icon button |
| `icon-sm` | size-7 | Icon button nhỏ |
| `icon-lg` | size-9 | Avatar trigger header |

### Patterns phổ biến

```tsx
// Ghost action cuối card (inline-left):
<Button variant="ghost" size="sm" className="mt-3 w-fit -ml-2 text-foreground hover:bg-muted">
  Xem chi tiết <ArrowRight className="size-4" />
</Button>

// Ghost full-width trong sidebar card:
<Button variant="ghost" size="sm" className="mt-4 w-full justify-center text-foreground hover:bg-muted">
  Xem hồ sơ
</Button>

// CTA chính trang (hero dark):
<Button size="lg" className="h-10 rounded-full bg-emerald-400 px-5 font-semibold text-slate-950 shadow-[0_10px_30px_rgba(16,185,129,0.46)] hover:bg-emerald-300">
  Đăng ký
</Button>

// Submit form (full width):
<Button className="w-full" size="lg">Ghi danh</Button>
```

---

## 8. Card Component

### Card chuẩn

```tsx
<div className="rounded-lg border border-border-subtle bg-card text-card-foreground shadow-card">
  <div className="p-4">...</div>
</div>
```

### Card có hover (clickable):

```tsx
<article className="group overflow-hidden rounded-lg border border-border-subtle bg-card text-card-foreground shadow-card transition-[box-shadow,border-color] hover:border-border hover:shadow-elevation-2">
```

### Image hover scale:

```tsx
<img className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
```

### Card thumbnail badge:

```tsx
<span className="absolute left-2 top-2 rounded-md bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background">
  Online
</span>
```

### Card sidebar (sticky):

```tsx
<aside className="lg:sticky lg:top-20 lg:self-start space-y-5">
  <div className="rounded-lg border border-border-subtle bg-card p-5">
```

---

## 9. Header

```tsx
<header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-card/95 backdrop-blur-md supports-backdrop-filter:bg-card/90">
  <div className="mx-auto flex h-14 w-full max-w-[1990px] items-center justify-between px-4 sm:px-6">
```

- Nav links: `rounded-lg px-3 py-2 text-[13px] font-medium transition-colors`
- Active: `bg-muted/80 text-foreground`
- Inactive: `text-muted-foreground hover:bg-muted/50 hover:text-foreground`

---

## 10. Breadcrumb

Dùng ngay sau wrapper, trước nội dung chính:

```tsx
<Breadcrumb className="mb-3">
  <BreadcrumbList>
    <BreadcrumbItem><BreadcrumbLink><Link to="/">Home</Link></BreadcrumbLink></BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem><BreadcrumbPage>Trang hiện tại</BreadcrumbPage></BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

---

## 11. Section Header Pattern

```tsx
<div className="mb-4 flex items-center gap-2">
  <IconName className="size-5 shrink-0 text-muted-foreground" weight="duotone" />
  <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
    Tiêu đề section
  </h2>
</div>
```

---

## 12. Icon Usage (Phosphor)

- **Weight mặc định:** `weight="duotone"` cho icon trong section label, UI decorative
- **Weight fill:** cho icon action nổi bật (`PlayCircle fill`, `ArrowRight`)
- **Kích thước phổ biến:** `size-4` (inline text), `size-5` (section icon), `size-8`+ (empty state)
- **Icon trong button:** `[&_svg:not([class*='size-'])]:size-4` tự động (không cần thêm class)
- Icon luôn có `shrink-0` khi trong flex container

---

## 13. Progress Bar

```tsx
<div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
  <div
    className="h-full rounded-full bg-success transition-all"
    style={{ width: `${progress}%` }}
  />
</div>
```

Dùng `h-1` (compact) hoặc `h-2` (nổi bật hơn trong sidebar).
- Fill màu: `bg-success` (emerald — ý nghĩa hoàn thành/tiến độ)
- Fill màu primary: `bg-primary` nếu muốn nhấn mạnh brand (indigo)

---

## 14. Form Fields

```tsx
<div className="flex flex-col gap-2">
  <label className="text-sm font-medium text-foreground">Label</label>
  <Input className="h-9 rounded-lg" />
  <p className="text-[13px] text-muted-foreground">Mô tả / lỗi</p>
</div>
```

---

## 15. Loading State

```tsx
<div className="flex min-h-[40vh] items-center justify-center">
  <Spinner className="size-8 animate-spin text-muted-foreground" />
</div>
```

---

## 16. Empty State

```tsx
<div className="rounded-lg border border-border-subtle bg-card p-8 text-center">
  <IconName className="mx-auto size-12 text-muted-foreground" />
  <p className="mt-4 text-muted-foreground">Không có dữ liệu.</p>
</div>
```

---

## 17. Alert / Banner

### Cảnh báo (warning):

```tsx
<div className="rounded-lg border border-amber-200/80 bg-amber-50/90 p-4 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
  <p className="font-medium">Tiêu đề cảnh báo</p>
  <p className="mt-1.5 text-[12px] text-amber-800/90 dark:text-amber-200/90">Mô tả</p>
</div>
```

### Banner draft preview (instructor/admin):

```tsx
<div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/40">
```

---

## 18. Hero Section (Dark)

Dùng cho landing section nổi bật (ví dụ: khoá học offline):

```tsx
<section className="mt-6 mb-10 overflow-hidden rounded-2xl border border-border-subtle bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 px-5 py-6 text-slate-50 shadow-[0_18px_45px_rgba(15,23,42,0.55)] sm:px-7 sm:py-8 lg:px-10 lg:py-10">
```

Quy tắc bên trong hero dark:
- Text màu: `text-slate-50`, `text-slate-200/85`, `text-slate-300/90`
- Chip/badge: `rounded-full border border-white/10 bg-white/5`
- Accent color: emerald (`text-emerald-300`, `bg-emerald-400/15`)
- CTA primary: `rounded-full bg-emerald-400 text-slate-950 font-semibold`
- CTA secondary: `rounded-full border-white/20 bg-white/5 text-slate-50`

---

## 19. Auth Page Background

```tsx
<div className="bg-auth-page">
```

Định nghĩa trong `globals.css` — gradient mềm + pattern chấm tinh tế.

---

## 20. Sidebar (Instructor/Admin)

Dùng component `<Sidebar>` từ `@/components/ui/sidebar` với tokens:
- `--sidebar-width: 16rem`
- `--sidebar-width-icon: 3rem` (collapsed)
- Màu: `bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`

---

## 21. Google Material 3 Expressive — Áp dụng vào app này

M3 Expressive là bộ nguyên tắc của Google giúp thiết kế **cảm xúc hơn, dễ dùng hơn, và hấp dẫn hơn**. Dưới đây là cách áp dụng cho Corelia:

### Tactic 1: Dùng đa dạng shapes

- Buttons: `rounded-none` (sharp) — tạo contrast với cards `rounded-lg`
- CTA hero quan trọng: `rounded-full` — nổi bật, gợi cảm giác "premium"
- Badge label: `rounded-md` — trung gian
- Progress/avatar: `rounded-full`
- **Quy tắc:** Đừng dùng cùng 1 radius cho mọi thứ. Tạo tension có chủ ý.

### Tactic 2: Màu giàu có, có hierarchy (M3 Color Roles)

- Surface chính: `bg-background` → `bg-card` → `bg-muted/50` (tạo depth 3 tầng)
- **M3 Tonal Container**: `bg-primary-container text-on-primary-container` — dùng cho active lesson, selection state, tonal chip. Không dùng `bg-primary/10` hardcode.
- Action CTA: `bg-primary text-primary-foreground` → nổi bật trên mọi nền
- Hero section: dark gradient + emerald accent → tương phản cực cao
- Tránh dùng quá nhiều màu sắc — chỉ dùng accent màu khi thực sự cần nhấn mạnh

**M3 E-learning color hierarchy (Midnight Blue):**

| Vai trò | Token | Kết quả visual |
|---|---|---|
| Brand CTA | `bg-primary text-primary-foreground` | Blue-700 button (light) / Blue-400 (dark) |
| Active/selected | `bg-primary-container text-on-primary-container` | Blue-100 tint (light) / Deep blue (dark) |
| Achievement | `bg-success/15 text-success` | Emerald tint |
| Caution | `bg-warning/15 text-warning` | Amber tint |
| Neutral surface | `bg-muted/50` | Blue-tinted neutral |

> **Hero section dark**: Giữ `from-slate-950 via-slate-900 to-slate-950` + emerald accent — contrast tốt với nền navy.

### Tactic 3: Typography hướng sự chú ý

- H1 trang: `font-normal` — nhẹ nhàng, không aggressive
- Số thống kê: `font-medium tabular-nums text-xl` — rõ ràng
- Section labels: `uppercase tracking-wide text-sm font-medium text-muted-foreground` — phân cấp rõ
- CTA text quan trọng: `font-semibold` với màu tương phản

### Tactic 4: Containment — nhóm nội dung

- Mỗi section có card riêng với `border border-border-subtle bg-card rounded-lg`
- Thống kê nhỏ trong sidebar: `bg-muted/50 rounded-lg p-3` (nested container)
- Section muted background: `bg-muted/40 px-4 py-2.5` (group header)

### Tactic 5: Motion tự nhiên

- Card hover: `transition-[box-shadow,border-color]` (smooth, không jarring)
- Image hover: `transition-transform duration-200 group-hover:scale-[1.02]` (subtle)
- Button transitions: `transition-all` (đã có sẵn trong CVA)
- Progress bar: `transition-all` (animated fill)

### Tactic 6: Tập trung vào key actions (Hero Moments)

- Mỗi trang chỉ có **1-2 hero moment** — nơi sự chú ý phải đến ngay
- Hero moment = button lớn hơn + màu tương phản + spacing thoáng
- Ví dụ: CTA "Ghi danh" trên CourseDetail = `w-full size-lg bg-primary`

### Accessibility

- Luôn đảm bảo contrast WCAG AA: `text-foreground` trên `bg-card` ✓
- Focus visible: `focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50` (built-in button)
- Tap targets tối thiểu 44px (button `lg` = h-9 ≈ 36px; hero button = h-10 = 40px)
- Icon-only buttons luôn có `aria-label`

---

## 22. Patterns KHÔNG được dùng

| ❌ Sai | ✅ Đúng |
|---|---|
| `text-gray-600` | `text-muted-foreground` |
| `bg-white` | `bg-card` hoặc `bg-background` |
| `border-gray-200` | `border-border-subtle` |
| `shadow-md` | `shadow-card` hoặc `shadow-elevation-2` |
| `text-black` | `text-foreground` |
| `bg-gray-100` | `bg-muted` hoặc `bg-muted/50` |
| Inline style cho màu | CSS variable / Tailwind token |
| Tailwind config v3 (`theme.extend`) | `@theme inline` trong `globals.css` |
| `import "tailwindcss/base"` | `@import "tailwindcss"` (v4) |

---

## 23. Checklist khi viết component/trang mới

**Layout & Spacing:**
- [ ] Wrapper trang có `mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10`
- [ ] **Không** bọc thêm outer div với `min-h-screen bg-background` (body đã xử lý)
- [ ] Section đầu tiên trong page wrapper **không có** `mt-*` (đã có `py-*` từ wrapper)
- [ ] Hero section chuẩn: `mb-10` (không có `mt-6`)
- [ ] Conditional elements trong `space-y-*`: render trực tiếp, không bọc `div` vô nghĩa
- [ ] Có breadcrumb (nếu không phải trang gốc)
- [ ] Responsive: `sm:`, `lg:` breakpoints cho px, py, grid-cols

**Typography & Màu:**
- [ ] H1 dùng đúng size: `text-2xl font-normal tracking-tight sm:text-3xl` (hoặc semibold nếu detail)
- [ ] Màu text: `text-foreground` / `text-muted-foreground` (không hardcode)
- [ ] Active/selected state: `bg-primary-container text-on-primary-container` (không dùng `bg-primary/10`)

**Components:**
- [ ] Cards dùng `border-border-subtle bg-card shadow-card rounded-lg`
- [ ] Hover card có `transition-[box-shadow,border-color] hover:border-border hover:shadow-elevation-2`
- [ ] Buttons dùng đúng variant + size
- [ ] Icon dùng `@phosphor-icons/react`, `weight="duotone"` mặc định, `shrink-0`
- [ ] Loading state: Spinner `animate-spin text-muted-foreground`
- [ ] Empty state: icon lớn + text muted trong card

**Quality:**
- [ ] Dark mode test: tất cả token tự đảo, không cần class đặc biệt (trừ hardcode màu)
- [ ] Elevation dùng đúng mức: `shadow-card` → `shadow-elevation-2` (hover) → `shadow-elevation-3` (float)

---

## 24. File references

| File | Vai trò |
|---|---|
| `src/styles/globals.css` | Toàn bộ CSS variables + `@theme inline` |
| `src/components/ui/button.tsx` | CVA button variants/sizes |
| `src/components/ui/card.tsx` | Card primitives |
| `src/components/base/Header.tsx` | Header pattern chuẩn |
| `src/components/layouts/MainLayout.tsx` | Shell layout |
| `src/pages/Home.tsx` | Reference: 2-col layout, card patterns |
| `src/pages/Courses.tsx` | Reference: hero dark section, grid cards |
| `src/pages/CourseDetail.tsx` | Reference: detail layout, sidebar CTA |
| `components.json` | shadcn config: style, icon library, aliases |
