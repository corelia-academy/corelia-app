# Activity Feed + Follow System

Checklist cho issue #96. Feed này tách biệt với notification cá nhân: notification là việc cần hành động, feed là hoạt động công khai/follow-based.

## Tiền đề staging

- Backend đã apply migration feed/follow mới.
- Frontend đã deploy đúng bundle mới và đã hard reload.
- Có tối thiểu 2 tài khoản học viên: `Student_1`, `Student_2`.
- Có ít nhất 1 course published, 1 hackathon public, 1 project public.

## Smoke DB rollback

Chạy trên DB staging/prod chỉ khi có quyền DBA và đã xác nhận đúng connection string. Script dùng transaction + `ROLLBACK`, không giữ fixture data.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/smoke-activity-feed.sql
```

Kỳ vọng:

```text
activity feed smoke test passed
```

Script đang phủ:

| Nhóm | Kỳ vọng |
|---|---|
| Trigger activity | Có event cho enroll course, complete course/section, hackathon register/submit/status, project publish/join, hearts milestone, course publish/new section, credential, follow user |
| Feed RPC | User follow actor/entity thì `get_feed_v1` trả event liên quan |
| Unfollow | Sau unfollow actor, event actor-only không còn xuất hiện |
| Follower preview | `list_followers_v1` trả follower public đúng entity |
| Privacy | Project đổi sang private thì activity project bị ẩn khỏi feed follower |

## Test local với demo seed

Chạy seed local:

```powershell
docker cp scripts\seed-activity-feed-demo.sql supabase_db_corelia-app:/tmp/seed-activity-feed-demo.sql
docker exec supabase_db_corelia-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed-activity-feed-demo.sql
```

Tài khoản:

| Tài khoản | Mật khẩu | Vai trò |
|---|---|---|
| `feed-demo-student1@corelia.test` | `Corelia123!` | Người xem feed, đã follow user/course/hackathon/project demo |
| `feed-demo-student2@corelia.test` | `Corelia123!` | Actor tạo activity chính |
| `feed-demo-student3@corelia.test` | `Corelia123!` | Follower/actor phụ để kiểm tra follower list |
| `feed-demo-instructor@corelia.test` | `Corelia123!` | Instructor tạo course/hackathon demo |

URL cố định:

| Mục | URL |
|---|---|
| Feed | `/feed` |
| Profile actor | `/u/feed-demo-student2` |
| Course demo | `/courses/feed-demo-course` |
| Hackathon demo | `/hackathons/feed-demo-hackathon` |

URL project demo thay đổi sau mỗi lần seed. Lấy URL bằng:

```powershell
docker exec supabase_db_corelia-app psql -U postgres -d postgres -At -c "select '/projects/' || id from public.projects where slug='feed-demo-project' order by created_at desc limit 1;"
```

### 1. Feed tổng

| Bước | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Login `feed-demo-student1@corelia.test` | Đăng nhập thành công |
| 2 | Mở `/feed` | Không bị empty state nếu seed đã chạy |
| 3 | Quan sát danh sách event | Có event course, hackathon, project, credential, follow |
| 4 | Click avatar/tên actor trong feed | Mở được profile actor, không rơi vào `/u/<id>` lỗi hoặc `/u/feed` |
| 5 | Click link mở object trong event hackathon | Mở `/hackathons/feed-demo-hackathon` bằng slug |

Trước sửa: link user từ feed có thể rơi vào profile không tìm thấy vì chỉ hỗ trợ username/OCID.  
Sau sửa: profile public hỗ trợ thêm UUID fallback, các link user từ feed vẫn mở được profile đúng.

### 2. Smart bundling

| Bước | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Login Student 1 |
| 2 | Mở `/feed` |
| 3 | Tìm event hoàn thành bài học của Student 2 | Các event `user.completed_section` cùng course/ngày được gom thành 1 bundle |

Kỳ vọng nội dung: dạng "Feed Demo Student 2 đã hoàn thành N bài học..." thay vì nhiều dòng rời.

### 3. FollowButton và follower list

| Entity | URL | Thao tác | Kỳ vọng |
|---|---|---|---|
| User | `/u/feed-demo-student2` | Click Follow/Following | Trạng thái đổi đúng, follower count cập nhật |
| Course | `/courses/feed-demo-course` | Click Watch/Following | Theo dõi/bỏ theo dõi được course public |
| Hackathon | `/hackathons/feed-demo-hackathon` | Click Watch/Following | Theo dõi/bỏ theo dõi được hackathon public |
| Project | URL project demo | Click Follow/Following | Theo dõi/bỏ theo dõi được project public |

Nếu có dòng follower summary, click vào dòng đó. Kỳ vọng mở dialog danh sách follower public và click từng follower mở `/u/:handle`.

### 4. Hackathon register CTA

| Bước | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Login `feed-demo-student1@corelia.test` |
| 2 | Mở `/hackathons/feed-demo-hackathon` |
| 3 | Click nút `Đăng ký bằng hồ sơ của tôi` ở hero hoặc cuối trang | Gửi đăng ký thật, không chỉ nhảy lên đầu/trỏ hash |
| 4 | Quan sát toast/trạng thái | Hiển thị trạng thái đăng ký pending/approved theo config |
| 5 | Refresh trang | Vẫn thấy trạng thái đăng ký, không quay lại CTA đăng ký mới |

Trước sửa: CTA hero/final chỉ navigate tới `#participant-workspace`, cảm giác như nút không đăng ký.  
Sau sửa: CTA đăng ký ở hero/final/mobile gọi cùng flow `handleApply()` với card đăng ký.

