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

Ngôn ngữ code đang bật: rust, typescript, javascript, python, java, c, cpp, go. Solidity và Move chưa bật.

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

## Sơ đồ (trong article)

Đặc tả dữ liệu, không phải ảnh. Tối đa 4 cột (0–3), 3 hàng (0–2), 8 node, mỗi ô một node. Nhãn node tối đa 4 từ và 24 ký tự, không trùng nhau, giữ nguyên tên lệnh và biến. Cạnh đi từ nguồn tới đích đúng nghĩa. `route: straight` chỉ khi đường thẳng không xuyên node khác, còn lại dùng `arc_above` hoặc `arc_below`. Hai cạnh giữa cùng một cặp node dùng hai route khác nhau. `style: dashed` cùng `crossed: true` cho quan hệ không còn hợp lệ. Tham chiếu trong markdown bằng `![mô tả](diagram:<id>)`, mỗi sơ đồ đúng một lần.

## Công cụ cục bộ

- Tìm video trên kênh được phép: `deno run -A --no-config scripts/studio/youtube-search.ts --query "<2-4 từ khóa>"`
- Đọc caption để chọn đoạn video: `deno run -A --no-config scripts/studio/youtube-captions.ts --url "<URL>" --query "<tiêu đề bài và outcome>"`

Cả hai cần `yt-dlp`. Không tự cài package; không tải video hoặc audio.
