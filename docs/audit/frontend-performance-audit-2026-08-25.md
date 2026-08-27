# Front-end Performance & Code Audit — Corelia App

> **SUPERSEDED — HISTORICAL EVIDENCE ONLY.** Nội dung Cora/learner AI trong báo cáo này phản ánh trạng thái tại thời điểm audit và không mô tả runtime hiện hành.

Ngày audit: 2026-08-25  
Phạm vi: `src/`, cấu hình build và static assets trong `public/`. Không audit schema, migration, Edge Functions, RLS hay implementation bên trong `supabase/`.

## 1. Kết luận điều hành

Front-end đã có nền tảng tốt: route-level `React.lazy`, React Compiler, nhiều request độc lập đã dùng `Promise.all`, test hiện tại chạy xanh. Tuy nhiên, chiến lược `manualChunks` đang làm mất phần lớn lợi ích của lazy loading: chunk `feature-learner-core` nặng **1,409.45 kB minified / 426.75 kB gzip** và bị preload ngay từ `index.html` trên mọi route. Tổng JavaScript entry + modulepreload ban đầu hiện khoảng **711 kB gzip** (chưa tính CSS khoảng 30 kB gzip và font). Đây là ưu tiên P0.

Các vấn đề lớn tiếp theo là: Cora AI luôn được mount trong layout dù không hiển thị, toàn bộ 20 namespace/ngôn ngữ i18n được bundle lúc boot, font import kéo nhiều unicode subset không cần thiết, ảnh Cora 2.3 MB và nhiều ảnh thiếu lazy loading/kích thước cố định, waterfall ở trang chi tiết khóa học, polling trùng lặp, cùng một số component/hook quá lớn gây khó tối ưu và tăng nguy cơ render lại.

Nếu xử lý P0/P1 theo thứ tự dưới đây, mục tiêu hợp lý là đưa initial JS của route công khai xuống dưới **250–350 kB gzip**, giảm đáng kể thời gian parse/execute trên mobile và loại bỏ nhiều request/render không cần thiết. Cần đo lại bằng Lighthouse/WebPageTest trên bản deploy để xác nhận Core Web Vitals thực tế.

## 2. Cách kiểm tra và baseline

Đã thực hiện:

- Đọc entry point, router, layout, i18n, hooks tải dữ liệu và các component lớn.
- Build production bằng `pnpm run build`.
- Chạy `pnpm run lint` và `pnpm test`.
- Thống kê 463 file TS/TSX/CSS, khoảng 82,891 dòng, `src` 4.5 MB và `public` 15 MB.
- Kiểm tra output chunk, modulepreload, assets, ảnh, timer/listener, lazy import và các waterfall rõ ràng trong source.

Baseline build đáng chú ý:

| Thành phần | Minified | Gzip | Trạng thái |
|---|---:|---:|---|
| `feature-learner-core` | 1,409.45 kB | 426.75 kB | P0, preload toàn cục |
| `vendor-react` | 225.27 kB | 72.20 kB | preload |
| `vendor-ui` | 182.75 kB | 59.20 kB | preload |
| `vendor-markdown` | 162.13 kB | 49.49 kB | preload dù không phải route nào cũng cần |
| `vendor-ocid` | 62.43 kB | 17.34 kB | preload toàn cục |
| CSS chính | 164.14 kB | 29.89 kB | toàn cục |
| `jspdf` | 352.60 kB | 115.70 kB | đã tách, chỉ nên tải khi export |
| `html2canvas` | 201.04 kB | 47.43 kB | đã tách, chỉ nên tải khi export |

`dist/index.html` hiện preload `vendor-react`, `vendor-i18n`, `vendor-icons`, `vendor-ui`, `vendor-ocid`, `vendor-supabase`, `vendor-markdown` và `feature-learner-core`. Con số initial JS ~711 kB gzip có tính chunk Supabase client vì nó thực sự nằm trong critical download graph; phần implementation Supabase vẫn nằm ngoài phạm vi audit.

## 3. Phát hiện và khuyến nghị

### P0. `manualChunks` gom gần toàn bộ learner UI vào một mega-chunk và ép preload

**Bằng chứng**

