# Activity Feed + Follow System — Runtime QA handoff

Issue: #96  
Branch: `fix/activity-feed-follow-system`  
Ngày cập nhật: 2026-05-28

## Mục tiêu của file này

File này dùng để tester kiểm tra phần **runtime/UI** của Activity Feed + Follow System sau khi code đã qua build, lint, unit test và smoke DB.

Điểm quan trọng: feed là luồng social/public, tách biệt với `user_notifications`. Nếu runtime sai, user có thể:

- Không thấy activity của người/entity đang follow.
- Bị redirect sai route như `/feed` thành `/u/feed`.
- Thấy link sai sang profile/hackathon/project.
- Tưởng đã đăng ký hackathon nhưng refresh lại mất trạng thái.
- Thấy badge feed trộn nhầm với notification cá nhân.
- Không nhận realtime indicator dù DB đã có event mới.

## Đề xuất cách test

**Khuyến nghị chính: deploy nhánh này lên staging rồi test trên staging.**

Lý do:

- Feature phụ thuộc Supabase Auth, RLS, Realtime, migration và dữ liệu public/private.
- Staging gần môi trường thật hơn local: domain, env vars, cache frontend, migration order, realtime websocket.
- Tester không cần setup Docker/Supabase local phức tạp.
- Dễ chụp bug report theo URL thật và build đang deploy.

**Local branch checkout chỉ nên dùng khi:**

- Staging chưa deploy được.
- Dev cần reproduce nhanh một bug cụ thể.
- Cần seed demo data bằng script local cố định.
- Tester là kỹ thuật và có Docker + pnpm + Supabase CLI.

## Luồng khuyến nghị

1. Dev push branch `fix/activity-feed-follow-system` lên remote.
2. Deploy branch đó lên staging hoặc tạo preview environment.
3. Tester mở staging, hard reload, xác nhận build đúng.
4. Tester chạy checklist runtime trong file này.
5. Nếu fail, ghi Actual/Error vào từng mục và tạo bug report.
6. Chỉ close issue khi các mục Must pass đều đạt hoặc đã có quyết định scope rõ ràng.

## Trạng thái đã verify trước runtime

Các mục dưới đây đã verify bằng code/DB/API, không thay thế cho test tay UI:

| Nhóm | Trạng thái | Kết quả dự đoán | Actual/Error |
|---|---|---|---|
| `pnpm build` | Pass | Build production thành công, chỉ còn warning chunk/dynamic import cũ nếu có | |
| `pnpm test` | Pass | `21 passed` | |
| Targeted ESLint | Pass | Không lỗi trên feed/follow files | |
| DB smoke rollback | Pass | `activity feed smoke test passed` | |
| Demo seed local | Pass | Tạo được feed-demo users/data | |
| Auth API demo login | Pass | Student 1 login trả access token | |
| Feed RPC | Pass | `get_feed_v1` trả events liên quan followed subjects | |
| Follower RPC | Pass | `list_followers_v1` trả follower public | |
| Follow/unfollow RLS | Pass | Current user insert/delete row của mình được | |
| Realtime ping data path | Pass | Ping event xuất hiện đầu `get_feed_v1` | |
| Bundling unit test | Pass | Completed lessons/followed users bundle đúng, heart milestones không bundle | |

## Cách A — Test trên staging/preview (khuyến nghị)

### A.1 Dev chuẩn bị staging

Owner/dev cần làm các bước này trước khi giao tester:

```bash
git status --short --branch
git push origin fix/activity-feed-follow-system
```

Expected output:

```text
## fix/activity-feed-follow-system...origin/fix/activity-feed-follow-system
```

Hoặc nếu branch ahead local:

```text
## fix/activity-feed-follow-system...origin/fix/activity-feed-follow-system [ahead N]
```

thì phải push trước khi tester có thể fetch/test nhánh remote.

Sau đó deploy:

- Backend staging: apply migration Supabase của branch này.
- Frontend staging/preview: deploy bundle từ cùng commit.
- Ghi lại URL staging/preview và commit SHA dùng để test.

Thông tin cần điền:

| Trường | Giá trị |
|---|---|
| Staging/preview URL | |
| Commit SHA deploy | |
| Backend migration applied lúc | |
| Frontend deploy lúc | |
| Người deploy | |

### A.2 Tester xác nhận build đúng

