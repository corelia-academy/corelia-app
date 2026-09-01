# Phạm vi sản phẩm Hackathon

## Public overview

Header chung hiển thị banner, title, short description, host name/logo/website, mode `online`/`offline`/`hybrid`, số người đăng ký, hai deadline, Telegram/X/Facebook và CTA theo trạng thái đăng nhập/đăng ký.

Header chỉ tải một lần trong layout cha. Chuyển tab giữ nguyên header và không cuộn lại đầu trang.

## Tabs

| Tab | Nội dung |
|---|---|
| Overview | Description Markdown, thông tin nhanh và trạng thái đăng ký |
| Prizes | Tổng prize pool, currency, Markdown description và phân bổ theo track |
| Timeline | Timeline dọc; title, start/end và Markdown description |
| Resources | Nội dung Markdown |
| Projects | Winner-first, filter track/sector/tech stack, newest/oldest và load more |

Tab trống vẫn tồn tại và hiển thị empty state. Trên mobile, tab bar cuộn ngang với touch target tối thiểu 44px; trên desktop tab bar sticky dưới header ứng dụng.

## Registration

- Một người có tối đa một registration trong mỗi hackathon.
- CTA tạo registration `registered` ngay lập tức; không có bước duyệt.
- Backend từ chối khi hackathon không mở hoặc đã qua `registration_deadline`.
- `participants_count` là tổng số registration và được trigger duy trì khi insert/delete.
- Public chỉ đọc counter, không đọc danh sách participant.

## Project và winner

- Project dự thi phải có ít nhất một track, một sector và một tech stack.
- OR trong cùng nhóm filter; AND giữa ba nhóm.
- Taxonomy do admin cấu hình trước. Mục đã được project dùng không được xóa, chỉ archive.
- Project có slug canonical. UUID và slug cũ redirect sang slug hiện tại; slug cũ không được tái sử dụng.
- Owner hoặc admin/support sửa project. Backend khóa thay đổi nội dung/taxonomy sau `submission_deadline`.
- Winner có thể có nhiều nhãn giải; admin đặt `sort_order`. Winner phù hợp filter luôn đứng trước project thường.

## Admin editor

Editor dùng layout tương tự course editor: status/metrics header, sticky sidebar, locale switcher VI/EN, section cards, lưu theo section và cảnh báo draft chưa lưu.

Các section:

1. Overview
2. Description
3. Prize & Tracks
4. Timeline
5. Resources
6. Project Taxonomy
7. Projects & Winners
8. Publish, end & delete

## Ngoài phạm vi

- Phí tham gia.
- Giới hạn participant.
- Co-organizer, judge, reviewer, mentor và observer.
- Duyệt registration.
- Score, rubric, judging rounds và leaderboard tính điểm.
- Analytics riêng, email blast và credential award từ hackathon editor.

Các mục ngoài phạm vi thuộc hệ thống hackathon cũ bị xoá, không phải tính năng tạm ẩn hoặc dự kiến bật lại. Vì chưa có hackathon thật, score và scoped access-invite cũ không cần export trước migration.
