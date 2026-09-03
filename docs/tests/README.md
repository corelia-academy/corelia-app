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

Client build cần tối thiểu `VITE_SUPABASE_URL` và một trong `VITE_SUPABASE_PUBLISHABLE_KEY` hoặc `VITE_SUPABASE_ANON_KEY`. OCID là tùy chọn — xem [.env.example](../../.env.example) và [README.md](../../README.md).

---

## Role trong hệ thống và gate truy cập

| Role (`profiles.role`) | `/admin/*` | `/instructor/*` | Hackathon MVP mục tiêu |
|------------------------|------------|-----------------|------------------------|
| `student`              | Không      | Không           | Chỉ tham gia            |
| `instructor`           | Không      | Có              | Chỉ tham gia             |
| `support_staff`        | **Có**     | **Có**          | Hỗ trợ vận hành         |
| `admin`                | **Có**     | **Có**          | Toàn quyền              |

**Lưu ý:** `admin` và `support_staff` **đều** được vào `/admin` và `/instructor` theo cấu hình hiện tại (`ROLE_GROUPS.admin` và `ROLE_GROUPS.instructorWorkspace`). Nếu nghiệp vụ yêu cầu kiểm tra riêng quyền admin vs support (ví dụ audit), hãy có **hai** tài khoản và so sánh.

---

## Ma trận tài khoản đề xuất (tối thiểu để phủ màn hình)

| ID | Mục đích | `profiles.role` | Ghi chú setup |
|----|----------|-----------------|---------------|
| **Student_1** | Luồng học viên chính | `student` | Đăng ký qua UI staging |
| **Student_2** *(tuỳ chọn)* | Invite project, tương tác đa user | `student` | Email khác Student_1 |
| **Instructor_1** | Workspace giảng viên; negative test admin hackathon | `instructor` | Gán role sau khi có user (SQL staging hoặc Admin Users nếu team hỗ trợ) |
| **Admin_1** hoặc **Support_1** | Trang quản trị + có thể vào instructor | `admin` **hoặc** `support_staff` | Một account là đủ cho smoke **admin**; dùng **hai** account nếu cần so sánh policy |

**Không** dùng production để chỉnh role hoặc seed dữ liệu test.

### Tiền đề staging — Hackathons

Module dùng public tabs và editor tại `/admin/hackathons`. Dùng dữ liệu và luồng trong [checklist Hackathon](../hackathon/acceptance-checklist.md). Không chuẩn bị judge, score, leaderboard, email blast hoặc scoped role cũ.

---

## Mục lục checklist

| File | Nội dung |
|------|----------|
| [01-auth-session-ocid.md](./01-auth-session-ocid.md) | Đăng ký, đăng nhập, phiên, OCID |
| [02-home-discovery.md](./02-home-discovery.md) | Trang chủ (khách / đã login) |
| [03-courses-catalog-detail-checkout-learn.md](./03-courses-catalog-detail-checkout-learn.md) | Khóa học, checkout, học |
| [04-career.md](./04-career.md) | Career |
| [05-projects-invites-search.md](./05-projects-invites-search.md) | Projects, invite, search |
| [06-public-profiles.md](./06-public-profiles.md) | Hồ sơ công khai `/u/:handle` |
| [07-account-hub.md](./07-account-hub.md) | `/account/*` |
| [Hackathon MVP](../hackathon/README.md) | Phạm vi mới, luồng tối giản và checklist nghiệm thu hackathon |
| [10-instructor-workspace.md](./10-instructor-workspace.md) | Workspace instructor |
| [11-admin.md](./11-admin.md) | Admin (`admin` / `support_staff`), activity milestones |
| [12-cross-cutting-i18n-theme-errors.md](./12-cross-cutting-i18n-theme-errors.md) | i18n, theme, 404, lỗi |
| [13-activity-feed-follow.md](./13-activity-feed-follow.md) | Activity Feed + Follow System |
| [13-activity-feed-follow-runtime-report.md](./13-activity-feed-follow-runtime-report.md) | Báo cáo QA issue #96, tách phần cần test tay runtime |
| [13-activity-feed-follow-manual.html](./13-activity-feed-follow-manual.html) | Checklist HTML cơ bản cho sub-issue QA #96, có export/import JSON |
| [14-oca-mint-course-flow.md](./14-oca-mint-course-flow.md) | Mint OCA (course credential): happy path, case biên, idempotency |
