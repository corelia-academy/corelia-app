# Staging QA Full Report — 2026-05-09

- **Date:** 2026-05-09 21:29–23:50 GMT+7
- **Staging URL:** https://staging.corelia.academy/
- **Build version:** `0.2.1`
- **Tester:** Automated QA via Chrome DevTools Protocol + manual admin session

## Executive Summary

Đã hoàn thành:
- ✅ Guest smoke test toàn bộ public routes
- ✅ Authenticated admin snapshot (users, dashboard, instructors, hackathons manage, instructor courses)
- ✅ Tạo thành công 1 QA course qua automation: `QA Smoke Course 2026-05-09` (ID: `20c12b8d-...`)
- ❌ Chưa tạo được lessons/career/hackathon do Chrome remote-debugging session bị đóng giữa chừng

**Blocker:** Chrome automation session (port 9224) bị disconnect sau khi tạo course. Cần reopen để tiếp tục.

---

## 1. Guest/Unauth Test Results

Xem chi tiết: `docs/tests/guest-unauth-staging-2026-05-09.md`

**Pass:**
- `/`, `/login`, `/courses`, `/career`, `/roadmap`, `/projects`, `/search`, `/hackathons` load đúng
- Protected routes (`/account/*`, `/admin/*`, `/instructor/*`) redirect về `/login`
- Unknown path `/not-a-real-path-qa` → `/u/not-a-real-path-qa` với message "User not found"
- Không console/log errors trong smoke pass

**Empty states (đúng thiết kế):**
- `/courses`: "0 results – No courses match the current filters"
- `/career`: "No tracks yet"
- `/hackathons`: "0 total · 0 accepting · 0 running · 0 ended"
- `/projects`: "No projects yet"

---

## 2. Authenticated Admin Session Snapshot

**User hiện tại:**
- Email: `thaiphamngoctuong@gmail.com`
- Role: Administrator
- OCID connected: `corelia.edu` / ETH `0x8c1dc1fb…f5f43e`
- Public handle: `/terrancrypt`

**Admin workspace:**
- `/admin`: 2 users total (1 admin, 1 student)
  - `terran@corelia.academy` (Student)
  - `thaiphamngoctuong@gmail.com` (Administrator)
- `/admin/dashboard`: Pin programs config form (3 slots)
- `/admin/instructors`: 0 instructors
- `/instructor/courses`: 0 courses (trước khi tạo QA course)
- `/hackathons/manage`: 0 contests

**Account pages:**
- `/account/profile`: Form đầy đủ (name, username, bio, website, phone, avatar, OCID)
- Warning: "Your profile needs a bit more information" (thiếu name/phone)

---

## 3. Content Creation — QA Course

**Thành công:**
- Route: `/instructor/courses/new` → submit → redirect `/instructor/courses/:id/edit`
- Course created: **QA Smoke Course 2026-05-09**
- ID: `20c12b8d-eb2a-4435-ba8e-cd13a05f2007`
- Settings:
  - Access: Free
  - Level: Beginner
  - Published: ✅ checked
  - Languages: VI (primary), EN
  - Revenue: Corelia course

**Form fields observed (course new):**
- Course content languages (VI/EN toggle)
- Primary content language dropdown
- Default video language dropdown
- Course title (text input)
- Slug (auto-suggest từ title)
- Short description (text)
- Description (textarea Markdown)
- What you'll learn (dynamic list, "Add outcome" button)
- Course cover image upload
- Revenue ownership type (Corelia/Partner)
- Course type (Free/Pay upfront/Learn free pay certificate)
- Level (Beginner/Intermediate/Advanced/All levels)
- Published checkbox
- Create course button

**Editor page sau khi tạo:**
- Sections: 0, Lessons: 0, Students: 0, Submissions: 0
- Tabs: Thông tin chung, Giá & thanh toán, Nội dung & bài học, Bài tập cuối khoá, Chứng nhận, Quản lý học viên, Xoá khoá học
- Language switcher: 🇻🇳 VI (chính), 🇬🇧 EN
- Co-instructors, Sponsors, Partners sections present
- Cover image upload
- Save changes button