- `vite.config.ts:42-49` gom `MainLayout`, toàn bộ `src/components/course-ai/`, `useCoraAI.ts` và toàn bộ `src/pages/home/` vào cùng `feature-learner-core`.
- Build tạo chunk 1.41 MB minified / 426.75 kB gzip.
- `dist/index.html` modulepreload chunk này trên cả `/login`, `/verify`, `/claim`, admin và các route không dùng Cora.
- Rollup cảnh báo `GlobalCoraAssistant` và `CoraSidebarPanel` vừa dynamic vừa static, nên dynamic import không tạo được boundary.

**Tác động**

Tăng download, parse, compile và execute trước interactive, đặc biệt rõ trên mobile/CPU chậm. Route lazy bên trong `App.tsx` không cứu được critical path vì manual chunk tạo dependency chung từ entry/layout.

**Khuyến nghị**

1. Xóa rule `feature-learner-core` hiện tại; để Rollup tự tách theo dynamic import trước khi thêm manual chunk mới.
2. Giữ `MainLayout` thành chunk nhỏ, không gộp `home` hay `course-ai` vào layout.
3. Tách Cora theo capability: `cora-shell`, `cora-markdown`, `cora-code-highlight`, chỉ import khi user mở assistant hoặc route thực sự cần.
4. Loại static import `CoraSidebarPanel` trong `src/pages/learn/Learn.tsx:61`; dùng cùng một lazy boundary hoặc component shell nhỏ không import assistant implementation.
5. Thêm budget CI: fail nếu entry critical graph >350 kB gzip hoặc chunk đơn >250 kB gzip (trừ export-only chunk có lý do).

**Tiêu chí hoàn tất**

- `feature-learner-core` không còn hoặc <200–250 kB gzip.
- `/login` và route public không preload markdown/Cora/home.
- Build không còn hai cảnh báo dynamic/static import nói trên.

### P0. Cora được tải và mount quá sớm

**Bằng chứng**

- `src/components/layouts/MainLayout.tsx:68-70` luôn render `GlobalCoraAssistant`.
- `src/components/layouts/MainLayout.tsx:109-116` luôn render `CoraSidebarPanel` và `ExplainSelectionButton`.
- Việc kiểm tra user/path chỉ xảy ra bên trong `GlobalCoraAssistant.tsx:215+`, tức module và dependency đã tải trước khi component trả về `null`.
- `CoraSidebarPanel.tsx` import `CoraAssistantCard` từ `GlobalCoraAssistant`, làm hai boundary dính nhau.

**Khuyến nghị**

- Đưa điều kiện authentication/path ra một wrapper rất nhẹ trong layout; chỉ `import()` assistant sau khi điều kiện đúng.
- Tốt hơn nữa: chỉ prefetch khi idle sau LCP hoặc khi hover/focus/click nút Cora; mount nội dung nặng sau intent.
- Tách `CoraAssistantCard` khỏi `GlobalCoraAssistant.tsx` để sidebar không kéo cả global assistant.
- Lazy load markdown, syntax highlighter và history panel khi có message/code/history tương ứng.

### P1. Toàn bộ i18n được đưa vào startup bundle

**Bằng chứng**

`src/i18n.ts:5-24` import tĩnh 10 namespace cho cả `vi` và `en`; `vendor-i18n` 55.44 kB minified / 18.17 kB gzip chưa bao gồm toàn bộ JSON nằm trong graph ứng dụng.

**Khuyến nghị**

- Boot chỉ với `common` và namespace của route hiện tại.
- Dùng dynamic import/backend loader theo `language + namespace`.
- Prefetch ngôn ngữ còn lại sau idle hoặc khi mở language switcher.
- Tách namespace quá lớn theo màn hình, nhất là `instructor`, `contests`, `admin`.

### P1. Font toàn cục phát hành quá nhiều subset

**Bằng chứng**

`src/styles/globals.css:4-5` import package root của Google Sans Variable và JetBrains Mono Variable. Build phát hành Google Sans cho Greek, Hebrew, Armenian, Cyrillic, Lao, Gurmukhi, Thai, Georgian, Tamil, Gujarati, Malayalam, Oriya, Devanagari, Khmer, Telugu, Sinhala, Bengali và Ethiopic; riêng Ethiopic là 248.63 kB. Sản phẩm hiện chỉ hỗ trợ `vi` và `en`.

