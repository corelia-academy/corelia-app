> **Legacy — chỉ phục vụ chuyển đổi.** Định hướng activity feed đã bị thay thế ngày 2026-09-22. Đọc [thiết kế mới](../README.md#product) và [kế hoạch loại bỏ](../README.md#migration). Các đề xuất sửa feed cũ trong tài liệu này không còn là roadmap.

# Feed & Follow — QA hiện hành

Đọc [hiện trạng](legacy-system.md) và [vấn đề đã nhận diện](legacy-review-2026-09-22.md) trước khi chạy. Bảng dưới là checklist, chưa đánh dấu pass. Ghi environment, commit/build, tài khoản/role, browser và bằng chứng cho mỗi lần chạy.

## Chuẩn bị

- Hai tài khoản A (viewer), B (actor), thêm tài khoản admin/support để kiểm tra phạm vi following.
- Course published, hackathon public, project public và profile công khai. Đảm bảo frontend và backend đang dùng cùng môi trường.
- Dữ liệu demo chỉ dùng local/test: [seed demo](../../../scripts/seed-activity-feed-demo.sql), [realtime ping](../../../scripts/seed-activity-feed-realtime-ping.sql). Đọc script trước khi chạy; seed tạo/đổi dữ liệu, không phải thao tác read-only.
- Với local DB đã chuẩn bị, dùng connection string của đúng local stack:

```sh
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/seed-activity-feed-demo.sql
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/smoke-activity-feed.sql
```

Smoke dùng transaction + rollback; kết quả mong đợi `activity feed smoke test passed`. Script chưa được chạy lại trong đợt rà soát này, cần xác minh tương thích schema hiện tại. Không lấy kết quả lịch sử làm pass mới.

Demo viewer: `feed-demo-student1@corelia.test`; actor: `feed-demo-student2@corelia.test`; mật khẩu fixture local: `Corelia123!`. Route: `/feed`, `/@feed-demo-student2`, `/courses/feed-demo-course`, `/hackathons/feed-demo-hackathon`. Project ID lấy từ project có slug `feed-demo-project` sau khi seed.

## Checklist

| Case | Thao tác | Kỳ vọng / cần ghi nhận |
|---|---|---|
| Auth | Mở `/feed` khi logout, rồi login | Guard chuyển đúng luồng login; login quay về route hợp lệ |
| Empty | A không follow và không có self activity | Empty state; không crash |
| Self | A không follow nhưng có self activity | Có event của A; ghi nhận cả `learning.*` private nếu phát sinh |
| Scope | A follow B hoặc object/target; B tạo event | RPC và UI trả event phù hợp, actor/title đúng |
| Follow | A follow/unfollow user/course/hackathon/project | Trạng thái và count đúng; reload kiểm tra persistence; ghi nhận độ trễ cache |
| Auto-follow | A enroll course / đăng ký hackathon | Có follow course/hackathon tương ứng |
| Staff | Nhiều user follow cùng subject; mở bằng staff | Following/isFollowing phải thuộc staff; ghi nhận lỗi hiện có nếu lẫn dữ liệu hoặc `maybeSingle` lỗi |
| Navigation | Click avatar và link “Mở” từng loại event | Profile `/@...`, course/hackathon slug, project ID đúng; lesson/section thiếu link là finding đã biết |
| Bundling | B hoàn thành nhiều bài cùng course/ngày, follow nhiều user | Gom đúng actor/course/ngày; khác ngày/course tách riêng; mốc hearts không gom |
| Pagination | >20 event; có nhiều event trùng timestamp tại ranh giới | Kiểm tra ID không trùng và không thiếu; cursor timestamp hiện có nguy cơ thiếu |
| Realtime | A giữ `/feed`, B tạo event liên quan rồi không liên quan | Event liên quan bật indicator; không liên quan không bật; self activity vẫn hợp lệ |
| Show new | Bấm indicator/làm mới | Event mới xuất hiện; ghi nhận network error và khả năng retry |
| Unread | Sau khi đã có mốc đọc, tạo event mới rồi mở feed | Badge tăng theo mẫu tối đa 50, hiển thị `9+`; mở feed đưa về 0; lần dùng đầu thiết lập mốc và trả 0 |
| Follower preview | Mở dialog, click follower | Chỉ preview profile công khai, link profile hợp lệ |
| Privacy | Project từ public thành private, A chỉ follow và không có quyền nội dung | Sau refetch event bị ẩn; kiểm tra riêng owner/collaborator/staff, không ép cùng kết quả |
| Private event | B tạo `learning.*` private; kiểm tra A và B | A thường không đọc được; B có thể thấy trên feed của mình theo implementation hiện tại |
| Resilience | Offline, lỗi RPC, đổi user, đổi VI/EN, mobile | Retry/loading phù hợp, không dùng cache user cũ, không vỡ layout |

Realtime ping local khi viewer đang mở feed:

```sh
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/seed-activity-feed-realtime-ping.sql
```

Ghi `Pass / Fail / Blocked / Not run`, expected/actual và evidence cho từng case. QA staging/production theo [release process](../../RELEASE_PROCESS.md); tách bằng chứng backend, frontend và runtime. Các bước CTA đăng ký hackathon chi tiết nằm trong [QA hackathon](../../hackathon/test-checklist.md).
