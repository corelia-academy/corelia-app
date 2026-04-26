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

### Eyebrow / Section Label (bổ sung)

Dùng cho các label nhỏ phía trên tiêu đề lớn (ví dụ: "CUỘC THI & HOẠT ĐỘNG HỆ SINH THÁI").

```tsx
<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
  Eyebrow label
</p>
```

> Chỉ dùng ALL CAPS cho eyebrow text. **Không dùng cho bất kỳ element nào khác.**

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

## Z-index Scale — không hardcode số

| Layer                    | Class  | Giá trị |
| ------------------------ | ------ | ------- |
| Nội dung trang           | `z-0`  | 0       |
| Sticky header / sidebar  | `z-10` | 10      |
| Dropdown / popover       | `z-20` | 20      |
| Modal overlay (backdrop) | `z-30` | 30      |
| Modal content            | `z-40` | 40      |
| Toast / notification     | `z-50` | 50      |

> Không dùng `z-[999]` hay `z-[9999]`. Mọi element đều phải nằm trong scale này.

---

## Shadow Scale

| Dùng cho                           | Class         |
| ---------------------------------- | ------------- |
| Card trên card (phân cấp bằng màu) | `shadow-none` |
| Card mặc định trên nền trang       | `shadow-sm`   |
| Card đang hover / floating element | `shadow-md`   |
| Modal, popover, dropdown           | `shadow-lg`   |

---

## Responsive / Breakpoints

| Breakpoint        | Layout chính           | Padding ngang |
| ----------------- | ---------------------- | ------------- |
| Mobile <640px     | 1 cột, stack dọc       | `px-4`        |
| Tablet 640–1024px | 2 cột                  | `px-6`        |
| Desktop >1024px   | Sidebar + content area | `px-8`        |

```tsx
// Grid chuẩn cho card list
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

// Container chuẩn
<div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
```

> **Checklist:** Test 375px trước khi ship. Không có layout nào được vỡ ở 375px.

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

**Rules:**
- Mỗi page/section chỉ có **1 Primary button**.
- Không đặt 2 nút Outline cạnh nhau mà không có nút Primary — mất hierarchy.
- Trong 1 viewport không được có 2 Primary button xuất hiện cùng lúc (kể cả ở các section khác nhau nếu cùng nhìn thấy).

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

### Filter Pill / Tab Pills

Dùng cho bộ lọc dạng chip (ví dụ: filter khoá học theo cấp độ, giá).

```tsx
{/* Active */}
<button className="rounded-full px-3 py-1 text-sm font-medium
  bg-primary/10 text-primary border border-primary/20 transition-colors duration-150">
  Mọi cấp độ
</button>

{/* Default */}
<button className="rounded-full px-3 py-1 text-sm font-medium
  bg-transparent text-muted-foreground border border-border
  hover:border-primary/40 hover:text-foreground transition-colors duration-150">
  Cơ bản
</button>
```

> Không dùng `Badge` cho filter pill — Badge không có interactive state.  
> Filter pills luôn dùng `rounded-full`, không phải `rounded-md`.

---

### Breadcrumb

```tsx
<nav className="flex items-center gap-1 text-xs text-muted-foreground">
  <a href="/dashboard" className="hover:text-foreground transition-colors duration-150">
    Dashboard
  </a>
  <ChevronRight className="w-3 h-3" />
  <span className="text-foreground font-medium">Tên trang hiện tại</span>
</nav>
```

> Breadcrumb luôn nằm phía trên `<h1>` của trang.  
> Không in đậm các cấp cha, chỉ in đậm level hiện tại.

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

### Input States

| Trạng thái | Style                                           |
| ---------- | ----------------------------------------------- |
| Default    | `border-border`                                 |
| Focus      | `border-primary ring-2 ring-primary/20`         |
| Error      | `border-destructive ring-2 ring-destructive/20` |
| Disabled   | `opacity-50 cursor-not-allowed bg-muted`        |
| Read-only  | `bg-muted cursor-default`                       |

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

### Toast / Notification

| Tình huống               | Dùng gì                               |
| ------------------------ | ------------------------------------- |
| Action thành công        | Toast bottom-right, auto-dismiss 3s   |
| Lỗi inline (form, field) | Error text đỏ ngay dưới field         |
| Lỗi page-level           | Alert banner phía trên content        |
| Hành động destructive    | Dialog xác nhận, **không phải toast** |
| Info hệ thống            | Banner cố định top, dismissable       |

```tsx
// Alert banner page-level
<div className="flex items-center gap-3 px-4 py-3 rounded-md
  bg-destructive/10 border border-destructive/20 text-destructive text-sm">
  <AlertCircle className="w-4 h-4 shrink-0" />
  <p>Nội dung thông báo lỗi</p>
</div>
```

---

### Dialog / Modal

```tsx
<Dialog>
  <DialogContent className="rounded-lg max-w-md w-full">
    {/* Header */}
    <div className="flex items-start justify-between gap-4 p-6 pb-0">
      <div>
        <DialogTitle className="text-lg font-semibold">Tiêu đề</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground mt-1">
          Mô tả ngắn nếu cần
        </DialogDescription>
      </div>
      <Button size="icon" variant="ghost" aria-label="Đóng dialog">
        <X className="w-4 h-4" />
      </Button>
    </div>

    {/* Body */}
    <div className="p-6 space-y-4">
      {/* content */}
    </div>

    {/* Footer */}
    <div className="flex justify-end gap-2 p-6 pt-0">
      <Button variant="outline">Huỷ</Button>
      <Button>Xác nhận</Button>
    </div>
  </DialogContent>
</Dialog>
```