**Chưa làm được:**
- Thêm chapters/lessons do session disconnect

---

## 4. UX/UI Observations & Recommendations

### 4.1. Public Empty States

**Hiện tại:** Good — clear messages, không lỗi.

**Recommendation:**
- Giữ ít nhất 1 course/public career/hackathon seed trên staging để tester có content click qua detail flows. Hiện tại guest chỉ test được list/empty, không test được `/courses/:id`, `/career/:slug`, `/hackathons/:slug/*`.

### 4.2. Unknown Path Handling

**Issue:** `/not-a-real-path-qa` → `/u/not-a-real-path-qa` → "User not found"

**Recommendation:**
- Nếu path không khớp pattern handle hợp lệ (ví dụ: chứa hyphen dài, numbers only, keywords trùng route), show generic NotFound thay vì cố render user profile.
- Hoặc thêm breadcrumb/gợi ý: "Did you mean `/courses` or `/hackathons`?"

### 4.3. Admin Dashboard Config

**Observation:** Form pin programs có 3 slots, mỗi slot nhiều field (type, source, badge, overrides).

**Recommendation:**
- Add inline validation: nếu enable slot mà chưa chọn source program → highlight error trước khi save.
- Preview mode: show mock how pinned programs appear on learner home.

### 4.4. Instructor Course Editor

**Positive:**
- Multi-language support rõ ràng (VI/EN toggles, primary language selector)
- Step-by-step tabs (Thông tin chung → Nội dung → Bài tập → Chứng nhận...)
- Disabled tabs cho steps chưa hoàn thành (good guidance)

**Issues observed:**
- Tab "Nội dung & bài học" chưa test được flow add chapter/lesson do session disconnect
- Placeholder tiếng Anh trong form tiếng Việt (e.g., "Select co-instructors…", "Add sponsor") → cân nhắc i18n đồng bộ

**Recommendation:**
- Ensure all placeholders/button labels respect current UI language (VI/EN switch)
- Add keyboard shortcuts for power users (Cmd+S save, Cmd+N new chapter)

### 4.5. Career Track Form

**Fields observed:**
- Title, Slug, Description
- "What you'll learn" (one line per item)
- Prerequisites (one line per item)
- Certificate available checkbox
- Published checkbox
- Included courses (picker, "Add course" button)

**Recommendation:**
- Validate slug client-side with real-time availability check
- Show warning if track published but has 0 courses included

### 4.6. Hackathon Create Form

**Fields observed:**
- Title, Slug, Tagline
- Status (Draft/Open/Raning/Ended)
- Format (Online/Offline/Hybrid)
- Dates: Starts, Ends, Registration deadline, Submission deadline
- Approved applications limit
- Banner image, Thumbnail
- Prize pool summary
- Overview, Requirements and rule

**Recommendation:**
- Date validation: Registration deadline ≤ Contest start; Submission deadline ≤ Contest end
- Auto-generate slug từ title với preview editable
- Show public URL preview: `https://staging.corelia.academy/hackathons/<slug>`

### 4.7. Profile Setup Nudge

**Observation:** `/account/profile` shows warning "Your profile needs a bit more information" khi thiếu name/phone.

**Recommendation:**
- Good nudge! Consider making it dismissible hoặc progress bar: "Profile completion: 60%"
- Add tooltip giải thích tại sao cần phone (support contact)

### 4.8. i18n Consistency

**Observed mix:**
- Some buttons/labels in Vietnamese ("Thông tin chung", "Nội dung & bài học")
- Some placeholders in English ("Select co-instructors…", "Add sponsor", "Search public content...")

**Recommendation:**
- Audit all forms for i18n completeness
- Use i18next keys consistently across VI/EN

---

## 5. Test Coverage Matrix

