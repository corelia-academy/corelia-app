# OpenGraph images cho Corelia

## Quyết định và phạm vi

OpenGraph là năng lực share của các route **public, canonical và có nội dung định danh riêng**; không phải tính năng dành riêng cho project, cũng không cần tạo ảnh động cho mọi route.

- Kích thước đầu ra: PNG `1200 × 630`.
- Không tạo OG editor hay template engine. Mỗi entity có một component JSX thuần nhận DTO đã chuẩn hoá.
- Bốn card `ProjectOG`, `CourseOG`, `EventOG`, `ProfileOG` dùng chung theme và pipeline render.

### Route policy

| Nhóm route | Chính sách OG | Lý do |
| --- | --- | --- |
| Homepage, directory, search, landing, tài liệu công khai | Site card tĩnh hiện có | Không có một resource riêng để card phải thay đổi theo URL/query. Không tạo cache cardinality cho filter/search. |
| Project public `/projects/:slug` | `ProjectOG` động | Mỗi project có title, summary, owner, taxonomy và logo riêng. |
| Course đã publish `/courses/:slug` (`/courses/:id` là alias) | `CourseOG` động | Nội dung học là public/shareable và có thumbnail/instructor riêng; canonical luôn trỏ về slug hiện hành. |
| Hackathon public `/hackathons/:slug` | `EventOG` động | Cần title, thời gian, cover và host riêng khi chia sẻ. |
| Public profile `/@:handle` | `ProfileOG` động | Chỉ khi public profile; không đưa dữ liệu account riêng tư vào card. |
| Certificate/credential verify, job detail, career-track | Quyết định từng entity trước khi thêm | Chỉ làm khi product xác nhận page đó được chủ động chia sẻ và field hiển thị không lộ PII/nguồn có giới hạn attribution. |
| Account, admin, editor, draft, invite, checkout, auth, private/unlisted/blocked entities | Không dynamic OG; `noindex` khi phù hợp | Không có canonical public resource và không được lộ metadata. |

Với entity dynamic, URL endpoint là `/api/og/<entity>/<canonical-id>`. Riêng project dùng `/api/og/project/:slug`; URL trang là `/projects/:slug` (không phải `/project/:slug`). `unlisted`, `private`, `blocked`, slug không tồn tại và dữ liệu lỗi đều không có OG endpoint: trả cùng một `404` để không tiết lộ trạng thái riêng tư.

## Vì sao plan gốc cần điều chỉnh theo Corelia

Corelia là Vite SPA được host bằng Cloudflare Worker (`worker/index.ts`); `src/` là browser bundle. API backend hiện hữu là Supabase Edge Function `corelia-api` và định tuyến bằng `?op=`. Vì vậy một `src/lib/og/render.ts` không thể là server endpoint, không được mang service key, và React client không thể tạo metadata mà crawler nhìn thấy.

Ngoài ra, `@resvg/resvg-js` là package native N-API cho Node. Nó không phải runtime phù hợp với Cloudflare Worker/Supabase Edge (Deno). Dùng nó sẽ chỉ hoạt động nếu ta đưa thêm Node server, vốn ngoài phạm vi app hiện tại.

**Stack đã chốt cho kiến trúc hiện tại:**

| Vai trò | Package/runtime |
| --- | --- |
| JSX → SVG | `satori`, chạy trong Supabase Edge/Deno |
| SVG → PNG | `@resvg/resvg-wasm`, chạy WASM trong Supabase Edge/Deno |
| Public route + HTML metadata | Cloudflare Worker hiện có |
| Đọc DB/Storage có đặc quyền | `corelia-api` service client hiện có |

`satori` yêu cầu font TTF, OTF hoặc WOFF (không dùng WOFF2) và chỉ hỗ trợ một tập CSS/flexbox. Font và WASM được bundle nội bộ một lần trong runtime; không fetch từ CDN ở mỗi request. Card dùng đúng các font từ email template: Akt cho title, TT Norms Pro Trial cho body, PP Supply Sans cho label; Be Vietnam Pro hỗ trợ dấu tiếng Việt. Nếu sau này có lý do thật sự để chạy renderer trên Node, khi đó mới dùng `@resvg/resvg-js` và ghi rõ Node deployment boundary riêng.

