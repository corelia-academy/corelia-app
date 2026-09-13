# QA Context — Toàn bộ chu kỳ kiểm thử 3 tuần (23/08/2026 - 13/09/2026)

## 1. Tổng quan & Phạm vi kiểm định

Tài liệu này đóng vai trò context kỹ thuật và nghiệp vụ tổng hợp cho chuỗi task QA mà developer đã thực hiện trong 3 tuần qua trên repository Corelia. Tài liệu cung cấp bối cảnh chi tiết, nguyên nhân gốc rễ (root cause), các invariant nghiệp vụ, các file/component bị tác động và các edge case trọng yếu cần chú ý khi thực hiện test.

### Các trục tính năng chính trong phạm vi:
1. **Trục Điều hướng, Xác thực & Đa ngôn ngữ (Auth, Navigation, Locale & Input):**
   - PR #432 (Fix #394): Chuẩn hóa thứ tự ưu tiên redirect sau xác thực, chặn redirect loop `/auth`, bảo toàn query parameters và hash fragments.
   - PR #435 (Fix #412): Giải quyết race condition trong quá trình đồng bộ ngôn ngữ (`AuthSync` vs `useLocale`) bằng cơ chế revision tracking và optimistic rollback.
   - PR #434 (Fix #411): Cô lập draft state của input mức lương khi gõ bộ gõ IME (Unikey, EVKey trên Windows) và bảo toàn giá trị `0` trong bộ lọc.
