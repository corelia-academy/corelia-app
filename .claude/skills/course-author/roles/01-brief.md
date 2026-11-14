# Role: Metadata và brief

Từ đầu vào của user và catalog hiện có (đọc từ file `.course-plan/catalog.json` nếu tồn tại), viết hai file: metadata của khóa và brief.

## Metadata

Bối cảnh để chốt phạm vi, không phải nguồn của nội dung khóa. Khi có `handoff.json`, không web search cho `demand` và `trend`; ghi hai mục đó là `null`. Khi không có `handoff.json`, dùng web search để tìm và đọc trang thật. Đánh giá từng mục mức 1–5, kèm căn cứ ngắn và URL đã đọc:

- `demand`: nhu cầu học và tuyển dụng (ghi `null` khi có `handoff.json`)
- `trend`: xu hướng của chủ đề (ghi `null` khi có `handoff.json`)
- `feasibility`: mức nền tảng kiểm được outcome của chủ đề (đối chiếu `platform.md`)
- `maintainability`: tốc độ nội dung bị lỗi thời
- `catalog_gap`: đối chiếu với file `.course-plan/catalog.json` để xem catalog Corelia đã phủ phần nào của chủ đề; catalog rỗng hoặc file chưa tồn tại thì ghi rỗng, không coi là bằng chứng
- `risks`: điều cần chú ý (an toàn, pháp lý, công cụ trả phí, phần cứng)

Không tính điểm tổng, không xếp hạng giữa các khóa.

## Brief

- `title_en`: tiêu đề tiếng Anh chuẩn. Khi có `handoff.json`, `brief.slug` BẮT BUỘC bằng `handoff.slug` và author làm việc trong đúng thư mục `.course-runs/<handoff.slug>/`. Khi không có handoff: `title_en` dùng làm căn cứ sinh slug.
- `slug`: khi có `handoff.json`, lấy nguyên văn từ `handoff.slug`; khi không có handoff, sinh từ `title_en`, chữ thường, nối bằng `-`.
- `title`: tiêu đề tiếng Việt hiển thị.
- `topic`: một nhiệm vụ cụ thể người học hoàn thành được khi học xong, dùng động từ quan sát được ("viết bộ đọc một file cấu hình và báo lỗi đầu tiên"). Toàn khóa xoay quanh nhiệm vụ này.
- `audience`, `level`.
- `promise`: khi có `handoff.json`, giữ nguyên văn trường `promise` từ handoff; khi không có handoff, ghi `null`.
- `final_product`: khi có `handoff.json`, giữ nguyên văn trường `final_product` từ handoff; khi không có handoff, ghi `null`.
- `goals`: hành động người học làm được và quan sát được. Khi có `promise`, mục tiêu (goal) đầu tiên bắt buộc khớp với `promise`. Không viết "hiểu X". Không hứa năng lực mà khóa không kiểm được.
- `scope`, `out_of_scope`: chốt từng chủ đề lớn là trong hay ngoài khóa, vừa với trình độ và thời lượng. Bước sau không quyết định lại phạm vi. Nếu có `scope_note`: mọi chủ đề trong đó nằm trong `scope`, hoặc nằm trong `out_of_scope` kèm lý do.
- `prerequisites`: kiến thức cần có trước. Không ghi điều kiện như biết đọc tiếng Việt hay có máy tính; những điều đó thuộc `audience`.
- `tools`: công cụ dùng trong ví dụ, practice và bài cuối khóa. Không ghi phiên bản; bước research chốt sau.
- `code_language`: một ID đang bật trong `platform.md` khi khóa có bài `code_exercise`; khóa dạy một ngôn ngữ đang bật thì chọn đúng ngôn ngữ đó. `null` khi khóa không có bài code.
- `is_foundation`: khi có handoff, lấy trực tiếp từ handoff; khi không có handoff: `true` khi user nói khóa là khóa basic đầu một path để các khóa sau kế thừa; mặc định `false`. `true` thì áp dụng `references/foundation.md`.
- `prerequisite_courses`: danh sách đường dẫn tới thư mục hoặc `provided_prerequisites.json` của khóa nền tảng mà khóa này kế thừa (khi có handoff, lấy từ handoff). Có giá trị thì kiểm tra và đọc file `provided_prerequisites.json` trong thư mục đó để lấy `prerequisites` theo mục "Khóa kế thừa" trong `references/foundation.md`. Nếu khóa tiên quyết chưa có file `provided_prerequisites.json`: ghi câu hỏi vào `open_questions` ("Khóa tiên quyết <slug> chưa có provided_prerequisites.json để trích xuất danh sách prerequisites chuẩn hóa"), không tự ý bổ sung ngầm; rỗng khi không có.
- `duration_hours`: ước tính.
- `assumptions`: mọi suy luận từ metadata hoặc từ đầu vào không ghi rõ.

Dùng `feasibility` và `risks` để giới hạn `scope` và cách đánh giá. `demand` và `trend` chỉ là bối cảnh. Không chép URL của metadata vào brief làm nguồn.

Không xác định được chủ đề hoặc đối tượng: trả `status: "needs_input"` cùng `open_questions`.

## Output

`metadata.json`:

```json
{ "demand": {"level": 1, "basis": "", "urls": []}, "trend": {}, "feasibility": {}, "maintainability": {}, "catalog_gap": {}, "risks": [""] }
```

`brief.json`:

```json
{ "status": "ready", "title_en": "", "slug": "", "title": "", "topic": "", "audience": "", "level": "beginner|intermediate|advanced",
  "promise": null, "final_product": null,
  "goals": [""], "scope": [""], "out_of_scope": [""], "prerequisites": [""], "tools": [""],
  "code_language": null, "is_foundation": false, "prerequisite_courses": [], "duration_hours": 0, "assumptions": [""], "open_questions": [] }
```
