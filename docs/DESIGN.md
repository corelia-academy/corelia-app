# Corelia Design System

> Tài liệu duy nhất về design tokens, component patterns và quy tắc UI. AI và dev tra trước khi viết UI.
>
> **v3 — Warm Sand Light + Premium Dark.** Light mode: Warm Sand + Slate Blue. Dark mode: Navy Slate + Gold. Card radius 16px. Brand accent blue.

---

## 0. AI Rules — Đọc trước

- **KHÔNG** hardcode màu: `#xxx`, `bg-[#xxx]`, `rgb()`. Luôn dùng token ở mục 1.
- **KHÔNG** hardcode spacing lẻ: `p-[15px]`, `mt-[22px]`. Chỉ scale Tailwind mặc định.
- **KHÔNG** hardcode z-index: `z-[999]`. Chỉ scale 0–50 ở mục 6.
- **KHÔNG** mix icon library. Chỉ `lucide-react`.
- **KHÔNG** có 2 Primary button trong cùng viewport.
- **KHÔNG** trộn Anh-Việt trong cùng 1 page (trừ tên riêng / thuật ngữ kỹ thuật).
- **KHÔNG** animate `width / height / padding`. Chỉ animate `transform / opacity / color`.
- **KHÔNG** xoá focus ring của interactive elements.
- **KHÔNG** dùng `shadow-lg` làm elevation — dùng `shadow-card` (mục 5).
- **KHÔNG** dùng `white` thuần cho text — dùng `text-foreground`.
- Mọi list / grid PHẢI có empty state + loading state.
- Mọi icon-only button PHẢI có `aria-label`.
- Mọi touch target trên mobile ≥ 44×44px.

---

## 1. Color Tokens

### 1a. Brand (mới — v3)

| Token | Light | Dark | ≈ Hex | Dùng cho |
|-------|-------|------|-------|---------|
| `--brand-navy` | `oklch(0.17 0.055 235)` | `oklch(0.12 0.04 240)` | `#0B2533` | Headings đậm, hero text |
| `--brand-accent` | `oklch(0.44 0.22 263)` | `oklch(0.62 0.2 263)` | `#2D5BE3` | Active state, CTA, link hover |

Tailwind: `text-brand-navy`, `bg-brand-accent`, `border-brand-accent`.

### 1b. Semantic Tokens

| Token | Light | Dark | Dùng cho |
|-------|-------|------|---------|
| `--primary` | `oklch(0.25 0.05 235)` | `oklch(0.82 0.12 95)` | Primary button, active badge |
| `--foreground` | `oklch(0.2 0.04 235)` | `oklch(0.95 0.01 75)` | Body text |
| `--foreground-muted` | `oklch(0.55 0.03 235)` | `oklch(0.65 0.02 240)` | Secondary text |
| `--foreground-subtle` | `oklch(0.7 0.02 235)` | `oklch(0.5 0.02 240)` | Placeholder, meta |
| `--success` | `oklch(0.6 0.12 150)` | `oklch(0.7 0.13 150)` | Completed, correct |
| `--destructive` | `oklch(0.58 0.16 35)` | `oklch(0.68 0.15 35)` | Error, delete |
| `--warning` | `oklch(0.65 0.16 65)` | `oklch(0.85 0.14 85)` | Alert, locked |

### 1c. Surface Tokens (5-layer elevation)

| Token | Light | Dark | Dùng cho |
|-------|-------|------|---------|
| `--surface-base` = `--card` | `oklch(1 0 0)` | `oklch(0.18 0.03 240)` | Card background |
| `--surface-raised` | `oklch(0.98 0.005 75)` | `oklch(0.22 0.035 240)` | Sidebar, hover state |
| `--surface-overlay` | `oklch(0.96 0.01 75)` | `oklch(0.26 0.035 240)` | Active list item |
| `--surface-float` | `= --card` | `oklch(0.3 0.035 240)` | Popover, dropdown |
| `--background` | `oklch(0.965 0.012 75)` | `oklch(0.18 0.03 240)` | App background (Warm Sand / Navy) |