**Modal width chuẩn:**
- Nhỏ (confirm): `max-w-sm`
- Mặc định (form): `max-w-md`
- Lớn (nội dung phức tạp): `max-w-2xl`
- Fullscreen: `max-w-screen-lg`

---

### Table

```tsx
<div className="rounded-md border border-border overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-muted">
      <tr>
        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
          Tên cột
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border">
      <tr className="hover:bg-muted/50 transition-colors duration-150">
        <td className="px-4 py-3 text-foreground">Dữ liệu</td>
      </tr>
    </tbody>
  </table>
</div>

// Row empty state
<tr>
  <td colSpan={n} className="py-16 text-center text-sm text-muted-foreground">
    Chưa có dữ liệu
  </td>
</tr>
```

---

### Clickable Card

```tsx
<Card className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
```

---

### Avatar / Image

```tsx
// Avatar với fallback
<div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
  <img
    src={avatarUrl}
    alt={name}
    className="w-full h-full object-cover"
    onError={(e) => { e.currentTarget.src = '/placeholder-avatar.png' }}
  />
</div>

// Course thumbnail
<div className="aspect-video w-full rounded-md bg-muted overflow-hidden">
  <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
</div>
```

**Aspect ratio chuẩn:**
- Avatar: `rounded-full` — 1:1
- Course thumbnail: `aspect-video` — 16:9
- Card banner: `aspect-[3/1]` — 3:1

---

## Border Radius

| Dùng cho               | Class               |
| ---------------------- | ------------------- |
| Input, badge nhỏ       | `rounded` (4px)     |
| Button, card, mặc định | `rounded-md` (8px)  |
| Modal, large card      | `rounded-lg` (12px) |
| Avatar, chip, toggle   | `rounded-full`      |
| Filter pill            | `rounded-full`      |

---

## Icons (lucide-react)

| Vị trí                    | Size      |
| ------------------------- | --------- |
| Inline text / badge       | `w-3 h-3` |
| Breadcrumb separator      | `w-3 h-3` |
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

// Sidebar drawer
className="animate-in slide-in-from-left-4 duration-300"
```

> Không animate `width`, `height`, `padding` — gây jank.

---

## Link Style

| Vị trí                  | Style                                                           |
| ----------------------- | --------------------------------------------------------------- |
| Link trong body text    | `text-primary underline underline-offset-4 hover:opacity-80`    |
| Link navigation / label | `text-foreground hover:text-primary transition-colors`          |
| Link phụ / breadcrumb   | `text-muted-foreground hover:text-foreground transition-colors` |

> Không bao giờ dùng màu xanh dương thuần (#0000ff). Luôn dùng `text-primary`.

---

## Ngôn ngữ & Thuật ngữ UI

> **Quy tắc:** Toàn bộ UI phải **nhất quán tiếng Việt**. Không trộn lẫn Anh-Việt trong cùng 1 trang.

| Nên dùng           | Không dùng                |
| ------------------ | ------------------------- |
| Tổng quan khoá học | Overview Description      |
| Đối tượng học viên | Target Audience           |
| Chương trình học   | Curriculum                |
| Tiếp tục học       | Continue Learning         |
| Đăng ký            | Register / Sign up (trộn) |

**Ngoại lệ:** Tên riêng, brand name, thuật ngữ kỹ thuật không có bản dịch chuẩn (blockchain, XLM, SDK...) được giữ nguyên tiếng Anh.

---

## Scrollbar

```css
/* Áp dụng cho overflow containers */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}

/* Ẩn scrollbar nhưng vẫn scroll được */
.scrollbar-hidden {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hidden::-webkit-scrollbar {
  display: none;
}
```

> Sidebar và modal body dùng `scrollbar-thin`. Horizontal scroll chips dùng `scrollbar-hidden`.

---

## Accessibility — bắt buộc

```tsx
// 1. Icon-only button phải có aria-label
<Button size="icon" aria-label="Đóng dialog">
  <X className="w-4 h-4" />
</Button>

// 2. Không xoá focus ring của interactive elements

// 3. Contrast: text thường ≥ 4.5:1, text lớn ≥ 3:1
// Kiểm tra: webaim.org/resources/contrastchecker

// 4. Link phải có text mô tả, không dùng "Xem thêm" / "Click here" đơn lẻ
<a href="/courses">Xem tất cả khoá học</a>  {/* ✓ */}
<a href="/courses">Xem thêm</a>              {/* ✗ */}
```

---

## Checklist nhanh trước khi ship

```
□ Dùng token màu, không hardcode
□ Spacing bội số 4px
□ Chỉ 1 Primary button trên viewport
□ Có empty state + loading state cho mọi list/grid
□ Input có đủ 5 states (default, focus, error, disabled, readonly)
□ Test dark mode
□ Mobile 375px không vỡ layout
□ Icon-only button có aria-label
□ Ngôn ngữ UI nhất quán tiếng Việt
□ Không mix icon library
□ Z-index nằm trong scale (0–50)
□ Thumbnail/avatar có fallback khi ảnh lỗi
```

---

*[Material Design 3](https://m3.material.io/) · [Lucide Icons](https://lucide.dev/) · [OKLCH Picker](https://oklch.com/) · [Contrast Checker](https://webaim.org/resources/contrastchecker/)*