## Kiến trúc mục tiêu

```text
share bot / browser
  │
  ├─ GET /<public-detail-route> (kể cả Accept: */* từ share bot)
  │    Cloudflare Worker lấy public OG metadata từ corelia-api
  │    và thay các thẻ trong <head> trước khi trả index.html
  │
  └─ GET /api/og/<entity>/<canonical-id>?v=<content-revision>
       Cloudflare Worker proxy nội bộ
       → corelia-api?op=og.<entity>.image&id=...
       → public entity data + permitted media bytes
       → <Entity>OG → Satori SVG → Resvg WASM PNG
       → image/png
```

Worker là lớp public URL duy nhất. Renderer nằm ở `corelia-api`, vì chỉ lớp này có service client để đọc media trong bucket `app` và không được đưa key vào Worker/browser. Worker forward request đến function bằng một service-to-service secret riêng (`OG_PROXY_SECRET`), không forward cookie hoặc Authorization của người xem. Function kiểm tra secret này trước khi thực hiện mọi `og.<entity>.meta/image`.

Worker cũng expose `GET /api/og/<entity>/<id>/meta` cho preview. Route này chỉ trả JSON `{ canonicalUrl, imageUrl, updatedAt, revision }` của entity public, gọi cùng `og.<entity>.meta` qua secret nội bộ và trả `404` như image route cho mọi entity unavailable. JSON có `Content-Type: application/json` và `Cache-Control: no-store`; method khác trả `405` với `Allow: GET`. Không có dữ liệu admin hay service key. Browser gọi route này cùng origin; không gọi thẳng `corelia-api` và không biết `OG_PROXY_SECRET`. Trang admin vẫn phải dùng `RequireRole` với `ROLE_GROUPS.admin`; quyền truy cập trang và quyền đọc metadata public là hai việc riêng.

Metadata op chỉ đọc project, owner và taxonomy; không download logo hoặc render PNG. Image op cũng tính revision từ đúng các field đó trước khi đọc logo. Cả hai dùng `CORELIA_APP_ORIGIN` cố định theo environment (staging/production), không lấy origin từ request header; Worker chỉ phát URL do op trả về nếu origin khớp origin đã cấu hình của environment.

Không dùng browser helper `getProjectBySlugOrId` cho renderer: helper đó ký URL cho media, tuỳ locale UI và có thể đọc `unlisted` theo RLS. OG phải có truy vấn server-side riêng với điều kiện `visibility = 'public'` và `blocked = false`.

## Nơi đặt code

Tách code theo runtime, thay cho folder `src/lib/og/` của plan ban đầu:

```text
supabase/functions/corelia-api/
  og/
    ProjectOG.tsx       # JSX thuần, stateless; không import React hooks/Tailwind
    theme.ts             # token màu, border, typography, kích thước
    fonts.ts             # tải/cache ArrayBuffer font TTF/OTF/WOFF
    render.ts            # Satori + WASM init + Resvg → Uint8Array PNG
    projectData.ts       # query, chuẩn hoá/giới hạn DTO, data URL logo
    handlers.ts          # op metadata/image, status/cache header
worker/
  index.ts               # image/meta routes, HTML metadata injection, admin noindex header
src/lib/
  og.ts                  # tùy chọn: chỉ build URL typed dùng cho React; không renderer
src/features/og/
  OgImagePreview.tsx      # khung preview nội bộ, chỉ hiển thị URL PNG canonical
  ogPreviewQueries.ts     # metadata/status query cho trang QA nội bộ
src/pages/admin/
  AdminOgPreviewPage.tsx  # route-level composition, được guard từ App.tsx
```

Không import file trong `supabase/functions/` vào `src/`, và không import `src` vào Edge Function. Nếu cùng cần một shape TypeScript, định nghĩa DTO nhỏ ở `supabase/functions/corelia-api/og/` trước; chỉ tách shared type khi xuất hiện consumer thực tế thứ hai.

## Data contract

`projectData.ts` trả một DTO đã an toàn cho layout, không trả raw row:

```ts
type ProjectOGData = {
  name: string;
  description: string | null;
  logoDataUrl: string | null;
  tags: string[];
  owner: string | null;
  url: string;
  updatedAt: string;
  revision: string;
};
```

| DTO | Nguồn Corelia | Quy tắc |
| --- | --- | --- |
| `name` | `projects.title` | trim, tối đa 96 Unicode code points; bắt buộc với project public |
| `description` | `projects.summary` | canonical/source text, bỏ Markdown/control chars, collapse whitespace, tối đa 180 code points; fallback `null` |
| `logoDataUrl` | `projects.logo_path` trong bucket `app` | chỉ download path bắt đầu `project-media/`; MIME image cho phép, giới hạn byte; convert thành `data:` URL; lỗi/missing → `null` |
| `tags` | taxonomy technology/sector active (`project_taxonomy_options`) + `custom_*_names` | tên canonical Vietnamese ở phase 1, dedupe, tối đa 3; không render raw ID |
| `owner` | `public_profiles.full_name`, rồi `username`, rồi `ocid` | chỉ dữ liệu projection public; trim/tối đa 48; không có profile → `null` |
| `url` | canonical app origin đã cấu hình + `/projects/${encodeURIComponent(slug)}` | chỉ dựng từ canonical slug DB và origin cố định/allowlist; không nhận Host, request origin hay URL từ query |
| `updatedAt` | `projects.updated_at` | thông tin chẩn đoán trong preview; không dùng một mình làm version |
| `revision` | SHA-256 của `{canonicalSlug,name,description,tags,owner,logoPath,updatedAt}` đã chuẩn hoá | encode dạng hex/base64url ổn định, thứ tự field cố định; metadata/image tính cùng thuật toán, không hash `logoDataUrl` hoặc URL do request cung cấp |

Không lấy `description`, progress, resource URL, collaborator, email, auth metadata, ảnh screenshot hay avatar vào ảnh đầu tiên. Điều này giữ card ít nhiễu và tránh làm lộ nội dung không cần thiết. Project public hiện đã bắt buộc summary khi publish; fallback description vẫn cần để xử lý dữ liệu legacy.

Project có nội dung song ngữ (`project_locales`), nhưng OG v1 dùng canonical/primary text. Không suy đoán locale của crawler và không thêm query `lang` ở phase này. Khi locale OG được yêu cầu, phải thêm locale vào **cả** page canonical/alternate policy lẫn cache key.

`revision` phải đổi khi owner đổi tên hoặc nhãn/active state taxonomy đổi, dù `projects.updated_at` giữ nguyên. Logo upload hiện tạo path UUID mới và `upsert: false`; chỉ dùng path đã lưu vào project. Nếu sau này cho overwrite cùng path, cần đưa checksum bytes/object version vào revision. Không đưa nội dung private vào nguồn hash. `ProjectOGData` dành cho bước render; metadata op dùng cùng DTO text và logo path nhưng bỏ bước tải `logoDataUrl`.

## ProjectOG visual contract

Layout hướng GitHub, không cố sao chép Tailwind/browser CSS:

```text
CORELIA / PROJECT                                      [logo | Corelia mark]

Project name (tối đa 2 dòng)
Short summary (tối đa 3 dòng)

[Solana] [AI] [Security]

Owner name                                      corelia.academy
```

- Nền tối, khối surface hơi sáng, border mảnh; accent dùng Corelia primary token từ `src/styles/brand-palette.css` được sao chép có chủ đích vào `theme.ts`.
- `ProjectOG` chỉ dùng inline style được Satori hỗ trợ (`display:flex`, padding, gap, border, font, overflow); không dùng class Tailwind, `<style>`, grid, filter hay pseudo-state.
- Dành chỗ logo `144×144`. Có logo thì `objectFit: contain`; không có hoặc không tải được thì render monogram 2 ký tự đầu của `name` trên surface, tuyệt đối không fail toàn ảnh.
- Clamp ở lớp data trước khi render; không phụ thuộc `line-clamp` CSS. Summary dài bị cắt bằng ellipsis chuẩn hoá, tag vượt giới hạn bị bỏ.
- Không render emoji hoặc icon font. Dùng text/shape SVG đơn giản nếu cần để tránh glyph thiếu font.

