# Cutover: landing tại `corelia.academy`, app tại `corelia.academy/learn`

Runbook cho lần chuyển từ `app.corelia.academy` (SPA ở gốc domain) và landing Netlify sang mô hình mới:

| Đường dẫn | Worker | Nguồn |
| --- | --- | --- |
| `corelia.academy/*` | `corelia-landing` | `landing/` (Astro + `@astrojs/cloudflare`) |
| `corelia.academy/learn*` | `corelia-app` | gốc repo (Vite SPA, `base: /learn/`) |
| `app.corelia.academy/*` | — | Redirect Rule 301 sang `corelia.academy/learn/*` |

Staging tương tự với `staging.corelia.academy` và các Worker `corelia-landing-staging`, `corelia-staging`.

Code đã sẵn sàng trên nhánh làm việc; **không merge vào `staging`/`main` trước khi các bước chuẩn bị bên dưới xong**. Merge đồng nghĩa với cutover: app build ra chỉ phục vụ dưới `/learn`, migration đổi `corelia_app_base_url`, email và link chứng chỉ trỏ sang `/learn`.

## 1. Chuẩn bị (không ảnh hưởng người dùng)

1. **Repo landing cũ**: tạo tag `pre-monorepo` trên `corelia-academy/corelia-landing@main` (lịch sử đầy đủ nằm ở đó; monorepo nhập dạng squash từ `632e589`). Giữ site Netlify chạy cho tới khi cutover ổn định.
2. **Cloudflare Worker landing** (Workers & Pages → Create → Import repository `corelia-app`):
   - Root directory: `landing`
   - Build command: `pnpm install --frozen-lockfile && pnpm build`
   - Deploy command: production `npx wrangler deploy -c wrangler.jsonc`, staging `npx wrangler deploy -c wrangler.jsonc --env staging` (luôn có `-c`: gốc repo có cấu hình Wrangler riêng).
   - Biến build (public): `PUBLIC_SITE_URL`, `PUBLIC_APP_URL=/learn`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` của đúng môi trường (xem `landing/.env.example`).
   - Kiểm tra bản deploy trên `*.workers.dev`: trang chủ, `/vi`, `/courses`, `/vi/courses/<slug>`, `/jobs/<slug>`, `/sitemap-catalog.xml`, một URL lạ trả 404.
3. **Supabase Auth** (Staging rồi Production) → URL Configuration:
   - Thêm vào Redirect URLs: `https://corelia.academy/learn/**` (staging: `https://staging.corelia.academy/learn/**`). Giữ URL cũ cho tới khi xong.
   - Site URL đổi ở bước cutover.
4. **Supabase Edge Function secrets** (đặt trước khi deploy function mới):
   - `CORELIA_APP_ORIGIN=https://corelia.academy` (staging: `https://staging.corelia.academy`)
   - `CORELIA_APP_BASE_PATH=/learn`
   - `APP_URL=https://corelia.academy/learn` (staging tương ứng)
   - `CORELIA_CORS_ALLOWED_ORIGINS`: thêm `https://corelia.academy`.
5. **OCID**: đăng ký thêm redirect URI `https://corelia.academy/learn/ocid-redirect` (và bản staging); cập nhật biến build `VITE_OCID_REDIRECT_URI` của Worker app trên Cloudflare cho nhánh tương ứng.
6. **Redirect Rule cho domain cũ** (Rules → Redirect Rules, zone `corelia.academy`), tạo ở trạng thái tắt, theo thứ tự:
   1. `http.host eq "app.corelia.academy" and (http.request.uri.path eq "/learn" or starts_with(http.request.uri.path, "/learn/"))` → Dynamic, `concat("https://corelia.academy/learn/study", substring(http.request.uri.path, 6))`, 301, giữ query string. (Trình học cũ `/learn/:courseId` nay là `/learn/study/:courseId`.)
   2. `http.host eq "app.corelia.academy"` → Dynamic, `concat("https://corelia.academy/learn", http.request.uri.path)`, 301, giữ query string.

