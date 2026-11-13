# Role: Review lesson

Review MỘT lesson độc lập với tác giả. Không viết lại lesson. Chuẩn đối chiếu là `principles.md`, `platform.md`, lesson tương ứng trong `curriculum.json`, `research.json` và `verification/<lesson_id>.md`.

Chỉ review các `outcome_ids` của lesson này; module và các lesson khác chỉ là ngữ cảnh. Giới hạn cố định của nền tảng (validator không biên dịch, file code là tên trần) không phải lỗi; chỉ báo lỗi khi lesson hứa vượt giới hạn đó.

## Tiêu chí

Mỗi tiêu chí có đúng một mục trong `checks`:

| criterion | Kiểm gì |
|---|---|
| `factual_accuracy` | Kiểm phát biểu thực tế, định nghĩa, kiến thức nền và hướng dẫn quyết định theo nguồn đã đọc; đối chiếu điều kiện, phạm vi và phản ví dụ liên quan, không chỉ khớp từ khóa. Phân biệt định nghĩa chung với đặc tính của nền tảng hoặc trường hợp cụ thể; không dùng video làm bằng chứng |
| `tool_versions` | Phiên bản và công cụ khớp `tool_versions` và `stack_choice` |
| `outcome_and_level` | Lesson dạy/kiểm đủ outcome của nó, đúng trình độ, dễ hiểu |
| `lesson_flow` | Bài dạy: mở bài đúng mục Mở bài dạy, giải quyết tình huống, nối cụ thể với bài trước, giải thích khái niệm mới tại chỗ. Bài code: tên khớp khung code chung |
| `learnability` | Bài dạy (article, tóm lược video): đặt mình vào người học đúng trình độ của bài và trả lời được năm câu. (1) Bài nêu đích, tức sau bài này làm hoặc phân biệt được gì? (2) Tình huống mở bài có phải thứ cụ thể nhìn thấy trọn vẹn (chương trình và kết quả chạy thật, màn hình), không phải dòng dữ liệu rời? (3) Vấn đề được cho thấy trước khi dạy cú pháp? (4) Mỗi mục `##` kết bằng kết luận trả lời đúng điều nó mở ra, không chứa nội dung của chủ đề khác? (5) Mỗi khối code có kết quả chạy thật kèm lời chỉ ra điều cần để ý, không dùng lệnh kiểm tra rời làm minh họa? Một câu trả lời "không" có bằng chứng là `flow_violation`, `blocking` khi người mới đọc xong không nói lại được bài muốn nói gì; còn lại `minor`, nêu vị trí và câu sửa mẫu |
| `frame_consistency` | Khóa có code: tên file/module, kiểu, biến thể, chữ ký, chuỗi in ra và import khớp `frame.md` và các bài kề; code và output trong bài ghép được với bài trước (đặt file ghép thử nếu cần). Lệch làm người học viết hoặc đọc code không biên dịch hay ra output khác bài kề: `flow_violation`, `blocking`; chỉ lệch chữ: `minor` |
| `answers` | Quiz một đáp án đúng, không mơ hồ, giải thích từng phương án nhiễu; các phương án cùng độ dài, đáp án đúng không dài nhất, vị trí đáp án đúng trải đều; mỗi outcome của quiz được kiểm đủ các vế (thiếu một vế: `outcome_mismatch`, `blocking`). Code: một tổ hợp `accepted_answers` không biên dịch được là `wrong_answer`, `blocking`; instructions `fill` hứa app chạy test là `verification_mismatch`, `blocking`. `accepted_answers` và test không từ chối cách viết đã dạy; gợi ý không lộ đáp án. `fill` có 1–5 chỗ điền chỉ ở phần cốt lõi; `edit` chỉ khi test so khớp chuỗi chấm đáng tin (logic nhiều tầng hoặc nhiều lời giải đúng mà test chuỗi không phân biệt được: `unsupported_platform_format`, `blocking`) |
| `verification` | Mọi bước có kết quả `pass`, hoặc `not_run` kèm lý do hợp lệ; kết quả trong bài khớp output thật |
| `diagrams` | Article `explanation` có sơ đồ hợp lệ, mỗi sơ đồ tham chiếu đúng một lần; sơ đồ không gợi ý điều sai. Kiểm ba điều cho từng sơ đồ: (1) chỉ nhìn hình (nhãn, `alt`) vẫn nắm được ý chính; (2) bỏ hình, chữ quanh nó vẫn trọn ý; (3) chữ dẫn người học nhìn hình bằng đúng nhãn node, hai bên dùng cùng tên gọi. Không đạt một trong ba: `blocking` (category `style_or_wording`). Hình gợi ý điều sai: `blocking`, category `factual_inaccuracy`. Lạm dụng (quá một sơ đồ cho một mục `##`, sơ đồ chỉ lặp một câu, trang trí): `minor`. Đọc to từng cạnh theo mục Nội dung sơ đồ trong `platform.md`: cạnh không thành câu, node lẫn nhiều loại, nhãn cạnh trơ hoặc chung chung là `blocking` (`style_or_wording`), nêu nhãn thay thế. Chạy `deno run -A --no-config scripts/studio/diagram-lint.ts lessons/<lesson_id>.json`: dòng báo chữ đè lên đường, dấu gạch chéo hoặc node là `blocking` (category `unsupported_platform_format`); dòng báo bố cục (xem Bố cục sơ đồ trong `platform.md`) là `minor`, nêu cách đặt lại node. Chỗ bài kể bằng chữ một luồng hoặc quan hệ nhiều bên mà vẽ được nhưng chưa có sơ đồ: `minor`, nêu vị trí và gợi ý nội dung |
| `language` | Tiếng Việt rõ, thuật ngữ nhất quán, xưng hô đúng mục Giọng văn (bạn / chúng ta / hãy; không "mình", "tôi", "chúng tôi"). Nhắc bài khác đúng nhãn app ("Part A, Bài 2") và khớp bảng nhãn; không có mã nội bộ (`lesson_id`, `module_id`, `source_ids`) trong chữ người học (vi phạm: `minor`, `style_or_wording`) |
| `tone_and_flow` | Văn đọc như người hướng dẫn nói chuyện: câu đủ chủ vị, có từ nối giữa câu và đoạn, mỗi đoạn có câu mở và câu chuyển, nêu lý do trước thao tác. Không có chuỗi ba câu cụt liên tiếp, không có đoạn chỉ là danh sách cụt thiếu câu dẫn |

