# Chuyển hệ thống avatar sang Humation

**Trạng thái:** đã triển khai trong worktree local; chưa phát hành staging/production. Tài liệu dưới đây giữ các quyết định kiến trúc và checklist rollout.

## Mục tiêu và phạm vi

- Avatar mặc định sinh từ `user.id`; cùng seed, cấu hình và phiên bản asset cho cùng SVG.
- Người dùng có thể tạo seed mới, chọn bộ phận, đổi màu, xem trước và lưu. Chỉ lưu seed/cấu hình, không lưu SVG hoặc PNG.
- Có URL công khai `GET /avatar/:username.svg` trả SVG với cache ngắn.
- Đóng gói manifest để sau này thay Humation 1 bằng asset pack của Corelia.

Đợt đầu dùng `@humation/assets-humation-1`. Việc **vẽ và đưa asset pack riêng vào production** là đợt sau, sau khi luồng trên chạy ổn; đợt đầu chỉ chuẩn bị ranh giới thay pack.

## Hiện trạng cần thay

| Phần | Hiện tại | Hướng chuyển |
|---|---|---|
| Sinh avatar | `src/lib/avatar.ts` gọi Multiavatar, fallback từ `avatar_seed ?? user.id` | Adapter Humation dùng cùng quy tắc seed |
| Hiển thị | `src/components/UserAvatar.tsx` ưu tiên `avatar_url` tải lên rồi đến SVG sinh | Giữ component dùng chung và API kích thước/fallback; chuyển renderer sang Humation. Bỏ lựa chọn tải ảnh mới trong editor |
| Chỉnh sửa | `/account/profile` cho tải ảnh hoặc randomize rồi lưu seed | Chuyển điều khiển avatar sang `/settings/avatar`; trang hồ sơ dẫn đến editor |
| Dữ liệu | `profiles` và `public_profiles` đã có `avatar_seed uuid`, `avatar_url` | Giữ `avatar_seed uuid`, thêm `avatar_config jsonb` ở cả hai bảng; đồng bộ qua `internal.sync_public_profile()` |
| Public URL | Chưa có URL SVG avatar | Cloudflare Worker nhận `/avatar/:username.svg`, lấy SVG từ API công khai |

Các dữ liệu feed, profile, project, social và các danh sách khác hiện dùng `UserAvatar`, `avatar_seed` hoặc `avatar_url`. Khi triển khai, rà soát các projection/RPC và `src/lib/publicProfileAvatars.ts` để mọi nơi nhận cả `avatar_config`, tránh mỗi màn hình hiển thị một avatar khác nhau. Không sửa các primitive `src/components/ui/avatar.tsx` chỉ vì đổi engine.

## Gói và renderer

Trong repo dùng pnpm: `pnpm add @humation/core @humation/react @humation/assets-humation-1`, cập nhật `pnpm-lock.yaml`. Xác nhận phiên bản và Deno/Worker bundle khi triển khai. Chỉ gỡ `@multiavatar/multiavatar` sau khi đã chuyển hết consumer.

Adapter dùng chung cho logic seed, chuẩn hóa cấu hình và manifest nằm ở `shared/`. `src/components/UserAvatar.tsx` giữ API kích thước/fallback và hiển thị SVG từ Humation core; editor dùng `<Avatar assets={avatarAssets} seed={seed} selections={...} colors={...} />` của `@humation/react`. Renderer server dùng `createAvatar(avatarAssets, { seed, selections, colors }).toString()`; endpoint không dùng React để tạo SVG.

`selections` ghi đè từng slot của seed, các slot không chọn vẫn do seed quyết định. Theo manifest Humation 1, slot bộ phận là `head`, `body`, `bottom`, `item`, `glasses`; nhóm màu là `hair`, `clothes`, `bottom`, `skin`, `stroke`, `background`. Editor lấy danh sách phần từ manifest qua `getPartsForSlot()`; không hardcode ID tùy đoán. Màu dùng hex được renderer hỗ trợ. Nếu có option “không đeo”/“không cầm”, xác nhận giá trị hợp lệ từ manifest trước khi đưa vào UI.