## Endpoint và metadata contract

### Image

`GET` và `HEAD /api/og/project/:slug?v=<content-revision>` trả khi project còn public và `v` khớp revision hiện tại:

```http
200 OK
Content-Type: image/png
Cache-Control: no-store
X-Content-Type-Options: nosniff
ETag: "project-og-<project-id>-<content-revision>"
```

`v` không quyết định data và không được đưa vào query DB. Sau khi query public-only, so sánh `v` với revision hiện tại; thiếu/sai `v` trả `404` cùng response shape với unavailable, không render và không tạo cache key tùy ý. Cả Worker lẫn Edge Function không cache HTML, metadata hay PNG chứa entity data; không cấu hình Cloudflare Cache Rule override `no-store`. Đây là yêu cầu để URL cũ ngừng phục vụ nội dung khi project chuyển private/blocked/deleted. Social platform có thể giữ bản sao đã lấy trước đó ngoài quyền kiểm soát của Corelia. ETag chỉ dùng cho chẩn đoán; không trả `304` từ cache cũ trước khi kiểm tra lại quyền public và revision. PNG response không chứa CORS header vì nó là image public, không phải browser API.

Sai method trả `405` với `Allow: GET, HEAD`; slug malformed, unavailable, revision không khớp hoặc renderer không có DTO công khai trả `404` với `no-store`. `HEAD` kiểm tra public/revision, trả success headers như `GET` khi dữ liệu hợp lệ nhưng không render PNG/body; lỗi chỉ xảy ra lúc render có thể chỉ xuất hiện ở `GET` và preview phải xử lý `<img onError>`. Nếu renderer/runtime hỏng sau khi data đã hợp lệ, trả `500` text `no-store`, log cấu trúc `{ route, slug, projectId?, stage }` và không log project text, signed URL hay binary data.

### Document metadata

`index.html` hiện có generic `og:image` và `twitter:card`, nhưng `usePageMeta` chỉ chạy sau hydration. Share crawler thường không chạy React, nên **không** coi hook này là hoàn tất OG.

Với mỗi detail route đã được cho phép trong bảng policy (ví dụ `GET /projects/:slug`), Worker gọi metadata op tương ứng khi asset response là HTML rồi dùng `HTMLRewriter` để thay các thẻ đã có, kể cả khi share bot gửi `Accept: */*`:

- `title`, `meta[name=description]`
- `meta[property=og:title]`, `og:description`, `og:url`, `og:image`, `og:image:alt`
- `meta[name=twitter:card]` = `summary_large_image`
- `meta[name=twitter:title]`, `twitter:description`, `twitter:image`
- canonical link = public project URL; `index.html` hiện chưa có canonical link nên chèn đúng một `<link rel="canonical">` vào `<head>` (hoặc thêm một tag nền vào `index.html` rồi thay nó)

`og:image` phải là absolute URL cùng origin, ví dụ:

```text
https://app.corelia.academy/api/og/project/custos?v=<content-revision>
```

Các trang detail có OG động không ghi đè `og:image` hoặc `twitter:image` bằng thumbnail, cover hay avatar trong `usePageMeta` sau khi React tải xong; Worker đã đặt URL ảnh OG canonical trong HTML ban đầu.

Nếu metadata lookup trả 404 hoặc lỗi, Worker trả SPA HTML nguyên bản với generic site metadata; không inject slug/raw request into HTML và không gắn `X-Robots-Tag: noindex` lên route công khai. Lỗi backend tạm thời được log. Cả HTML đã rewrite và fallback trên detail route đều trả `Cache-Control: no-store` để không giữ metadata của project vừa chuyển private/blocked. Worker chỉ rewrite response HTML thành công của `ASSETS.fetch`, không rewrite asset, non-HTML response, hay route admin. Không tạo duplicate tag và không dùng Host/request origin để dựng canonical/OG URL.

## Preview để kiểm tra khi sửa

OG cần có nơi preview nội bộ để người sửa content nhìn được card thực tế trước khi chia sẻ. Preview **không** là OG editor: không nhận `title`, `image`, màu hay raw JSX qua query string, và không tạo pipeline render thứ hai.

