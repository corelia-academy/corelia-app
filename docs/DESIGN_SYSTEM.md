# Corelia Design System

> Rules-only cheatsheet. AI và dev tra trước khi viết UI. Mọi class string trong file này copy được trực tiếp.

---

## 0. AI Rules — Đọc trước

- KHÔNG hardcode màu: `#xxx`, `bg-[#xxx]`, `rgb()`. Luôn dùng token mục 1.
- KHÔNG hardcode spacing lẻ: `p-[15px]`, `mt-[22px]`. Chỉ scale Tailwind mặc định.
- KHÔNG hardcode font-size: `text-[15px]`. Chỉ 6 cấp ở mục 2.
- KHÔNG hardcode z-index: `z-[999]`. Chỉ scale 0–50 ở mục 6.
- KHÔNG mix icon library. Chỉ `lucide-react`.
- KHÔNG có 2 Primary button trong cùng viewport.
- KHÔNG trộn Anh-Việt trong cùng 1 page (trừ tên riêng / thuật ngữ kỹ thuật).
- KHÔNG animate `width / height / padding`. Chỉ animate `transform / opacity / color`.
- KHÔNG xoá focus ring của interactive elements.
- KHÔNG dùng `<Badge>` cho filter — Badge không có interactive state.
- Mọi list / grid PHẢI có empty state + loading state.
- Mọi icon-only button PHẢI có `aria-label`.
- Mọi input PHẢI hỗ trợ 5 states: default, focus, error, disabled, readonly.
- Mọi touch target trên mobile ≥ 44×44px.
- Test 375px trước khi ship.

---

## 1. Color Tokens (Corelia DS v2)

| Use case | Token |
| --- | --- |
| Page bg | `bg-surface-base` |
| Raised surface | `bg-surface-raised` |
| Overlay surface | `bg-surface-overlay` |
| Float surface (modal/sheet/dropdown) | `bg-surface-float` |
| Text chính | `text-foreground` |
| Text phụ / hint | `text-foreground-muted` |
| Text subtle | `text-foreground-subtle` |
| Primary CTA | `bg-primary text-primary-foreground` |
| Primary muted / tonal | `bg-primary-muted text-primary` |
| Border default | `border-border` |
| Border nhẹ | `border-border-subtle` |
| Border mạnh | `border-border-strong` |
| Error | `text-destructive` / `bg-destructive` / `bg-destructive-muted` |
| Success | `text-success` / `bg-success` / `bg-success-muted` |
| Warning | `text-warning` / `bg-warning` / `bg-warning-muted` |

**Depth scale (DS v2):**
`bg-surface-base` → `bg-surface-raised` → `bg-surface-overlay` → `bg-surface-float`

---

## 2. Typography (6 cấp duy nhất)

| Cấp     | Class                                                                   | Dùng cho             |
| ------- | ----------------------------------------------------------------------- | -------------------- |
| H1      | `text-2xl font-semibold tracking-tight`                                 | Tiêu đề trang        |
| H2      | `text-lg font-semibold`                                                 | Section / card title |
| Label   | `text-sm font-medium`                                                   | Field label          |
| Body    | `text-sm leading-relaxed`                                               | Nội dung             |
| Caption | `text-xs text-foreground-muted`                                         | Metadata, hint       |
| Eyebrow | `text-xs font-semibold uppercase tracking-widest text-foreground-muted` | Nhãn nhỏ trên H1/H2  |

- Tối đa 2 font-weight / màn hình.
- ALL CAPS chỉ dùng cho Eyebrow.
- Không tạo size mới.

---

## 3. Spacing (bội số 4px)

| Vị trí            | Class                         |
| ----------------- | ----------------------------- |
| Icon trong button | `gap-2`                       |
| Padding button    | `px-3 py-1.5`                 |
| Padding card      | `p-4` (default) / `p-6` (lớn) |
| List item gap     | `gap-3`                       |
| Section gap       | `gap-6` / `gap-8`             |
| Label ↔ input     | `space-y-1.5`                 |
| Form field gap    | `space-y-4`                   |

---

## 4. Border Radius

| Class               | Dùng cho                          |
| ------------------- | --------------------------------- |
| `rounded` (4px)     | Input, badge nhỏ                  |
| `rounded-md` (8px)  | Button, card default              |
| `rounded-lg` (12px) | Modal, large card                 |
| `rounded-full`      | Avatar, chip, filter pill, toggle |

---

## 5. Shadow (DS v2)

