> **Legacy — chỉ phục vụ chuyển đổi.** Định hướng activity feed đã bị thay thế ngày 2026-09-22. Đọc [thiết kế mới](../README.md#product) và [kế hoạch loại bỏ](../README.md#migration). Các đề xuất sửa feed cũ trong tài liệu này không còn là roadmap.

# Rà soát Feed — 2026-09-22

Phương pháp: đọc frontend, migrations liên quan và kiểm thử bundling hiện có. Các kết luận dưới đây dựa trên source, chưa phải lỗi đã tái hiện bằng browser/DB. Không suy diễn trạng thái deployment từ repository. Worktree có thay đổi XP đang được thực hiện song song, gồm badge trong FeedPage; phần XP chưa thuộc phạm vi audit này và không được coi là tính năng đã phát hành.

## Phát hiện cần xử lý

| Ưu tiên đề xuất | Phát hiện và bằng chứng | Tác động / hướng xử lý |
|---|---|---|
| Cao | [RPC](../../../supabase/migrations/20260702000000_activity_feed_follow_system.sql) sort và cursor chỉ dùng `created_at`; trang sau dùng `< cursor` | Nhiều event cùng timestamp vượt ranh giới trang có thể bị bỏ sót. Dùng cursor `(created_at, id)` và sort ổn định; thêm test >20 event đồng thời. Dedup client không khôi phục event đã bị bỏ qua. |
| Vừa | [FeedPage.objectHref](../../../src/pages/feed/FeedPage.tsx) ưu tiên target; completed-section có object course, target lesson trong [trigger](../../../supabase/migrations/20260709000008_activity_feed_payload_titles.sql) | Target lesson/section không nằm trong các loại được định tuyến nên thiếu nút “Mở”. Nên fallback về course hoặc xây deep link học tập hợp lệ. |
| Vừa | [FollowButton mutation](../../../src/components/social/FollowButton.tsx) chỉ đổi cache trạng thái follow; subscription trong FeedPage chỉ invalidate following | Timeline/unread/preview có thể cũ sau follow/unfollow cho tới refetch khác. Invalidate các query liên quan sau mutation; kiểm tra cả thay đổi từ tab khác. |
| Vừa | [listFollowing/isFollowing](../../../src/lib/follows.ts) không lọc `follower_id`, trong khi RLS cho staff SELECT mọi quan hệ | Với staff, following có thể lẫn của người khác; `maybeSingle` có thể lỗi khi nhiều người follow cùng subject; indicator có thể báo nhầm. RPC timeline tự lọc user nên không kết luận timeline lộ dữ liệu từ lỗi này. Thêm điều kiện user và test staff. |
| Vừa | [Telemetry learning](../../../supabase/migrations/20260911110235_learning_course_reporting.sql) ghi `private` vào cùng bảng; RPC cho lấy event của actor, không có allowlist verb | Feed của chính mình có thể lẫn telemetry, dùng text fallback và ảnh hưởng unread. Quyết định loại khỏi social feed hay thiết kế hiển thị riêng; kiểm tra badge cùng quy tắc. |
| Thấp | [Unread](../../../src/features/feed/feedQueries.ts) chỉ đếm 50 event; [mốc đọc](../../../src/lib/feedUnread.ts) ở localStorage | Không phải tổng unread đầy đủ hay đồng bộ nhiều thiết bị. Nếu cần semantics đó, phải có read cursor server; trước mắt giữ mô tả đúng giới hạn. |

## Khoảng trống kiểm thử

Đã chạy `pnpm vitest run src/lib/feedBundling.test.ts`: **1 file, 4 tests pass** (gom bài học, tách ngày, gom follow user, giữ riêng mốc hearts).

Các test này không xác minh cursor RPC, RLS/privacy, quyền staff, follow cache, URL event, unread hoặc WebSocket. Chưa chạy lại DB smoke, seed demo hay manual browser QA trong lần rà soát này. Các báo cáo “Pass” của issue #96 nằm trong archive và không được tính là bằng chứng hiện hành.

Thứ tự đề xuất: sửa pagination → xác định ranh giới social/telemetry và following của staff → sửa navigation/cache → chạy [QA](legacy-qa.md) với hai user và một staff. Các sửa đổi runtime này chưa được thực hiện trong đợt chỉnh docs.

## Những điểm docs cũ đã được làm rõ

- Không follow ai chưa đủ để kết luận feed trống; còn self activity.
- Route avatar hiện dùng `/@...`; chỉ avatar là link, không phải toàn bộ tên trong câu.
- Follow UI hiện dùng nhãn chung, không mặc định gọi nút entity là “Watch”.
- Realtime có self activity hợp lệ; không chỉ activity từ người đang follow.
- Các bước đăng ký hackathon thuộc luồng liên tính năng, không phải định nghĩa feed.
- Báo cáo issue #96 có thông tin branch, ngày và số test lịch sử; không thay thế release process hiện tại.