**Khuyến nghị**

- Import trực tiếp CSS subset `latin` và `vietnamese`; bỏ các subset khác.
- Chỉ load JetBrains Mono ở màn hình có code, hoặc dùng system monospace cho boot.
- Đảm bảo `font-display: swap`; preload duy nhất font WOFF2 thực sự cần above-the-fold nếu đo cho thấy có lợi.

Lưu ý: unicode-range thường ngăn browser tải tất cả file, nên đây chủ yếu là giảm artifact/deploy noise và tránh tải nhầm; cần xác nhận Network panel trên trình duyệt mục tiêu.

### P1. Static assets quá lớn và chiến lược ảnh chưa nhất quán

**Bằng chứng**

- `public/logo/Cora_AI_Tutor.svg`: 2.3 MB và được dùng ở header (`Header.tsx:703`) lẫn Cora constants.
- `public/images/occ/OCA1.png` đến `OCA10.png`: khoảng 1.1 MB mỗi file, tổng hơn 10 MB.
- Có 86 thẻ `<img>` nhưng chỉ khoảng một nhóm nhỏ khai báo `loading="lazy"`; nhiều card/list ảnh không có `width`/`height` hoặc `aspect-ratio` rõ ràng từ intrinsic attributes.
- Ví dụ chưa lazy: `ProjectDetailPage.tsx:49`, `ProjectsPage.tsx:68`, `CoursesPage.tsx:61`, `GuestHome.tsx:131`, nhiều ảnh admin và achievement.

**Khuyến nghị**

- Tối giản SVG Cora bằng SVGO; nếu thực chất là raster embedded trong SVG, xuất WebP/AVIF đúng kích thước hiển thị. Mục tiêu <50–100 kB cho logo/mascot UI.
- Chuyển OCA PNG sang AVIF/WebP responsive; tạo thumbnail thay vì dùng ảnh gốc cho card.
- Component ảnh dùng chung nên nhận `width`, `height`, `sizes`, `srcSet`; lazy + `decoding="async"` cho dưới fold.
- Chỉ hero/LCP image dùng eager và `fetchpriority="high"`; không lazy LCP.
- Thiết lập CDN transform/cache immutable cho asset content-hashed và ảnh upload.

### P1. Waterfall dữ liệu ở trang chi tiết khóa học

**Bằng chứng**

`src/pages/course-details/hooks/useCourseLoad.ts:48-79` thực hiện chuỗi:

1. tìm course theo slug;
2. nếu không có mới tìm theo id;
3. tải locale course;
4. tải sections;
5. tải locale map của sections.

Sau đó `useCourseLessons.ts` chỉ bắt đầu khi `course` và `resolvedCourseId` đã cập nhật, rồi lại tải lessons trước và locale map sau. `useCourseProgress.ts` tiếp tục phụ thuộc lessons/sections và reset state trong effect, tạo thêm render cascade (cũng là lỗi lint hiện tại).

**Khuyến nghị**

- Chuẩn hóa URL để route biết slug hay UUID, tránh probe slug rồi fallback id.
- Sau khi có course ID, chạy course locale, sections, section locale, lessons và lesson locale song song bằng `Promise.all` hoặc một front-end loader/service aggregate.
- Dùng route loader/cache (hoặc query cache) để dedupe giữa Course Detail, Home và Learn.
- Dùng `AbortController` thay cho chỉ cờ `cancelled`, giúp hủy network/request work khi đổi route.
- Tránh reset `setHasStarted(false)` đồng bộ đầu effect; model state theo request key hoặc reducer/query state.

### P1. Home dashboard có request amplification và mutation-on-read

**Bằng chứng**

`useHomeUserDashboard.ts` tải enrollments/config, sau đó luôn gọi `backfillMissingEnrollmentsForUser`, có thể tải enrollments lần hai, rồi với tối đa 2 enrollment gọi riêng course + lessons + sections + progress: tối đa 8 request ở wave tiếp theo. `useHomeCatalogAndContests.ts` còn tải catalog/contest riêng và sau đó locale content.

**Khuyến nghị**