2. **Trục Cuộc thi, Hackathons & Danh mục dự án (Contests, Hackathons & Projects):**
   - PR #433 (Fix #395): Mở quyền đăng ký cuộc thi cho trạng thái `running` trước deadline; chuẩn hóa URL slug cuộc thi (canonicalize sang chữ thường); củng cố xử lý lỗi/empty state tab Projects.
   - PR #431 (Fix #393): Phân giải slug cuộc thi cho link trang cá nhân (`/u/:username`) kèm fallback UUID; chuyển query sang bảng `hackathon_submissions`.
   - PR #438 (Fix #438): Sửa logic đếm số lượng cuộc thi đang mở đơn (`accepting`) dựa trên `registration_deadline` thay vì status thô.
   - PR #439 (Fix #439): Xử lý bộ lọc slug cuộc thi không phân biệt hoa thường (`case-insensitive`) và chuẩn hóa URL danh mục dự án.
   - PR #437 (Fix #437): Đa ngôn ngữ hóa (i18n) trạng thái (`status`) và hình thức (`mode`) trên thẻ cuộc thi tại trang quản trị (`/admin/hackathons`).
   - Nhánh `feat/373-ux-improvements`: Validate thứ tự deadline cuộc thi; hiển thị dấu hoa thị bắt buộc (`*`); lưu và hiển thị huy hiệu dự án đạt giải (Winner Award Badge); chặn fallback chuỗi rỗng trong `applyHackathonLocaleContent` (#367).
3. **Trục Email, Thông báo, Hộp thư đi & Tính bất biến (Outbox, Invites & Idempotency):**
   - Lưu trữ outbox email bền vững và hỗ trợ retry an toàn khi mạng chập chờn.
   - Đảm bảo tính bất biến (idempotency) khi gửi lời mời tham gia dự án (project invite) và thông báo trao giải thưởng cuộc thi.
   - Chặn phân bổ giải thưởng âm (negative prize allocations) và thu hồi quyền blast email trái phép của co-organizer (#374).
   - Xác thực token hủy đăng ký email (BUG-UNSUB).
4. **Trục Khóa học, Học tập, Thanh toán & Bộ Bug Hunt (BUG-001 -> BUG-016):**
   - Ghi danh trực tiếp cho khóa học miễn phí mà không tạo deadlock cổng thanh toán SePay (BUG-012, BUG-006).
   - Xử lý lỗi hiển thị khi truy cập `lessonId` không hợp lệ mà không silent redirect (BUG-011).
   - Ngăn chặn vòng lặp tải vô tận trong `QuestionGeneratorDialog` (BUG-004) và validate payload API tạo câu hỏi (BUG-001, BUG-002, BUG-003).
   - Ẩn form và action khi ID lộ trình nghề nghiệp không tồn tại (BUG-005) và xóa cache danh mục sau khi mutation (BUG-013).
   - Bắt lỗi token mời dự án (BUG-007) và map mã lỗi mời đồng giảng viên sang thông báo thân thiện (BUG-016).
   - Validate định dạng UUID giảng viên trước khi truy vấn (BUG-008).
   - Thêm thanh tìm kiếm inline responsive cho mobile trên trang tìm kiếm (BUG-010).
   - Hoàn tất thu hồi các bề mặt AI phía học viên và bảo toàn bất biến thanh toán/hoàn tiền (R4/R5).

---

## 2. Chi tiết kỹ thuật theo từng module

### 2.1. Xác thực & Điều hướng (Auth & Navigation)
- **Files liên quan:**
  - `src/lib/authRedirect.ts`
  - `src/pages/login/Auth.tsx`
  - `src/pages/login/LoginForm.tsx`
- **Bối cảnh & Vấn đề gốc (#394):**
  - Trước đây, logic lấy đường dẫn redirect sau khi đăng nhập chấp nhận nhiều tên query parameter (`returnTo`, `redirect_to`, `redirect`, `next`) nhưng không có thứ tự ưu tiên nhất quán.
  - Nguy cơ lặp vô hạn (infinite loop) khi tham số trỏ chính xác về `/auth` hoặc `/login`.
  - Tham số redirect nội bộ chứa query (`?filter=abc`) hoặc hash fragment (`#target-section`) bị cắt cụt trong quá trình sanitize.
  - Nguy cơ Open Redirect nếu người dùng bị dẫn dụ click vào link chứa domain độc hại bên ngoài.
- **Quy tắc kỹ thuật & Invariants:**
  1. Chỉ chấp nhận đường dẫn nội bộ (bắt đầu bằng `/`, không chứa protocol `http://`, `https://`, hoặc `//`).
  2. Bất kỳ tham số nào trỏ về `/auth`, `/login` hoặc rỗng đều phải được chuẩn hóa về fallback mặc định (`/home` hoặc `/`).
  3. Mọi query params và hash fragment đi kèm trong đường dẫn nội bộ hợp lệ phải được bảo toàn nguyên vẹn sau khi người dùng đăng nhập thành công.

---

### 2.2. Đồng bộ đa ngôn ngữ (Locale Sync & Race Guard)
- **Files liên quan:**
  - `src/components/auth/AuthSync.tsx`
  - `src/lib/localeSyncGuard.ts`
  - `src/hooks/useLocale.ts`
- **Bối cảnh & Vấn đề gốc (#412):**
  - Khi người dùng đăng nhập, component `AuthSync` sẽ đọc trường `preferred_locale` từ database profile và cập nhật `i18n`.
  - Tuy nhiên, nếu người dùng chủ động bấm đổi ngôn ngữ (VI ↔ EN) trong Header ngay lúc profile đang tải hoặc đang sync chậm trên network, phản hồi API cũ sẽ ghi đè ngược lại lựa chọn mới của người dùng (gây hiện tượng giật/nhấp nháy ngôn ngữ - flicker/revert).
  - Nếu mutation cập nhật lên database thất bại, UI vẫn giữ trạng thái lệch với database.
- **Quy tắc kỹ thuật & Invariants:**
  1. Sử dụng monotonic revision counter: Mỗi thao tác đổi ngôn ngữ cục bộ sẽ tăng số revision. `AuthSync` chỉ được phép áp dụng ngôn ngữ từ database nếu payload có revision mới hơn hoặc bằng revision hiện tại.
  2. Áp dụng Optimistic UI: Khi người dùng đổi ngôn ngữ, UI lập tức chuyển sang ngôn ngữ mới. Nếu API mutation lưu profile thất bại, hệ thống tự động rollback về ngôn ngữ trước đó kèm thông báo.

---

### 2.3. Bộ lọc lương tuyển dụng (Salary Input & IME Composition)
- **Files liên quan:**
  - `src/components/jobs/JobsSalaryInput.tsx`
  - `src/lib/jobFilterUtils.ts`
- **Bối cảnh & Vấn đề gốc (#411):**
  - Trên hệ điều hành Windows khi sử dụng bộ gõ tiếng Việt có dấu (Unikey/EVKey) qua cơ chế composition (IME), mỗi phím gõ sẽ kích hoạt sự kiện `compositionupdate`. Logic cũ ép kiểu và format số ngay trong sự kiện `onChange`, làm ngắt quãng bộ đệm của Unikey, dẫn đến mất chữ hoặc nhảy con trỏ.
  - Khi người dùng nhập mức lương là số `0`, hàm filter xử lý `if (!value)` khiến giá trị `0` bị coi là falsy, tự động xóa bộ lọc hoặc biến thành `null`.
- **Quy tắc kỹ thuật & Invariants:**
  1. Tách biệt biến state đệm `rawDraft` trong khi đang gõ IME (`isComposing === true`).
  2. Chỉ commit và format dữ liệu khi kết thúc gõ (`compositionend`), khi nhấn phím `Enter` hoặc khi `blur` khỏi trường nhập.
  3. Giá trị `0` là một số hợp lệ trong bộ lọc mức lương tối thiểu, không được xóa về rỗng trừ khi người dùng chủ động xóa trắng ô input.

---

### 2.4. Cuộc thi & Hackathons (Contests, Slugs & Registration)
- **Files liên quan:**
  - `src/pages/hackathons/HackathonDetailPage.tsx`
  - `src/pages/hackathons/HackathonsPage.tsx`
  - `src/pages/projects/ProjectsPage.tsx`
  - `src/pages/projects/ProjectNewPage.tsx`
  - `src/pages/admin/AdminHackathonsPage.tsx`
  - `src/lib/hackathonValidators.ts`
- **Bối cảnh & Vấn đề gốc (#395, #393, #438, #439, #437, #373):**
  - Cuộc thi đã bắt đầu diễn ra (`status = 'running'`) nhưng hạn chót đăng ký (`registration_deadline`) vẫn còn thì người dùng mới vẫn phải được phép đăng ký. Logic cũ chỉ cho phép đăng ký ở trạng thái `published`.
  - Truy cập URL chứa slug viết hoa (ví dụ: `/hackathons/SUMMER-CONTEST`) gây lỗi 404 hoặc không load được data.
  - Trang cá nhân `/u/:username` hiển thị danh sách hackathon tham gia nhưng link trỏ về ID cũ hoặc query bảng dữ liệu cũ.
  - Trang `/admin/hackathons` hiển thị nhãn trạng thái và hình thức tổ chức bằng text tiếng Anh cứng không qua i18n.
  - Bộ lọc dự án theo hackathon trên `/projects?hackathon=slug` bị phân biệt hoa thường dẫn đến không tìm thấy kết quả.
  - Form tạo/sửa hackathon trong trang quản trị thiếu validate logic thứ tự thời gian giữa các mốc deadline.
- **Quy tắc kỹ thuật & Invariants:**
  1. Cho phép đăng ký tham gia cuộc thi nếu thời điểm hiện tại nhỏ hơn `registration_deadline`, áp dụng cho cả trạng thái `published` và `running`.
  2. Mọi URL slug cuộc thi khi nhận vào phải được tự động redirect/canonicalize về chữ thường (lowercase).
  3. Số lượng hackathon đang nhận đơn trên trang danh mục (`accepting`) phải tính theo điều kiện `now() < registration_deadline`.
  4. Form Admin Hackathon bắt buộc: `submission_deadline` phải sau `registration_deadline`, và `judging_deadline` phải sau `submission_deadline`. Không cho phép lưu thời gian nghịch đảo.

---

### 2.5. Email Outbox, Lời mời dự án & Idempotency
- **Files liên quan:**
  - `supabase/functions/winner_award_notify/index.ts`
  - `src/lib/projectInvites.ts`
  - `src/pages/invites/ProjectInvitePage.tsx`
- **Bối cảnh & Vấn đề gốc (#373, #374, BUG-007, BUG-016):**
  - Khi gửi email mời thành viên vào dự án hoặc gửi email thông báo giải thưởng, nếu gặp lỗi mạng chập chờn hoặc retry nhiều lần, người dùng bị nhận hàng loạt email trùng lặp (duplicate blast).
  - Co-organizer bị lợi dụng sơ hở quyền hạn để gửi email thông báo tùy tiện (#374).
  - Trường hợp trao giải thưởng cho phép nhập số tiền âm gây sai lệch quỹ giải.
  - Token lời mời không hợp lệ vẫn hiển thị nút Chấp nhận/Từ chối trên màn hình (BUG-007), khi bấm sinh ra lỗi không mong muốn.
- **Quy tắc kỹ thuật & Invariants:**
  1. Mọi tác vụ gửi email thông báo giải thưởng hoặc lời mời phải đi qua bảng outbox với khóa bất biến (idempotency key). Gửi lại cùng một tác vụ không được phát sinh thêm email gửi đi từ Resend.
  2. Chặn hoàn toàn số tiền giải thưởng âm (`prize_amount >= 0`).
  3. Chỉ có Owner cuộc thi hoặc Admin hệ thống mới có quyền gửi blast notification; co-organizer bị chặn quyền này.
  4. Màn hình lời mời dự án khi nhận token không hợp lệ (hết hạn, sai định dạng, đã dùng) phải ẩn toàn bộ nút hành động và hiển thị thông báo lỗi rõ ràng.

---

### 2.6. Khóa học, Học tập, Thanh toán & Bộ Bug Hunt (BUG-001 -> BUG-016)
- **Files liên quan:**
  - `src/pages/checkout/CheckoutPage.tsx`
  - `src/pages/learn/LearnPage.tsx`
  - `src/components/instructor/QuestionGeneratorDialog.tsx`
  - `src/pages/career/CareerTrackEditorPage.tsx`
  - `src/pages/search/SearchPage.tsx`
  - `src/pages/instructors/InstructorDetailPage.tsx`
- **Bối cảnh & Vấn đề gốc:**
  - Khóa học miễn phí (`price === 0` hoặc `access_model === 'free'`) bị đẩy sang bước tạo mã giao dịch SePay dẫn đến lỗi deadlock không thể ghi danh (BUG-012).
  - Context thanh toán không hợp lệ làm vỡ màn hình checkout thay vì báo "Đơn hàng không hợp lệ" (BUG-006).
  - Học viên nhập sai `lessonId` trên thanh địa chỉ bị rơi vào màn hình trắng khi danh sách bài học rỗng, hoặc bị redirect âm thầm (BUG-011).
  - Dialog tạo câu hỏi tự động trong khu vực giảng viên rơi vào infinite loop khi gọi API (BUG-004), đồng thời API thiếu validate trường count và json body (BUG-001, BUG-002, BUG-003).
  - Sửa lộ trình nghề nghiệp (career track) không tự động xóa cache danh mục (BUG-013); truy cập ID lộ trình không tồn tại làm vỡ layout (BUG-005).
  - URL giảng viên chứa chuỗi không phải UUID làm phát sinh exception SQL thô (BUG-008).
  - Trang tìm kiếm trên mobile không có form tìm kiếm riêng biệt (BUG-010).
- **Quy tắc kỹ thuật & Invariants:**
  1. Khóa học miễn phí phải ghi danh trực tiếp (direct enrollment) và chuyển ngay sang trạng thái học tập.
  2. Bất kỳ ID không tồn tại nào trên URL (giảng viên, lộ trình, bài học, token lời mời) phải được bắt lỗi ngay từ tầng guard/validate và hiển thị trang Not Found hoặc thông báo lỗi chuẩn, không được để văng lỗi hệ thống hoặc SQL ra màn hình.
  3. Quá trình tạo câu hỏi phải có trạng thái timeout/error rõ ràng, không treo giao diện.

---

## 3. Ma trận tài khoản & Tiền đề kiểm thử môi trường Local

Để bao phủ đầy đủ các kịch bản kiểm thử trên môi trường local hoặc staging, cần chuẩn bị ma trận người dùng tối thiểu:

| Định danh vai trò | Role trong database | Quyền hạn kiểm thử |
|---|---|---|
| **User Học viên** | `student` | Tham gia cuộc thi, nộp dự án, đổi ngôn ngữ, học bài, lọc việc làm, nhận lời mời dự án |
| **User Giảng viên** | `instructor` | Quản lý khóa học, sử dụng Question Generator dialog, tạo lộ trình nghề nghiệp |
| **User Quản trị** | `admin` / `support_staff` | Quản trị cuộc thi (`/admin/hackathons`), duyệt giải thưởng, kiểm tra nhãn đa ngôn ngữ |
| **Khách vãng lai** | Logged out | Kiểm tra redirect sau khi đăng nhập (`/auth`), xem danh mục cuộc thi, xem dự án công khai |

---

## 4. Nhật Ký Thực Thi Kiểm Thử Từng Bước (Live QA Execution Log)

### `[SETUP-01]` Build & TypeScript Check
- **Thời gian thực thi:** 2026-09-13.
- **Lệnh kiểm tra:** `pnpm build` (`tsc -b && vite build && node scripts/jobs/generate-sitemap.mjs --mode production`).
- **Kết quả:** `PASS` (Exit code: 0).
- **Chi tiết ghi nhận:**
  - Typecheck `tsc -b`: Pass hoàn toàn, 0 lỗi TypeScript.
  - Bundle `corelia_app` (worker environment): Hoàn thành trong 90ms.
  - Bundle `client` (SPA frontend): Hoàn thành trong 1m 9s.
  - `generate-sitemap.mjs`: Sinh sitemap production thành công.
- **Đánh dấu:** Đã cập nhật `[x] [SETUP-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[SETUP-02]` Staging Environment & Build Verification
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **Lệnh kiểm tra:** `window.__CORELIA_BUILD__` trong Console trình duyệt.
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - `window.__CORELIA_BUILD__`: Trả về `{ version: '0.10.0' }` khớp với phiên bản phát hành `0.10.0` trong `package.json`.
  - Console: Khởi động thành công, không có exception làm crash ứng dụng (lỗi `net::ERR_BLOCKED_BY_CLIENT` do lá chắn quảng cáo của trình duyệt chặn tài nguyên tracking thứ ba, không ảnh hưởng runtime Corelia).
  - Giao diện người dùng: Tải đầy đủ dashboard, sidebar hiển thị các mục quản trị và giảng dạy.
- **Đánh dấu:** Đã cập nhật `[x] [SETUP-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[SETUP-03]` Test Accounts Readiness
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Tài khoản Quản trị / Giảng viên (`admin` / `instructor`): Đã đăng nhập sẵn trên phiên làm việc, có đủ quyền truy cập `/admin/*` và `/instructor/*` (Teaching).
  - Tài khoản Học viên (`student`): Đã chuẩn bị sẵn sàng với cấu hình giao diện tối (Dark Theme).
- **Đánh dấu:** Đã cập nhật `[x] [SETUP-03]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-AUTH-01]` Preserve Query Parameters and Hash Fragment on Auth Redirect
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/login?redirect=%2Fprojects%3Ffilter%3Dactive%23details`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Sau khi xác thực thành công tại trang `/login`, hệ thống thực thi hàm `resolveAuthRedirect` và điều hướng chính xác đến `https://staging.corelia.academy/projects?filter=active#details`.
  - Tham số tìm kiếm `?filter=active` và hash fragment `#details` được giữ nguyên vẹn 100% trên thanh URL, không bị truncate hay biến dạng.
  - Giao diện chuyển hướng vào trang Dự án (`/projects`) mượt mà.
- **Đánh dấu:** Đã cập nhật `[x] [TC-AUTH-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-AUTH-02]` Prevent Redirect Loops to Auth / Login Endpoints
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/login?redirect=%2Flogin` (hoặc `/login?redirect=%2Fauth`)
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Sau khi xác thực thành công từ URL chứa tham số redirect trỏ về chính `/login`, hàm `sanitizeRedirectUrl` đã nhận diện mục tiêu không an toàn (`path === "/login"`).
  - Hệ thống tự động từ chối loop và fallback chuyển hướng về trang chủ `https://staging.corelia.academy/` (Dashboard Home: "Hi, Le").
  - Tránh triệt để nguy cơ người dùng bị kẹt trong vòng lặp chuyển hướng vô hạn giữa các endpoint xác thực.
- **Đánh dấu:** Đã cập nhật `[x] [TC-AUTH-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-AUTH-03]` Prevent Open Redirects to External Domains
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/login?redirect=https%3A%2F%2Fevil-domain.com%2Fsteal`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Sau khi đăng nhập từ URL chứa tham số domain bên ngoài (`https://evil-domain.com/steal`), hàm `sanitizeRedirectUrl` đã kiểm tra protocol/origin và từ chối điều hướng ra bên ngoài.
  - Hệ thống tự động fallback chuyển hướng an toàn về trang chủ `https://staging.corelia.academy/` (Trang chủ tài khoản học viên).
  - Loại bỏ hoàn toàn nguy cơ Open Redirect lừa đảo người dùng sau khi xác thực.
- **Đánh dấu:** Đã cập nhật `[x] [TC-AUTH-03]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-LOCALE-01]` Fast Language Switching & Flicker Guard
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Thực hiện chuyển đổi ngôn ngữ liên tục giữa `VI` và `EN` nhiều lần trên thanh Header.
  - Giao diện phản hồi tức thời theo lựa chọn click cuối cùng của người dùng.
  - Cơ chế monotonic revision tracking trong `localeSyncGuard` hoạt động chuẩn xác: các phản hồi API cũ hoặc tác vụ sync profile ngầm không làm giật hay đảo ngược (revert) ngôn ngữ về trạng thái cũ.
- **Đánh dấu:** Đã cập nhật `[x] [TC-LOCALE-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-LOCALE-02]` Optimistic Rollback on Locale Persistence Failure
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Phương pháp giả lập:** Bật chế độ `Offline` trong DevTools Network tab.
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Khi người dùng bấm chuyển đổi ngôn ngữ trong điều kiện mạng ngắt kết nối (`Offline`), giao diện ban đầu cập nhật lạc quan (optimistic UI) sang ngôn ngữ mới.
  - Sau khi tác vụ mutation cập nhật `preferred_locale` lên database thất bại (reject do mạng offline), handler bắt lỗi đã lập tức kích hoạt hàm rollback.
  - Giao diện tự động phục hồi về ngôn ngữ cũ trước đó, đảm bảo tính toàn vẹn trạng thái giữa client và server.
- **Đánh dấu:** Đã cập nhật `[x] [TC-LOCALE-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-LOCALE-03]` Persistent Account Locale Setting
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/account/profile`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Người dùng thay đổi ngôn ngữ trong cài đặt tài khoản cá nhân và lưu thành công.
  - Sau khi thực hiện reload lại trình duyệt (F5/hard reload), tùy chọn ngôn ngữ đã lưu vẫn được giữ nguyên vẹn bền vững, không bị khôi phục về giá trị mặc định.
- **Đánh dấu:** Đã cập nhật `[x] [TC-LOCALE-03]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-JOBS-01]` Salary Input IME Composition Isolation
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/jobs`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Nhập dữ liệu số vào bộ lọc mức lương tối thiểu trong khi bộ gõ IME tiếng Việt (Unikey/EVKey trên Windows) đang kích hoạt.
  - Component `JobsSalaryInput` duy trì biến đệm `rawDraft` xuyên suốt quá trình composition; con trỏ văn bản không bị nhảy vị trí, không nuốt ký tự.
  - Khi kích hoạt sự kiện kết thúc gõ hoặc blur, giá trị số được định dạng và áp dụng chính xác vào bộ lọc.
- **Đánh dấu:** Đã cập nhật `[x] [TC-JOBS-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-JOBS-02]` Preserve Salary Value 0 in Filters
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/jobs`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Nhập giá trị `0` vào ô mức lương tối thiểu trong phần More filters.
  - Sau khi blur/commit, hệ thống giữ nguyên hiển thị `0` trong ô input và lọc chính xác danh sách 26 công việc tương ứng.
  - Giá trị `0` không bị coi là falsy/empty để tự xóa về placeholder hay `null`.
- **Đánh dấu:** Đã cập nhật `[x] [TC-JOBS-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-JOBS-03]` Clear Salary Filter State
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/jobs?currency=USD`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Thực hiện xóa giá trị trong ô nhập mức lương tối thiểu (hoặc nhấn nút Clear).
  - Ô input quay về trạng thái placeholder mặc định ("Minimum salary").
  - Tham số `&salary=0` được gỡ bỏ sạch sẽ khỏi URL query string trên thanh địa chỉ.
  - Danh sách việc làm được reset về danh sách đầy đủ.
- **Đánh dấu:** Đã cập nhật `[x] [TC-JOBS-03]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-CONTEST-01]` Contest Registration for Running Status Before Deadline
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/hackathons/qa-356`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Với cuộc thi có trạng thái `running` (Open) và thời gian hiện tại nằm trước hạn chót đăng ký (`now() < registration_deadline`), nút "Register now" hiển thị khả dụng cho học viên chưa đăng ký.
  - Khi người dùng click "Register now", hệ thống gửi mutation đăng ký thành công:
    - Hiển thị toast thông báo: "Registration complete.".
    - Nút hành động chuyển sang: "Create / view project".
    - Số lượng thí sinh tham gia (`Participants`) tăng từ 3 lên 4.
    - Trạng thái người dùng (`Your status`) chuyển từ "Not registered" sang "Registered".
- **Đánh dấu:** Đã cập nhật `[x] [TC-CONTEST-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-CONTEST-02]` Uppercase Contest Slug Normalization
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/hackathons/QA-356`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Nhập trực tiếp URL có slug viết hoa `/hackathons/QA-356` vào thanh địa chỉ.
  - Bộ định tuyến và logic canonicalize tự động phân giải slug về dạng chữ thường chuẩn: `https://staging.corelia.academy/hackathons/qa-356/overview`.
  - Toàn bộ nội dung cuộc thi tải thành công, không gặp lỗi 404 Not Found hay route mismatch.
- **Đánh dấu:** Đã cập nhật `[x] [TC-CONTEST-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-CONTEST-03]` Contest Projects Tab Empty State and Error Boundary
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/hackathons/bug2/projects`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Truy cập trực tiếp tab Projects của cuộc thi chưa có bài dự án (`bug2`).
  - Giao diện render sạch sẽ bộ lọc `Filter projects`, bộ chọn `Tracks`, `Sort Newest` và khung empty state chuẩn.
  - Không phát sinh exception runtime, không bị trắng màn hình (blank page) hoặc vỡ khung layout.
- **Đánh dấu:** Đã cập nhật `[x] [TC-CONTEST-03]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-PROFILE-01]` Query Submissions and Display Contest Projects on Public Profile
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/@le_thanh_hau`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Trang cá nhân công khai hiển thị mục Projects với số lượng bài nộp chính xác (dữ liệu được lấy từ bảng `hackathon_submissions`).
  - Thẻ dự án hiển thị đầy đủ tên bài thi ("Hackathons project Test"), badge `HACKATHON`, mô tả summary, số lượt yêu thích và các nút liên kết (`View source`, `Demo`, `Repo`, `Video`).
- **Đánh dấu:** Đã cập nhật `[x] [TC-PROFILE-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-PROFILE-02]` Contest Link Integrity from Public Profile
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/u/:username` -> `/hackathons/:slug/overview`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Từ thẻ dự án cuộc thi trên trang cá nhân của người dùng, thực hiện click liên kết điều hướng cuộc thi / nguồn dự án (`View source`).
  - Trình duyệt điều hướng chính xác đến trang chi tiết cuộc thi chuẩn `/hackathons/:slug/overview`.
  - Liên kết bảo toàn tính toàn vẹn, không xảy ra đứt gãy link (broken link) hoặc điều hướng vào route lỗi 404.
- **Đánh dấu:** Đã cập nhật `[x] [TC-PROFILE-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-HACK-01]` Public Hackathon Catalog Accepting Applications Count (#438)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/hackathons`
- **Tài khoản thực hiện:** Quản trị viên (`admin`) / Khách vãng lai (`public`).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Trang danh mục cuộc thi tính toán và hiển thị dòng tóm tắt số liệu: `2 total · 2 accepting · 0 running · 0 ended`.
  - Bộ đếm `accepting` phản ánh đúng các cuộc thi có trạng thái `published` hoặc `running` và thời gian hiện tại nằm trước hạn chót đăng ký (`now() < registration_deadline`).
  - Huy hiệu trạng thái trên từng thẻ cuộc thi hiển thị tương ứng "Accepting applications" ("Đang nhận hồ sơ").
- **Đánh dấu:** Đã cập nhật `[x] [TC-HACK-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-HACK-02]` Projects Catalog Case-Insensitive Hackathon Slug Filter (#439)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** Local Dev (`http://localhost:5173`) trên nhánh `feat/handle-3-hackathon-bugs` (PR #439).
- **URL thử nghiệm:** `/projects?hackathon=QA-356`
- **Tài khoản thực hiện:** Khách vãng lai (`public`) / Người dùng thông thường.
- **Kết quả:** `PASS` (Đã kiểm chứng trực quan trên Local Dev và 4/4 automated unit tests).
- **Chi tiết ghi nhận:**
  - Nhập trực tiếp URL có query param slug viết hoa: `/projects?hackathon=QA-356`.
  - Hệ thống tự động chuẩn hóa query parameter trên thanh địa chỉ URL về dạng chữ thường chuẩn: `/projects?hackathon=qa-356` thông qua `setParams(..., { replace: true })`.
  - Bộ lọc dropdown Cuộc thi tự động nhận diện và gán đúng giá trị cuộc thi tương ứng.
  - Giao diện dự án render trạng thái rỗng chuẩn (Empty state) phù hợp với bộ lọc, không còn bị kích hoạt lỗi `This hackathon is unavailable` như trên bản build Staging cũ chưa tích hợp PR #439.
- **Ghi chú môi trường:** Môi trường Staging hiện tại đang chạy commit `ee1c7fc` chưa merge PR #439 nên bị vướng lỗi cũ; PR #439 giải quyết triệt để lỗi này khi được đưa vào `staging`.
- **Đánh dấu:** Đã cập nhật `[x] [TC-HACK-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-HACK-03]` Admin Hackathons Localized Status & Mode Badges (#437)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** Local Dev (`http://localhost:5173`) trên nhánh `feat/handle-3-hackathon-bugs` (PR #437).
- **URL thử nghiệm:** `/admin/hackathons`
- **Tài khoản thực hiện:** Quản trị viên (`admin`).
- **Kết quả:** `PASS` (Đã kiểm chứng trực quan trên Local Dev và 3/3 automated unit tests).
- **Chi tiết ghi nhận:**
  - Truy cập danh sách cuộc thi quản trị tại `/admin/hackathons` với giao diện ngôn ngữ Tiếng Việt.
  - Toàn bộ badge trạng thái trên các thẻ cuộc thi được bản địa hóa chuẩn: `Bản nháp` (draft), `Đã xuất bản` (published), `Đang diễn ra` (running), `Đã kết thúc` (ended).
  - Nhãn hình thức tổ chức cạnh icon lịch được dịch đầy đủ: `Trực tuyến` (online), `Kết hợp` (hybrid), `Trực tiếp` (offline).
  - Không còn hiện tượng giữ nguyên chuỗi tiếng Anh viết thường gốc trên giao diện tiếng Việt.
- **Đánh dấu:** Đã cập nhật `[x] [TC-HACK-03]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-HACK-04]` Admin Hackathon Editor Deadline Ordering Validation (#373)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** Local Dev (`http://localhost:5173`)
- **URL thử nghiệm:** `/admin/hackathons/:contestId/edit#overview`
- **Tài khoản thực hiện:** Quản trị viên (`admin`).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Tại form chỉnh sửa cuộc thi trong Admin, nhập thời gian Hạn đăng ký (`registration_deadline`) diễn ra sau Hạn nộp dự án (`submission_deadline`).
  - Khi nhấn nút "Lưu thay đổi", logic validation client chặn gửi request.
  - Hiển thị Toast thông báo lỗi rõ ràng: "Hạn đăng ký phải trước hạn nộp dự án." (bản EN: "Registration deadline must precede submission deadline.").
  - Tự động di chuyển focus và highlight trường dữ liệu deadline không hợp lệ.
- **Đánh dấu:** Đã cập nhật `[x] [TC-HACK-04]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-HACK-05]` Required Form Field Asterisk Brand Blue Styling (#373)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** Local Dev (`http://localhost:5173`)
- **URL thử nghiệm:** `/admin/hackathons/:contestId/edit#overview`, `/projects/new`
- **Tài khoản thực hiện:** Quản trị viên (`admin`).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Trên form chỉnh sửa cuộc thi và form nộp bài dự án, toàn bộ dấu hoa thị bắt buộc `*` tại các trường bắt buộc (như `Tiêu đề *`, `Slug *`) được hiển thị với màu xanh thương hiệu (`text-primary` / brand blue).
  - Không còn sử dụng màu đỏ cảnh báo (`text-destructive`), giúp phân biệt rõ ràng giữa ký hiệu chỉ dẫn bắt buộc và trạng thái lỗi trường dữ liệu.
- **Đánh dấu:** Đã cập nhật `[x] [TC-HACK-05]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-HACK-06]` Hackathon Locale Content Fallback on Empty String (#367)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** Local Dev (`http://localhost:5173`)
- **URL thử nghiệm:** `/hackathons/:slug/overview`
- **Tài khoản thực hiện:** Quản trị viên (`admin`) / Khách vãng lai (`public`).
- **Kết quả:** `PASS` (Đã kiểm chứng trực quan trên Local Dev và 7/7 automated unit tests).
- **Chi tiết ghi nhận:**
  - Thiết lập bản dịch tiếng Việt của cuộc thi có trường mô tả ngắn là chuỗi rỗng `""`.
  - Khi người dùng truy cập xem chi tiết cuộc thi với ngôn ngữ Tiếng Việt (`VI`), hàm `fallbackLocalizedText` tự động nhận diện chuỗi rỗng và fallback về nội dung mô tả gốc bằng tiếng Anh.
  - Giao diện hiển thị đầy đủ văn bản mô tả dự phòng, không bị hiện tượng khoảng trắng rỗng (blank space) hoặc vỡ layout.
- **Đánh dấu:** Đã cập nhật `[x] [TC-HACK-06]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-PROJECT-01]` Project Catalog Winner Award Badge Display (#373 / commit `d4a3235`)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/hackathons/:slug/projects`, `/projects`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Thẻ dự án đạt giải hiển thị huy hiệu đạt giải màu vàng (`bg-amber-400 text-amber-950`) kèm icon `Sparkles` và nhãn giải thưởng ("✨ giải nhất").
  - Huy hiệu được đặt overlay ở góc trên bên trái của khung ảnh thumbnail dự án theo thiết kế thẻ card.
  - Các dự án không đạt giải hiển thị thumbnail bình thường, không bị gán nhầm badge.
- **Đánh dấu:** Đã cập nhật `[x] [TC-PROJECT-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-PROJECT-02]` Project Detail Winner Award Badge Persistence (#373 / commit `d4a3235`)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/projects/:slug`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Trang chi tiết dự án hiển thị huy hiệu giải thưởng màu vàng nổi bật cạnh tiêu đề dự án và badge nguồn gốc `HACKATHON`.
  - Thực hiện tải lại trang (F5 / hard reload), dữ liệu giải thưởng từ `sourceQuery.data.winner_awards` được khôi phục chính xác, không bị biến mất hoặc nhấp nháy giao diện.
- **Đánh dấu:** Đã cập nhật `[x] [TC-PROJECT-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-NOTIF-01]` Winner Award Notification Idempotency & Outbox Deduping (#373, #374)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy` (và 15/15 tests `winner_award_notify.test.ts`).
- **URL thử nghiệm:** Hộp thư đến người dùng / Edge Function `corelia-api` (`winner_award_notify`).
- **Tài khoản thực hiện:** Quản trị viên (`admin`) / Học viên (`student`).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Hệ thống gửi email thông báo trao giải cho thí sinh đạt giải thông qua dịch vụ Resend và lưu trạng thái vào bảng `email_outbox`.
  - Quản trị viên thực hiện chỉnh sửa và lưu lại biểu mẫu cuộc thi nhiều lần liên tiếp sau khi đã trao giải.
  - Hộp thư đến của học viên chỉ nhận duy nhất 01 email trao giải đầu tiên; cơ chế lease fencing và đối soát idempotency key (`claimRes.type === 'already_sent'`) đã chặn đứng hoàn toàn việc phát sinh email trùng lặp.
  - Backend Edge Function trả về kết quả an toàn, không có hiện tượng double send hay spam notification.
- **Đánh dấu:** Đã cập nhật `[x] [TC-NOTIF-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-NOTIF-02]` Negative Prize Allocation Rejection (#373)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/admin/hackathons/:contestId/edit#prizes`
- **Tài khoản thực hiện:** Quản trị viên (`admin`).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Tại mục cấu hình Giải thưởng & Hạng mục trong trình chỉnh sửa cuộc thi, nhập giá trị số âm vào trường Tổng giải thưởng (`Total prize pool`).
  - Khi bấm Lưu thay đổi, hàm `isPrizeAllocationValid` chặn submit ngay tại client.
  - Hiển thị Toast cảnh báo: "Track allocations cannot exceed the prize pool." (bản VI: "Tổng giải theo hạng mục không được vượt tổng giải thưởng.").
  - Tự động highlight viền và di chuyển focus đến ô nhập giá trị giải thưởng vi phạm.
- **Đánh dấu:** Đã cập nhật `[x] [TC-NOTIF-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-NOTIF-03]` Co-organizer Email Blast Permission Lockdown (#374)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy` (và 4/4 tests `blast_permissions.test.ts`).
- **URL thử nghiệm:** `/hackathons/:slug/overview`, `/functions/v1/corelia-api` (`hackathons.blastEmail`)
- **Tài khoản thực hiện:** Học viên (`student`, co-organizer scope).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Truy cập chi tiết cuộc thi với tài khoản người dùng thông thường / co-organizer: Giao diện chỉ hiển thị các tab công khai chuẩn (`Overview`, `Prizes`, `Timeline`, `Resources`, `Projects`). Toàn bộ tab và panel quản lý gửi email thông báo hàng loạt (`Email blast`) hoàn toàn bị ẩn.
  - Phía backend API, logic ủy quyền `canProfileBlastHackathonEmail` khóa chặt quyền blast email chỉ dành riêng cho `admin` và `support_staff`. Nếu tài khoản có vai trò khác gửi request, API lập tức phản hồi mã lỗi `403 forbidden:blast_email`.
- **Đánh dấu:** Đã cập nhật `[x] [TC-NOTIF-03]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-INVITE-01]` Invalid or Expired Project Invite Token Handling (BUG-007)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/invites/project/:token` (token giả lập `invalid-token-123`)
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Truy cập đường dẫn mời dự án với token không tồn tại hoặc sai định dạng.
  - Thẻ giao diện `Project invitation` xử lý an toàn lỗi từ `projectInvitePreviewQueryOptions`.
  - Hiển thị thông báo lỗi rõ ràng bằng văn bản cảnh báo màu đỏ: "This invite is invalid or has expired." (bản VI: "Lời mời không hợp lệ hoặc đã hết hạn.").
  - Toàn bộ các nút thao tác nguy hiểm ("Chấp nhận" / "Từ chối") bị ẩn hoàn toàn, chỉ duy trì nút "Retry" và điều hướng về "Home", ngăn chặn triệt để hành vi gửi mutation trái phép với token rác.
- **Đánh dấu:** Đã cập nhật `[x] [TC-INVITE-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-INVITE-02]` Valid Project Collaboration Invite & Idempotent Acceptance
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/projects/:projectId/edit`, Dropdown thông báo người dùng (`NotificationBell`)
- **Tài khoản thực hiện:** Chủ dự án (`student`) và Thành viên được mời (`student`).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Chủ dự án gửi lời mời cộng tác thành viên qua giao diện chỉnh sửa dự án `ProjectTeamEditor`.
  - Tài khoản được mời nhận thông báo in-app `Team invite` kèm tùy chọn "Accept" và "Decline" trong thanh thông báo.
  - Khi người dùng bấm "Accept":
    - RPC `accept_project_collaboration_invite_by_id` thực thi thành công, thêm người dùng vào bảng `project_collaborators`.
    - Thông báo hiển thị trạng thái đã giải quyết ("Lời mời đã được xử lý" / "This invite has been resolved"), các nút bấm thao tác bị gỡ bỏ, ngăn chặn thao tác trùng lặp.
    - Tại giao diện quản lý nhóm của chủ dự án (`/projects/:projectId/edit`), tài khoản người được mời lập tức được chuyển từ danh sách "PENDING INVITATIONS" sang danh sách "ACCEPTED MEMBERS", kèm nút "Remove".
  - Kiểm chứng cơ chế Idempotent Retry: Token / bản ghi lời mời sau khi chuyển trạng thái sang `accepted` sẽ kích hoạt điều kiện guard `data.status !== 'pending'`, trả về thông báo an toàn `not_actionable` thay vì ném exception hoặc crash giao diện.
- **Đánh dấu:** Đã cập nhật `[x] [TC-INVITE-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-UNSUB-01]` Email Unsubscribe Missing/Invalid Token Validation (BUG-UNSUB)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/email/unsubscribe`
- **Tài khoản thực hiện:** Khách vãng lai (`public`) / Người dùng ẩn danh.
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Truy cập trực tiếp đường dẫn hủy đăng ký email `/email/unsubscribe` mà không kèm query parameter token.
  - Component `EmailUnsubscribePage` áp dụng logic kiểm tra tức thời `!token`, lập tức chuyển trạng thái sang `status: "error"` mà không phát sinh request thừa thãi tới backend API.
  - Giao diện hiển thị card thông báo chuẩn xác và tức thì (không có độ trễ/không treo):
    - Tiêu đề: "Could not process request".
    - Nội dung: "The unsubscribe link is invalid or has expired. Please go to Settings to manage your notifications."
  - Không có tình trạng xoay loading spinner vô hạn; timeout phòng hộ 8 giây (`window.setTimeout(() => controller.abort(), 8000)`) đảm bảo tính sẵn sàng cao, hoàn thành triệt để mục tiêu của BUG-UNSUB.
- **Đánh dấu:** Đã cập nhật `[x] [TC-UNSUB-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-COURSE-01]` Direct Course Enrollment Without Payment Deadlock (BUG-012)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/courses/:courseSlug`, `/learn/:courseSlug/lesson/:lessonId`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Học viên truy cập trang chi tiết một khóa học chưa đăng ký và bấm nút "Đăng ký học ngay" (Enroll and enter).
  - Hệ thống gọi hàm `enrollCourse` và kích hoạt RPC `enroll_in_course`, tạo bản ghi ghi danh trực tiếp trong bảng `enrollments` mà không qua bất kỳ cổng thanh toán trung gian nào.
  - Sau khi ghi danh thành công, giao diện tự động chuyển hướng mượt mà và trực tiếp sang trang bài học `/learn/:courseSlug/lesson/:lessonId`.
  - Toàn bộ nội dung bài học, thanh tiến độ học tập (Curriculum progress) và các nút điều hướng "Complete & continue" hiển thị đầy đủ, hoạt động bình thường, tuyệt đối không tạo đơn hàng SePay hoặc yêu cầu quét mã QR chuyển khoản.
- **Đánh dấu:** Đã cập nhật `[x] [TC-COURSE-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-COURSE-02]` Invalid Checkout Context & Retired Route Fallback (BUG-006)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/checkout?courseId=invalid-id`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark) / Khách vãng lai.
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Nhập trực tiếp đường dẫn thanh toán giả lập với ID khóa học không hợp lệ trên URL.
  - Toàn bộ luồng thanh toán và route `/checkout` đã được gỡ bỏ chính thức theo quyết định kiến trúc tại commit `30bfb25` (`remove_all_financial_features.sql`), đưa `/checkout` vào danh sách `RESERVED_HANDLES`.
  - Bộ định tuyến của ứng dụng xử lý an toàn và chuyển tiếp hiển thị component trang `404 - Page not found` ("This page doesn't exist or has been moved" kèm nút "Back to home").
  - Giao diện phản hồi chuẩn xác, không làm phát sinh exception JS chưa được bắt và không bị sập màn hình trắng (blank screen).
- **Đánh dấu:** Đã cập nhật `[x] [TC-COURSE-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-LEARN-01]` Invalid Lesson ID Graceful Fallback & Feedback (BUG-011)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/learn/:courseId/lesson/00000000-0000-0000-0000-000000000000`
- **Tài khoản thực hiện:** Học viên (`student`, theme dark).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Học viên chỉnh sửa tham số `lessonId` trên URL phòng học thành một UUID giả lập không tồn tại.
  - Vòng đời component `Learn.tsx` bắt được trạng thái `!currentLesson` thông qua effect xử lý route bài học.
  - Hệ thống phát thông báo Toast người dùng nổi bật: "The lesson changed. Opened the first available lesson." (hoặc "Bài học đã thay đổi. Đã chuyển tới bài khả dụng đầu tiên.").
  - Tự động điều hướng học viên về bài học hợp lệ đầu tiên (`visibleLessons[0].id`), bảo toàn hoàn toàn trải nghiệm học tập, không bị redirect âm thầm (silent redirect không phản hồi) và không bị lỗi sập màn hình trắng (blank screen).
- **Đánh dấu:** Đã cập nhật `[x] [TC-LEARN-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-LEARN-02]` Empty Course Curriculum & Lesson Empty State
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/courses/:slug` (khóa học mới khởi tạo chưa có bài học)
- **Tài khoản thực hiện:** Giảng viên (`instructor`, author scope).
- **Kết quả:** `PASS`.
- **Chi tiết ghi nhận:**
  - Khóa học ở trạng thái bản nháp có `SECTIONS: 0` và `LESSONS: 0`.
  - Tại trang chi tiết khóa học xem trước (`/courses/:slug`), giao diện hiển thị trạng thái chuẩn xác:
    - Huy hiệu "Curriculum: 0 lessons" và số lượng phần "0 sections".
    - Không hiển thị các khối accordion bài học rỗng bị vỡ viền hoặc lỗi render danh sách `undefined`.
    - Thẻ điều hướng/truy cập bên phải hiển thị chỉ dẫn chuẩn: "Ready to learn - Enroll for free to start learning and sync progress across devices" kèm nút "Enroll and start", đảm bảo tính toàn vẹn của layout.
- **Đánh dấu:** Đã cập nhật `[x] [TC-LEARN-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-INST-01]` Loading Loop & Lifecycle in Question Generator Dialog (BUG-004)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** Local Regression Test Suite (`pnpm vitest run src/tests/issue343.regression.test.ts` & `src/pages/instructor-course-edit/components/QuestionGeneratorDialog.test.tsx`).
- **Phạm vi kiểm thử:** `QuestionGeneratorDialog` component lifecycle, state isolation, loading cleanup on unmount/error, cross-section race condition guard.
- **Kết quả:** `PASS`.
- **Chi tiết kỹ thuật:**
  - Verify vòng đời component khi kích hoạt `handleGenerateQuestions`: trạng thái `generating` được bật dứt khoát với spinner `Loader2` và vô hiệu hóa các nút tương tác.
  - Khi request API hoàn tất thành công hoặc gặp lỗi kết nối/HTTP status error, khối `finally` đảm bảo reset `generating = false`, dọn dẹp loading state dứt khoát, không bị rơi vào vòng lặp spinner vô tận (BUG-004 resolved).
  - Kiểm định race condition: khi section A đang fetch dở dang mà user chuyển sang section B, request của section A bị vô hiệu hóa an toàn qua `generateRequestIdRef`, không làm ghi đè câu hỏi của section B.
  - Kiểm định unmount isolation: đóng dialog khi đang fetch câu hỏi tự động hủy cập nhật state trên unmounted component, ngăn chặn memory leak và warning React state update.
- **Đánh dấu:** Đã cập nhật `[x] [TC-INST-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-INST-02]` Question Generation API Payload Validation (BUG-001, BUG-002, BUG-003)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** Edge Function Regression Test Suite (`src/tests/issue343.regression.test.ts`).
- **Phạm vi kiểm thử:** Edge Function `generate-questions` payload schema validation & HTTP status responses.
- **Kết quả:** `PASS`.
- **Chi tiết kỹ thuật:**
  - **BUG-001 (Count validation):** Gửi request với trường `count` không phải số nguyên dương hợp lệ (chuỗi hoặc float như `"five"` hoặc `3.14`) -> Hàm trả về HTTP `400 Bad Request` với mã lỗi payload validation tương ứng.
  - **BUG-002 (Invalid JSON / Missing body):** Gửi request body rỗng hoặc định dạng JSON sai cú pháp -> Hàm trả về HTTP `400 Bad Request` dứt khoát, không làm sập tiến trình runtime.
  - **BUG-003 (Resource existence):** Gửi request tạo câu hỏi trắc nghiệm với ID khóa học/section không tồn tại -> Hàm trả về HTTP `404 Not Found` (HttpStatusError) chuẩn xác thay vì 500 Internal Server Error.
  - Bộ 16 tests hồi quy hành vi của Issue #343 đạt 100% tỷ lệ pass.
- **Đánh dấu:** Đã cập nhật `[x] [TC-INST-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-INST-03]` Co-Instructor Invite Error & State Handling (BUG-016)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/instructor/courses/:courseId/edit#info`
- **Tài khoản thực hiện:** Giảng viên chính (`instructor`, course owner).
- **Kết quả:** `PASS`.
- **Chi tiết kỹ thuật:**
  - Thao tác gửi lời mời đồng giảng viên cho tài khoản khác (`User C`) trong tab **General info**.
  - Hệ thống kích hoạt RPC `create_course_co_instructor_invite`, tạo lời mời bảo mật và token liên quan.
  - Thông báo Toast phát ra chuẩn: `"Sent 1 co-instructor invite(s)"` và `"General info saved."`. Tuyệt đối không để lộ mã lỗi thô SQL từ cơ sở dữ liệu (`duplicate key`, `PGRST116`).
  - Giao diện cập nhật ngay lập tức: tài khoản vừa được mời chuyển sang khối danh sách **PENDING INVITES** kèm hạn sử dụng (14 ngày) và nút `Revoke` (thu hồi lời mời).
  - Dropdown combobox `ProfileCombobox` tự động lọc bỏ tài khoản đang có pending invite (`!pendingCoInstructorInvites.some(...)`), ngăn chặn người dùng chọn và gửi trùng lặp từ giao diện client.
- **Đánh dấu:** Đã cập nhật `[x] [TC-INST-03]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-CAREER-01]` Invalid Career Track ID Graceful Fallback (BUG-005)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/instructor/career-tracks/00000000-0000-0000-0000-000000000000/edit`
- **Tài khoản thực hiện:** Giảng viên (`instructor`).
- **Kết quả:** `PASS`.
- **Chi tiết kỹ thuật:**
  - Nhập trực tiếp URL chỉnh sửa lộ trình nghề nghiệp với một UUID không tồn tại (`00000000-0000-0000-0000-000000000000`).
  - Truy vấn `instructorCareerTrackEditorQueryOptions` trả về `track = null`.
  - Component `InstructorCareerTrackEditorPage.tsx` kích hoạt khối rẽ nhánh bảo vệ `if (!isNew && !track)`:
    - Hiển thị thông báo lỗi nổi bật trong khung cảnh báo viền đỏ: `"Track not found."` (hoặc *"Không tìm thấy lộ trình nghề nghiệp"*).
    - Cung cấp nút điều hướng quay lại an toàn: `<Button render={<Link to="/instructor/career-tracks" />}>Back</Button>`.
    - Toàn bộ form soạn thảo lộ trình, danh sách khóa học, và các nút Lưu/Xóa bị ẩn hoàn toàn (early return).
  - Giao diện phản hồi chuẩn mực, không phát sinh lỗi crash màn hình trắng (blank screen) và không rò rỉ ngoại lệ unhandled promise rejection.
- **Đánh dấu:** Đã cập nhật `[x] [TC-CAREER-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA\corelia-app\docs\tests\qa-local-checklist.md).

### `[TC-CAREER-02]` Career Tracks Cache Invalidation & Multi-Session Integrity (BUG-013)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy` & Local Test Suite (`src/tests/issue343.regression.test.ts`).
- **URL thử nghiệm:** `/instructor/career-tracks` & `/career`
- **Tài khoản thực hiện:** Giảng viên (`instructor`).
- **Kết quả:** `PASS`.
- **Chi tiết kỹ thuật:**
  - Giảng viên khởi tạo/cập nhật lộ trình nghề nghiệp (`track01`). Khi mutate thành công, `operationMutation` kích hoạt `onSuccess: () => queryClient.invalidateQueries({ queryKey: careerKeys.all })`.
  - Danh sách lộ trình nghề nghiệp tại `/instructor/career-tracks` cập nhật phản chiếu ngay lập tức bản ghi mới mà không cần thao tác reload trình duyệt hay xóa cache thủ công.
  - Kiểm định tự động trong `issue343.regression.test.ts`:
    - Case 1: Invalidate list cache khi đổi track A sang track B cùng số lượng bản ghi.
    - Case 2: Bảo tồn bản dịch đã translate khi cache hit.
    - Case 3: Tự động refresh translation khi session khác cập nhật nội dung đa ngôn ngữ trong bảng `career_track_locales` (kể cả khi `updated_at` của bảng cha không đổi).
  - Khắc phục hoàn toàn lỗi cache cũ và lệch dữ liệu giữa các phiên làm việc (BUG-013 resolved).
- **Đánh dấu:** Đã cập nhật `[x] [TC-CAREER-02]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-CAREER-03]` Instructor Profile UUID Validation & Error Page (BUG-008)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy`
- **URL thử nghiệm:** `/instructors/invalid-instructor-param`
- **Tài khoản thực hiện:** Người dùng vãng lai / Giảng viên.
- **Kết quả:** `PASS`.
- **Chi tiết kỹ thuật:**
  - Nhập trực tiếp URL hồ sơ giảng viên với tham số ID không phải là UUID hợp lệ (`invalid-instructor-param`).
  - Component `InstructorDetail.tsx` áp dụng bộ lọc regex UUID (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`).
  - Khi `isValidUuid === false`, tùy chọn query đặt `enabled: false`, hoàn toàn không gửi chuỗi rác tới Postgres qua Supabase RPC/REST API.
  - Ngăn chặn triệt để lỗi database exception `invalid input syntax for type uuid` (mã lỗi PostgreSQL `22P02`) trên network / browser console.
  - Giao diện người dùng render thẻ cảnh báo nổi bật: `"Instructor profile not found."` kèm liên kết `"Back to courses"`, bảo đảm trải nghiệm người dùng sạch sẽ và nhất quán.
- **Đánh dấu:** Đã cập nhật `[x] [TC-CAREER-03]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

### `[TC-SEARCH-01]` Mobile Responsive Inline Search Form (BUG-010)
- **Thời gian thực thi:** 2026-09-13.
- **Môi trường:** `https://staging.corelia.academy` (Mobile Viewport: iPhone 16 - 393 x 852).
- **URL thử nghiệm:** `/search`
- **Tài khoản thực hiện:** Người dùng vãng lai / Giảng viên.
- **Kết quả:** `PASS`.
- **Chi tiết kỹ thuật:**
  - Kích hoạt chế độ giả lập thiết bị di động trong Chrome DevTools (viewport 393px).
  - Khác với giao diện Desktop (tìm kiếm trên header thanh điều hướng), trên màn hình Mobile thanh tìm kiếm header được ẩn đi để tối ưu không gian.
  - Trang `/search` (`SearchPage.tsx`) hiển thị form tìm kiếm inline nổi bật ngay phía dưới tiêu đề:
    - Input tìm kiếm kèm icon kính lúp hiển thị rõ ràng, co giãn theo chiều rộng màn hình (`flex-1 min-w-0`).
    - Nút submit "Search" (Tìm kiếm) cố định kích thước (`shrink-0`).
    - Không bị tràn viền (overflow), không xuất hiện thanh cuộn ngang (horizontal scroll), căn lề padding và khoảng cách chuẩn theo hệ thống token giao diện.
  - Trải nghiệm tìm kiếm trên thiết bị di động mượt mà, phản hồi ngay lập tức khi gửi form.
- **Đánh dấu:** Đã cập nhật `[x] [TC-SEARCH-01]` trong [`docs/tests/qa-local-checklist.md`](file:///g:/Documents/CORELIA/corelia-app/docs/tests/qa-local-checklist.md).

---

## 4. TỔNG KẾT NGHIỆM THU QA TOÀN DIỆN (FINAL SIGN-OFF)

- **Thời gian hoàn thành:** 2026-09-13T20:30:00+07:00.
- **Môi trường:** Staging (`https://staging.corelia.academy`) kết hợp Local Vitest Regression Suite.
- **Tổng số ca kiểm thử:** 39 ca.
- **Kết quả nghiệm thu:** **39 / 39 ca PASS (100%)**.
  - **Trục 1: Auth, Navigation & Locale:** 9/9 PASS.
  - **Trục 2: Contests, Hackathons & Projects:** 11/11 PASS.
  - **Trục 3: Emails, Notifications & Outbox:** 6/6 PASS.
  - **Trục 4: Courses, Learning & Bug Hunt:** 13/13 PASS.
- **Lỗi phát sinh trong quá trình QA & Xử lý:**
  - Phát hiện lỗi hiển thị chuỗi lỗi thô DB `COURSE_NOT_PUBLISHABLE` khi lưu khóa học trống ở trạng thái xuất bản (`published = true`).
  - Đã khắc phục triệt để qua PR: `fix/localize-course-publish-validation-error` (bổ sung i18n vi/en, mapping helper thân thiện và bộ unit test kiểm thử 100% pass).
- **Kết luận:** Toàn bộ hệ thống đạt tiêu chuẩn kỹ thuật, không còn bug nghiêm trọng, sẵn sàng bàn giao và phát hành.
