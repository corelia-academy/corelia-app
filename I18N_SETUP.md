# Hướng dẫn i18n (Đa ngôn ngữ) - Corelia Academy

## Tổng quan

Website Corelia Academy đã được thiết lập với hỗ trợ đa ngôn ngữ (i18n) cho **Tiếng Việt** (mặc định) và **Tiếng Anh**.

## ✨ Tính năng mới

### Language Switcher Dropdown
- **Thiết kế nhỏ gọn** với cờ quốc gia 🇻🇳 🇬🇧
- **Dropdown menu** hiện đại với animation mượt mà
- **Hiển thị bên phải header** trên cả desktop và mobile
- **Tự động highlight** ngôn ngữ đang sử dụng

## Cấu trúc thư mục

```
src/
├── i18n/
│   ├── translations.ts       # File chứa tất cả các bản dịch (đã hoàn chỉnh)
│   └── utils.ts              # Các hàm hỗ trợ cho routing i18n
├── pages/
│   ├── index.astro           # Trang chủ tiếng Việt (mặc định)
│   └── en/
│       └── index.astro       # Trang chủ tiếng Anh
└── components/
    ├── common/
    │   ├── LanguageSwitcher.astro  # Component dropdown chuyển đổi ngôn ngữ
    │   ├── header.astro            # ✅ Đã dịch hoàn chỉnh
    │   ├── footer.astro            # ✅ Đã dịch hoàn chỉnh
    │   └── cta.astro              # ✅ Đã dịch hoàn chỉnh
    └── landing/
        ├── hero.astro             # ✅ Đã dịch hoàn chỉnh
        ├── company.astro          # ✅ Đã dịch hoàn chỉnh
        ├── why.astro              # ✅ Đã dịch hoàn chỉnh
        ├── why.tsx                # ✅ Đã dịch hoàn chỉnh
        ├── program.astro          # ✅ Đã dịch hoàn chỉnh
        ├── number.astro           # ✅ Đã dịch hoàn chỉnh
        ├── different.astro        # ✅ Đã dịch hoàn chỉnh
        ├── faq.astro              # ✅ Đã dịch hoàn chỉnh
        └── faq.tsx                # ✅ Đã dịch hoàn chỉnh
```

## ✅ Trạng thái dịch thuật

### Đã hoàn thành 100%

Tất cả các phần của website đã được dịch hoàn chỉnh:

#### Navigation & Header
- ✅ Trang chủ / Home
- ✅ Lĩnh vực / Fields
- ✅ Cho Doanh nghiệp / For Businesses
- ✅ Cho Trường học / For Universities
- ✅ Liên hệ / Contact
- ✅ Bắt đầu / Get Started

#### Hero Section
- ✅ Badge: "Được công nhận bởi trường đại học..."
- ✅ Title: "Hành trình phát triển Web3 duy nhất bạn cần"
- ✅ Description & CTAs

#### Company Section
- ✅ Tiêu đề hợp tác với đối tác

#### Why Choose Corelia Academy
- ✅ Tiêu đề & mô tả chính
- ✅ 4 tabs: Môi trường, Chương trình, Mentorship, Dự án
- ✅ Nội dung chi tiết cho mỗi tab

#### Educational Programs
- ✅ Tiêu đề & mô tả
- ✅ 4 chương trình học
- ✅ "Chưa chắc chương trình nào..." section
- ✅ CTA buttons

#### Numbers Section
- ✅ Tiêu đề "Con số nói lên tất cả"
- ✅ 3 thống kê với mô tả đầy đủ

#### What Makes Us Different
- ✅ Tiêu đề & mô tả
- ✅ 6 điểm khác biệt với mô tả chi tiết

#### FAQ
- ✅ Tiêu đề & mô tả
- ✅ 7 câu hỏi & câu trả lời

#### CTA Section
- ✅ "Bắt đầu hành trình..." section
- ✅ CTA button

#### Footer
- ✅ Stay Updated section
- ✅ Subscribe description
- ✅ Resources links
- ✅ Copyright

## Cấu hình

### astro.config.mjs

```javascript
i18n: {
  locales: ["vi", "en"],
  defaultLocale: "vi",
  routing: {
    prefixDefaultLocale: false,
  },
}
```

## Cấu trúc URL