- Không chạy backfill trong critical read path mỗi lần mở home; chuyển sang migration/background/auth-once flow hoặc đánh dấu đã backfill.
- Tạo read model/batch endpoint cho home trả đúng dữ liệu card cần dùng.
- Cache theo user/course/locale và chia sẻ giữa home, catalog, detail, learn.
- Render shell + catalog công khai độc lập; không để dashboard cá nhân chặn nội dung có thể hiển thị sớm.

### P1. Polling thông báo/feed có khả năng trùng và chạy khi tab ẩn

**Bằng chứng**

- `NotificationBell.tsx:101-106` refresh mỗi 60 giây.
- `useFeedUnreadCount.ts:47-53` cũng refresh mỗi 60 giây và có realtime subscription/event refresh.

**Khuyến nghị**

- Gom unread state thành một store/query duy nhất để Header và Feed dùng chung.
- Nếu realtime đủ tin cậy, bỏ polling thường xuyên; nếu cần fallback, pause khi `document.hidden`, dùng backoff/jitter và refresh khi focus/reconnect.
- Dedupe in-flight request để interval, realtime và manual event không gọi đồng thời.

### P1. Component/hook quá lớn làm tăng coupling và khó tạo render boundary

**Bằng chứng**

- `InstructorCourseEdit.tsx`: 9,334 dòng.
- `useContestDetailOrchestrator.ts`: 2,333 dòng.
- `ContestDetailManagerSettingsCard.tsx`: 1,472 dòng.
- `InstructorCareerTrackEditorPage.tsx`: 1,142 dòng.
- `AccountCoraRoute.tsx`: 977 dòng; `useCoraAI.ts`: 836 dòng; `Learn.tsx`: 825 dòng.

Kích thước file không tự động đồng nghĩa runtime chậm, nhưng ở đây nó làm code splitting theo section khó, tăng closure/dependency graph, và dễ khiến state cục bộ làm render lại vùng UI lớn.

**Khuyến nghị**

- Tách theo tab/section/dialog thành lazy component; dialog generator/export chỉ tải khi mở.
- Tách orchestrator thành hooks theo domain, state machine/reducer ổn định và selector nhỏ.
- Không thêm `memo/useMemo` hàng loạt vì React Compiler đã bật; đo React Profiler trước, ưu tiên thu nhỏ state ownership và props.
- Virtualize danh sách dài (user, participant, submission, notification) sau khi profiler xác nhận DOM/render cost.

### P2. Provider và global work nằm trên mọi route

**Bằng chứng**

`src/main.tsx` bọc toàn app bằng `OCConnect`; `App.tsx` mount `AuthSync`, toaster, tooltip, loading bar, credential sync và pending modal trước router/route. Route public như `/verify` và `/email/unsubscribe` vẫn trả chi phí các provider/global observer này.

**Khuyến nghị**

- Tách `PublicMinimalLayout`, `AuthLayout`, `LearnerLayout`, `InstructorLayout`, `AdminLayout` với provider đúng nhu cầu.
- Chỉ mount credential realtime/pending modal khi đã authenticated và route cần.
- Đánh giá lazy initialization OCID theo route/intent; nếu SDK bắt buộc cho toàn app, giữ provider shell nhưng trì hoãn UI/module phụ.

### P2. CSS toàn cục lớn và transition có thể gây paint không cần thiết

CSS chính 164.14 kB minified / 29.89 kB gzip. Nhiều component dùng `transition-colors` hợp lý, nhưng cần tránh `transition-all`, blur/backdrop/shadow lớn trên vùng scroll và animation liên tục. Audit source chưa đủ để kết luận paint bottleneck thực tế.

**Khuyến nghị**

- Dùng Chrome Performance/Rendering để tìm long task, layout shift, paint flashing trên Home, Learn và editor.
- Kiểm tra Tailwind source detection để CSS không thu class từ file ngoài `src` không cần thiết.
- Áp dụng `content-visibility: auto` cho section dài dưới fold sau khi test accessibility/anchor navigation.
- Tôn trọng `prefers-reduced-motion`; animate transform/opacity thay vì layout properties.

### P2. Thiếu performance budget và coverage hiệu năng tự động

