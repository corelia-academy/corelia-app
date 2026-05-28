# Activity Feed + Follow System — Báo cáo QA tách runtime

Issue: #96  
Ngày cập nhật: 2026-05-28  
Branch: `fix/activity-feed-follow-system`

## Đã xác minh bằng code/static/DB/API

Các mục dưới đây không phụ thuộc browser visual test:

| Nhóm | Trạng thái | Bằng chứng |
|---|---|---|
| Build frontend | Pass | `pnpm build` |
| Unit tests | Pass | `pnpm test` |
| Targeted lint feed/social | Pass | `pnpm exec eslint ...` trên các file feed/follow/profile liên quan |
| Smoke DB rollback | Pass | `scripts/smoke-activity-feed.sql` trả `activity feed smoke test passed` |
| Demo seed local | Pass | `scripts/seed-activity-feed-demo.sql` tạo users/feed-demo data |
| Demo auth login | Pass | `feed-demo-student1@corelia.test / Corelia123!` login qua Auth API |
| Feed RPC | Pass | `get_feed_v1` trả event từ actor/entity user đang follow |
| Follower RPC | Pass | `list_followers_v1` trả follower public cho course demo |
| Follow/unfollow RLS | Pass | REST insert/delete `follows` cho user hiện tại hoạt động |
| Realtime ping data path | Pass | `seed-activity-feed-realtime-ping.sql` insert event mới và event lên đầu `get_feed_v1` |
| Smart bundling rules | Pass | `src/lib/feedBundling.test.ts` phủ completed lessons, followed users, heart milestones |

## Phần cần test tay runtime riêng

Các mục này cần browser thật hoặc staging/prod vì phụ thuộc UI render, realtime channel trong tab, navigation, toast và cache bundle:

| Nhóm | Cần test tay | Kỳ vọng |
|---|---|---|
| `/feed` route | Mở `/feed` sau login | Không redirect sang `/u/feed`, không empty nếu seed có data |
| Feed render | Quan sát danh sách event | Có course, hackathon, project, credential, follow |
| Link actor | Click avatar/tên actor | Mở đúng `/u/:handle` hoặc UUID fallback |
| Link hackathon | Click event hackathon | Mở `/hackathons/feed-demo-hackathon` bằng slug |
| Bundling UI | Quan sát completed section | Nhiều lesson cùng course/ngày gom thành một bundle |
| FollowButton UI | Toggle user/course/hackathon/project | Trạng thái và follower count cập nhật, rollback nếu lỗi |
| Follower dialog | Click follower summary | Dialog mở danh sách follower public, click follower mở profile |
| Hackathon CTA | Click `Đăng ký bằng hồ sơ của tôi` | Tạo registration thật, refresh vẫn giữ trạng thái đã đăng ký |
| Header badge | Tạo event mới liên quan | Badge Feed tăng riêng, không trộn notification bell |
| Realtime indicator | Mở `/feed`, chạy realtime ping | Hiện indicator activity mới trong tab đang mở |
| Staging cache | Hard reload staging | `window.__CORELIA_BUILD__` đúng version/commit mong muốn |

## Lệnh chuẩn bị local cho tester

```powershell
cd C:\Users\Admin\Documents\CORELIA\corelia-app
docker cp scripts\seed-activity-feed-demo.sql supabase_db_corelia-app:/tmp/seed-activity-feed-demo.sql
docker exec supabase_db_corelia-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed-activity-feed-demo.sql
pnpm dev
```

Tài khoản chính:

| Email | Password | Vai trò |
|---|---|---|
| `feed-demo-student1@corelia.test` | `Corelia123!` | Viewer/follower chính |
| `feed-demo-student2@corelia.test` | `Corelia123!` | Actor chính |
| `feed-demo-student3@corelia.test` | `Corelia123!` | Follower/actor phụ |
| `feed-demo-instructor@corelia.test` | `Corelia123!` | Instructor demo |

URL cố định:

| Mục | URL |
|---|---|
| Feed | `/feed` |
| Profile actor | `/u/feed-demo-student2` |
| Course demo | `/courses/feed-demo-course` |
| Hackathon demo | `/hackathons/feed-demo-hackathon` |

Project URL demo lấy bằng:

```powershell
docker exec supabase_db_corelia-app psql -U postgres -d postgres -At -c "select '/projects/' || id from public.projects where slug='feed-demo-project' order by created_at desc limit 1;"
```

Realtime ping:

```powershell
docker cp scripts\seed-activity-feed-realtime-ping.sql supabase_db_corelia-app:/tmp/seed-activity-feed-realtime-ping.sql
docker exec supabase_db_corelia-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed-activity-feed-realtime-ping.sql
```

## Ghi chú scope

Không dùng các mục sau làm điều kiện đóng v1 nếu team chưa đổi scope: `instructor_org`, `course.announcement`, email digest, block/mute UI, anti-abuse rate limit, backfill lịch sử.