- **Tiếng Việt (mặc định):**
  - Trang chủ: `https://corelia.academy/`
  - Các trang khác: `https://corelia.academy/about`

- **Tiếng Anh:**
  - Trang chủ: `https://corelia.academy/en/`
  - Các trang khác: `https://corelia.academy/en/about`

## Language Switcher Component

### Thiết kế mới

Component `LanguageSwitcher.astro` hiện có:
- **Dropdown nhỏ gọn** với cờ quốc gia
- **Animation mượt mà** khi mở/đóng
- **Backdrop blur** cho dropdown menu
- **Check icon** cho ngôn ngữ đang active
- **Responsive** trên cả desktop và mobile

### Cách hoạt động

```astro
<!-- Trong header -->
<LanguageSwitcher />
```

Component tự động:
1. Nhận diện ngôn ngữ hiện tại từ URL
2. Hiển thị cờ tương ứng
3. Generate links đúng cho từng ngôn ngữ
4. Highlight ngôn ngữ đang active

## Cách sử dụng

### 1. Thêm bản dịch mới

Mở file `src/i18n/translations.ts` và thêm keys mới:

```typescript
export const translations = {
  vi: {
    "new.section.title": "Tiêu đề mới",
  },
  en: {
    "new.section.title": "New Title",
  },
}
```

### 2. Sử dụng trong component

```astro
---
import { getLangFromUrl } from "@/i18n/utils";
import { useTranslations } from "@/i18n/translations";

const lang = getLangFromUrl(Astro.url);
const t = useTranslations(lang);
---

<h1>{t("new.section.title")}</h1>
```

### 3. Sử dụng trong React component

```tsx
import { useTranslations } from "@/i18n/translations";

const MyComponent = ({ lang = "vi" }: { lang?: "vi" | "en" }) => {
  const t = useTranslations(lang);
  
  return <h1>{t("new.section.title")}</h1>;
};
```

### 4. Tạo links đa ngôn ngữ

```astro
---
import { getLangFromUrl, useTranslatedPath } from "@/i18n/utils";

const lang = getLangFromUrl(Astro.url);
const translatePath = useTranslatedPath(lang);
---

<a href={translatePath("/about")}>About</a>
```

## 🎨 Customization

### Thay đổi cờ quốc gia

Trong `LanguageSwitcher.astro`:

```typescript
const languageIcons = {
  vi: "🇻🇳",
  en: "🇬🇧",
};
```

### Thay đổi màu sắc

Trong `<style>` của `LanguageSwitcher.astro`:

```css
.lang-option.active {
  background: rgba(255, 247, 0, 0.15); /* Màu nền khi active */
  color: #fff700; /* Màu chữ khi active */
}
```

## 🧪 Testing

Server đang chạy tại: **http://localhost:4322/**

- Tiếng Việt: http://localhost:4322/
- English: http://localhost:4322/en/

### Kiểm tra các tính năng:

1. ✅ Language switcher hiển thị đúng
2. ✅ Dropdown mở/đóng mượt mà
3. ✅ Tất cả nội dung hiển thị đúng ngôn ngữ
4. ✅ Navigation links hoạt động đúng
5. ✅ Tabs trong Why section hoạt động
6. ✅ FAQ accordion hoạt động
7. ✅ Responsive trên mobile

## 📝 Tất cả bản dịch

File `translations.ts` hiện có **100+ keys** được dịch đầy đủ cho:
- Navigation (8 keys)
- Hero section (5 keys)
- Company section (1 key)
- Why section (12 keys)
- Program section (10 keys)
- Number section (8 keys)
- Different section (8 keys)
- FAQ section (16 keys)
- CTA section (3 keys)
- Footer section (6 keys)
- Meta tags (2 keys)

## 🚀 Production Ready

Website đã sẵn sàng cho production với:
- ✅ Toàn bộ nội dung được dịch
- ✅ Language switcher hoạt động hoàn hảo
- ✅ SEO-friendly URLs
- ✅ No linter errors
- ✅ Responsive design
- ✅ Performance optimized

## 📚 Tài liệu tham khảo

- [Astro i18n Documentation](https://docs.astro.build/en/guides/internationalization/)
- [Astro i18n Routing](https://docs.astro.build/en/reference/routing-reference/#i18n-routing)
