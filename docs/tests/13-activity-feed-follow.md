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
