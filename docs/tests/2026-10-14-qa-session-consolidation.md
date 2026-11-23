# Tổng hợp QA 2026-10-14

Gộp từ 3 nguồn độc lập. Mỗi phần giữ nguyên mức bằng chứng của nguồn gốc; file này không chạy lại check nào.

- Nhánh tham chiếu: `feat/664-quiz-first-pass-xp`, HEAD `57bee22b` (fix `3358a190`), base `staging`.
- Mốc: tag mới nhất `v0.15.0` (2026-10-10); `main` tại `a135f77c` (2026-10-13); `staging` hơn `main` 6 commit (notifications #702-#704).
- Quy ước: `[FACT]` = đã đọc source/chạy lệnh; `[SUY LUẬN]` = suy ra, chưa chạy; `[CHƯA XÁC MINH]` = cần kiểm chứng thêm.

| Phần | Chủ đề | Kết luận | Mức bằng chứng |
|---|---|---|---|
| 1 | Kế hoạch dev, QA sau v0.15.0, #664/#705, #688, OCID | Cần QA mới sau v0.15.0: CHƯA ĐỦ BẰNG CHỨNG. #705, #688: đề xuất merge | Source + gh; OCID runtime lấy từ docs QA 2026-10-13 |
| 2 | Xóa khóa học có làm mất chứng nhận | CHƯA ĐẠT (một phần) | Chỉ source/migration |
| 3 | Technical gates nhánh #664 | Gate chính PASS; 1 bug script trên Windows; 3 điểm tối ưu | Lệnh đã chạy (do session khác báo) |

---

## Phần 1 — Kế hoạch dev, QA sau v0.15.0, #664/#705, #688, OCID

### 1.1 Phạm vi
- Yêu cầu: liệt kê việc dev nên làm; xác định đoạn từ QA cuối (v0.15.0, ghi nhận đến 2026-10-13) đến app hiện tại có cần QA mới không; giải thích #688/#705; test các case OCID. Phạm vi issue: từ #545 đến nay.
- PR: #705 (fix #664, mở, CLEAN, 2 check pass: Baseline and declaration guards, Clean local migration recreate); #688 (copy XP quiz, mở, CLEAN).

### 1.2 Kết luận
| Hạng mục | Kết luận | Ghi chú |
|---|---|---|
| QA mới cho v0.15.0 → staging HEAD | CHƯA ĐỦ BẰNG CHỨNG | Không có tài liệu QA nào trong `docs/tests` bao phủ |
| #705 | Source pass, chưa có runtime staging | Đề xuất merge, rủi ro thấp; QA một ca trên staging sau merge |
| #688 | Nên merge | Chưa xác minh chữ "+30 XP" hardcode hay lấy từ config |
| OCID — ca chính | PASS trên staging sandbox (2026-10-13) | Bằng chứng từ docs QA của user, không phải session tự chạy |
| OCID — hai tài khoản cùng một OC | CHƯA ĐỦ BẰNG CHỨNG | Chưa chạy được |

### 1.3 Finding
**#664 [P4] — Quiz đậu lần đầu không được XP khi chưa enroll**
- `[FACT]` Trong `private.learning_quiz_submit`, `UPDATE group_total` chạy trước `INSERT enrollments`; trigger `private.xp_quiz_passed` (AFTER UPDATE OF group_total, kiểm tra enrollment tại `supabase/migrations/20261001070125_qa661_xp_feed_wallet_fixes.sql:18`) thoát sớm.
- `[FACT]` #705 chuyển `INSERT enrollments` lên trước (`supabase/migrations/20261013120000_quiz_enroll_before_xp_trigger.sql`). Diff từng dòng với bản `20260915130736`: chỉ khác vị trí một dòng; `INSERT enrollments` vốn không có điều kiện pass nên hành vi bài trượt không đổi; không migration sau đó ghi đè hàm.
- `[FACT]` Mức độ thực tế: luồng chính đăng ký trước rồi mới vào `/learn` (`src/pages/course-details/CourseDetail.tsx:315-331`). Nhưng `/learn` không guard enrollment (`useLearnEnrollmentAccess.ts` trả `hasFullCourseAccess` cố định `true`) và RPC tự tạo enrollment → lỗi chỉ xảy ra khi mở thẳng URL `/learn`.
- `[CHƯA XÁC MINH]` Cách người báo tái hiện (SQL hay URL); RLS `course_lessons` có giới hạn nội dung theo enrollment không.
- `[SUY LUẬN]` Không backfill: học viên đã đậu lần đầu trước fix và chưa làm lại sẽ không được cộng bù. Chưa đếm số người bị ảnh hưởng.
- `[SUY LUẬN]` Mini quiz ngoài Home: sau fix XP không phụ thuộc nút Đăng ký, nhưng người chơi bị đăng ký ngầm vào khóa — quyết định sản phẩm.

**#688 — Copy ngưỡng đạt**
- `[FACT]` Ngưỡng đạt là `passing_ratio` của từng quiz, mặc định 0.7 (`xp_quiz_passed`, `learning_quiz_submit`). Chữ "80%" trên Home là sót từ lúc hardcode 0.8.

**OCID — luồng link và chống chiếm đè**
- `[FACT]` `src/pages/OCIDRedirect.tsx` → Edge `ocid.link` → `supabase/functions/corelia-api/ocid/handlers.ts` xác minh token → RPC `private.xp_link_verified_ocid` (`20261001122504_qa661_identity_reward_once_wallet_unlink.sql:47`).
- `[FACT]` Unique trên `xp_verified_ocid.ocid` và `profiles_ocid_key`. OCID thuộc user khác → 23505 → rollback → API 409 `OCID_ALREADY_LINKED` → UI báo "đã liên kết với tài khoản khác". `xp_unlink_ocid` chỉ xóa dòng của `auth.uid()`. Không tìm thấy đường để tài khoản mới chiếm OCID của tài khoản khác.
- `[FACT]` UX (thấp): `src/pages/account/ConnectOCIDCard.tsx:56` chỉ gọi `signInWithRedirect`, không gọi `ocAuth.logout` → phiên OC còn thì tự quay về tài khoản OC cũ, người dùng không chọn được tài khoản OC khác. SDK có `logout({ returnUrl })`; chưa thấy tham số `prompt`. Hướng khả dĩ: nút "Dùng tài khoản OC khác" gọi logout trước (phụ tác dụng: đăng xuất OC dùng chung).
- `[SUY LUẬN]` (thấp, chưa chạy): unique so sánh `edu_username` sau `btrim`, không `lower()`, không dùng `sub` của OC. Thưởng +50 khóa theo (user, nguồn) → khi user đổi OCID, OCID mới bị xóa khỏi bảng seen, user khác link sau vẫn nhận +50. Chưa có bằng chứng OC cho đổi nickname.
- `[FACT]` Không có test cho `ocid/handlers.ts`.

**Cấu hình staging**
- `[FACT, từ docs QA 2026-10-13]` Supabase Auth staging có Site URL là localhost, Redirect URLs không có domain staging → OAuth GitHub redirect sai. Lỗi cấu hình, không phải code. Chưa có issue riêng.

### 1.4 Nhóm thay đổi chưa QA sau v0.15.0 (ưu tiên)
Suy ra từ tên file và commit message; chưa đọc logic migration notifications và phần security.

| Ưu tiên | Nhóm | Tham chiếu |
|---|---|---|
| Cao | Bảo mật credential | `3e267c57`, `1a4b3d19` |
| Cao | Thông báo xã hội: digest, unsubscribe, realtime (chỉ trên staging) | #702-#704, migration `20261013000703`, `20261013004846` |
| Trung bình | Hackathon prep/posts/awards/award picker | #693-#700 |
| Trung bình | Save responsive | `51fa273e` |

### 1.5 Checkbox GitHub (#545 đến nay, đếm regex)
- Đóng nhưng còn ô chưa tick: #625 (7), #613 (5), #615 (1). Mở: #549 (5).
- Tick đủ: #545-#547, #550, #551, #663, #669-#671. Chưa mở body từng issue.

### 1.6 Checks đã chạy
- Đọc source/migration/diff: `learning_quiz_submit` (diff với `20260915130736`), `xp_quiz_passed`, `xp_link_verified_ocid`, `xp_award_identity_once`, `xp_unlink_ocid`, `ocid/handlers.ts`, `OCIDRedirect.tsx`, `ConnectOCIDCard.tsx`, `CourseDetail.tsx`, `useLearnEnrollmentAccess.ts`.
- `gh`: trạng thái #705/#688, danh sách issue/PR mở, đếm checkbox, `gh issue reopen 551`.
- Trình duyệt staging: vô tình kích hoạt luồng Connect OCID, dừng ở trang đăng nhập OC; không đăng nhập, không đổi dữ liệu.
- Không chạy: test/build/`db:verify`; Edge Function (thiếu deno, Docker tắt); query DB staging.

### 1.7 Việc mở / quyết định cần user
- **#551 đã bị mở lại** do hiểu nhầm môi trường (Brave đang ở app production với OC live, không phải staging). Đề xuất đóng lại; chưa đóng, chưa comment, chưa bỏ tick.
- Ca hai tài khoản Corelia staging cùng link một OC sandbox (mong đợi 409, tài khoản thứ hai không có OCID/XP): cần user đăng nhập OC sandbox + phiên Corelia thứ hai.
- Ca token sai/hết hạn/sai audience/thiếu `edu_username`: source cho thấy đều trả 400 `invalid_ocid_token`; chạy runtime cần Bearer của user đăng nhập.
- Ca hủy ở trang OC; GitHub OAuth tài khoản mới (bị chặn bởi Redirect URLs).
- Có tạo issue cho cấu hình Redirect URLs staging và UX "dùng tài khoản OC khác" không.
- Merge #688, #705 vào staging → chờ Deploy Staging xanh → QA #664: chưa đăng ký đậu lần đầu; retake không cộng trùng; instructor không XP; khóa/bài chưa publish không XP; ngưỡng khác 0.7.
- Quyết định sản phẩm: backfill XP; giữ đăng ký ngầm khi làm quiz ngoài trang khóa; `/learn` không guard enrollment có chủ đích không.
- Xác nhận "30 XP" trong copy #688 có hardcode không.
- 14 file untracked trong repo: quyết định commit hay xóa; `local_qa_accounts.txt` không được vào git.

---

## Phần 2 — Xóa khóa học có làm mất chứng nhận không

### 2.1 Phạm vi
- Câu hỏi: khi khóa học bị xóa, chứng nhận liên quan phải được giữ, không mất theo.
- Read-only trên HEAD `57bee22b`. Không PR, không sửa code.

### 2.2 Kết luận: CHƯA ĐẠT (một phần)
| Thành phần | Khi xóa course | Bằng chứng |
|---|---|---|
| `certificate_records` (có `course_title` snapshot) | Giữ (SET NULL) | `20260804000000_certificate_public_verification.sql:35` |
| `credential_issuances` (có `display_snapshot`) | Giữ (SET NULL) | `20260701154437_preserve_issued_credentials.sql:105-109` |
| `credential_templates` | Giữ (SET NULL) | cùng file, dòng 87-91 |
| Mã xác minh công khai | Còn hoạt động | theo các bảng trên |
| `enrollments` | **Bị xóa (CASCADE)** | `20250504120000_corelia_initial.sql:413` |
| Chứng nhận trên trang Achievements | **Mất** | `buildAchievementsData.ts:57-58` dựng từ `enrollments` |

### 2.3 Finding
**V-01 [P1-P2, chưa chốt] — Xóa course làm mất chứng nhận khỏi Achievements của learner**
- `[FACT]` `enrollments.course_id ... ON DELETE CASCADE` (`supabase/migrations/20250504120000_corelia_initial.sql:413`); không migration nào đổi sau đó. Comment tại `20260804000000_certificate_public_verification.sql:19` cũng ghi nhận.
- `[FACT]` `src/pages/achievements/utils/buildAchievementsData.ts:57-58` lấy danh sách chứng nhận từ `enrollments` lọc `certificate_issued_at` → enrollment bị cascade thì chứng nhận biến mất khỏi UI.
- `[FACT]` Guard xóa chỉ ở UI: `src/pages/instructor-course-edit/InstructorCourseEdit.tsx:8603` disable nút khi published/archived/còn enrollments/submissions. Policy `courses_delete_manager` (`20260506071954_tighten_rls_and_lockdown_functions.sql:511-517`) cho instructor sở hữu hoặc admin/support xóa mà không kiểm tra enrollment; `deleteCourse` (`src/lib/courses.ts:1462-1463`) gọi delete trực tiếp.
- `[SUY LUẬN]` Gọi API trực tiếp, admin/support, hoặc course có chứng nhận nhưng enrollment đã bị revert đều vượt guard UI. Chưa chạy thử.
- Trigger → Actual → Expected: course đã cấp chứng nhận bị xóa → enrollments cascade, chứng nhận mất khỏi Achievements → chứng nhận vẫn hiển thị và tải được.

### 2.4 Checks đã chạy
- Chỉ đọc source/migration (grep/read) các vị trí trên. Không chạy test, build, DB query, staging hay Production.

### 2.5 Việc mở / quyết định cần user
- `[CHƯA XÁC MINH]` FK thực tế trên staging/Production có khớp migration không (khả năng drift).
- `[CHƯA XÁC MINH]` Nếu `getCourse()` trả null cho course đã xóa, chứng nhận có hiện tên fallback và ảnh `CERT_PLACEHOLDER` thay vì bản gốc không.
- Chọn hướng sửa (đề xuất, chưa duyệt, chưa tạo task worker):
  - **A (nhỏ nhất):** chặn xóa course ở DB nếu còn `certificate_records` hoặc enrollment có `certificate_issued_at`; chỉ cho archive.
  - **B:** dựng danh sách Achievements từ `certificate_records` (cần snapshot template/layout, phạm vi lớn hơn).

---

## Phần 3 — Technical gates nhánh `feat/664-quiz-first-pass-xp`

Nguồn: báo cáo của session khác dán vào. Các lệnh do session đó chạy; file này không chạy lại.

### 3.1 Kết quả gates
| Gate | Lệnh | Kết quả | Ghi chú |
|---|---|---|---|
| Vitest full | `pnpm test` | 1574 PASS / 8 FAIL | 8 fail đều timeout (5000/15000ms) khi chạy song song 237 file trên Windows |
| Vitest rerun 3 file timeout | `pnpm vitest run <file>` | 60/60 PASS | AdminComponentsOverviewPage 9/9, AdminComponentShowcasePages 24/24, waveC.retirement 27/27 |
| DB contract tests | `node --test scripts/db/tests/*.test.mjs` | 166/166 PASS | schema, RLS, lifecycle, release manifest |
| DB baseline + drift | `pnpm db:baseline:verify && pnpm db:drift:verify` | PASS | 137 migration sau baseline |
| DB local | `pnpm db:verify:local` | BLOCKED | Docker daemon tắt |
| ESLint | `pnpm lint` | PASS | |
| Typecheck | `pnpm exec tsc -b` | PASS | |
| Build | `pnpm build` | PASS | 2m12s |
| Email auth sync | `node --experimental-strip-types scripts/email/generate-auth.mjs --check` | FAIL | Bug CRLF/LF trên Windows (3.2 #1) |

Phân loại theo delta task: 8 timeout Vitest và FAIL email check không liên quan diff #664 → `PRE-EXISTING FAIL` / môi trường `[SUY LUẬN]`. `db:verify:local` chưa chạy → migration #705 chưa có bằng chứng recreate local từ session này (CI #705 có check "Clean local migration recreate" pass, theo Phần 1).

### 3.2 Finding
**1. [BUG, P4] `generate-auth.mjs --check` fail trên Windows do không chuẩn hóa line ending**
- `[FACT]` `scripts/email/generate-auth.mjs:9` so sánh `readFileSync(target, "utf8") !== html`. Git checkout Windows tạo CRLF trong `supabase/templates/`, generator tạo LF.
- `[FACT]` Sau `.replace(/\r\n/g, "\n")`: 13/13 template khớp từng byte.
- Đề xuất: chuẩn hóa CRLF → LF cả hai vế trước khi so sánh, giống `scripts/db/tests/production-release-artifact.test.mjs`. Phương án thay thế: `.gitattributes` ép `eol=lf` cho template.

**2. [PERF, P5] Trigger `xp_quiz_passed` chạy N lần mỗi lần nộp quiz**
- `[FACT]` Trigger `FOR EACH ROW AFTER UPDATE OF group_total` (`20260921183531_xp_system_foundation.sql:160-161`); `learning_quiz_submit` update cả N dòng của attempt group (`20261013120000_quiz_enroll_before_xp_trigger.sql:35`).
- Hệ quả: dòng 2..N vẫn SELECT courses/course_lessons và gọi `xp_award()`, chỉ bị chặn bởi `ON CONFLICT (user_id, source_key) DO NOTHING`. Quiz 10 câu → ~18 SELECT và ~18 lần gọi `xp_award()` thừa.
- Không ảnh hưởng tính đúng (idempotent theo `source_key`). Có từ trước #705; ngoài scope #664.
- Đề xuất: giới hạn trigger chạy một lần mỗi attempt group, hoặc cộng điểm trực tiếp trong RPC.

**3. [CODE SMELL, P5] `IF NOT FOUND` sau hai `SELECT INTO` liên tiếp**
- `[FACT]` `private.xp_quiz_passed()` (`20261001070125_qa661_xp_feed_wallet_fixes.sql:13-16`), `private.xp_lesson_completed()` (`20260921183531_xp_system_foundation.sql:124-126`). `FOUND` chỉ phản ánh câu SELECT cuối (lesson).
- `[SUY LUẬN]` FK `course_lessons.course_id → courses(id)` đảm bảo lesson tồn tại thì course tồn tại → không có đường lỗi thực tế với schema hiện tại. Chỉ là rủi ro bảo trì.
- Đề xuất: gộp thành một query JOIN rồi kiểm tra `NOT FOUND`.

**4. [FLAKY, P5] Vitest timeout giả khi chạy full suite trên Windows**
- `[FACT]` `vitest.config.ts` không đặt `testTimeout`; các test render admin nặng mất 1.5-2.5s/case khi chạy riêng, vượt 5000ms khi chạy song song 237 file.
- Đề xuất: tăng `testTimeout` hoặc giới hạn concurrency. Cần đối chiếu CI (Linux) có bị không trước khi đổi cấu hình chung.

### 3.3 Workspace
- Session đó không sửa file source. Nhánh `feat/664-quiz-first-pass-xp` đã có commit fix và test cho #664.

---

## Tổng hợp quyết định cần user

| # | Quyết định | Nguồn |
|---|---|---|
| 1 | Đóng lại #551 (bị mở lại do nhầm môi trường) | Phần 1 |
| 2 | Merge #705, #688 vào staging rồi QA #664 trên staging | Phần 1 |
| 3 | Backfill XP; đăng ký ngầm qua mini quiz; `/learn` không guard enrollment | Phần 1 |
| 4 | Tạo issue cho Redirect URLs staging và UX đổi tài khoản OC | Phần 1 |
| 5 | Lên kế hoạch QA cho nhóm sau v0.15.0 (credential security, notifications trước) | Phần 1 |
| 6 | Chọn hướng A hoặc B cho V-01 (chứng nhận khi xóa course) | Phần 2 |
| 7 | Có sửa bug CRLF email check và cấu hình Vitest không (ngoài scope #664) | Phần 3 |
| 8 | Xử lý 14 file untracked; không commit `local_qa_accounts.txt` | Phần 1 |
