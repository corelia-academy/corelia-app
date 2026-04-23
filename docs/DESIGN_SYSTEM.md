# Corelia Design System — Cheatsheet

> Mở file này khi code UI. Mọi quyết định design đều tra ở đây trước.

---

## Colors — dùng token, không hardcode

### Semantic tokens (copy-paste trực tiếp)

| Dùng cho                 | Token                                            |
| ------------------------ | ------------------------------------------------ |
| Nền trang                | `bg-background`                                  |
| Nền card / panel         | `bg-card`                                        |
| Text chính               | `text-foreground`                                |
| Text phụ (hint, caption) | `text-muted-foreground`                          |
| Nút primary, link active | `bg-primary text-primary-foreground`             |
| Nút container nhẹ        | `bg-primary-container text-on-primary-container` |
| Viền input, divider      | `border-border`                                  |
| Divider rất nhẹ          | `border-border-subtle`                           |
| Trạng thái lỗi           | `text-destructive` / `bg-destructive`            |
| Trạng thái thành công    | `text-success` / `bg-success`                    |
| Trạng thái cảnh báo      | `text-warning` / `bg-warning`                    |

> **Quy tắc số 1:** Không bao giờ viết `color: #xxx` hay `bg-[#xxx]` trong component.  
> Dark mode tự hoạt động nếu dùng đúng token.

### Màu nền theo độ sâu (dark mode)

```
Trang nền     → bg-background          (tối nhất)
Card lv1      → bg-card                (+4% sáng hơn)
Card lv2      → bg-muted               (+3% sáng hơn)
Popover/menu  → bg-secondary           (sáng nhất)
```

---

## Typography — 5 cấp, không hơn

```tsx
// Tiêu đề trang
<h1 className="text-2xl font-semibold tracking-tight">

// Tiêu đề section / card
<h2 className="text-lg font-semibold">

// Label, tên field
<p className="text-sm font-medium">

// Body text
<p className="text-sm leading-relaxed">

// Caption, hint, metadata
<p className="text-xs text-muted-foreground">
```

> Không dùng quá 2 font-weight trên 1 màn hình.  
> Không viết `text-[15px]` — chỉ dùng scale mặc định của Tailwind.

---

## Spacing — bội số 4px, không dùng số lẻ

| Vị trí                        | Class                |
| ----------------------------- | -------------------- |
| Gap icon trong nút            | `gap-1` (4px)        |
| Padding nội bộ nút            | `px-3 py-1.5`        |
| Padding card                  | `p-4` hoặc `p-6`     |
| Gap giữa các items trong list | `gap-3`              |
| Gap giữa các section          | `gap-6` hoặc `gap-8` |
| Khoảng giữa label & input     | `space-y-1.5`        |
| Khoảng giữa các form field    | `space-y-4`          |

> **Sai:** `mt-[22px]` `p-[15px]`  
> **Đúng:** `mt-6` `p-4`

---

## Components — dùng đúng variant

### Button

```tsx
<Button>                        {/* Primary — CTA chính */}
<Button variant="secondary">    {/* Hành động phụ */}
<Button variant="outline">      {/* Ít quan trọng */}
<Button variant="ghost">        {/* Trong toolbar, icon action */}
<Button variant="destructive">  {/* Xoá, hành động nguy hiểm */}

// Size
<Button size="lg">       {/* Hero section */}
<Button size="default">  {/* Mặc định */}
<Button size="sm">       {/* Trong table, compact */}
<Button size="icon">     {/* Icon-only */}
```

**Rule:** Mỗi page/section chỉ có **1 Primary button**.

---

### Badge / Tag

```tsx
<Badge>                         {/* Primary — nổi bật */}
<Badge variant="secondary">     {/* Trung tính */}
<Badge variant="outline">       {/* Nhẹ nhất */}

// Level khoá học
<Badge className="bg-success/10 text-success border-success/20 border">Beginner</Badge>
<Badge className="bg-warning/10 text-warning border-warning/20 border">Intermediate</Badge>
<Badge className="bg-destructive/10 text-destructive border-destructive/20 border">Advanced</Badge>
```

---

### Form Field — cấu trúc chuẩn

```tsx
<div className="space-y-1.5">
  <Label htmlFor="field">Tên field <span className="text-destructive">*</span></Label>
  <Input id="field" placeholder="Gợi ý format..." />
  <p className="text-xs text-muted-foreground">Helper text nếu cần</p>
  {error && <p className="text-xs text-destructive">{error}</p>}
</div>
```

> Placeholder = gợi ý format, **không** phải thay thế label.

---

### Empty State — bắt buộc với mọi list/grid

```tsx
<div className="flex flex-col items-center gap-3 py-16 text-center">
  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
    <Icon className="w-6 h-6 text-muted-foreground" />
  </div>
  <div>
    <p className="text-sm font-medium">Chưa có dữ liệu</p>
    <p className="text-xs text-muted-foreground mt-0.5">Mô tả ngắn hướng dẫn tiếp theo</p>
  </div>
  <Button size="sm">Hành động chính</Button>
</div>
```

---

### Loading State

```tsx
// Biết layout trước → Skeleton (luôn ưu tiên)
<Skeleton className="h-5 w-40 rounded" />       // Text
<Skeleton className="h-40 w-full rounded-xl" />  // Card/image

// Không biết layout (action inline) → Spinner
<Loader2 className="w-4 h-4 animate-spin" />
```

---

### Clickable Card

```tsx
<Card className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
```

---

## Border Radius

| Dùng cho               | Class               |
| ---------------------- | ------------------- |
| Input, badge nhỏ       | `rounded` (4px)     |
| Button, card, mặc định | `rounded-md` (8px)  |
| Modal, large card      | `rounded-lg` (12px) |
| Avatar, chip, toggle   | `rounded-full`      |

---

## Icons (lucide-react)

| Vị trí                    | Size      |
| ------------------------- | --------- |
| Inline text / badge       | `w-3 h-3` |
| Trong nút, inline action  | `w-4 h-4` |
| Sidebar, icon-only button | `w-5 h-5` |
| Empty state / hero        | `w-8 h-8` |

> Không mix nhiều icon library. Chỉ dùng `lucide-react`.

---

## Animation

```tsx
// Hover/focus mặc định
className="transition-colors duration-150"

// Card hover
className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"

// Fade in
className="animate-in fade-in duration-200"

// Modal / slide panel
className="animate-in slide-in-from-bottom-4 duration-300"
```

> Không animate `width`, `height`, `padding` — gây jank.

---

## Accessibility — 3 điều bắt buộc

```tsx
// 1. Icon-only button phải có aria-label
<Button size="icon" aria-label="Đóng dialog">
  <X className="w-4 h-4" />
</Button>

// 2. Không xoá focus ring của interactive elements

// 3. Contrast: text thường ≥ 4.5:1, text lớn ≥ 3:1
// Kiểm tra: webaim.org/resources/contrastchecker
```

---

## Checklist nhanh trước khi ship

```
□ Dùng token màu, không hardcode
□ Spacing bội số 4px
□ Có empty state + loading state
□ Test dark mode
□ Mobile 375px không vỡ layout
□ Icon-only button có aria-label
```

---

*[Material Design 3](https://m3.material.io/) · [Lucide Icons](https://lucide.dev/) · [OKLCH Picker](https://oklch.com/)*