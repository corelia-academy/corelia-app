# Khả năng nền tảng

Nguồn đúng là code; file này tóm tắt để các role không hứa vượt khả năng nền tảng. Khi code đổi, cập nhật file này theo code.

- Loại bài và giới hạn: `supabase/functions/corelia-api/studio/formats.ts`
- Ngôn ngữ code đang bật: `supabase/functions/corelia-api/studio/lesson_ports.ts` (`CODE_LANGUAGE_ADAPTERS`, chỉ `status: "enabled"`)
- Practice và artifact: `src/features/learning/types.ts` (`PracticeConfig`, `ArtifactField`)
- Bài cuối khóa: `src/types/courses.ts` (`final_assignment_*`)
- Kênh YouTube được phép: `supabase/functions/corelia-api/studio/channels.ts` (`ALLOWED_CHANNELS`)

## Loại bài

| Loại | Kiểm được | Không kiểm được |
|---|---|---|
| `article` | Hoàn thành khi đọc. Markdown, kèm sơ đồ | Hiểu bài; kỹ năng đọc hoặc vẽ sơ đồ |
| `video` | Hoàn thành khi xem. Video YouTube từ kênh được phép, có thể cắt đoạn | Hiểu bài |
| `quiz` | Trắc nghiệm một đáp án, tự chấm theo ngưỡng đạt. Hiểu khái niệm, dự đoán kết quả, đọc code | Nội dung sơ đồ (quiz không hiển thị sơ đồ) |
| `code_exercise` | Một file, một ngôn ngữ đang bật. `fill`: điền chỗ trống. `edit`: viết/sửa để qua test so khớp chuỗi | Biên dịch, chạy, terminal. Test chứa/không chứa chuỗi có thể bị né bằng chú thích |
| `practice` | Checklist từng bước người học tự tick. Không chặn bài sau | Việc người học có làm thật hay không |

Ngôn ngữ code đang bật: rust, typescript, javascript, python, java, c, cpp, go, solidity, move. Solidity và Move chạy như mọi ngôn ngữ khác (file `.sol`, `.move`, chấm bằng so khớp chuỗi, không biên dịch); riêng Move mở trong editor dưới dạng văn bản thường, không tô màu cú pháp.

## Chọn dạng `code_exercise`

Mọi lựa chọn dưới đây chỉ dùng các dạng bài đã có, không đòi nền tảng thêm khả năng. Giới hạn blank nằm ở `lesson_ports.ts` (`invalid_blanks`).

- `fill` có từ 1 đến 5 chỗ trống. Chỉ để chỗ trống ở phần là trọng tâm và có giá trị cốt lõi của outcome; phần còn lại (khung hàm, import, đoạn lặp, đoạn đã dạy ở bài trước) cho sẵn trong `starter_source`. Một bài cần hơn 5 chỗ điền thì thu hẹp trọng tâm hoặc tách thành hai bài.
- `edit` chỉ khi lời giải có chữ ký và khung cố định, và tập cách viết đúng đủ nhỏ để test so khớp chuỗi (`contains`, `not_contains`, `equals`) vừa chấp nhận mọi cách viết đúng thường gặp vừa không cho qua code sai. Test chuỗi không kiểm được logic nhiều tầng hay thứ tự thực thi.
- Logic nhiều tầng hoặc nhiều cách giải hợp lệ (ví dụ lan truyền lỗi qua nhiều hàm) dùng `fill` cho phần cốt lõi. Phần "tự viết trọn vẹn" luyện bằng `practice` tự chạy trên máy người học và kiểm bằng bài cuối khóa do giảng viên chấm; ghi rõ phần nào do bài tự chấm kiểm, phần nào do giảng viên chấm.
- Khi `brief.code_language != null`: mỗi module dạy logic/cơ chế thể hiện được bằng mã nguồn dùng `code_exercise` (`fill` 1–5 chỗ trống hoặc `edit` khung cố định) để kiểm tra phần cốt lõi tự chấm trên app, thay vào vị trí quiz thừa hoặc đứng làm bước đệm trước `practice`.

## Đoạn phát của video

`start_seconds` và `end_seconds` chỉ được xác định từ các đoạn trong `segments` đã có `caption_evidence` qua `youtube-captions.ts`. Đoạn phát tối đa 720 giây (`MAX_VIDEO_SEGMENT_SECONDS`). Phát cả video chỉ khi `duration_seconds` ≤ 900 (`MAX_FULL_VIDEO_SECONDS`) và `assumes` không chứa khái niệm chưa được dạy ở bài đứng trước. Không đoán timestamp và không ghi mốc thời gian không có `caption_evidence`.

## Practice

`PracticeConfig.mode` có `instruction`, `checklist`, `submission`, `guided_project`.

- `checklist`: `checklist_items` là `{ id, label }`, chỉ có một dòng chữ cho mỗi mục.
- `guided_project`: mỗi bước là `{ id, title, instructions_markdown, verification: "self_check" | "artifact_required", order }`.

Mỗi bước practice cần chứa việc cần làm, kết quả mong đợi, lỗi hay gặp và cách sửa. Người học tự đánh dấu từng bước; bước practice không khóa bài tiếp theo.

## Bài cuối khóa

Cấp course, không phải lesson. Các trường:

- `final_assignment_title`
- `final_assignment_description`: tình huống và sản phẩm cần làm
- `final_assignment_instructions`: yêu cầu nộp và tiêu chí chấm công bố cho người học
- `final_assignment_fields`: tập con của `github_url`, `deployment_url`, `contract_address`, `transaction_url`, `demo_url`, `notes`. Luôn có `notes` để người học giải thích lựa chọn.

Người chấm là instructor; cách chấm nằm ngoài phạm vi skill này.

## Công cụ cục bộ

- Kiểm sơ đồ của một lesson (chữ đè đường hoặc node, cạnh xuyên node, quá lưới, cùng các gợi ý bố cục ở trên): `deno run -A --no-config scripts/studio/diagram-lint.ts <lessons/<lesson_id>.json>`. Thoát mã 1 và in lý do khi có lỗi.
- Tìm video trên kênh được phép: `deno run -A --no-config scripts/studio/youtube-search.ts --query "<2-4 từ khóa>" [--track <slug>]` (cờ `--track` lọc đúng các kênh của track từ `channels.ts`; kết quả tự xếp video 120–1800 giây lên trước).
- Đọc dàn ý video cho bước research: `deno run -A --no-config scripts/studio/youtube-captions.ts --url "<URL>" --outline [--range <start>-<end>]`. Trả về thời lượng (`duration_seconds`, `duration_source`), track (`language`, `track`), danh sách các đoạn (`segments`) và `truncated: true` kèm phạm vi đã trả nếu chạm trần kích thước. Với video dài hơn 1800 giây, chạy `--query` trước để xác định vùng timestamp rồi mới chạy `--outline --range <start>-<end>`.
- Đọc caption theo truy vấn: `deno run -A --no-config scripts/studio/youtube-captions.ts --url "<URL>" --query "<tiêu đề bài và outcome>"`
- Lấy bằng chứng cho một đoạn dạy (đã chọn ranh giới từ outline, tối đa 720 giây): `deno run -A --no-config scripts/studio/youtube-captions.ts --url "<URL>" --range <start>-<end>`. Kết quả tái lập được: cùng đoạn cho cùng `cue_text_sha256`.
- Kiểm tra các ràng buộc tất định về bài video trong curriculum: `node .claude/skills/course-author/scripts/curriculum-lint.mjs <thư-mục-khóa>`.

Cần `yt-dlp`. Không tự cài package; không tải video hoặc audio.
