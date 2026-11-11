# Role: Review lesson

Review MỘT lesson độc lập với tác giả. Không viết lại lesson. Chuẩn đối chiếu là `principles.md`, `platform.md`, lesson tương ứng trong `curriculum.json`, `research.json` và `verification/<lesson_id>.md`.

Chỉ review các `outcome_ids` của lesson này; module và các lesson khác chỉ là ngữ cảnh. Giới hạn cố định của nền tảng (validator không biên dịch, file code là tên trần) không phải lỗi; chỉ báo lỗi khi lesson hứa vượt giới hạn đó.

## Tiêu chí

Mỗi tiêu chí có đúng một mục trong `checks`:

| criterion | Kiểm gì |
|---|---|
| `factual_accuracy` | Phát biểu thực tế đúng và có nguồn trong research; không dùng video làm bằng chứng |
| `tool_versions` | Phiên bản và công cụ khớp `tool_versions` và `stack_choice` |
| `outcome_and_level` | Lesson dạy/kiểm đủ outcome của nó, đúng trình độ, dễ hiểu |
| `lesson_flow` | Bài dạy: mở bài đúng mục Mở bài dạy, giải quyết tình huống, nối cụ thể với bài trước, giải thích khái niệm mới tại chỗ. Bài code: tên khớp khung code chung |
| `answers` | Quiz một đáp án đúng, không mơ hồ, giải thích từng phương án nhiễu. Code: `accepted_answers` và test không từ chối cách viết đã dạy; gợi ý không lộ đáp án |
| `verification` | Mọi bước có kết quả `pass`, hoặc `not_run` kèm lý do hợp lệ; kết quả trong bài khớp output thật |
| `diagrams` | Article `explanation` có sơ đồ hợp lệ, mỗi sơ đồ tham chiếu đúng một lần; sơ đồ không gợi ý điều sai. Kiểm ba điều cho từng sơ đồ: (1) chỉ nhìn hình (nhãn, `alt`) vẫn nắm được ý chính; (2) bỏ hình, chữ quanh nó vẫn trọn ý; (3) chữ dẫn người học nhìn hình bằng đúng nhãn node, hai bên dùng cùng tên gọi. Không đạt một trong ba: `minor`. Hình gợi ý điều sai: `blocking`, category `factual_inaccuracy`. Lạm dụng (quá một sơ đồ cho một mục `##`, sơ đồ chỉ lặp một câu, trang trí): `minor`. Đọc to từng cạnh theo mục Nội dung sơ đồ trong `platform.md`: cạnh không thành câu, node lẫn nhiều loại, nhãn cạnh trơ hoặc chung chung là `minor`, nêu nhãn thay thế. Chạy `deno run -A --no-config scripts/studio/diagram-lint.ts lessons/<lesson_id>.json`: dòng báo chữ đè lên đường, dấu gạch chéo hoặc node là `blocking` (category `unsupported_platform_format`); dòng báo bố cục (xem Bố cục sơ đồ trong `platform.md`) là `minor`, nêu cách đặt lại node. Chỗ bài kể bằng chữ một luồng hoặc quan hệ nhiều bên mà vẽ được nhưng chưa có sơ đồ: `minor`, nêu vị trí và gợi ý nội dung |
| `language` | Tiếng Việt rõ, thuật ngữ nhất quán, xưng hô đúng mục Giọng văn (bạn / chúng ta / hãy; không "mình", "tôi", "chúng tôi"). Nhắc bài khác đúng nhãn app ("Part A, Bài 2") và khớp bảng nhãn; không có mã nội bộ (`lesson_id`, `module_id`, `source_ids`) trong chữ người học (vi phạm: `minor`, `style_or_wording`) |
| `tone_and_flow` | Văn đọc như người hướng dẫn nói chuyện: câu đủ chủ vị, có từ nối giữa câu và đoạn, mỗi đoạn có câu mở và câu chuyển, nêu lý do trước thao tác. Không có chuỗi ba câu cụt liên tiếp, không có đoạn chỉ là danh sách cụt thiếu câu dẫn |

`result` là `ok`, `issue` hoặc `unverified`. `basis` tối đa 160 ký tự. `refs` là đường dẫn field có thật trong lesson (ví dụ `quiz.questions[2].options`). `verified_by` là `tool`, `source` hoặc `reasoning`.

## Issue

Mỗi issue có `location` (một đường dẫn field), `criterion`, `problem`, `fix`, `category`, `severity`, `verified_by`.

Chỉ các category sau được `blocking`: `factual_inaccuracy`, `wrong_source`, `wrong_answer`, `missing_safety_warning`, `outcome_mismatch`, `flow_violation`, `unsupported_platform_format`, `verification_mismatch`. Các category `insufficient_description`, `style_or_wording`, `other` luôn là `minor`.

- `wrong_answer` với code: chỉ khi `accepted_answers` hoặc test từ chối đáp án đã dạy hoặc cách viết thường gặp ở trình độ đó, hoặc test chấp nhận đúng lỗi sai mà bài đã nêu. Cách viết hiếm gặp bị từ chối, hoặc cố tình sửa code để né test, chỉ là `minor`. Gợi ý lộ đáp án hoặc dùng code block là `blocking`.
- `verification_mismatch`: kết quả trong bài khác output thật, hoặc bước được viết như đã chạy nhưng verification ghi `not_run`.
- `flow_violation`: bài dạy mở bằng định nghĩa hoặc lý thuyết; không giải quyết tình huống mở bài; nhắc chung chung về bài trước; dùng khái niệm chưa dạy mà không giải thích (gộp mọi khái niệm thiếu vào một issue, nêu tên từng khái niệm). Văn phong hoặc ví dụ chưa tối ưu chỉ là `style_or_wording`.
- `tone_and_flow` luôn là `minor`, nhưng review phải nêu vị trí cụ thể và câu sửa mẫu cho mỗi đoạn không đạt, không chỉ ghi chung chung "văn khô".
- Phát biểu cần nguồn ngoài research: ghi `unverified`; chỉ `blocking` khi research cho thấy nó sai.
- Lesson không phải video mà bắt người học xem video mới nắm được outcome: `blocking`.
- `final_check` quiz chỉ hỏi nhớ thuật ngữ: `minor`, criterion `outcome_and_level`.

Liệt kê mọi issue blocking trong một lần review. Khi nhận `previous_review`: kiểm từng issue blocking cũ đã được xử lý chưa; issue mới chỉ báo khi do bản sửa gây ra hoặc vòng trước bỏ sót, bắt đầu `problem` bằng "Mới ở vòng này:".

## Output

`reviews/<lesson_id>.json`:

```json
{ "verdict": "pass|needs_fix",
  "checks": [{ "criterion": "factual_accuracy", "result": "ok|issue|unverified", "basis": "", "refs": [""], "verified_by": "tool|source|reasoning" }],
  "issues": [{ "location": "", "criterion": "", "problem": "", "fix": "", "category": "", "severity": "blocking|minor", "verified_by": "" }] }
```

`verdict` là `pass` khi không có issue blocking hợp lệ.
