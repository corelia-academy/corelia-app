# QA Manual — Corelia App (Staging)

Tài liệu checklist cho tester kiểm thử **staging**. Mỗi file trong thư mục này tương ứng một nhóm tính năng.

**Phiên bản HTML** (checkbox + ghi chú lưu `localStorage`, export/import JSON): [manual.html](./manual.html) — mở file trực tiếp trong trình duyệt hoặc host tĩnh.

## URL và môi trường

- **URL staging**: lấy từ team (DevOps / internal wiki). Repo không cố định URL công khai.
- **Backend staging**: workflow CI **Deploy Staging** chỉ áp dụng **Supabase** (migrations + Edge Functions khi có thay đổi). File trong repo: [.github/workflows/deploy-staging.yml](../../.github/workflows/deploy-staging.yml).
- **Frontend staging**: deploy **riêng** (Cloudflare Workers/Pages hoặc pipeline tương đương). Nếu API đã mới nhưng UI vẫn sai hành vi, coi phần verify bundle bên dưới.

### Chuẩn bị trình duyệt

1. Dùng cửa sổ ẩn danh hoặc profile sạch khi cần tránh cache/extension.
2. Sau mỗi lần deploy frontend: **hard reload** (Cmd+Shift+R / Ctrl+Shift+R).
3. Mở DevTools → Console để xem lỗi JS và chạy lệnh verify build.

### Verify phiên bản build (bắt buộc khi nghi cache hoặc bug “đã sửa nhưng vẫn cũ”)

Theo [STAGING_BUILD_VERIFY.md](../STAGING_BUILD_VERIFY.md):

1. Mở staging, DevTools → Console.
2. Chạy:

```js
window.__CORELIA_BUILD__
```

3. Đối chiếu `version` với `version` trong [package.json](../../package.json) của commit/release mà team mong đợi.

Chi tiết thêm (auth lock, perf markers): xem trực tiếp [docs/STAGING_BUILD_VERIFY.md](../STAGING_BUILD_VERIFY.md).

### Biến môi trường (tham khảo cho dev / CI)

Client build cần tối thiểu `VITE_SUPABASE_URL` và một trong `VITE_SUPABASE_PUBLISHABLE_KEY` hoặc `VITE_SUPABASE_ANON_KEY`. OCID và form feedback là tùy chọn — xem [.env.example](../../.env.example) và [README.md](../../README.md).

---

## Role trong hệ thống và gate truy cập

| Role (`profiles.role`) | `/admin/*` | `/instructor/*` | Hackathon manager (`/hackathons/manage`, `/hackathons/new`) |
|------------------------|------------|-----------------|---------------------------------------------------------------|
| `student`              | Không      | Không           | Chỉ khi email có trong `co_organizer_emails` của contest (scoped) — xem [09-hackathons-manage-workspace.md](./09-hackathons-manage-workspace.md) |
| `instructor`           | Không      | Có              | Có (catalog quản lý)                                          |
| `support_staff`        | **Có**     | **Có**          | Có                                                            |
| `admin`                | **Có**     | **Có**          | Có                                                            |

**Lưu ý:** `admin` và `support_staff` **đều** được vào `/admin` và `/instructor` theo cấu hình hiện tại (`ROLE_GROUPS.admin` và `ROLE_GROUPS.instructorWorkspace`). Nếu nghiệp vụ yêu cầu kiểm tra riêng quyền admin vs support (ví dụ audit), hãy có **hai** tài khoản và so sánh.

---

## Ma trận tài khoản đề xuất (tối thiểu để phủ màn hình)