### 5. Realtime indicator

Mở `/feed` bằng Student 1, sau đó chạy:

```powershell
docker exec supabase_db_corelia-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed-activity-feed-realtime-ping.sql
```

Kỳ vọng:

| Mục | Kỳ vọng |
|---|---|
| Indicator | `/feed` hiển thị có hoạt động mới |
| Refresh/show new | Click refresh/show new thì event mới xuất hiện |
| Phạm vi | Event chỉ báo khi liên quan actor/entity Student 1 đang follow |

## Reproduce UI trên staging/prod

### Follow entity và feed

1. Login `Student_1`.
2. Vào public profile/course/hackathon/project.
3. Bấm Follow/Watch.
4. Login `Student_2` ở tab hoặc browser khác.
5. Tạo hoạt động tương ứng: enroll course, đăng ký hackathon, publish project hoặc follow user.
6. Quay lại `Student_1`, mở `/feed`.

Kỳ vọng:

- Feed hiển thị event mới đúng actor/object.
- Link event mở đúng route public, đặc biệt hackathon dùng `/hackathons/:slug`.
- Header có badge feed mới, tách biệt với chuông notification.

### Realtime indicator

1. Mở `/feed` bằng `Student_1`.
2. Ở tab khác tạo activity từ actor/entity mà `Student_1` đang follow.
3. Quan sát `/feed`.

Kỳ vọng:

- Có indicator hoạt động mới.
- Bấm refresh/show new thì feed load event mới.
- Event không liên quan đến followed entities không làm feed đổi trạng thái.

### Smart bundling

1. Cho `Student_2` hoàn thành nhiều lesson/section trong cùng một course và cùng ngày.
2. `Student_1` follow `Student_2` hoặc follow course đó.
3. Mở `/feed`.

Kỳ vọng:

- Các event `user.completed_section` cùng actor/course/ngày được gom thành một bundle.
- `project.received_hearts_milestone` không bị bundle mất từng mốc quan trọng.

### Follower list

1. Vào public profile/course/hackathon/project có follower.
2. Click dòng follower summary dưới nút Follow/Watch.

Kỳ vọng:

- Mở dialog danh sách follower public.
- Click follower trong dialog mở `/u/:handle`.
- Không đọc trực tiếp bảng `follows` từ client; dữ liệu đi qua RPC `list_followers_v1`.

### Privacy

1. Tạo project public và có activity xuất hiện trong feed follower.
2. Đổi project sang private.
3. Refresh `/feed` của follower.

Kỳ vọng:

- Activity project private không còn xuất hiện.
- Collaborator/project permission vẫn do RLS hiện có quyết định, không bypass qua feed.

## Ghi chú phạm vi

- `instructor_org`, `course.announcement`, email digest, block/mute UI, anti-abuse rate limit và backfill lịch sử là v1.5/v2 hoặc câu hỏi mở trong issue, chưa dùng làm điều kiện đóng v1.
- Schema dùng `subject_id`/`object_id` dạng `text` để tương thích repo hiện tại vì `courses.id` và `hackathons.id` không phải UUID thuần.