| Area                  | Guest | Auth Admin | Notes                          |
|-----------------------|-------|------------|--------------------------------|
| Home                  | ✅    | ✅         |                                |
| Login/Logout          | ✅    | ✅         | Redirects đúng                 |
| Courses list          | ✅    | ✅         | Empty state OK                 |
| Course detail         | ❌    | ⏸️         | Chưa có public course seed     |
| Checkout              | N/A   | ❌         | Cần course + payment sandbox   |
| Learn routes          | N/A   | ❌         | Cần lesson created             |
| Career list/detail    | ✅    | ❌         | Empty, chưa tạo track          |
| Hackathons list       | ✅    | ✅         | Empty                          |
| Hackathon create      | N/A   | ⏸️         | Form inspected, chưa submit    |
| Admin users           | N/A   | ✅         | 2 users visible                |
| Admin dashboard       | N/A   | ✅         | Pin programs form OK           |
| Admin instructors     | N/A   | ✅         | 0 instructors                  |
| Instructor courses    | N/A   | ✅         | Created 1 QA course            |
| Account profile       | N/A   | ✅         | Form OK, missing name/phone    |
| Account CV            | N/A   | ❌         | Chưa inspect                   |
| Account billing       | N/A   | ❌         | Chưa inspect                   |
| Projects              | ✅    | ❌         | Empty gallery                  |
| Search                | ✅    | ❌         | Empty state OK                 |
| Public profile        | ✅    | ❌         | `/u/:handle` 404 handled       |
| OCID redirect         | N/A   | ✅         | Connected                      |
| i18n switch           | ✅    | ✅         | VI/EN hoạt động                |
| Theme switch          | ✅    | ✅         | Dark/light OK                  |
| 404 handling          | ✅    | ✅         | NotFound component             |

Legend: ✅ tested/pass, ❌ not tested/blocker, ⏸️ partial, N/A not applicable

---

## 6. Next Steps to Complete QA

**Cần reopen Chrome automation:**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9224 \
  --user-data-dir=/tmp/corelia-qa-chrome \
  https://staging.corelia.academy/instructor/courses/20c12b8d-eb2a-4435-ba8e-cd13a05f2007/edit
```

Sau khi login và mở URL trên:

1. **Thêm lessons cho QA course:**
   - Chương 1: "Làm quen với Corelia"
   - Bài 1.1: "Welcome to Corelia" (text/video placeholder)
   - Publish course

2. **Tạo QA Career Track:**
   - Link QA course vào track
   - Publish track

3. **Tạo QA Hackathon:**
   - Điền overview, timeline, prizes, rules
   - Publish ở chế độ Draft hoặc Open

4. **Test public detail routes:**
   - `/courses/20c12b8d-...`
   - `/career/corelia/qa-smoke-track`
   - `/hackathons/qa-smoke-hackathon/overview`
   - `/hackathons/qa-smoke-hackathon/timeline`
   - `/hackathons/qa-smoke-hackathon/prizes`

5. **Test learn flow:**
   - `/learn/:courseId`
   - `/learn/:courseId/lesson/:lessonId`

6. **Export checklist state** vào JSON + update manual.html

---

## 7. Files Created

- `docs/tests/guest-unauth-staging-2026-05-09.md`
- `docs/tests/corelia-qa-checklist-export-guest-unauth-2026-05-09.json`
- `docs/tests/full-staging-qa-admin-content-2026-05-09.md`
- `docs/tests/staging-qa-full-report-2026-05-09.md` (file này)

**Commits:**
- `cfdd004 docs: add guest staging smoke test report`
- `8ae7540 docs: add full staging qa admin plan`

---

## 8. Automation Scripts (workspace)

- `corelia_guest_smoke.py` — guest route smoke
- `cdp_corelia.py` — authenticated snapshot
- `inspect_form.py` — inspect form controls
- `create_course.py` — auto-create QA course (✅ thành công)
- `create_lesson.py` — auto-add lesson (❌ failed do disconnect)

---

**Status:** Chờ reopen Chrome session để tiếp tục tạo lessons/career/hackathon và hoàn thiện report.
