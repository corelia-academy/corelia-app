> **Legacy — chỉ phục vụ chuyển đổi.** Định hướng activity feed đã bị thay thế ngày 2026-09-22. Đọc [thiết kế mới](../README.md#product) và [kế hoạch loại bỏ](../README.md#migration). Các đề xuất sửa feed cũ trong tài liệu này không còn là roadmap.

# Feed: hệ thống hiện tại

Đối chiếu source ngày 2026-09-22. Thay đổi XP chưa commit trong worktree được loại khỏi phạm vi mô tả ổn định này. Các điểm cần cải thiện nằm trong [báo cáo rà soát](legacy-review-2026-09-22.md).

## Phạm vi sản phẩm

- `/feed` nằm sau `RequireAuth`, dùng lazy-loaded `FeedPage`.
- Feed gồm hoạt động của chính người xem và hoạt động khớp user/course/hackathon/project đang follow. Không follow ai vẫn có thể có feed của chính mình.
- Có làm mới, tải thêm, skeleton, error/retry, empty state, bản dịch VI/EN. UI hiện chưa cung cấp bộ lọc dù RPC nhận `p_filter`.
- Follow thủ công trên nội dung công khai; insert enrollment tự follow course, insert hackathon registration tự follow hackathon. Các trigger auto-follow dùng `ON CONFLICT DO NOTHING`.
- Có follower preview/dialog và danh sách user đang theo dõi trên profile. `muted_until` và helper mute đã tồn tại, chưa có UI mute trong feed.

## Luồng dữ liệu

1. Thao tác nghiệp vụ ghi DB; trigger tạo `activity_events` qua `private.log_activity`.
2. `get_feed_v1` chọn hoạt động của mình hoặc khớp actor/object/target đang follow, bỏ các quan hệ còn mute. RPC chạy `SECURITY INVOKER`, chịu RLS.
3. `getFeedPage` lấy event rồi đọc `public_profiles` theo các actor ID duy nhất.
4. TanStack Query lưu từng trang theo user ID, `staleTime` 30 giây. Trang 20 event, cursor là `created_at` cuối trang; UI loại ID trùng giữa các trang.
5. Bundling chạy trên toàn bộ event đã tải. Realtime INSERT chỉ bật nút “Có hoạt động mới”; nút này refetch timeline và following.

## Dữ liệu và quyền

| Thành phần | Contract hiện tại |
|---|---|
| `follows` | Khóa `(follower_id, subject_type, subject_id)`; ID đa hình là `text`; có `created_at`, `muted_until`; cấm tự follow user |
| `activity_events` | Actor, verb, object, target tùy chọn, JSON payload, visibility, thời gian và ID tăng dần |
| `get_feed_v1` | Cursor timestamp, limit mặc định 20/clamp 1–100, filter danh sách verb; sort `created_at DESC` |
| `list_followers_v1` | Preview follower công khai qua RPC; không dùng truy vấn toàn bộ `follows` để dựng danh sách người theo dõi |
| `listFollowing` | Đọc trực tiếp `follows`, dựa vào RLS; xem lưu ý tài khoản staff trong báo cáo |

RLS của `follows` cho user đọc/ghi quan hệ của mình; admin/support còn có quyền SELECT rộng hơn. Insert kiểm tra đối tượng followable. Activity chỉ được client SELECT, không có quyền ghi client trong migration nền.

`private.can_read_activity` cho staff đọc, cho actor đọc event `private`, và yêu cầu follow actor còn hiệu lực đối với event `followers` của người khác. Với event public/followers, object và target tiếp tục qua kiểm tra quyền đọc. “Public event” không có nghĩa object private được bỏ qua kiểm tra. Người chỉ follow project, không có quyền nội dung, mất quyền đọc event khi project thành private; owner/collaborator có thể vẫn đọc được.

Nguồn nền: [schema/RPC/RLS](../../../supabase/migrations/20260702000000_activity_feed_follow_system.sql), [bản sửa helper RLS](../../../supabase/migrations/20260702030000_activity_feed_rls_helper_row_security_fix.sql), [auto-follow](../../../supabase/migrations/20260705000003_auto_follow_on_enroll_register.sql).

## Event và hiển thị

| Nhóm | Verb |
|---|---|
| Học tập công khai | `user.enrolled_course`, `user.completed_section`, `user.completed_course` |
| Khóa học | `course.published`, `course.new_section` |
| Hackathon | `user.registered_hackathon`, `user.submitted_hackathon`, `hackathon.status_changed` |
| Project | `user.published_project`, `user.joined_project`, `project.received_hearts_milestone` |
| Credential | `user.earned_credential` |
| Social | `user.followed_user` |

Các trigger nền nằm ở [event triggers](../../../supabase/migrations/20260702010000_activity_feed_event_triggers.sql) và [additional events](../../../supabase/migrations/20260702020000_activity_feed_additional_events.sql). Payload được bổ sung bởi [payload titles](../../../supabase/migrations/20260709000008_activity_feed_payload_titles.sql); credential được bổ sung guard OC ID và title qua migrations kế tiếp. Có key dịch cho follow course/hackathon/project không đồng nghĩa trigger sinh đủ các verb đó.

Bảng activity còn được dùng cho telemetry `learning.*` với visibility `private`: [learning reporting](../../../supabase/migrations/20260911110235_learning_course_reporting.sql). RPC feed không loại nhóm này; actor có thể thấy event riêng tư của mình với text fallback. Đây là điểm cần quyết định lại về sản phẩm.

Bundling:

- `user.completed_section`: cùng actor, course (`object_id`) và ngày.
- `user.followed_user`: cùng actor và ngày.
- Ngày lấy trực tiếp 10 ký tự đầu timestamp, không đổi theo timezone người xem.
- Mốc hearts giữ riêng từng event. Bundle có thể tăng số lượng khi tải thêm trang.

Link avatar là `/@<username|ocid|UUID>`. Tên actor trong câu hiện là text. Link “Mở” ưu tiên target rồi object, hỗ trợ course/hackathon/project/user; xem báo cáo về trường hợp target là lesson/section.

## Realtime và badge chưa đọc

- Trang feed subscribe INSERT `activity_events`, kiểm tra khớp actor/object/target với following hoặc actor là chính mình. Subscribe thay đổi following chỉ invalidate query following.
- Header subscribe activity để invalidate unread; số lượng được tính lại bằng RPC, không cộng trực tiếp từ payload realtime. Có polling 60 giây khi không chạy nền.
- Chỉ lấy 50 event mới nhất để đếm unread; badge hiển thị tối đa `9+`.
- Mốc đã đọc nằm ở `localStorage`, key `corelia.feedLastReadAt.v1:<userId>`. Lần đầu có event sẽ đặt mốc mới nhất và trả 0; khi trang feed có dữ liệu sẽ đánh dấu tới event mới nhất đã tải.
- Không có read receipt trên server. Custom event cập nhật trong cùng cửa sổ; hook chưa nghe `storage` để đồng bộ tức thì giữa tab.

## Bản đồ source

| Vai trò | Source |
|---|---|
| Route | [App.tsx](../../../src/App.tsx) |
| UI, link, realtime matching | [FeedPage.tsx](../../../src/pages/feed/FeedPage.tsx) |
| Query keys, paging, unread | [feedQueries.ts](../../../src/features/feed/feedQueries.ts) |
| RPC và subscription | [feed.ts](../../../src/lib/feed.ts), [follows.ts](../../../src/lib/follows.ts) |
| Bundling và unit tests | [feedBundling.ts](../../../src/lib/feedBundling.ts), [tests](../../../src/lib/feedBundling.test.ts) |
| Unread | [feedUnread.ts](../../../src/lib/feedUnread.ts), [hook](../../../src/hooks/useFeedUnreadCount.ts) |
| Follow UI | [FollowButton.tsx](../../../src/components/social/FollowButton.tsx) |
