# Tiêu chí review: Quiz

Áp dụng kèm `roles/06-lesson-review/common.md`.

## Tiêu chí riêng cho Quiz

| criterion | Kiểm gì |
|---|---|
| `lesson_flow` | Bài dạy: mở bài đúng mục Mở bài dạy, giải quyết tình huống, nối cụ thể với bài trước, giải thích khái niệm mới tại chỗ. Bài code: tên khớp khung code chung |
| `answers` | Quiz một đáp án đúng, không mơ hồ, giải thích từng phương án nhiễu; câu hỏi có cơ sở trong nguồn hoặc bài trước; mỗi phương án sai có cơ sở (misconception có nguồn hoặc lựa chọn đúng ở tình huống khác) và `explanation` nêu lý do loại trừ cụ thể; người đã học loại được nhiễu bằng mô hình tư duy, người chưa học không đoán được nhờ dấu hiệu bề mặt; vị trí đáp án đúng trải đều; không chấm theo độ dài phương án; mỗi outcome của quiz được kiểm đủ các vế (thiếu một vế: `outcome_mismatch`, `blocking`). Code: một tổ hợp `accepted_answers` không biên dịch được là `wrong_answer`, `blocking`; instructions `fill` hứa app chạy test là `verification_mismatch`, `blocking`. `accepted_answers` và test không từ chối cách viết đã dạy; gợi ý không lộ đáp án. `fill` có 1–5 chỗ điền chỉ ở phần cốt lõi; `edit` chỉ khi test so khớp chuỗi chấm đáng tin (logic nhiều tầng hoặc nhiều lời giải đúng mà test chuỗi không phân biệt được: `unsupported_platform_format`, `blocking`) |

Với Quiz: đa số câu hỏi là dự đoán, giải thích, chẩn đoán (lập luận dựa trên mô hình tư duy); mỗi phương án nhiễu gắn với một misconception từ research hoặc brief; explanation giải thích rõ theo mô hình tư duy và misconception liên quan.

## Luôn là blocking với Quiz

- Quiz: câu hỏi bịa hoặc không có cơ sở trong nguồn, phương án vô nghĩa hoặc sai hiển nhiên, phương án sai không có lý do loại trừ trong `explanation`, câu đoán được nhờ dấu hiệu bề mặt thay vì mô hình tư duy, đáp án đúng dồn một vị trí, explanation tự mâu thuẫn, thiếu câu curriculum yêu cầu cho outcome, khẳng định tuyệt đối vượt nguồn hoặc phản ví dụ hiển nhiên.
- `final_check` quiz chỉ hỏi nhớ thuật ngữ: `minor`, criterion `outcome_and_level`.