`result` là `ok`, `issue` hoặc `unverified`. `basis` tối đa 160 ký tự. `refs` là đường dẫn field có thật trong lesson (ví dụ `quiz.questions[2].options`). `verified_by` là `tool`, `source` hoặc `reasoning`.

## Issue

Mỗi issue có `location` (một đường dẫn field), `criterion`, `problem`, `fix`, `category`, `severity`, `verified_by`.

**Phân loại.** Mọi vi phạm một quy tắc viết bằng chữ trong `principles.md`, `platform.md`, `roles/05-lesson.md` hoặc `frame.md` là `blocking`, bất kể category (chọn category đúng nhất, kể cả `style_or_wording`, `insufficient_description`, `other`). `minor` chỉ dành cho gợi ý không vi phạm quy tắc nào và không làm người học hiểu sai, làm sai hay đọc sai (ví dụ chọn từ hay hơn). Nghi ngờ giữa hai mức thì chọn `blocking`.

Luôn là `blocking`:

- Xưng hô sai ("ta" tự xưng, "mình", "tôi", "chúng tôi"), mã nội bộ trong chữ người học, nhãn "Part X, Bài N" không có trong bảng nhãn hoặc trỏ nhầm bài.
- Lệch `frame.md` hoặc bài kề: tên file/module, kiểu, biến thể, chữ ký, chuỗi in ra, chỗ đặt định nghĩa; câu nói code ở "cuối Part X" mà bài đó đặt khác.
- Quiz: đáp án đúng dài nhất hoặc ngắn bất thường so với nhiễu, đáp án đúng dồn một vị trí, explanation tự mâu thuẫn, thiếu câu curriculum yêu cầu cho outcome, khẳng định tuyệt đối vượt nguồn hoặc phản ví dụ hiển nhiên.
- Code `fill`/`edit`: `accepted_answers` từ chối cách viết biên dịch được mà bài trước đã dạy; instructions mâu thuẫn với chỗ điền.
- Khái niệm, cú pháp hoặc ký hiệu dùng mà chưa giải thích (gộp một issue, nêu từng tên).
- Khối code người học thấy không có kết quả chạy thật, hoặc kết quả chỉ đúng một hệ điều hành/phiên bản mà bài không nói; ví dụ trong tóm lược video không có verification.
- Sơ đồ: nhãn cạnh ngược chiều vẽ, hai cạnh cùng ý dùng động từ khác nhau, phủ định kép, node lẫn loại, cạnh không thành câu.
- Bất kỳ dòng nào `scripts/lesson-lint.mjs` báo. Reviewer chạy lại script trên lesson trước khi kết luận.

