# Tiêu chí review: Code exercise

Áp dụng kèm `roles/06-lesson-review/common.md`.

## Tiêu chí riêng cho Code

| criterion | Kiểm gì |
|---|---|
| `lesson_flow` | Bài code: có trường `reinforces` nêu mô hình tư duy củng cố và lập luận người học phải làm; bài code không phải bước dựng tính năng; tên khớp khung code chung (khi khóa dùng `frame.md`) |
| `answers` | Code: một tổ hợp `accepted_answers` không biên dịch được là `wrong_answer`, `blocking`; instructions `fill` hứa app chạy test là `verification_mismatch`, `blocking`. `accepted_answers` và test không từ chối cách viết đã dạy; gợi ý (`hints`/`feedback`) chỉ về mô hình tư duy cần xem lại (P6), không lộ đáp án. `fill` có 1–5 chỗ điền chỉ ở phần cốt lõi; `edit` chỉ khi test so khớp chuỗi chấm đáng tin (logic nhiều tầng hoặc nhiều lời giải đúng mà test chuỗi không phân biệt được: `unsupported_platform_format`, `blocking`) |

## Luôn là blocking với Code

- Code `fill`/`edit`: `accepted_answers` từ chối cách viết biên dịch được mà bài trước đã dạy; instructions mâu thuẫn với chỗ điền.
- Bài `code_exercise` thiếu trường `reinforces`, hoặc bài code viết thành bước dựng tính năng thay vì củng cố mô hình tư duy.
- `wrong_answer` với code: chỉ khi `accepted_answers` hoặc test từ chối đáp án đã dạy hoặc cách viết thường gặp ở trình độ đó, hoặc test chấp nhận đúng lỗi sai mà bài đã nêu. Cách viết hiếm gặp bị từ chối, hoặc cố tình sửa code để né test, chỉ là `minor`. Gợi ý lộ đáp án hoặc dùng code block là `blocking`.