## 2. Cutover Staging

1. Merge nhánh làm việc vào `staging`. `Deploy Staging` tự chạy (migration `move_app_base_url_under_learn` + Edge Functions); Cloudflare tự build Worker `corelia-staging` (route `staging.corelia.academy/learn*` do `scripts/deploy/worker-target.mjs` đặt) và Worker landing staging.
2. Chuyển hostname `staging.corelia.academy` cho landing: gắn route `staging.corelia.academy/*` vào `corelia-landing-staging` (dùng route thay vì Custom Domain cho cả hai Worker trên cùng hostname, để route cụ thể hơn `/learn*` quyết định Worker app; kiểm tra lại bằng request thật sau khi gắn). Gỡ Custom Domain cũ của `corelia-staging`.
3. Đổi Supabase Site URL của Staging thành `https://staging.corelia.academy/learn`.
4. Kiểm tra (mục 4).

## 3. Cutover Production

1. Merge `staging` → `main` qua PR như thường lệ. Cloudflare build Worker `corelia-app` với route `corelia.academy/learn*`.
2. DNS `corelia.academy`: chuyển từ Netlify sang proxied qua Cloudflare; gắn route `corelia.academy/*` cho `corelia-landing`.
3. Bật hai Redirect Rule ở bước 1.6. Gỡ Custom Domain `app.corelia.academy` khỏi Worker app nhưng giữ một bản ghi DNS proxied cho `app.corelia.academy`, vì Redirect Rule chỉ chạy với traffic đi qua Cloudflare.
4. Dispatch `Deploy Production` từ `main` (migration + Edge Functions) và theo dõi tới khi xanh.
5. Đổi Supabase Site URL Production thành `https://corelia.academy/learn`.
6. Thông báo người dùng: session đăng nhập lưu theo origin nên mọi người phải đăng nhập lại một lần.

## 4. Kiểm tra sau cutover

- `curl -I https://app.corelia.academy/courses/x?ref=1` → 301 tới `https://corelia.academy/learn/courses/x?ref=1`; `/learn/abc/lesson/1` → `/learn/study/abc/lesson/1`.
- `https://corelia.academy/learn/` tải app, đăng nhập/đăng ký/quên mật khẩu/OCID hoạt động, deep link `/learn/study/...` mở đúng bài.
- HTML của app có `noindex` (thẻ meta và header `X-Robots-Tag` trên các response qua Worker).
- Landing: `view-source` trang `/courses/<slug>`, `/vi/courses/<slug>`, `/jobs/<slug>` có title, description, canonical, hreflang, JSON-LD và nội dung thật; Rich Results Test cho Course/JobPosting/Event.
- Email: link xác thực chứng chỉ (`/learn/verify/...`), claim (`/learn/claim?token=`), learning reminder (`/learn/study/<slug>`).
- Search Console: thêm property `corelia.academy`, submit `sitemap-index.xml` và `sitemap-catalog.xml`; dùng Change of Address từ `app.corelia.academy`.
- Sau khi ổn định: Archive repo `corelia-landing`, tắt site Netlify.

## Rollback

- **Landing**: trỏ DNS `corelia.academy` về Netlify (site cũ vẫn chạy) và gỡ route `corelia.academy/*`.
- **App**: tắt hai Redirect Rule, gắn lại Custom Domain `app.corelia.academy` cho một bản deploy của Worker app từ commit trước khi merge (Cloudflare → Deployments → Rollback), gỡ route `corelia.academy/learn*`.
- **Database**: `corelia_app_base_url` đổi lại trong Admin → Branding (giá trị cũ `https://app.corelia.academy`); không sửa migration đã apply.
- **Edge secrets**: khôi phục `CORELIA_APP_ORIGIN`/`APP_URL` cũ và bỏ `CORELIA_APP_BASE_PATH`, deploy lại Edge Functions.