## Mô hình dữ liệu

```ts
type AvatarConfig = {
  selections: Record<string, string>;
  colors: Record<string, string>;
};

type SavedAvatar = {
  avatar_seed: string | null; // cột uuid hiện có; null nghĩa là dùng profile.id
  avatar_config: AvatarConfig; // jsonb, mặc định { selections: {}, colors: {} }
};
```

`avatar_seed = user.id` là **quy tắc đọc**, không cần backfill mọi profile. Giữ seed cũ để người dùng đã randomize không tự đổi avatar khi chuyển engine. Seed cũ sẽ cho hình Humation khác Multiavatar; đây là một phần của việc thay hệ thống. Khi nhấn Randomize dùng `crypto.randomUUID()` trong bản nháp; chỉ ghi DB khi nhấn Save. Nút khôi phục mặc định có thể lưu `avatar_seed = null` và cấu hình rỗng.

Migration mới thêm `avatar_config jsonb` vào `public.profiles` và `public.public_profiles`, cập nhật trigger đồng bộ hiện có và backfill giá trị rỗng cho hàng cũ. Dùng ràng buộc/validation để dữ liệu luôn là object có `selections` và `colors` dạng object; kiểm tra độ dài payload. `public_profiles` chỉ chứa cấu hình avatar công khai, không kéo thêm dữ liệu profile riêng tư. Cập nhật `Profile`, `PublicProfile`, insert/update types, mapper, các select tường minh và cache keys liên quan.

Không xóa ngay `avatar_url`, ảnh trong Storage hoặc seed cũ. Đợt chuyển đổi không cho tải ảnh mới và renderer mới ưu tiên Humation; dữ liệu ảnh cũ được giữ để có thể đối chiếu/khôi phục trong giai đoạn rollout. Sau nghiệm thu mới lập migration dọn cột và quy trình dọn Storage riêng.

## Editor và lưu

- Route có guard đăng nhập: `/settings/avatar`; thêm link từ `/account/profile` và menu cài đặt hiện có.
- Preview dùng bản nháp riêng, không ghi DB khi chọn part/màu hoặc randomize. Tải lại trang trước Save vẫn cho avatar đã lưu.
- Cho chọn head/hair, body, bottom nếu cần, item/accessory, glasses và các màu manifest hỗ trợ. Hiển thị phần đã chọn; có cách bỏ override của từng slot để quay về phần theo seed.
- Save thành công mới refresh profile/auth store và invalidate các query hiển thị avatar; lỗi giữ nguyên bản nháp và thông báo cho người dùng. Có trạng thái đang lưu và hỗ trợ bàn phím, nhãn truy cập, i18n Việt/Anh.

Hợp đồng HTTP mong muốn:

```http
PATCH /api/me/avatar
Authorization: Bearer <access token>
Content-Type: application/json

{"seed":"<uuid>","selections":{},"colors":{}}
```

Cloudflare Worker chuyển route này đến một operation có bảo vệ của `corelia-api`. Worker chỉ chuyển tiếp Bearer token và nội dung cần thiết; không tự tin các trường id/username trong body. Handler phải **xác thực JWT thực sự và lấy user id từ token**. Kiểm tra seed là UUID, giới hạn kích thước body, chỉ nhận slot/part ID có trong manifest và màu hex hợp lệ, rồi cập nhật đúng hàng `profiles.id = auth user id`. Không chỉ dựa vào việc có Bearer header: `corelia-api` đang tắt gateway `verify_jwt` và có cả public/protected operation. Trả cấu hình chuẩn hóa để UI cập nhật từ kết quả lưu. Giữ chính sách RLS hiện tại cho client và kiểm tra đường ghi mới cùng trigger đồng bộ `public_profiles`.

## Public SVG

```text
GET /avatar/:username.svg
  → Cloudflare Worker (đứng trước SPA fallback)
  → public avatar operation trong corelia-api
  → tra public_profiles bằng username
  → render @humation/core từ id + avatar_seed + avatar_config
  → image/svg+xml
```

