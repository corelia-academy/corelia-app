# Corelia Learning

Thư mục này là nguồn thiết kế chính cho hệ thống học tập của Corelia.

## Tài liệu

- [Learning system](./learning-system.md): kiến trúc tổng thể, phạm vi sản phẩm, data flow, migration và tiêu chí hoàn thành.
- [Learner UI](./learner-ui.md): shell, responsive layouts, từng lesson renderer, navigation và UI states.
- [Instructor authoring UI](./admin-ui.md): editor hiện hữu, curriculum, instructor list, YouTube video và publish flow.
- [Local QA](./local-qa.md): evidence kiểm thử và phần chưa nghiệm thu.
- [Trạng thái nghiệm thu](./acceptance-status.md): đối chiếu toàn bộ phạm vi, bằng chứng và các gate còn thiếu.
- [Release runbook](./release-runbook.md): chuẩn bị rollout sau local delivery, thứ tự tương thích và xử lý lỗi.
- [Authoring và review](./authoring-and-review.md): sử dụng editor instructor hiện hữu, cấu hình format và review final assignment.
- [Code exercise](./code-exercise.md): thiết kế chi tiết cho bài tập code với hai mode `fill` và `edit`.
- [Competitive positioning](./competitive-positioning.md): Corelia so với HackQuest, lý do sử dụng và cách kiểm chứng product wedge.

## Thứ tự ưu tiên

Khi tài liệu cũ hoặc bản ý tưởng bên ngoài mâu thuẫn với tài liệu trong thư mục này:

1. Yêu cầu mới nhất của người dùng quyết định phạm vi, gồm việc giữ editor và quyền instructor hiện hữu.
2. Hành vi và schema đang chạy trong repo là baseline cần kiểm tra tương thích, không phải lý do giữ lỗi trái yêu cầu.
3. `learning-system.md` mô tả target architecture; tài liệu feature như `code-exercise.md` bổ sung chi tiết trong phạm vi đã chốt.

Mọi thay đổi lớn phải cập nhật tài liệu tổng thể và tài liệu feature liên quan trong cùng pull request.

## Product constraints hiện tại

- Giữ quản lý khóa học trong workspace instructor và quyền instructor/owner/co-instructor hiện có.
- Không thay mô hình ownership/permission đang chạy. Attribution bổ sung không tự cấp quyền.
- Mọi khóa học hiện tại đều miễn phí; checkout, payment và paid access để sau.
- Video lesson dùng YouTube URL trong phase hiện tại; managed video hosting để sau.

## Điều chỉnh phạm vi ngày 11/09/2026

Theo yêu cầu mới nhất: **giữ nguyên route và editor hiện hữu, chỉ bổ sung tính năng**. Các yêu cầu admin-only và di chuyển sang `/admin/learning` trong bản kế hoạch trước không còn áp dụng.

- `/instructor/courses`: danh sách hiện hữu.
- `/instructor/courses/new`: tạo khóa học hiện hữu.
- `/instructor/courses/:id/edit`: editor hiện hữu, bổ sung learning panels.
- `/instructor/courses/:id/preview/:lessonId?`: preview bổ sung.
- Instructor quản lý course của mình; quyền co-instructor theo feature và quyền staff hiện hữu được giữ. RPC mới phải dùng cùng helper phân quyền.
- Giữ chứng nhận PDF, OpenCampus Credentials, thông báo, học viên, sponsor/partner và localization; không tạo editor thứ hai.
