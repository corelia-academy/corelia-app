# Rust CLI pilot — local fixture

Khóa học có 2 sections và 12 lessons dùng chung IDs cho `vi/en`. `course.json` là nguồn seed; `video-fixture.json` là fixture YouTube riêng, không phải điều kiện hoàn thành pilot.

## Seed

Chạy isolated Supabase theo `supabase/AGENTS.md`, apply migrations rồi:

```sh
node scripts/learning/seed-local.mjs
node scripts/learning/seed-local.mjs
```

Script chỉ truy cập container `supabase_db_corelia-app`, thực hiện transaction và upsert qua API authoring. Không dùng database URL từ môi trường, không gửi email, không tạo enrollment hoặc phát credential. Profile attribution/admin dùng ID riêng; tài khoản này chưa có mật khẩu đăng nhập. Tài khoản browser QA phải được tạo riêng qua Auth local.

## Reference project / Dự án tham khảo

```sh
cargo test --manifest-path docs/learning/pilot/reference/Cargo.toml
cargo run --manifest-path docs/learning/pilot/reference/Cargo.toml -- add "Learn Rust"
cargo run --manifest-path docs/learning/pilot/reference/Cargo.toml -- list
cargo run --manifest-path docs/learning/pilot/reference/Cargo.toml -- done 1
```

Mặc định dữ liệu lưu trong `tasks.tsv` ở working directory; dùng `CORELIA_TASK_FILE` để chọn file riêng. Project không có dependency ngoài Rust standard library. Không dùng chung file dữ liệu giữa nhiều process ghi đồng thời.

The reference implements `add`, `list`, and `done`, UTF-8 TSV persistence, checked IDs, explicit errors, and six unit tests. Set `CORELIA_TASK_FILE` to isolate your data. The `starter` directory is the initial Cargo project; learners implement the required behavior themselves. The browser exercises use text rules and do not compile Rust.

## Review

Nộp GitHub URL và notes tại final assignment duy nhất của course. Reviewer chạy `cargo test`, thử add → khởi động lại → list → done, kiểm tra file lỗi, README và khả năng tái lập. Pending hoặc “Cần chỉnh sửa” chưa hoàn thành course. Approve chỉ hoàn thành sau khi đủ lessons published.

Không tự công khai repository hoặc bài nộp; learner quyết định việc chia sẻ. Seed và unit test không phải phản hồi từ learner thật.
