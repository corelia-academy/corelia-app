# i18n Setup Guide - Corelia Academy

## Overview

Corelia Academy website has been configured with internationalization (i18n) support for **Vietnamese** (default) and **English**.

## Folder Structure

```
src/
├── i18n/
│   ├── translations.ts       # All translations
│   └── utils.ts              # i18n routing helpers
├── pages/
│   ├── index.astro           # Vietnamese homepage (default)
│   └── en/
│       └── index.astro       # English homepage
└── components/
    └── common/
        └── LanguageSwitcher.astro  # Language switcher component
```

## Configuration

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

**Explanation:**
- `locales`: List of supported languages
- `defaultLocale`: Default language (Vietnamese)
- `prefixDefaultLocale: false`: Vietnamese URLs won't have `/vi/` prefix

## URL Structure

- **Vietnamese (default):**
  - Homepage: `https://corelia.academy/`
  - Other pages: `https://corelia.academy/about`, `https://corelia.academy/contact`

- **English:**
  - Homepage: `https://corelia.academy/en/`
  - Other pages: `https://corelia.academy/en/about`, `https://corelia.academy/en/contact`

## Usage

### 1. Add new translations

Open `src/i18n/translations.ts` and add new keys:

```typescript
export const translations = {
  vi: {
    "new.key": "Vietnamese text",
  },
  en: {
    "new.key": "English text",
  },
}
```

### 2. Use translations in components

```astro
---
import { getLangFromUrl } from "@/i18n/utils";
import { useTranslations } from "@/i18n/translations";

const lang = getLangFromUrl(Astro.url);
const t = useTranslations(lang);
---

<h1>{t("new.key")}</h1>
```

### 3. Create multilingual links

```astro
---
import { getLangFromUrl, useTranslatedPath } from "@/i18n/utils";

const lang = getLangFromUrl(Astro.url);
const translatePath = useTranslatedPath(lang);
---

<a href={translatePath("/about")}>About</a>
```

### 4. Create English version of a page

1. Create Vietnamese page at `src/pages/about.astro`
2. Create English page at `src/pages/en/about.astro`
3. Use the same components with different languages

## Updated Components

### LanguageSwitcher

This component allows users to switch between languages. Integrated in:
- Header (desktop and mobile)
- Shows current language with highlight

### Hero Component

- ✅ Translated to both Vietnamese and English
- ✅ Automatically displays appropriate language based on URL

### Header Component

- ✅ Navigation items are translated
- ✅ Language switcher integrated
- ✅ All links automatically add language prefix

## Current Translations

### Vietnamese
- **Badge:** "Được công nhận bởi trường đại học. Được hỗ trợ bởi quỹ."
- **Title:** "Hành trình phát triển Web3 duy nhất bạn cần"
- **Description:** "Một hành trình học tập thực tế nơi các lập trình viên học hỏi, xây dựng và phát triển trong hệ sinh thái Web3 của Việt Nam."
- **CTA:** "Tham gia danh sách chờ" | "Liên hệ"

### English
- **Badge:** "University-recognized. Foundation-backed."
- **Title:** "The only Web3 development journey you need"
- **Description:** "A practical learning journey where developers learn, build, and grow in Vietnam's Web3 ecosystem."
- **CTA:** "Join Waitlist" | "Contact"

## Testing

Server running at: `http://localhost:4322/`

- Vietnamese: http://localhost:4322/
- English: http://localhost:4322/en/

## Next Steps

### To complete i18n for the entire website:

1. **Add translations for remaining components:**
   - Company
   - Why
   - Program
   - Number
   - Different
   - FAQ
   - Footer

2. **Create English pages for other routes:**
   - `/en/fields`
   - `/en/businesses`
   - `/en/universities`
   - `/en/contact`

3. **Update SEO meta tags:**
   - Add `<link rel="alternate" hreflang="vi" href="..." />`
   - Add `<link rel="alternate" hreflang="en" href="..." />`

4. **Add browser language detection** (optional):
   - Automatically redirect users to appropriate language based on browser preference

## Reference Documentation

- [Astro i18n Documentation](https://docs.astro.build/en/guides/internationalization/)
- [Astro i18n Routing](https://docs.astro.build/en/reference/routing-reference/#i18n-routing)
