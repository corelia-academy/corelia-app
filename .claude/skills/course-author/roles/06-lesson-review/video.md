# Tiêu chí review: Video

Áp dụng kèm `roles/06-lesson-review/common.md`.

## Tiêu chí riêng cho Video

| criterion | Kiểm gì |
|---|---|
| `lesson_flow` | Bài dạy: mở bài đúng mục Mở bài dạy, giải quyết tình huống, nối cụ thể với bài trước, giải thích khái niệm mới tại chỗ. Bài code: tên khớp khung code chung |
| `learnability` | Bài dạy (article, tóm lược video): đặt mình vào người học đúng trình độ của bài và trả lời được năm câu. (1) Bài nêu đích, tức sau bài này làm hoặc phân biệt được gì? (2) Tình huống mở bài có phải thứ cụ thể nhìn thấy trọn vẹn (chương trình và kết quả chạy thật, màn hình), không phải dòng dữ liệu rời? (3) Vấn đề được cho thấy trước khi dạy cú pháp? (4) Mỗi mục `##` kết bằng kết luận trả lời đúng điều nó mở ra, không chứa nội dung của chủ đề khác? (5) Mỗi khối code có kết quả chạy thật kèm lời chỉ ra điều cần để ý, không dùng lệnh kiểm tra rời làm minh họa? Một câu trả lời "không" có bằng chứng là `flow_violation`, `blocking` khi người mới đọc xong không nói lại được bài muốn nói gì; còn lại `minor`, nêu vị trí và câu sửa mẫu |

## Luôn là blocking với Video

- Khối code người học thấy không có kết quả chạy thật, hoặc kết quả chỉ đúng một hệ điều hành/phiên bản mà bài không nói; ví dụ trong tóm lược video không có verification.
- **Tiêu chí "chỉ đọc":** reviewer đọc phần `## Tóm lược kiến thức` mà không dựa vào video, đối chiếu với từng outcome trong `outcome_ids` của bài và từng câu của bài kiểm tra ngay sau. Bất kỳ outcome hoặc câu hỏi nào không trả lời được từ bài tóm lược cùng các bài đứng trước là `blocking` (category: `outcome_mismatch` hoặc `flow_violation`). Người học chỉ đọc bài tóm lược bên dưới video vẫn phải đạt trọn vẹn outcome của bài.