| ID | Mục đích | `profiles.role` | Ghi chú setup |
|----|----------|-----------------|---------------|
| **Student_1** | Luồng học viên chính | `student` | Đăng ký qua UI staging |
| **Student_2** *(tuỳ chọn)* | Invite project, tương tác đa user | `student` | Email khác Student_1 |
| **Instructor_1** | Workspace giảng viên + hackathon manager | `instructor` | Gán role sau khi có user (SQL staging hoặc Admin Users nếu team hỗ trợ) |
| **Admin_1** hoặc **Support_1** | Trang quản trị + có thể vào instructor | `admin` **hoặc** `support_staff` | Một account là đủ cho smoke **admin**; dùng **hai** account nếu cần so sánh policy |
| **Scoped_coorganizer** | Vào `/hackathons/manage` không cần instructor | `student` (hoặc role bất kỳ đã login) | Thêm **email** user vào `co_organizer_emails` của một contest trên staging |
| **Scoped_reviewer** *(tuỳ chọn)* | Tab `applications` trên workspace contest | `student` hoặc role bất kỳ | Email trong `reviewer_emails` của contest seed |
| **Scoped_judge** *(tuỳ chọn)* | Tab `judging` trên workspace contest | `student` hoặc role bất kỳ | Email trong `judge_emails` của contest seed |

**Không** dùng production để chỉnh role hoặc seed dữ liệu test.

### Tiền đề staging — Hackathons

- Ít nhất một contest **published** với `slug` cố định (team ghi trong sheet QA).
- Khuyến nghị **hai contest** ở lifecycle phase khác nhau (ví dụ đang mở đăng ký vs đã kết thúc) — chỉnh timestamp trên staging hoặc seed riêng.
- Registrations với status **approved**, **pending**, **rejected** để test email blast ([09](./09-hackathons-manage-workspace.md)).
- Contest **ended** đã **publish results** để test `#results` trên public ([08](./08-hackathons-public.md)).
- Edge Function **`hackathons.blastEmail`** đã deploy staging; biến `RESEND_API_KEY`, `MAIL_FROM` (hoặc chấp nhận UI `notConfigured`).

---

## Mục lục checklist

| File | Nội dung |
|------|----------|
| [01-auth-session-ocid.md](./01-auth-session-ocid.md) | Đăng ký, đăng nhập, phiên, OCID |
| [02-home-discovery.md](./02-home-discovery.md) | Trang chủ (khách / đã login) |
| [03-courses-catalog-detail-checkout-learn.md](./03-courses-catalog-detail-checkout-learn.md) | Khóa học, checkout, học |
| [04-career-roadmap.md](./04-career-roadmap.md) | Career + roadmap |
| [05-projects-invites-search.md](./05-projects-invites-search.md) | Projects, invite, search |
| [06-public-profiles.md](./06-public-profiles.md) | Hồ sơ công khai `/u/:handle` |
| [07-account-hub.md](./07-account-hub.md) | `/account/*`, `/cora` |
| [08-hackathons-public.md](./08-hackathons-public.md) | Hackathon công khai — single-page `/hackathons/:slug` + hash, lifecycle, showcase |
| [09-hackathons-manage-workspace.md](./09-hackathons-manage-workspace.md) | Workspace manage — tabs overview/applications/judging/email/… |
| [10-instructor-workspace.md](./10-instructor-workspace.md) | Workspace instructor |
| [11-admin.md](./11-admin.md) | Admin (`admin` / `support_staff`), activity milestones |
| [12-cross-cutting-i18n-theme-errors.md](./12-cross-cutting-i18n-theme-errors.md) | i18n, theme, 404, lỗi |
| [13-activity-feed-follow.md](./13-activity-feed-follow.md) | Activity Feed + Follow System |
| [13-activity-feed-follow-runtime-report.md](./13-activity-feed-follow-runtime-report.md) | Báo cáo QA issue #96, tách phần cần test tay runtime |
| [13-activity-feed-follow-manual.html](./13-activity-feed-follow-manual.html) | Checklist HTML cơ bản cho sub-issue QA #96, có export/import JSON |

---

## Báo lỗi

Template và quy trình gợi ý: [GOOGLE_FORM_BUG_REPORT.md](../GOOGLE_FORM_BUG_REPORT.md).