### Surface cần có

**Admin OG Preview:** route nội bộ `/admin/og-preview`, chỉ `admin` và `support_staff` qua `RequireRole roles={ROLE_GROUPS.admin}`, để QA các entity public theo loại + canonical ID/slug. Worker trả `X-Robots-Tag: noindex, nofollow` ngay trên HTML response route này; React có thể đặt thêm meta robots sau hydration nhưng không thay thế response header. Worker không inject OG động và route không là một public share target.

Trang dùng chung `OgImagePreview` khi từng entity có OG policy trong bảng route policy. Không thêm preview vào entity editor, account, draft hay private page.

### Hành vi preview

- Render bằng thẻ `<img>` trỏ trực tiếp đến `imageUrl` từ public metadata route `/api/og/<entity>/<id>/meta`; không screenshot DOM và không gọi Satori từ browser.
- Hiển thị ở tỷ lệ vừa màn hình nhưng giữ `aspect-ratio: 1200 / 630`; có toggle nền sáng/tối xung quanh card để kiểm tra edge/border, không thay đổi PNG.
- Có link mở public page và link mở raw PNG trong tab mới. Admin screen có thêm metadata đọc-only: canonical URL, image URL, `updatedAt`, `revision`, HTTP status và `Content-Type` của image (`HEAD` cùng origin, không cần CORS).
- Nút “Làm mới preview” chỉ refetch metadata `no-store` để lấy revision hiện tại. Không tự thêm timestamp ngẫu nhiên vì sẽ che lỗi versioning và tạo URL vô hạn.
- Nếu entity chưa lưu, không public hoặc OG endpoint trả 404, hiển thị empty state giải thích điều kiện thay vì generic image. Nếu image trả lỗi, hiện retry + link diagnostic cho admin; không render raw error từ backend vào page.

### Acceptance bổ sung cho preview

- [ ] Chọn một project public trong `/admin/og-preview` hiển thị đúng URL revision hiện tại sau khi metadata được refetch.
- [ ] Preview trong trang QA và raw image URL có cùng pixel content; card không dùng dữ liệu draft chưa lưu.
- [ ] `/admin/og-preview` bị chặn với user thường/anon, có `noindex`, và không hiển thị private/unlisted/blocked entity.
- [ ] Preview layout đúng 1200:630 ở mọi viewport, có accessible alt text và thao tác copy/open hoạt động.

## Bảo mật và giới hạn

1. Chỉ `visibility='public' AND blocked=false` được query bằng service role. Đây là business rule riêng, không dựa vào RLS anon vốn hiện cho public **và unlisted** đọc.
2. Dùng canonical slug từ row sau khi query; lower-case/trim input, reject slug quá 160 ký tự trước query. Không follow redirect slug-history và không nhận UUID ở endpoint công khai này.
3. Không expose `SUPABASE_SECRET_KEYS`, publishable key cũng không cần ở Worker, và `OG_PROXY_SECRET` chỉ là server secret (Cloudflare secret + Supabase Edge secret).
4. Logo được đọc server-side từ known storage prefix, giới hạn kích thước (khuyến nghị 2 MiB), MIME và timeout; không để Satori/Resvg fetch arbitrary `logo_path` hay user-provided remote URL.
5. Sanitize theo mục đích plain-text: remove NUL/control, normalize whitespace và bound length. Không parse/render project Markdown/HTML trong OG.
6. Rate-limit theo IP/route ở Worker để giảm render và lookup lặp lại; không cache response entity hoặc `404` vì trạng thái public có thể đổi bất cứ lúc nào. Giới hạn request vào image/meta route và giữ rendering timeout/byte cap riêng. Không dùng query `v` không kiểm soát để tạo cache key.

## Triển khai local