### 1d. Border Tokens

| Token | Light | Dùng cho |
|-------|-------|---------|
| `--border-subtle` | `oklch(0.92 0.01 75)` | Default card border |
| `--border` | `oklch(0.88 0.015 75)` | Input border, separator |
| `--border-strong` | `oklch(0.75 0.02 75)` | Emphasis border |

---

## 2. Typography

Sử dụng **Google Sans Variable** (sans) + **JetBrains Mono Variable** (mono).

| Level | Classes | Dùng cho |
|-------|---------|---------|
| Display | `text-3xl font-semibold tracking-tight` | Hero headings |
| H1 | `text-2xl font-semibold` | Page title, lesson title |
| H2 | `text-[18px] font-semibold` | Section heading |
| Body | `text-[15px] leading-[1.7]` | Lesson content, long-form |
| UI | `text-sm` | Buttons, labels, inputs |
| Meta | `text-[13px] text-foreground-muted` | Duration, count, date |
| Label | `text-[11px] font-medium uppercase tracking-wide` | Section label, eyebrow |

**Line height**: body content `leading-[1.7]`; UI elements `leading-snug` hoặc `leading-5`.

---

## 3. Border Radius

| Token | Value | Class | Dùng cho |
|-------|-------|-------|---------|
| `--radius-sm` | `0.3rem` (4.8px) | `rounded-sm` | Badge, pill small |
| `--radius-md` | `0.4rem` (6.4px) | `rounded-md` | Input, button |
| `--radius-lg` | `0.5rem` (8px) | `rounded-lg` | Internal card section |
| `--radius-xl` | `0.7rem` (11.2px) | `rounded-xl` | Popover, toast |
| **`--radius-2xl`** | **`1rem` (16px)** | **`rounded-2xl`** | **Card — premium feel** |
| `--radius-3xl` | `1.1rem` | `rounded-3xl` | Modal |
| `--radius-4xl` | `1.3rem` | `rounded-4xl` | Floating elements |
| `rounded-full` | — | — | Avatar, pill |

**Rule**: Card component uses `rounded-2xl` (16px). Giữ nhất quán toàn app.

---

## 4. Shadows & Elevation

Ưu tiên **luminance elevation** (surface layers) cho most UI. Shadow chỉ dùng cho card premium và floating elements.

| Token | Value | Class | Dùng cho |
|-------|-------|-------|---------|
| `--elevation-1` | `0 1px 2px oklch(.../ 0.05)` | `shadow-sm` | Subtle lift |
| `--elevation-2` | `0 4px 6px -1px oklch(.../ 0.08)` | `shadow-md` | Raised elements |
| **`--elevation-card`** | **`0 8px 24px oklch(0.15 0.04 235 / 0.04)`** | **`shadow-card`** | **Lesson cards, content panels** |

Dark mode `--elevation-card`: `0 8px 24px oklch(0 0 0 / 0.2)`.

---

## 5. Component Patterns

### Card

```tsx
// Standard card — automatically applied via Card component
<Card> → rounded-2xl border border-border-subtle bg-surface-base shadow-card
```

**Custom card** (inline):
```tsx
<div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
```

### Lesson Content Wrappers

```tsx
// Video player
<div className="mx-4 overflow-hidden rounded-2xl shadow-card sm:mx-6">
  <div className="aspect-video">{/* iframe */}</div>
</div>

// Article body
<div className="mx-4 overflow-hidden rounded-2xl border border-border-subtle shadow-card sm:mx-6">
  <div className="px-6 py-8 text-[15px] leading-[1.7]">
    <Markdown />
  </div>
</div>
```

### Active Lesson State (Curriculum)