DS v2 ưu tiên **surface elevation** thay vì shadow. Dùng `bg-surface-*` + border.

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

- Container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
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

## 9. Animation

| Class                                                                | Use                 |
| -------------------------------------------------------------------- | ------------------- |
| `transition-colors duration-150`                                     | Hover/focus default |
| `transition-all duration-200 hover:shadow-md hover:-translate-y-0.5` | Card hover          |
| `animate-in fade-in duration-200`                                    | Fade in             |
| `animate-in slide-in-from-bottom-4 duration-300`                     | Modal slide up      |
| `animate-in slide-in-from-left-4 duration-300`                       | Sidebar drawer      |

Reduced-motion handled ở global CSS — không animate ở component nếu user opt-out.

---

## 10. Components

### Button
- Variants: default (Primary) / `secondary` / `outline` / `ghost` / `destructive`.
- Sizes: `sm` / `default` / `lg` / `icon`.
- 1 Primary / viewport. Icon-only PHẢI có `aria-label`.
- Không đặt 2 Outline cạnh nhau mà thiếu Primary — mất hierarchy.

### Badge
- Variants: default / `secondary` / `outline`.
- Course level:
  - Beginner: `bg-success/10 text-success border-success/20 border`
  - Intermediate: `bg-warning/10 text-warning border-warning/20 border`
  - Advanced: `bg-destructive/10 text-destructive border-destructive/20 border`
- Không dùng cho filter — dùng Filter Pill.

### Filter Pill (interactive, multi-select)
- Luôn `rounded-full px-3 py-1 text-sm font-medium transition-colors duration-150`.
- Active: `bg-primary/10 text-primary border border-primary/20`
- Default: `bg-transparent text-foreground-muted border border-border hover:border-primary/40 hover:text-foreground`

### Tabs (chuyển view, exclusive — KHÁC Filter Pill)
- Pattern underline, không phải pill.
- Container: `flex gap-6 border-b border-border`.
- Active: `text-foreground border-b-2 border-primary pb-2 font-medium`
- Default: `text-foreground-muted border-b-2 border-transparent pb-2 hover:text-foreground`

### Tooltip
- Style: `px-2 py-1 text-xs bg-foreground text-background rounded shadow-md`.
- Z-index: `z-20`. Delay 200ms.
- Bắt buộc cho icon-only action không có visible label.

### Breadcrumb
- Wrapper: `flex items-center gap-1 text-xs text-foreground-muted`.
- Separator: `<ChevronRight className="w-3 h-3" />`.
- Level hiện tại: `text-foreground font-medium`. Cấp cha không in đậm.
- Đặt phía trên `<h1>`.

### Form Field
- Cấu trúc: Label → Input → helper (`text-xs text-foreground-muted`) → error (`text-xs text-destructive`).
- Wrapper: `space-y-1.5`. Required: `<span className="text-destructive">*</span>` sau label.
- Placeholder = gợi ý format, KHÔNG thay thế label.

### Input States

| State    | Class                                           |
| -------- | ----------------------------------------------- |
| Default  | `border-border`                                 |
| Focus    | `border-primary ring-2 ring-primary/20`         |
| Error    | `border-destructive ring-2 ring-destructive/20` |
| Disabled | `opacity-40 cursor-not-allowed bg-surface-raised`        |
| Readonly | `bg-surface-raised cursor-default`                       |

### Empty State (bắt buộc)
- Wrapper: `flex flex-col items-center gap-3 py-16 text-center`.
- Icon: `w-6 h-6 text-foreground-subtle` trong vòng tròn `w-12 h-12 rounded-full bg-surface-raised`.
- Title `text-sm font-medium` + subtitle `text-xs text-foreground-muted`.
- 1 CTA `size="sm"`.

### Loading State
- Biết layout → `<Skeleton>` (ưu tiên).
- Không biết layout / action inline → `<Loader2 className="w-4 h-4 animate-spin" />`.

### Toast / Feedback

| Tình huống          | Pattern                             |
| ------------------- | ----------------------------------- |
| Success action      | Toast bottom-right, auto-dismiss 3s |
| Error inline (form) | Error text dưới field               |
| Error page-level    | Alert banner phía trên content      |
| Destructive action  | Dialog xác nhận (KHÔNG toast)       |
| System info         | Banner top, dismissable             |