Đã triển khai cả bốn entity. `worker/og.ts` giữ public route và HTML rewrite; `corelia-api/og/` đọc DTO public, tính revision từ nội dung card, tải media nội bộ và render PNG. Course dùng slug canonical, `/courses/:id` là alias. Profile dựng avatar từ `avatar_seed`/`avatar_config` public bằng cùng thư viện Humation mà app dùng, với `id` làm seed mặc định; revision đổi khi cấu hình avatar đổi. Avatar profile và monogram fallback đều được cắt tròn trong OG, khớp avatar trên trang profile. Nếu dựng avatar lỗi, chỉ ảnh Storage nội bộ đã xác thực mới được dùng làm fallback, sau đó mới tới monogram; không fetch avatar URL ngoài. Ngày hackathon luôn định dạng theo `Asia/Ho_Chi_Minh`. Card dùng cùng nền ảnh xanh, logo trắng, palette, font, header và đường phân cách của email template. PNG không in URL hay nút mở trang; URL canonical chỉ nằm trong HTML metadata và giao diện admin preview. `OG_TEMPLATE_REVISION` đổi khi thay đổi thiết kế card để URL ảnh cũ hết hiệu lực.

Text được làm sạch và giới hạn ở DTO (title 96 ký tự, description 180 ký tự, detail 48 ký tự, tối đa 3 tag 32 ký tự). Renderer giảm cỡ chữ theo độ dài và dành tối đa ba dòng cho title/description; phần vượt giới hạn có dấu ba chấm từ bước chuẩn hoá. Monogram bỏ dấu để không cắt glyph tiếng Việt. Trang admin hiển thị `/corelia-og-default-background.png` mặc định khi chưa chọn entity; asset PNG 1200×630 này chỉ có logo trắng Corelia ở giữa trên nền ảnh xanh đen của email template, khác bố cục card entity, và được dùng cho metadata website chung. Tên asset mới tránh dùng lại URL ảnh cũ đã có thể được trình duyệt hoặc crawler lưu cache.

1. Chạy Supabase local theo `supabase/AGENTS.md`. Copy `supabase/functions/.env.example` thành file `.env` được ignore và đặt `OG_PROXY_SECRET` cùng `CORELIA_APP_ORIGIN=http://localhost:5173`; giữ các biến Edge Function khác theo môi trường local.
2. Copy `.dev.vars.example` thành `.dev.vars` được ignore. Đặt cùng `OG_PROXY_SECRET`, `CORELIA_OG_FUNCTION_URL=http://127.0.0.1:54321/functions/v1/corelia-api`, và `CORELIA_APP_ORIGIN=http://localhost:5173`. Không đưa secret vào `VITE_*`.
3. Chạy `pnpm functions:serve` rồi `pnpm dev`; dùng `http://localhost:5173`. Nếu 5173 đang bận, dừng process cũ trước khi kiểm thử để canonical URL và origin local trùng nhau.
4. Thử `GET /api/og/project/:slug/meta`, lấy `imageUrl` rồi thử `GET` và `HEAD` trên ảnh. Các entity còn lại dùng `course`, `hackathon`, `profile` trong endpoint. Mở `/admin/og-preview` bằng tài khoản thuộc `ROLE_GROUPS.admin` để kiểm tra ảnh thực tế.
5. Thử lại URL ảnh cũ sau khi chuyển entity sang private/draft/archived: phải trả `404`. Sửa field hiển thị trên card rồi lấy metadata mới: `revision` phải đổi và URL revision cũ trả `404`.

Worker cần `OG_RATE_LIMITER` binding. Cấu hình `wrangler.jsonc` đã khai báo binding và origin/function URL cố định cho production/staging; `OG_PROXY_SECRET` phải là secret tương ứng ở cả Cloudflare và Supabase khi triển khai remote. Staging đã được kiểm tra với metadata và PNG thật; bot có thể vẫn bị Cloudflare Bot Fight Mode challenge trước khi đến Worker.

## Kết quả kiểm thử local

- Bốn endpoint metadata, PNG 1200×630 và `HEAD` đã chạy qua Supabase local + Vite Worker.
- HTML của bốn detail route có OG/Twitter metadata trước hydration và một canonical tag; profile `/@handle` và dạng asset server chuẩn hóa `/%40handle` đều được xử lý.
- Project chuyển public → private làm metadata và URL ảnh revision cũ trả `404`; sửa title tạo revision mới.
- Preview admin có `X-Robots-Tag: noindex, nofollow`; rate limit được kiểm bằng binding mô phỏng trong unit test.