Vì frontend có cache, bước này bắt buộc.

1. Mở staging/preview URL.
2. Hard reload: `Ctrl+Shift+R`.
3. Mở DevTools Console.
4. Chạy:

```js
window.__CORELIA_BUILD__
```

Expected:

- Có object build info.
- `version` đúng với `package.json`.
- Commit/build time khớp deploy note nếu app expose.
- Footer/app version không phải app cũ.

Actual/Error:

```text

```

Nếu thấy version cũ hoặc không có build info:

```text
BLOCKED: Chưa test tiếp. Cần redeploy hoặc clear cache/CDN.
```

### A.3 Tester chuẩn bị tài khoản staging

Tối thiểu cần:

| Account | Mục đích | Email/handle | Ready? | Ghi chú lỗi |
|---|---|---|---|---|
| Student 1 | Viewer/follower chính | | | |
| Student 2 | Actor tạo activity | | | |
| Instructor 1 | Tạo course/hackathon nếu cần | | | |

Dữ liệu tối thiểu:

| Entity | Điều kiện | URL/ID | Ready? | Ghi chú lỗi |
|---|---|---|---|---|
| User profile Student 2 | `profile_public = true` | | | |
| Course | Published | | | |
| Hackathon | Published/running/ended | | | |
| Project | Public | | | |

## Cách B — Test local bằng branch hiện tại

Dùng cách này khi staging chưa sẵn sàng hoặc cần reproduce bằng demo seed.

### B.1 Lấy code từ branch về máy tester

Nếu tester chưa có repo:

```powershell
git clone <repo-url> corelia-app
cd corelia-app
git fetch origin
git switch fix/activity-feed-follow-system
```

Nếu tester đã có repo:

```powershell
cd C:\path\to\corelia-app
git fetch origin
git switch fix/activity-feed-follow-system
git pull --ff-only origin fix/activity-feed-follow-system
```

Expected output:

```text
Switched to branch 'fix/activity-feed-follow-system'
Already up to date.
```

hoặc:

```text
Updating <old>..<new>
Fast-forward
```

Actual/Error:

```text

```

Nếu lỗi `pathspec ... did not match`, branch chưa được push hoặc tên branch sai. Dừng test và yêu cầu dev push branch.

### B.2 Cài dependency và kiểm tra app version

```powershell
pnpm install
pnpm build
```

Expected:

- `pnpm install` không lỗi.
- `pnpm build` pass.
- `package.json` version là `0.7.0` hoặc version branch hiện tại.

Actual/Error:

```text

```

### B.3 Cấu hình Supabase local

Chạy Supabase local theo setup repo/team đang dùng, sau đó lấy URL/key:

```powershell
pnpm supabase status
```

Expected output có:

```text
Project URL │ http://127.0.0.1:54321
Publishable │ <local publishable key>
```

Tạo file `.env.development` local, không commit:

```env
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="<local publishable key>"
```

Actual/Error:

```text

```

### B.4 Seed demo data local

```powershell
docker cp scripts\seed-activity-feed-demo.sql supabase_db_corelia-app:/tmp/seed-activity-feed-demo.sql
docker exec supabase_db_corelia-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed-activity-feed-demo.sql
```

Expected output:

```text
NOTICE:  Activity Feed demo seed created.
NOTICE:  Login: feed-demo-student1@corelia.test / Corelia123!
NOTICE:  Open: /feed, /u/feed-demo-student2, /courses/feed-demo-course, /hackathons/feed-demo-hackathon, /projects/<uuid>
```

Actual/Error:

```text

```

### B.5 Chạy dev server

```powershell
pnpm dev
```

Expected output:

```text
VITE v...
Local: http://localhost:5173/
```

Mở:

```text
http://localhost:5173/feed
```

Actual/Error:

```text

```

## Tài khoản demo local

| Email | Password | Vai trò |
|---|---|---|
| `feed-demo-student1@corelia.test` | `Corelia123!` | Viewer/follower chính |
| `feed-demo-student2@corelia.test` | `Corelia123!` | Actor chính |
| `feed-demo-student3@corelia.test` | `Corelia123!` | Follower/actor phụ |
| `feed-demo-instructor@corelia.test` | `Corelia123!` | Instructor demo |

URL demo local:

