# 08 — Hackathons (công khai)

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ `/hackathons` và trang contest công khai **`/hackathons/:slug`** — **một trang** cuộn với anchor hash (`#about`, `#timeline`, …), không còn tab route riêng làm luồng chính. Legacy `/hackathons/:slug/overview` (và các path tab cũ) chỉ dùng smoke redirect.

## Tiền đề staging

- Ít nhất một contest **published** có `slug` cố định.
- Khuyến nghị: **hai contest seed** ở lifecycle phase khác nhau (ví dụ `registration_open` và `ended`) — xem README hub.
- Contest `ended` có **published leaderboard** hoặc winner announcements để test `#results`.
- Contest có submissions hoặc published leaderboard để test `#projects` showcase.

## Tài khoản cần dùng

- **Ẩn danh** — xem public, lifecycle CTA guest.
- **Student_1** — đăng ký, workspace participant (application / submission), heart project khi đăng nhập.

## Checklist

### A. Danh sách & routing

1. **Ẩn danh**: `/hackathons` — danh sách load; contest draft chỉ hiện với manager khi applicable ([09](./09-hackathons-manage-workspace.md)).
2. Mở `/hackathons/<slug>` — trang single-page load; **không** redirect sang `/overview`.
3. Legacy smoke: `/hackathons/<slug>/overview`, `/timeline`, `/prizes`, `/rules`, `/faqs`, `/projects` — redirect về canonical `/hackathons/<slug>` + hash tương ứng (không 404).

### B. Subnav & sections

4. Sticky subnav (`ContestPublicNav`): click từng mục — scroll tới section, highlight tab active.
5. Các section hiện theo dữ liệu contest (ghi nhận mục nào có/không):
   - `#about`, `#timeline`, `#resources`, `#track`, `#prizes`, `#badges`, `#learn`, `#people`, `#partners`, `#rules`, `#faq`, `#final-cta`
   - `#results` — chỉ khi contest **ended** và đã publish leaderboard hoặc winners
   - `#projects` — khi có showcase (submissions hoặc published leaderboard)
6. **FAQs**: accordion mở/đóng (`<details>`), không crash layout.

### C. Lifecycle & hero CTA

7. Với contest **upcoming**: badge + countdown “mở đăng ký”; CTA guest → login/account settings.
8. Với contest **registration_open**:
   - **Ẩn danh**: CTA đăng nhập / đăng ký.
   - **Student_1** chưa đăng ký: CTA đăng ký contest.
   - **Student_1** pending / approved / rejected — CTA và copy phù hợp từng trạng thái.
   - Nếu `auto_approve_registrations`: copy đăng ký tức thì hiển thị đúng.
9. Với contest **in_progress**: CTA submit / xem submission (approved) hoặc follow timeline/projects (visitor).
10. Với contest **judging**: CTA gallery/projects khi showcase visible.
11. Với contest **ended**: CTA winners/results; `#results` trong nav khi có dữ liệu publish.

### D. Showcase & results

12. `#projects`: thứ tự leaderboard + project liên kết; project orphan (nếu seed) vẫn hiển thị.
13. `#results`: bảng/xếp hạng và thông báo giải sau khi organizer publish ([09](./09-hackathons-manage-workspace.md) bước publish).
14. **Student_1** đăng nhập: thử heart/like project (nếu UI có) — không crash.

### E. Participant workspace (cột phải / mobile)

15. **Student_1**: tab Application / Submission; hash `#application` hoặc tương đương sync với URL hash.
16. Mobile: sticky CTA và FAB workspace (nếu user có quyền manage) — không che nội dung chính.

### F. Resilience & i18n

17. Đổi locale EN/VI — chuỗi lifecycle (`detail.lifecycle.*`), nav public (`detail.public.nav.*`) dịch đúng.
18. Gây lỗi permission (ví dụ action sau deadline) — toast hiển thị message localized (`detail.errors.*`), **không** hiện raw code API.
19. *(Known issue)* `SectionErrorBoundary` copy retry có thể **hardcoded tiếng Việt** khi locale EN — ghi nhận nếu gặp.

## Kết quả mong đợi

- Public contest đọc được end-to-end trên single-page + hash; legacy URL redirect đúng.
- Lifecycle badge, countdown và CTA khớp phase thời gian thực.
- Không lỗi auth lock khi chỉ xem ([STAGING_BUILD_VERIFY.md](../STAGING_BUILD_VERIFY.md)).

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