### Dialog / Modal
- Width: `max-w-sm` confirm / `max-w-md` form / `max-w-2xl` complex / `max-w-screen-lg` fullscreen.
- Cấu trúc: Header `p-6 pb-0` → Body `p-6 space-y-4` → Footer `p-6 pt-0 flex justify-end gap-2`.
- Close: `<Button size="icon" variant="ghost" aria-label="Đóng dialog">`.

### Table
- Wrapper: `rounded-md border border-border overflow-hidden`.
- Head: `bg-surface-raised`. `th` = `px-4 py-3 text-left text-sm font-medium text-foreground-muted`.
- Body: `divide-y divide-border`. Row hover: `hover:bg-surface-raised transition-colors duration-150`.
- Empty row: `<td colSpan={n} className="py-16 text-center text-sm text-foreground-muted">`.

### Clickable Card
- `cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`.

### Avatar / Image
- Avatar: `w-10 h-10 rounded-full bg-surface-raised overflow-hidden shrink-0`, `<img>` dùng `object-cover`, có `onError` fallback.
- Course thumbnail: `aspect-video w-full rounded-md bg-surface-raised overflow-hidden` (16:9).
- Card banner: `aspect-[3/1]`.

---

## 11. Course Card (Corelia-specific)

- Cấu trúc: Thumbnail (`aspect-video`) → Body (`p-4 space-y-2`).
- Body order: Level Badge → Title (`text-sm font-semibold line-clamp-2`) → Instructor (`text-xs text-foreground-muted`) → Footer (`flex justify-between text-xs` cho price + duration).
- Hover: dùng Clickable Card pattern.
- Nếu enrolled: Progress Bar `h-1` ngay dưới thumbnail (sát mép trên body).

---

## 12. Progress

### Progress Bar
- Track: `relative h-2 w-full rounded-full bg-surface-raised overflow-hidden`.
- Fill: `h-full bg-primary transition-all duration-300` + `style={{ width: '${pct}%' }}`.
- Variant mỏng (trên course card): track `h-1`.

### Progress Ring
- SVG 2 circle: background `stroke-muted`, foreground `stroke-primary`.
- Sizes: `w-8 h-8` inline / `w-16 h-16` card / `w-24 h-24` hero.
- Fill bằng `strokeDasharray` + `strokeDashoffset`. Stroke width 8% của diameter.
- Center text: `text-sm font-semibold` (size theo ring).

---

## 13. Link

| Vị trí           | Class                                                           |
| ---------------- | --------------------------------------------------------------- |
| Body text        | `text-primary underline underline-offset-4 hover:opacity-80`    |
| Navigation       | `text-foreground hover:text-primary transition-colors`          |
| Phụ / breadcrumb | `text-foreground-muted hover:text-foreground transition-colors` |

Không bao giờ dùng `#0000ff`. Luôn `text-primary`.

---

## 14. Ngôn ngữ UI (tiếng Việt nhất quán)

| Nên dùng           | Không dùng                |
| ------------------ | ------------------------- |
| Tổng quan khoá học | Overview / Description    |
| Đối tượng học viên | Target Audience           |
| Chương trình học   | Curriculum                |
| Tiếp tục học       | Continue Learning         |
| Đăng ký            | Sign up / Register (trộn) |

Ngoại lệ: tên riêng, brand, thuật ngữ kỹ thuật không có bản dịch chuẩn (blockchain, SDK, XLM...).

---

## 15. Scrollbar

- Sidebar, modal body: `scrollbar-thin`.
- Horizontal chip scroller: `scrollbar-hidden`.

---

## 16. Accessibility

- Contrast text thường ≥ 4.5:1, text lớn ≥ 3:1.
- Link phải có text mô tả — KHÔNG dùng "Xem thêm" / "Click here" đơn lẻ.
- Focus ring không xoá.
- Touch target mobile ≥ 44×44px.
- Tab order tự nhiên top-to-bottom, left-to-right.

---

## 17. Pre-ship Checklist

- [ ] Token màu, không hardcode
- [ ] Spacing bội số 4px
- [ ] Chỉ 1 Primary button / viewport
- [ ] Empty + loading state cho list/grid
- [ ] Input đủ 5 states
- [ ] Dark mode test
- [ ] 375px không vỡ
- [ ] Icon-only button có `aria-label`
- [ ] Touch target ≥ 44px (mobile)
- [ ] UI tiếng Việt nhất quán
- [ ] Z-index trong scale 0–50
- [ ] Avatar / thumbnail có fallback ảnh
- [ ] Không mix icon library

---

*Material Design 3 · Lucide Icons · OKLCH · WebAIM Contrast Checker*