| Mục | URL |
|---|---|
| Feed | `/feed` |
| Profile actor | `/u/feed-demo-student2` |
| Course demo | `/courses/feed-demo-course` |
| Hackathon demo | `/hackathons/feed-demo-hackathon` |

Project URL demo:

```powershell
docker exec supabase_db_corelia-app psql -U postgres -d postgres -At -c "select '/projects/' || id from public.projects where slug='feed-demo-project' order by created_at desc limit 1;"
```

## Checklist runtime Must pass

### 1. Login viewer

Tại sao cần test: feed chỉ có ý nghĩa khi có authenticated user và RLS đọc đúng current user.

| Bước | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| 1 | Login bằng Student 1 | Login thành công, không bị loop auth | |
| 2 | Refresh trang sau login | Vẫn giữ session | |
| 3 | Mở `/feed` | Vào trang feed, không bị redirect sai | |

Mô tả lỗi nếu fail:

```text

```

### 2. Route `/feed`

Tại sao cần test: từng có risk route `feed` bị legacy redirect thành `/u/feed`.

| Bước | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| 1 | Gõ trực tiếp `/feed` trên address bar | URL vẫn là `/feed` | |
| 2 | Quan sát page | Không hiện profile not found của `/u/feed` | |
| 3 | Click nav Feed trong sidebar/header | Điều hướng về `/feed` | |

Mô tả lỗi nếu fail:

```text

```

### 3. Feed render đúng activity

Tại sao cần test: feed phải observational/public/follow-based, không phải notification cá nhân.

| Bước | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| 1 | Mở `/feed` với Student 1 | Không empty nếu seed/data sẵn | |
| 2 | Quan sát events | Có course, hackathon, project, credential, follow | |
| 3 | So với notification bell | Feed badge/list tách biệt notification cá nhân | |

Expected nội dung ví dụ:

```text
Feed Demo Student 2 đã đăng ký khoá Activity Feed Demo Course
Feed Demo Student 2 đã nộp bài hackathon Activity Feed Demo Hackathon
Dự án Activity Feed Demo Project đã đạt ... hearts
```

Mô tả lỗi nếu fail:

```text

```

### 4. Smart bundling

Tại sao cần test: nhiều completed lesson cùng course/ngày phải gom lại, tránh feed bị spam.

| Bước | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| 1 | Mở `/feed` | Có một bundle completed lessons | |
| 2 | Kiểm tra text bundle | Hiển thị dạng hoàn thành N bài học trong cùng course | |
| 3 | Kiểm tra heart milestone | Không bị gom mất từng mốc quan trọng | |

Expected:

```text
Feed Demo Student 2 đã hoàn thành 5 bài học trong Activity Feed Demo Course
```

Mô tả lỗi nếu fail:

```text

```

### 5. Actor/profile links

Tại sao cần test: feed cần đưa user về profile đúng, kể cả fallback UUID.

| Bước | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| 1 | Click avatar/tên actor trong feed | Mở profile actor | |
| 2 | Kiểm tra URL | Ưu tiên `/u/feed-demo-student2`, fallback UUID vẫn không 404 | |
| 3 | Back về feed | Feed vẫn giữ trạng thái hợp lý | |

Mô tả lỗi nếu fail:

```text

```

### 6. Hackathon links

Tại sao cần test: event hackathon phải dùng slug public, không dùng ID nội bộ khó đọc/sai route.

| Bước | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| 1 | Tìm event hackathon trong feed | Có event register/submit/status | |
| 2 | Click object hackathon | Mở `/hackathons/feed-demo-hackathon` | |
| 3 | Refresh trang hackathon | Vẫn load đúng public detail | |

Mô tả lỗi nếu fail:

```text

```

### 7. FollowButton trên user/course/hackathon/project

Tại sao cần test: follow là đầu vào chính của feed fan-in.

| Entity | URL | Thao tác | Expected output | Actual/Error |
|---|---|---|---|---|
| User | `/u/feed-demo-student2` | Toggle Follow/Following | Trạng thái đổi, count cập nhật | |
| Course | `/courses/feed-demo-course` | Toggle Follow/Following | Theo dõi/bỏ theo dõi được course public | |
| Hackathon | `/hackathons/feed-demo-hackathon` | Toggle Follow/Following | Theo dõi/bỏ theo dõi được hackathon public | |
| Project | Project URL demo | Toggle Follow/Following | Theo dõi/bỏ theo dõi được project public | |

Mô tả lỗi nếu fail:

```text

```

### 8. Follower list dialog

Tại sao cần test: follower summary không được đọc trực tiếp bảng `follows`, mà phải qua RPC public-safe.

| Bước | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| 1 | Mở course/hackathon/project/profile có follower | Thấy follower summary nếu count > 0 | |
| 2 | Click follower summary | Dialog mở danh sách follower public | |
| 3 | Click một follower | Mở `/u/:handle` đúng | |

Mô tả lỗi nếu fail:

```text

```

### 9. Hackathon registration CTA

Tại sao cần test: CTA từng chỉ nhảy anchor, không tạo registration thật.

| Bước | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| 1 | Login Student 1 | Session OK | |
| 2 | Mở `/hackathons/feed-demo-hackathon` | Trang load đúng | |
| 3 | Click `Đăng ký bằng hồ sơ của tôi` ở hero/final/mobile | Có toast/trạng thái đăng ký | |
| 4 | Refresh trang | Không quay lại trạng thái như chưa đăng ký | |

Mô tả lỗi nếu fail:

```text

```

### 10. Realtime indicator

Tại sao cần test: realtime là phần UI websocket, không thể kết luận chỉ bằng DB insert.

Chuẩn bị: mở `/feed` bằng Student 1 rồi giữ tab đó.

Chạy ping:

```powershell
docker cp scripts\seed-activity-feed-realtime-ping.sql supabase_db_corelia-app:/tmp/seed-activity-feed-realtime-ping.sql
docker exec supabase_db_corelia-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed-activity-feed-realtime-ping.sql
```

Expected SQL output:

```text
activity feed realtime ping inserted
```

Checklist:

| Bước | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| 1 | Giữ tab `/feed` đang mở | Không cần refresh thủ công | |
| 2 | Chạy realtime ping | UI hiện indicator có activity mới | |
| 3 | Click refresh/show new | Event mới xuất hiện ở đầu feed | |
| 4 | Kiểm tra scope | Chỉ activity liên quan followed actor/entity báo mới | |

Mô tả lỗi nếu fail:

```text

```

### 11. Privacy dynamic hide

Tại sao cần test: feed event public cũ phải bị ẩn động nếu object chuyển private.

| Bước | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| 1 | Có project public đã có event trong feed | Event xuất hiện với follower | |
| 2 | Đổi project sang private | Lưu thành công | |
| 3 | Refresh `/feed` follower | Event project private biến mất | |
| 4 | Đổi lại public nếu cần cleanup | Feed có thể hiện lại theo quyền đọc | |

Mô tả lỗi nếu fail:

```text

```

## Checklist Should pass

| Nhóm | Thao tác | Expected output | Actual/Error |
|---|---|---|---|
| Empty state | User không follow ai/entity nào mở `/feed` | Empty state rõ ràng, không crash | |
| Pagination | Click load more | Load thêm event, không duplicate | |
| i18n VI/EN | Đổi language | Feed verb text đổi ngôn ngữ | |
| Mobile layout | Test viewport mobile | Nút follow/dialog/feed không overlap | |
| Error state | Tắt network hoặc revoke session | Có error/loading state dễ hiểu | |

## Template báo cáo bug

Copy block này cho mỗi lỗi:

```text
Issue #96 Runtime QA bug

Environment:
- Staging/local:
- URL:
- Commit/build:
- Browser:
- Account:

Checklist item:
- Section:
- Step:

Expected:

Actual:

Repro steps:
1.
2.
3.

Evidence:
- Screenshot/video:
- Console error:
- Network/API response:

Severity:
- Blocker / High / Medium / Low

Notes:
```

## Điều kiện đề xuất để close issue #96

Must pass:

- `/feed` route không redirect sai.
- Feed hiển thị events từ followed users/entities.
- Link actor/object đúng, đặc biệt hackathon slug.
- Follow/unfollow hoạt động trên user/course/hackathon/project.
- Follower dialog mở và link profile đúng.
- Hackathon CTA tạo registration thật.
- Realtime indicator hoạt động trên tab đang mở.
- Privacy public -> private ẩn event khỏi feed follower.

Có thể để v1.5/v2, không block close v1 nếu team chưa đổi scope:

- `instructor_org`.
- `course.announcement`.
- Email digest.
- Block/mute UI.
- Anti-abuse/rate limit.
- Backfill lịch sử.