Hiện chưa thấy script Lighthouse/bundle budget trong `package.json`. `perfTelemetry` đã được dùng ở Home, đây là điểm khởi đầu tốt nhưng chưa đủ bảo vệ regression.

**Khuyến nghị**

- CI chạy bundle budget và Lighthouse CI trên `/`, `/login`, `/courses/:slug`, `/learn/:id`, một route instructor.
- Budget đề xuất: LCP <2.5s, INP <200ms, CLS <0.1 ở p75; initial JS route public <350 kB gzip; không chunk UI thường dùng >250 kB gzip.
- Thu thập Web Vitals RUM theo route, device, network và app version; không chỉ dựa local Lighthouse.
- Thêm regression test cho số request và không tải Cora/markdown trên route public.

## 4. Code quality / correctness ảnh hưởng performance

### Lint

`pnpm run lint` thất bại:

- Error tại `src/pages/course-details/hooks/useCourseProgress.ts:43`: gọi `setHasStarted(false)` đồng bộ trong effect, có thể tạo cascading render.
- Warning tại `src/lib/supabase.ts:50`: eslint-disable thừa. Warning này thuộc file Supabase và không được phân tích thêm theo phạm vi yêu cầu.

### Test

`pnpm test` pass: **17 test files, 85 tests**. Tuy nhiên coverage hiện chủ yếu là utility/domain logic; chưa có test đo route bundle, request waterfall, render count hoặc Core Web Vitals.

### Build

`pnpm run build` pass nhưng có:

- Cảnh báo chunk >500 kB.
- Hai cảnh báo mixed dynamic/static imports cho `GlobalCoraAssistant` và `CoraSidebarPanel`.

## 5. Kế hoạch triển khai đề xuất

### Giai đoạn 1 — 1 đến 2 ngày, lợi ích lớn/rủi ro thấp

1. Bỏ `feature-learner-core` manual chunk, sửa mixed imports, build lại và chốt bundle budget.
2. Condition/lazy load toàn bộ Cora theo auth + intent.
3. Chỉ import font Latin/Vietnamese.
4. Tối ưu `Cora_AI_Tutor.svg`; lazy các ảnh dưới fold dễ nhận diện.
5. Sửa lint ở `useCourseProgress`.

### Giai đoạn 2 — 3 đến 5 ngày

1. Lazy load i18n namespace.
2. Parallelize Course Detail/Learn data và thêm cache/dedupe.
3. Gom unread polling/realtime thành một nguồn state.
4. Tách export certificate (`jspdf`, `html2canvas`) và syntax highlighting khỏi các route không dùng.
5. Thiết lập Lighthouse CI + RUM.

### Giai đoạn 3 — theo profiler

1. Tách editor 9k dòng theo section/dialog.
2. Tách contest orchestrator và manager panels.
3. Virtualize các list được profiler xác nhận chậm.
4. Tối ưu render/paint cụ thể dựa trên flamegraph, không memo hóa đại trà.

## 6. Checklist xác minh sau tối ưu

- Build không có mixed dynamic/static warning.
- DevTools Network ở `/login` và `/verify`: không tải `feature-learner-core`, Cora, markdown, syntax highlighter, jsPDF/html2canvas.
- Route `/`: initial JS <350 kB gzip; Cora chỉ tải sau intent/idle theo thiết kế.
- Không request trùng course/enrollment/unread trong cùng navigation.
- Ảnh dưới fold lazy; ảnh LCP có kích thước cố định và priority đúng.
- Font request chỉ có subset Latin/Vietnamese cần thiết.
- Lighthouse mobile và RUM đạt LCP/INP/CLS budget; test trên mạng Fast 3G/4G và CPU slowdown.
- `pnpm run lint`, `pnpm test`, `pnpm run build` đều pass sạch.

## 7. Giới hạn của audit

Audit này là static/source/build audit trong môi trường local. Không có dữ liệu production RUM, cache headers/CDN thực tế, tài khoản để chạy đầy đủ các flow authenticated, hay trace từ thiết bị mobile thật. Vì vậy các kết luận về bundle/import graph là xác thực từ production build; các nhận định về LCP/INP/paint cần được xác nhận bằng đo lường runtime sau khi deploy bản tối ưu.
