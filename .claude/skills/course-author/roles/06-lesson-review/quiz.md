# Tiêu chí review: Quiz

Áp dụng kèm `roles/06-lesson-review/common.md`.

## Tiêu chí riêng cho Quiz

| criterion | Kiểm gì |
|---|---|
| `lesson_flow` | Bài dạy: mở bài đúng mục Mở bài dạy, giải quyết tình huống, nối cụ thể với bài trước, giải thích khái niệm mới tại chỗ. Bài code: tên khớp khung code chung |
| `answers` | Quiz một đáp án đúng, không mơ hồ, giải thích từng phương án nhiễu; các phương án cùng độ dài, đáp án đúng không dài nhất, vị trí đáp án đúng trải đều; mỗi outcome của quiz được kiểm đủ các vế (thiếu một vế: `outcome_mismatch`, `blocking`). Code: một tổ hợp `accepted_answers` không biên dịch được là `wrong_answer`, `blocking`; instructions `fill` hứa app chạy test là `verification_mismatch`, `blocking`. `accepted_answers` và test không từ chối cách viết đã dạy; gợi ý không lộ đáp án. `fill` có 1–5 chỗ điền chỉ ở phần cốt lõi; `edit` chỉ khi test so khớp chuỗi chấm đáng tin (logic nhiều tầng hoặc nhiều lời giải đúng mà test chuỗi không phân biệt được: `unsupported_platform_format`, `blocking`) |

## Luôn là blocking với Quiz

- Quiz: đáp án đúng dài nhất hoặc ngắn bất thường so với nhiễu, đáp án đúng dồn một vị trí, explanation tự mâu thuẫn, thiếu câu curriculum yêu cầu cho outcome, khẳng định tuyệt đối vượt nguồn hoặc phản ví dụ hiển nhiên.
- `final_check` quiz chỉ hỏi nhớ thuật ngữ: `minor`, criterion `outcome_and_level`.