```tsx
// border-l-[3px] trên tất cả items (transparent khi inactive)
"border-l-[3px] pl-[calc(1rem-3px)]"
// Active:
"border-l-brand-accent bg-primary-muted text-primary"
// Inactive:
"border-l-transparent"
```

### Button Hierarchy

| Action | Variant | Note |
|--------|---------|------|
| Primary CTA (Next, Submit) | `default` | Một cái duy nhất |
| Secondary (Previous, Cancel) | `outline` | |
| Tertiary (Mark as read) | `ghost` | |
| Danger (Delete) | `destructive` | |

### Suggestion Pills (AI panel)

```tsx
"rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-[11px]"
"hover:border-border hover:bg-surface-overlay hover:text-foreground"
```

---

## 6. Spacing

- Content padding: `clamp(1rem, 3vw, 2rem)` via `--content-px`
- Tailwind: `px-4 sm:px-6` cho most containers
- Card inner: `p-4` (compact) hoặc `p-5`/`px-6 py-8` (content)
- Gap: `gap-3` (tight), `gap-4` (standard), `gap-6` (section)
- Section spacing: `space-y-6` hoặc `mt-6`

---

## 7. Z-Index Scale

| Layer | Value | Dùng cho |
|-------|-------|---------|
| Base | 0 | Static elements |
| Raised | 10 | Sticky elements |
| Overlay | 20 | Backdrop |
| Sidebar | 30–40 | Sidebar, floating panels |
| Modal | 50 | Dialog, sheet |

---

## 8. AI Panel (Cora) Patterns

### Empty State Structure

```
[Context block]     ← Course + Lesson + Format badge
[Suggestions]       ← "Try asking" label + SuggestionPills
```

### Format-aware suggestions

| Format | Suggestions |
|--------|-------------|
| `video` | Summarize this video · Ask about this video · Explain what I just watched |
| `article` | Summarize this reading · Explain this concept · Ask about this paragraph |
| `quiz` | Explain the correct answers · Give me a hint · Related concepts |
| `practice` | Review my approach · Give me a hint · Solution walkthrough |

### Context block

```tsx
<div className="rounded-xl border border-border-subtle bg-surface-raised p-3">
  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-1.5">
    Cora is using
  </p>
  <p className="text-xs font-medium text-foreground">{courseTitle}</p>
  <p className="text-xs text-foreground-muted">{lessonTitle}</p>
  <span className="text-[10px] text-foreground-subtle">{formatIcon} {formatLabel}</span>
</div>
```

---

## 9. Lesson Formats

| Format | `lesson_format` value | Learner UI | Instructor tooling |
|--------|----------------------|------------|-------------------|
| Video | `"video"` | YouTube embed in card | YouTube URL |
| Article | `"article"` | Markdown in card | Markdown editor |
| Quiz | `"quiz"` | `LessonQuiz` MCQ component | AI Generate Questions |
| Practice | `"practice"` | `LessonPractice` + Cora CTA | Markdown + AI gen |

### Quiz data model

- Questions: `course_section_questions` table với cột `lesson_id` (nullable)
- Attempts: `section_question_attempts` table với cột `lesson_id` (nullable)
- Functions: `getLessonQuestions`, `setLessonQuestions` trong `src/lib/sectionQuestions.ts`
- Attempt submit: `submitLessonQuizAttempts` trong `src/lib/quizAttempts.ts`
- AI generation: `supabase/functions/generate-questions/` — pass `lessonId` thay `sectionId`

---

## 10. Dark Mode Rules

- Primary button dark: `oklch(0.82 0.12 95)` (Gold) — KHÔNG dùng xanh trên nền dark
- `brand-accent` dark: `oklch(0.62 0.2 263)` — sáng hơn để đủ contrast
- Surfaces: 5 layers từ `0.18` đến `0.30` lightness
- Shadows: strong black overlay `oklch(0 0 0 / 0.2)` thay vì light shadow
- KHÔNG dùng `white` — dùng `oklch(0.95 0.01 75)` (warm off-white)
