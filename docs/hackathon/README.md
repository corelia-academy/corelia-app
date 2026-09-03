# Hackathon

Đây là nguồn tài liệu hiện hành cho hệ thống hackathon đã tinh giản của Corelia.

Luồng sản phẩm:

> Admin tạo và xuất bản → người dùng đăng ký tức thời → tạo project có taxonomy → admin chọn winner thủ công → kết thúc.

Không còn judge, reviewer, co-organizer, invite theo vai trò, duyệt đơn, chấm điểm, rubric, vòng chấm, leaderboard theo điểm, analytics riêng, email blast hoặc cấp credential mới từ workspace hackathon. Credential đã cấp trước đây vẫn được bảo toàn.

## Quyết định cleanup

Corelia chưa vận hành hackathon thật và không có dữ liệu nghiệp vụ cần lưu từ hệ thống cũ. Migration xoá trực tiếp toàn bộ score, scoped access-invite và object phụ thuộc; không export, backup hoặc lưu snapshot riêng cho hai nhóm dữ liệu legacy này.

Các tài liệu audit trước migration chỉ là bằng chứng lịch sử. Khi mô tả judging, review registration, role invite, score hoặc `metrics_snapshot`, chúng không còn là contract sản phẩm hay hướng dẫn rollout. Bộ tài liệu trong thư mục này là nguồn hiện hành duy nhất cho hackathon.

## Tài liệu

1. [Phạm vi sản phẩm](./product-scope.md)
2. [Routes, luồng và quyền](./flows-and-permissions.md)
3. [Data contract và migration](./simplification-plan.md)
4. [Checklist nghiệm thu](./acceptance-checklist.md)
5. [Checklist test Hackathon & Project](./test-checklist.md)

## Contract chính

- Public detail dùng năm tab có URL riêng: Overview, Prizes, Timeline, Resources và Projects.
- Editor chỉ nằm trong `/admin/hackathons`; URL workspace cũ trả Not Found.
- Nội dung có locale VI/EN; primary locale là VI.
- Project là thực thể canonical. Submission chỉ liên kết project với hackathon.
- Track, sector và tech stack đều hỗ trợ nhiều lựa chọn và đều bắt buộc khi nộp.
- Winner là nhãn giải và thứ tự do admin đặt, không liên quan đến score.

Tên `Contest*` còn tồn tại trong một số type/helper nội bộ để giữ tương thích code, nhưng UI, route và tài liệu mới dùng “hackathon”.
