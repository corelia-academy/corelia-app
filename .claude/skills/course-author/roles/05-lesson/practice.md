# Quy tắc viết bài: Practice

Áp dụng kèm `roles/05-lesson/common.md`.

## Practice

- `mode: "checklist"`. Mỗi mục là một bước, lấy từ `setup_steps` của research và đúng `stack_choice`, gồm năm trường, mỗi trường một việc:
  - `title`: nhãn ngắn của bước, tối đa 60 ký tự, câu mệnh lệnh ("Đọc nhãn verify của USDC"). Đây là dòng đứng cạnh ô tick.
  - `action`: việc cần làm, một đến hai câu, đủ để làm theo mà không cần đoán.
  - `expected`: chỉ những gì người học nhìn thấy khi làm đúng (kèm giá trị đã quan sát, ghi ngày). Không viết việc cần làm ở đây.
  - `record`: điều cần ghi vào ghi chú, kể cả cách ghi khi không thấy ("không thấy"). Bỏ trống khi bước không cần ghi gì.
  - `common_errors`: tối đa ba lỗi, mỗi lỗi một dòng dạng "triệu chứng: cách xử lý".
- `action` tối đa 300 ký tự (`lesson-lint` kiểm). Ứng dụng hiển thị `action` thành một đoạn chữ liền, không xuống dòng được, nên không nhét câu lệnh nhiều dòng, SQL hay đoạn mã dài vào đó.
- `snippet` (tùy chọn, ngoài năm trường trên): `{ "language": "sql", "code": "..." }`. Dùng khi bước cần người học sao chép tệp hoặc câu lệnh nhiều dòng. `code` là mã thật, xuống dòng bằng `\n`, không tự bọc code fence (`import-local.ts` dựng fence ngay sau `action`). Mỗi bước tối đa một snippet; cần nhiều tệp thì tách bước. `action` chỉ nói làm gì với snippet đó (ví dụ "Tạo tệp `reset-auth.sql` với nội dung dưới đây rồi chạy bằng `psql`").
- `instructions_markdown` mở bằng mục tiêu của bài thực hành và điều cần chuẩn bị. Đây chỉ là phần mở đầu: không chép lại nội dung các bước, vì mỗi bước đã có `action`, `expected` và `common_errors` riêng để người học làm và tick từng bước.

## Output

Khối `practice` trong `lessons/<lesson_id>.json`:

```json
"practice": { "mode": "checklist", "instructions_markdown": "", "checklist_items": [{ "id": "", "title": "", "action": "", "expected": "", "record": "", "common_errors": [""] }] }
```

Bước cần mã thì thêm khóa tùy chọn `snippet` vào mục tương ứng: `"snippet": { "language": "", "code": "" }`.
