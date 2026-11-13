# Quy tắc viết bài: Code exercise

Áp dụng kèm `roles/05-lesson/common.md`.

## Code exercise

- `language` bằng `brief.code_language`; `mode` bằng `code_mode` của curriculum. `file_path` là tên file trần có đuôi đúng ngôn ngữ.
- Dùng đúng tên file, hàm, kiểu đã ghi trong mô tả lesson.
- Theo mục "Chọn dạng `code_exercise`" trong `platform.md`. Mô tả lesson trong curriculum đã nêu chỗ điền hoặc chữ ký; không tự thêm chỗ điền quá 5 hay đổi dạng bài. Nếu mô tả đòi quá 5 chỗ điền, thu hẹp về phần cốt lõi theo `platform.md` và ghi thay đổi vào báo cáo, không hỏi lại user.
- Mọi tên, chữ ký, chuỗi Display và tên file lấy từ `frame.md`; không tự đặt bản riêng. Chạy thật thấy khác khung thì không tự đổi khung: báo coordinator (nêu chỗ lệch và đề xuất), vẫn viết theo khung.
- Instructions của bài `fill` nói rõ app chỉ so khớp từng chỗ điền với `accepted_answers` và không biên dịch hay chạy test của người học; không viết "các test bên dưới kiểm tra" như thể app chạy chúng.
- `fill`: `starter_source` có 1–5 chỗ trống `{{blank:<id>}}`, chỉ đặt ở phần là trọng tâm và có giá trị cốt lõi của outcome; phần còn lại cho sẵn. Mỗi chỗ trống có `accepted_answers` (mọi cách viết đúng thường gặp, mỗi cách một phần tử) và `feedback` giải thích khái niệm. `tests: []`. Starter chưa điền không được tự đạt.
- Với `fill`, bộ chấm chấm từng chỗ độc lập nên người học có thể chọn tổ hợp bất kỳ. Trước khi giao: thay lần lượt mọi tổ hợp đáp án có thể ghép từ `accepted_answers` (nếu quá nhiều thì mọi cặp đáp án của các chỗ liên quan nhau, cộng mẫu ngẫu nhiên các tổ hợp còn lại) vào `starter_source` và biên dịch bằng toolchain của khóa. Đáp án làm tổ hợp không biên dịch (ví dụ một import và một kiểu trả về chỉ hợp lệ khi đi cùng nhau) thì bỏ khỏi `accepted_answers` hoặc đổi cách đặt chỗ trống để các chỗ không phụ thuộc nhau. Ghi số tổ hợp đã thử vào `verification/<id>.md`.
- `edit`: `starter_source` không có chỗ trống; `reference_solution` hoàn chỉnh; `tests` có ít nhất một test `required`. Starter phải chưa đạt mọi test required, `reference_solution` phải đạt mọi test required. Test kiểm điều bài dạy và chấp nhận mọi cách sửa đúng hợp lý. `blanks: []`.
- Gợi ý (`hints`, `feedback`, `failure_message`, hint của test) xếp từ chung đến cụ thể nhưng không chạm đáp án, vì app hiện mọi gợi ý cùng lúc. Chỉ hướng tư duy: câu hỏi nên tự đặt, khái niệm cần xem lại, cách thu hẹp lỗi. Không chứa định danh trùng với đáp án hoặc với `value` của test `contains`, không dán code giải, không dùng code block.

## Output

Khối `code` trong `lessons/<lesson_id>.json`:

```json
"code": { "mode": "fill|edit", "language": "", "instructions": "", "file_path": "", "starter_source": "", "reference_solution": "", "hints": [""],
  "blanks": [{ "id": "", "accepted_answers": [""], "feedback": "" }],
  "tests": [{ "id": "", "kind": "contains|not_contains|equals", "value": "", "required": true, "description": "", "failure_message": "", "hint": "" }] }
```
