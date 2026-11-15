# Quy tắc viết bài: Article

Áp dụng kèm `roles/05-lesson/common.md`.

### Article

Article `explanation` có ít nhất một sơ đồ trong `diagrams`, theo quy tắc sơ đồ trong `platform.md`. Thêm sơ đồ chỉ ở chỗ chữ đang kể một cấu trúc, luồng, quan hệ hoặc sự đối lập mà vẽ được trong giới hạn nền tảng, và tuân theo mục Minh họa bằng sơ đồ trong `principles.md`: tối đa một sơ đồ cho mỗi mục `##`, thường 1–3 sơ đồ cho cả bài, không vẽ trang trí. Mỗi sơ đồ đặt ngay sau đoạn nó minh họa và tham chiếu đúng một lần. Chữ và hình phải bổ trợ nhau: bỏ chữ vẫn nắm được ý chính từ nhãn và `alt`, bỏ hình vẫn hiểu trọn từ chữ, và đoạn văn dẫn người học nhìn hình bằng đúng nhãn node. Tình huống mở bài là một chỗ có thể có sơ đồ khi nó có nhiều bên (website, ví, contract...) hoặc có một điều cần nhìn thấy mới hiểu. Viết nhãn theo mục Nội dung sơ đồ trong `platform.md` (đọc to từng cạnh thành câu) và đặt node theo mục Bố cục sơ đồ (dòng chính trong một hàng, ưu tiên 2 hàng, nguồn phụ hợp lưu từ hàng trên). Trước khi trả kết quả, chạy `deno run -A --no-config scripts/studio/diagram-lint.ts lessons/<lesson_id>.json` và sửa mọi dòng nó báo.

## Cấu trúc thân bài

Giữ quy tắc mở bài hiện có (mở bằng tình huống cụ thể: hiện tượng quan sát được, câu hỏi mở bài).

Thân bài BẮT BUỘC triển khai theo đúng thứ tự:
1. **Hiện tượng quan sát được**: kết quả lạ, thông báo lỗi, một giá trị hoặc hành vi bất thường.
2. **Mô hình tư duy**: giải thích cơ chế, quy luật, cấu trúc bản chất bên dưới giải thích hiện tượng đó (kèm sơ đồ nếu là bài `explanation`).
3. **Mô hình dự đoán được gì**: vận dụng mô hình để suy luận, dự đoán các tình huống khác.
4. **Lỗi hiểu thường gặp và vì sao sai**: các lỗi hiểu sai (từ `misconceptions`), giải thích vì sao sai theo mô hình.
5. **Đoạn code ngắn minh họa (nếu có)**: đoạn code ngắn gọn, chỉ đủ để thấy mô hình hoạt động. TUYỆT ĐỐI KHÔNG viết thành hướng dẫn từng bước dựng tính năng.

## Output

Khối `article` trong `lessons/<lesson_id>.json`:

```json
"article": { "description_markdown": "", "diagrams": [{ "id": "", "alt": "", "nodes": [{ "id": "", "label": "", "col": 0, "row": 0 }], "edges": [{ "from": "", "to": "", "label": "", "route": "straight|arc_above|arc_below", "style": "solid|dashed", "crossed": false }] }] }
```