Worker hiện chỉ phục vụ assets/SPA, nên route `/avatar/` phải được xử lý trước `env.ASSETS.fetch()`. Tránh đưa URL Supabase hoặc key vào public URL. Backend chỉ đọc dữ liệu được phép công khai; với `profile_public = false`, username không tồn tại hoặc không hợp lệ, trả 404. Username phải được giải mã, chuẩn hóa và kiểm tra theo quy tắc hiện tại; `.svg` là phần mở rộng route, không thuộc username. SVG được render từ asset tin cậy và input đã allowlist, không nhúng text/URL do người dùng nhập.

Trả `Content-Type: image/svg+xml; charset=utf-8`, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=60, s-maxage=60`; nếu dùng Cloudflare Cache API, key gồm hostname + username chuẩn hóa và TTL tối đa 60 giây. 404/private dùng cache rất ngắn hoặc `no-store` để không giữ trạng thái sau khi người dùng đổi quyền/username. Có thể bổ sung ETag từ `updated_at` hoặc hash cấu hình sau khi flow hoạt động. Kiểm tra endpoint trả SVG thực, không trả `index.html` của SPA; thay đổi avatar hoặc username sẽ phản ánh trong tối đa 60 giây. Cần cập nhật cả endpoint ảnh OG dùng avatar nếu nó còn phụ thuộc `avatar_url`.

## Chuẩn bị custom assets

Tạo ranh giới `avatar-assets/` hoặc module manifest tương đương; renderer và editor nhận manifest qua một export duy nhất thay vì import `humation1` rải rác. Asset pack sau này dự kiến có `head/`, `body/`, `item/`, `glasses/`, `manifest.ts`; bổ sung `bottom`/background theo schema Humation được kiểm tra tại thời điểm tạo pack. Mục tiêu thiết kế: 10 heads, 8 bodies, 15 accessories, 6 glasses, 10 backgrounds; nét viền dày, hình bo tròn, màu phẳng, mặt tối giản, phụ kiện dễ thương.

Trước khi đổi manifest phải kiểm tra khả năng ánh xạ `selections` cũ: giữ alias/ID tương thích, chuyển dữ liệu có kiểm chứng, hoặc bỏ override không còn hợp lệ để dùng phần theo seed. Cố định phiên bản asset/renderer trong lockfile; thay đổi phiên bản có thể làm hình từ cùng seed thay đổi nên cần visual regression trước rollout.

## Thứ tự triển khai và nghiệm thu

1. Thêm gói, adapter và migration `avatar_config`; kiểm tra sync sang `public_profiles` và quyền đọc/ghi.
2. Chuyển `UserAvatar` và mọi nguồn dữ liệu đang cấp avatar; thêm editor và Save API. Kiểm tra các avatar trong header, profile, feed, project, instructor và các danh sách liên quan.
3. Thêm public SVG ở API + Worker, cache và kiểm tra domain staging thực tế.
4. Sau khi các đường trên ổn định, tạo asset pack riêng theo mục tiêu nêu trên và chuyển manifest bằng migration/compatibility plan riêng.

Điều kiện nghiệm thu đợt đầu: cùng id/seed/config/phiên bản pack cho SVG giống nhau; hai seed khác nhau thường cho hình khác; randomize chỉ đổi bản nháp đến khi Save; chọn/bỏ chọn part và màu sống qua reload; lỗi lưu không mất bản nháp; người khác không thể sửa avatar; username public trả SVG và private/không tồn tại trả 404; cache hết hạn sau cập nhật; không ghi image vào DB/Storage. Chạy test mục tiêu, `pnpm db:verify`, stack cục bộ `pnpm db:verify:local` khi có migration, lint/build và các gate release tương ứng nếu phát hành từ xa.

## Tham chiếu

- [Humation README](https://github.com/humation-labs/humation): API React/core, seed, manifest slot và lưu trạng thái.
- [Quy trình release Corelia](../RELEASE_PROCESS.md) và [quy tắc Supabase](../../supabase/AGENTS.md).
