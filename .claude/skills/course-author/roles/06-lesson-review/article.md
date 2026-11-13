# Tiêu chí review: Article

Áp dụng kèm `roles/06-lesson-review/common.md`.

## Tiêu chí riêng cho Article

| criterion | Kiểm gì |
|---|---|
| `lesson_flow` | Bài dạy: mở bài đúng mục Mở bài dạy, giải quyết tình huống, nối cụ thể với bài trước, giải thích khái niệm mới tại chỗ. Bài code: tên khớp khung code chung |
| `learnability` | Bài dạy (article, tóm lược video): đặt mình vào người học đúng trình độ của bài và trả lời được năm câu. (1) Bài nêu đích, tức sau bài này làm hoặc phân biệt được gì? (2) Tình huống mở bài có phải thứ cụ thể nhìn thấy trọn vẹn (chương trình và kết quả chạy thật, màn hình), không phải dòng dữ liệu rời? (3) Vấn đề được cho thấy trước khi dạy cú pháp? (4) Mỗi mục `##` kết bằng kết luận trả lời đúng điều nó mở ra, không chứa nội dung của chủ đề khác? (5) Mỗi khối code có kết quả chạy thật kèm lời chỉ ra điều cần để ý, không dùng lệnh kiểm tra rời làm minh họa? Một câu trả lời "không" có bằng chứng là `flow_violation`, `blocking` khi người mới đọc xong không nói lại được bài muốn nói gì; còn lại `minor`, nêu vị trí và câu sửa mẫu |
| `diagrams` | Article `explanation` có sơ đồ hợp lệ, mỗi sơ đồ tham chiếu đúng một lần; sơ đồ không gợi ý điều sai. Kiểm ba điều cho từng sơ đồ: (1) chỉ nhìn hình (nhãn, `alt`) vẫn nắm được ý chính; (2) bỏ hình, chữ quanh nó vẫn trọn ý; (3) chữ dẫn người học nhìn hình bằng đúng nhãn node, hai bên dùng cùng tên gọi. Không đạt một trong ba: `blocking` (category `style_or_wording`). Hình gợi ý điều sai: `blocking`, category `factual_inaccuracy`. Lạm dụng (quá một sơ đồ cho một mục `##`, sơ đồ chỉ lặp một câu, trang trí): `minor`. Đọc to từng cạnh theo mục Nội dung sơ đồ trong `platform.md`: cạnh không thành câu, node lẫn nhiều loại, nhãn cạnh trơ hoặc chung chung là `blocking` (`style_or_wording`), nêu nhãn thay thế. Chạy `deno run -A --no-config scripts/studio/diagram-lint.ts lessons/<lesson_id>.json`: dòng báo chữ đè lên đường, dấu gạch chéo hoặc node là `blocking` (category `unsupported_platform_format`); dòng báo bố cục (xem Bố cục sơ đồ trong `platform.md`) là `minor`, nêu cách đặt lại node. Chỗ bài kể bằng chữ một luồng hoặc quan hệ nhiều bên mà vẽ được nhưng chưa có sơ đồ: `minor`, nêu vị trí và gợi ý nội dung |

## Luôn là blocking với Article

- Sơ đồ: nhãn cạnh ngược chiều vẽ, hai cạnh cùng ý dùng động từ khác nhau, phủ định kép, node lẫn loại, cạnh không thành câu.