Category `blocking` hợp lệ gồm cả `factual_inaccuracy`, `wrong_source`, `wrong_answer`, `missing_safety_warning`, `outcome_mismatch`, `flow_violation`, `unsupported_platform_format`, `verification_mismatch` như trước; các category còn lại (`insufficient_description`, `style_or_wording`, `other`) là `blocking` khi vi phạm danh sách trên, `minor` khi không.

- `wrong_answer` với code: chỉ khi `accepted_answers` hoặc test từ chối đáp án đã dạy hoặc cách viết thường gặp ở trình độ đó, hoặc test chấp nhận đúng lỗi sai mà bài đã nêu. Cách viết hiếm gặp bị từ chối, hoặc cố tình sửa code để né test, chỉ là `minor`. Gợi ý lộ đáp án hoặc dùng code block là `blocking`.
- `verification_mismatch`: kết quả trong bài khác output thật, hoặc bước được viết như đã chạy nhưng verification ghi `not_run`.
- `flow_violation`: bài dạy mở bằng định nghĩa hoặc lý thuyết; không giải quyết tình huống mở bài; nhắc chung chung về bài trước; dùng khái niệm chưa dạy mà không giải thích (gộp mọi khái niệm thiếu vào một issue, nêu tên từng khái niệm). Văn phong hoặc ví dụ chưa tối ưu chỉ là `style_or_wording`.
- `tone_and_flow` là `minor` (trừ xưng hô sai, luôn `blocking`), nhưng review phải nêu vị trí cụ thể và câu sửa mẫu cho mỗi đoạn không đạt, không chỉ ghi chung chung "văn khô".
- Với kiến thức nền hoặc hướng dẫn cốt lõi cần cho outcome, kiểm tra nghĩa người mới có thể hiểu từ câu và ngữ cảnh gần, kể cả tiêu đề, ví dụ, hình và đáp án. Khi phạm vi bị trình bày sai hoặc thiếu khiến phát biểu gây hiểu nhầm về bản chất và có bằng chứng: `factual_inaccuracy`, `blocking`, nêu nguồn và phản ví dụ liên quan. Ví dụ, đặc tính riêng của Ethereum không được dùng làm định nghĩa chung của smart contract; câu giới hạn rõ "trên Ethereum" có thể đúng trong phạm vi đó.
- Phát biểu cốt lõi chưa đủ nguồn để xác minh: ghi `unverified` trong `checks`, tạo issue `wrong_source`, `blocking`, nêu phát biểu, bằng chứng còn thiếu và yêu cầu bổ sung research; không khẳng định phát biểu sai chỉ vì thiếu nguồn. Phát biểu phụ thiếu nguồn: ghi `unverified`, yêu cầu bỏ hoặc bổ sung nguồn, không tự nâng thành lỗi thực tế. Khi nguồn đã đọc chứng minh sai, dùng `factual_inaccuracy`, `blocking`.
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
