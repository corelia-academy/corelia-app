# Corelia Learning

Thư mục này là nguồn thiết kế chính cho hệ thống học tập của Corelia.

## Tài liệu

- [Learning system](./learning-system.md): kiến trúc tổng thể, phạm vi sản phẩm, data flow, migration và tiêu chí hoàn thành.
- [Learner UI](./learner-ui.md): shell, responsive layouts, từng lesson renderer, navigation và UI states.
- [Admin authoring UI](./admin-ui.md): course editor, curriculum, instructor list, YouTube video và publish flow.
- [Code exercise](./code-exercise.md): thiết kế chi tiết cho bài tập code với hai mode `fill` và `edit`.
- [Competitive positioning](./competitive-positioning.md): Corelia so với HackQuest, lý do sử dụng và cách kiểm chứng product wedge.

## Thứ tự ưu tiên

Khi tài liệu cũ hoặc bản ý tưởng bên ngoài mâu thuẫn với tài liệu trong thư mục này:

1. Hành vi và schema đang chạy trong repo là baseline tương thích.
2. `learning-system.md` quyết định target architecture và phạm vi.
3. Tài liệu theo feature như `code-exercise.md` quyết định chi tiết trong phạm vi feature đó.

Mọi thay đổi lớn phải cập nhật tài liệu tổng thể và tài liệu feature liên quan trong cùng pull request.

## Product constraints hiện tại

- Mọi khóa học thuộc Corelia và chỉ admin chỉnh sửa nội dung.
- Instructor là danh sách attribution trên khóa học, không phải ownership hoặc permission model.
- Mọi khóa học hiện tại đều miễn phí; checkout, payment và paid access để sau.
- Video lesson dùng YouTube URL trong phase hiện tại; managed video hosting để sau.
