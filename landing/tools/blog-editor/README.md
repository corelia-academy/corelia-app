# Corelia Blog Editor

Trình soạn thảo local dành riêng cho nội dung Markdown trong repo.

```bash
pnpm blog:editor
```

Mở `http://127.0.0.1:4322`. Tool có thể:

- mở, chỉnh sửa và lưu bài trong `src/content/blog/vi` và `src/content/blog/en`;
- gom hai phiên bản có cùng `translationKey` thành một bài và chuyển VI/EN ngay trong editor;
- tạo nhanh bản dịch còn thiếu bằng nút `+ VI` hoặc `+ EN`;
- soạn Markdown với EasyMDE: toolbar định dạng, preview, side-by-side và fullscreen;
- tạo bài Markdown mới với frontmatter cơ bản;
- tải nhiều ảnh vào thư mục con của `public/blog`;
- chèn cú pháp ảnh Markdown tại vị trí con trỏ;
- hiển thị ảnh nào đang được bài viết sử dụng;
- chỉ cho xóa ảnh không còn được tham chiếu trong nội dung blog.

Server chỉ lắng nghe trên `127.0.0.1` và không được đưa vào website production.

Nếu port `4322` đang được một tiến trình khác sử dụng, có thể mở editor trên port khác:

```bash
BLOG_EDITOR_PORT=4323 pnpm blog:editor
```
