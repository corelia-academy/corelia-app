# Checklist Kiểm Thử Local / Staging — Toàn bộ QA 3 Tuần Qua

> **Phạm vi kiểm thử:** Toàn bộ tính năng, cải tiến và bản sửa lỗi do developer thực hiện trong chu kỳ 3 tuần (23/08/2026 - 13/09/2026).
>
> **Môi trường thực hiện:** Staging (`https://staging.corelia.academy`).
>
> **Cách sử dụng:** Đánh dấu `[x]` vào các ô checkbox khi hoàn thành từng bước kiểm tra. Ghi lại mã lỗi hoặc log cụ thể nếu phát hiện lỗi.

---

## 0. Chuẩn bị môi trường & Tiền kiểm (Pre-flight Checks)

- [x] **[SETUP-01]** Chạy `pnpm build` hoặc `pnpm build:staging` thành công, không có lỗi TypeScript hoặc bundle.
- [x] **[SETUP-02]** Truy cập môi trường Staging (`https://staging.corelia.academy`) trên trình duyệt (Incognito), mở Console F12 kiểm tra `window.__CORELIA_BUILD__` và xác nhận không có runtime error khi khởi động.
- [x] **[SETUP-03]** Chuẩn bị sẵn 3 tài khoản kiểm thử:
  - Tài khoản học viên (`role = 'student'`, cấu hình theme dark)
  - Tài khoản giảng viên (`role = 'instructor'`)
  - Tài khoản quản trị (`role = 'admin'` hoặc `'support_staff'`)

---

## 1. Trục Xác Thực, Điều Hướng & Đa Ngôn Ngữ (Auth, Navigation & Locale)

### 1.1. Chuẩn hóa Auth Redirect & Chống Redirect Loop (#394 / PR #432)
- [x] **[TC-AUTH-01] Bảo toàn Query Parameters và Hash Fragment sau đăng nhập**
  - **Tiền điều kiện:** Chưa đăng nhập (logged out).
  - **Thao tác:** Truy cập URL có tham số bảo vệ: `/login?redirect=%2Fprojects%3Ffilter%3Dactive%23details`.
  - **Thực hiện:** Đăng nhập thành công bằng tài khoản học viên.
  - **Kỳ vọng:** Trình duyệt tự động chuyển hướng chính xác về `/projects?filter=active#details` (giữ nguyên filter và hash fragment `#details`, không bị mất hoặc biến dạng URL).
- [x] **[TC-AUTH-02] Chặn Redirect Loop về chính `/auth` hoặc `/login`**
  - **Tiền điều kiện:** Chưa đăng nhập.
  - **Thao tác:** Truy cập `/login?redirect=%2Fauth` hoặc `/login?redirect=%2Flogin`.
  - **Thực hiện:** Đăng nhập thành công.
  - **Kỳ vọng:** Hệ thống từ chối chuyển về trang auth/login, tự động fallback an toàn về `/` (hoặc `/home`), không bị kẹt trong vòng lặp vô hạn.
- [x] **[TC-AUTH-03] Chặn Open Redirect ra domain bên ngoài**
  - **Tiền điều kiện:** Chưa đăng nhập.
  - **Thao tác:** Truy cập `/login?redirect=https%3A%2F%2Fevil-domain.com%2Fsteal`.
  - **Thực hiện:** Đăng nhập thành công.
  - **Kỳ vọng:** Hệ thống phát hiện external protocol và fallback về trang nội bộ an toàn (`/`), tuyệt đối không chuyển hướng sang domain ngoài.

---

### 1.2. Race Condition Đa Ngôn Ngữ & Rollback (#412 / PR #435)
- [x] **[TC-LOCALE-01] Chuyển đổi ngôn ngữ nhanh liên tục (Flicker Guard)**
  - **Tiền điều kiện:** Đã đăng nhập bằng tài khoản người dùng.
  - **Thao tác:** Tại thanh Header, bấm chuyển đổi ngôn ngữ liên tục giữa `VI` và `EN` (3-5 lần trong vòng 2 giây).
  - **Kỳ vọng:** Giao diện cập nhật ngay lập tức theo lựa chọn click cuối cùng của người dùng; không có hiện tượng giao diện bị giật nhấp nháy hoặc bị API cũ trả về đè ngược (revert) về ngôn ngữ cũ.
- [x] **[TC-LOCALE-02] Rollback trạng thái khi API lưu profile thất bại**
  - **Tiền điều kiện:** Đã đăng nhập; giả lập ngắt mạng hoặc chặn request PATCH tới `/rest/v1/profiles` qua Network tab (Block request URL).
  - **Thao tác:** Chọn chuyển ngôn ngữ từ `VI` sang `EN`.
  - **Kỳ vọng:** UI ban đầu chuyển `EN` (optimistic), khi request thất bại hệ thống tự động rollback về lại `VI` và hiển thị thông báo lỗi thân thiện, không để cache lệch với database.
- [x] **[TC-LOCALE-03] Kiểm tra đồng bộ ngôn ngữ tại trang Account Settings**
  - **Thao tác:** Truy cập `/account/profile`, đổi ngôn ngữ hiển thị trong form cài đặt và reload lại trang.
  - **Kỳ vọng:** Ngôn ngữ đã chọn được lưu bền vững sau khi F5/hard reload.

---

### 1.3. Bộ Lọc Mức Lương Tuyển Dụng & Bộ Gõ IME (#411 / PR #434)
- [x] **[TC-JOBS-01] Nhập lương bằng bộ gõ tiếng Việt (Unikey / EVKey)**
  - **Môi trường:** Trình duyệt trên Windows có bật bộ gõ tiếng Việt (Telex/VNI).
  - **Thao tác:** Truy cập trang việc làm `/jobs` (hoặc `/careers`), mở bộ lọc mức lương tối thiểu. Gõ nhanh chuỗi số có dấu hoặc thao tác gõ tiếng Việt.
  - **Kỳ vọng:** Input không bị ngắt quãng giữa chừng, không bị mất focus hay nhảy con trỏ chuột về đầu ô. Sau khi nhấn `Enter` hoặc click ra ngoài (`blur`), giá trị số được định dạng chính xác.
- [x] **[TC-JOBS-02] Bảo toàn giá trị mức lương bằng 0**
  - **Thao tác:** Nhập giá trị `0` vào ô mức lương tối thiểu và thực hiện lọc.
  - **Kỳ vọng:** Hệ thống giữ nguyên giá trị `0` trong bộ lọc và trên thanh địa chỉ URL; không bị tự động xóa ô input thành rỗng hoặc `null`.
- [x] **[TC-JOBS-03] Xóa trắng bộ lọc mức lương**
  - **Thao tác:** Xóa hết ký tự trong ô input và nhấn Enter/blur.
  - **Kỳ vọng:** Bộ lọc được clear sạch sẽ, danh sách công việc hiển thị đầy đủ không bị giới hạn mức lương.

---

## 2. Trục Cuộc Thi, Hackathons & Danh Mục Dự Án

### 2.1. Đăng Ký Cuộc Thi Đang Diễn Ra & Chuẩn Hóa Slug (#395 / PR #433)
- [x] **[TC-CONTEST-01] Đăng ký cuộc thi có trạng thái `running` trước deadline**
  - **Tiền điều kiện:** Cuộc thi có `status = 'running'` và thời gian hiện tại nhỏ hơn `registration_deadline`.
  - **Thao tác:** Dùng tài khoản học viên chưa đăng ký truy cập trang chi tiết cuộc thi `/hackathons/:slug`.
  - **Kỳ vọng:** Nút **Đăng ký tham gia** vẫn hiển thị và khả dụng; bấm đăng ký thành công, trạng thái chuyển sang đã tham gia mà không bị chặn quyền.
- [x] **[TC-CONTEST-02] Chuẩn hóa Slug URL viết hoa về chữ thường**
  - **Thao tác:** Nhập trực tiếp URL chứa chữ hoa trên trình duyệt: `/hackathons/UPPERCASE-SLUG` hoặc `/contests/UPPERCASE-SLUG`.
  - **Kỳ vọng:** Hệ thống tự động redirect 301 hoặc chuyển hướng nội bộ về `/hackathons/uppercase-slug`, tải nội dung thành công, không bị lỗi 404 Not Found.
- [x] **[TC-CONTEST-03] Tab Projects của cuộc thi: Empty state và xử lý lỗi**
  - **Thao tác:** Vào tab **Dự án** (Projects) của cuộc thi chưa có dự án nào được nộp.
  - **Kỳ vọng:** Hiển thị màn hình empty state thân thiện ("Chưa có dự án nào"), không bị văng lỗi runtime trắng màn hình.

---

### 2.2. Liên Kết Cuộc Thi Trong Trang Cá Nhân (#393 / PR #431)
- [x] **[TC-PROFILE-01] Điều hướng cuộc thi từ trang cá nhân người dùng**
  - **Thao tác:** Truy cập trang cá nhân `/u/:username` của tài khoản đã nộp bài cuộc thi.
  - **Kỳ vọng:** Danh sách các cuộc thi và dự án hiển thị chính xác (được query từ bảng `hackathon_submissions`).
- [x] **[TC-PROFILE-02] Kiểm tra tính toàn vẹn của liên kết**
  - **Thao tác:** Bấm vào thẻ cuộc thi trong trang profile.
  - **Kỳ vọng:** Trình duyệt điều hướng đúng đến URL chuẩn `/hackathons/:slug` của cuộc thi tương ứng; nếu cuộc thi không có slug, fallback về ID cuộc thi hợp lệ.

---

### 2.3. Danh Mục Cuộc Thi & Quản Trị (#437, #438, #439, #373)
- [x] **[TC-HACK-01] Số lượng cuộc thi đang mở đơn (`accepting count`) (#438)**
  - **Thao tác:** Mở trang danh mục cuộc thi `/hackathons`.
  - **Kỳ vọng:** Số lượng đếm trên badge "Đang mở đăng ký" phản ánh chính xác các cuộc thi có `now() < registration_deadline`, không đếm nhầm các cuộc thi đã quá hạn đăng ký.
- [x] **[TC-HACK-02] Bộ lọc dự án theo slug không phân biệt hoa thường (#439)**
  - **Thao tác:** Truy cập danh mục dự án với param viết hoa: `/projects?hackathon=UPPERCASE-SLUG`.
  - **Kỳ vọng:** Danh sách lọc đúng các dự án thuộc cuộc thi đó; thanh địa chỉ URL tự động chuẩn hóa về slug chữ thường.
- [x] **[TC-HACK-03] Đa ngôn ngữ nhãn trạng thái & hình thức tại trang Admin (#437)**
  - **Tiền điều kiện:** Đăng nhập tài khoản quản trị (`admin`), truy cập `/admin/hackathons`.
  - **Thao tác:** Chuyển đổi ngôn ngữ sang Tiếng Việt.
  - **Kỳ vọng:** Các badge trạng thái (`draft` -> Bản nháp, `published` -> Đã xuất bản, `running` -> Đang diễn ra, `ended` -> Đã kết thúc) và hình thức (`online` -> Trực tuyến, `in-person` -> Trực tiếp, `hybrid` -> Kết hợp) được dịch hoàn chỉnh sang tiếng Việt, không còn chuỗi tiếng Anh gốc.
- [x] **[TC-HACK-04] Validate thứ tự deadline trong form chỉnh sửa cuộc thi (#373)**
  - **Thao tác:** Tại trang chỉnh sửa cuộc thi trong admin, cố tình đặt `submission_deadline` trước `registration_deadline` rồi bấm Lưu.
  - **Kỳ vọng:** Form chặn submit ngay tại client, hiển thị thông báo lỗi chỉ rõ thời hạn nộp bài phải diễn ra sau thời hạn đăng ký.
- [x] **[TC-HACK-05] Hiển thị dấu hoa thị bắt buộc (`*`) màu xanh thương hiệu (#373)**
  - **Thao tác:** Quan sát các trường bắt buộc trong form tạo/sửa cuộc thi và form nộp dự án.
  - **Kỳ vọng:** Dấu hoa thị `*` hiển thị rõ ràng với màu xanh thương hiệu (brand blue), giúp người dùng phân biệt trường bắt buộc.
- [x] **[TC-HACK-06] Fallback nội dung cuộc thi khi chuỗi rỗng (#367)**
  - **Thao tác:** Xem cuộc thi chỉ có mô tả bằng tiếng Anh nhưng chuyển giao diện sang tiếng Việt.
  - **Kỳ vọng:** Hiển thị nội dung mô tả tiếng Anh dự phòng, không để trống khoảng trắng trên giao diện.

---

### 2.4. Huy Hiệu Giải Thưởng Dự Án Thắng Cuộc (Winner Award Badge)
- [x] **[TC-PROJECT-01] Hiển thị huy hiệu đạt giải trên trang danh mục dự án**
  - **Thao tác:** Truy cập `/projects`, tìm dự án đã được quản trị viên trao giải trong cuộc thi.
  - **Kỳ vọng:** Thẻ dự án hiển thị rõ badge đạt giải (ví dụ: Giải Nhất / Quán quân / Winner Badge) nổi bật.
- [x] **[TC-PROJECT-02] Hiển thị huy hiệu đạt giải trên trang chi tiết dự án**
  - **Thao tác:** Click vào xem chi tiết dự án `/projects/:slug`.
  - **Kỳ vọng:** Phần tiêu đề và thông tin giải thưởng hiển thị đầy đủ, không bị biến mất khi F5 tải lại trang.

---

## 3. Trục Email, Thông Báo & Hộp Thư Đi (Outbox & Notifications)

### 3.1. Tính Bất Biến Khi Gửi Thông Báo & Trao Giải (#373, #374)
- [x] **[TC-NOTIF-01] Gửi thông báo trao giải thưởng (Idempotency check)**
  - **Tiền điều kiện:** Đăng nhập tài khoản admin; mở danh sách bài thi đã chấm điểm.
  - **Thao tác:** Thực hiện trao giải và kích hoạt gửi thông báo cho đội thi. Bấm gửi lại lần 2 hoặc giả lập retry request.
  - **Kỳ vọng:** Hệ thống ghi nhận kết quả gửi qua outbox; không xảy ra hiện tượng spam 2 email cùng nội dung đến cùng một tài khoản thành viên.
- [x] **[TC-NOTIF-02] Chặn phân bổ số tiền giải thưởng âm**
  - **Thao tác:** Trong form cấu hình giải thưởng hoặc trao giải, nhập giá trị tiền thưởng mang số âm (ví dụ: `-1000000`).
  - **Kỳ vọng:** Hệ thống từ chối submit và báo lỗi số tiền thưởng không hợp lệ.
- [x] **[TC-NOTIF-03] Chặn quyền blast email của co-organizer (#374)**
  - **Tiền điều kiện:** Đăng nhập tài khoản có quyền co-organizer (đồng tổ chức).
  - **Thao tác:** Kiểm tra giao diện điều khiển cuộc thi.
  - **Kỳ vọng:** Quyền blast email toàn thể thí sinh bị ẩn hoặc từ chối truy cập 403 Forbidden nếu cố tình gọi API.

---

### 3.2. Lời Mời Tham Gia Dự Án & Token Hủy Đăng Ký (BUG-007, BUG-UNSUB)
- [x] **[TC-INVITE-01] Xử lý token mời dự án không hợp lệ (BUG-007)**
  - **Thao tác:** Truy cập đường dẫn mời dự án với token giả lập hoặc đã hết hạn: `/invites/project?token=invalid-token-123`.
  - **Kỳ vọng:** Màn hình hiển thị thông báo lỗi rõ ràng ("Lời mời không hợp lệ hoặc đã hết hạn"); toàn bộ nút "Chấp nhận" và "Từ chối" bị ẩn hoàn toàn.
- [x] **[TC-INVITE-02] Chấp nhận lời mời dự án hợp lệ (Idempotent retry)**
  - **Thao tác:** Mở link lời mời hợp lệ, bấm "Chấp nhận".
  - **Kỳ vọng:** Thành viên được thêm vào dự án thành công; nếu bấm lại link cũ sau khi đã chấp nhận, hệ thống báo đã là thành viên thay vì báo lỗi hệ thống.
- [x] **[TC-UNSUB-01] Xác thực token hủy đăng ký email (BUG-UNSUB)**
  - **Thao tác:** Gọi endpoint hủy đăng ký email mà không truyền token: `/api/unsubscribe` hoặc mở URL thiếu token.
  - **Kỳ vọng:** Endpoint trả về lỗi 404 HttpStatusError trong vòng dưới 8 giây (có timeout), không bị treo request vô thời hạn.

---

## 4. Trục Khóa Học, Học Tập, Thanh Toán & Bộ Sửa Lỗi Bug Hunt

### 4.1. Khóa Học Miễn Phí & Tránh Deadlock Cổng Thanh Toán (BUG-012, BUG-006)
- [x] **[TC-COURSE-01] Ghi danh trực tiếp vào khóa học miễn phí (BUG-012)**
  - **Tiền điều kiện:** Đăng nhập tài khoản học viên chưa sở hữu khóa học có `price = 0`.
  - **Thao tác:** Tại trang chi tiết khóa học, bấm nút "Đăng ký học ngay" (Enroll).
  - **Kỳ vọng:** Hệ thống kích hoạt ghi danh trực tiếp (direct enrollment) và chuyển hướng ngay sang trang bài học; tuyệt đối không tạo đơn hàng SePay hoặc yêu cầu quét mã QR chuyển khoản.
- [x] **[TC-COURSE-02] Xử lý context đơn hàng không hợp lệ tại trang Checkout (BUG-006)**
  - **Thao tác:** Truy cập trực tiếp URL thanh toán không có thông tin đơn hàng hợp lệ: `/checkout?courseId=invalid-id`.
  - **Kỳ vọng:** Giao diện hiển thị thông báo "Đơn hàng không tồn tại hoặc không hợp lệ" kèm nút quay lại danh mục khóa học, không bị trắng màn hình.

---

### 4.2. Trải Nghiệm Học Tập & Xử Lý Lỗi Lesson ID (BUG-011)
- [x] **[TC-LEARN-01] Truy cập bài học với `lessonId` không tồn tại (BUG-011)**
  - **Tiền điều kiện:** Đã đăng nhập và đã ghi danh khóa học.
  - **Thao tác:** Trên URL học tập, sửa trực tiếp tham số bài học thành một ID rác: `/learn/:courseSlug?lessonId=fake-lesson-uuid`.
  - **Kỳ vọng:** Giao diện hiển thị thông báo lỗi chỉ rõ "Bài học không tồn tại hoặc đã bị xóa" kèm nút điều hướng quay về bài học khả dụng gần nhất; không bị redirect âm thầm hoặc rơi vào màn hình trắng.
- [x] **[TC-LEARN-02] Trường hợp danh sách bài học rỗng**
  - **Kỳ vọng:** Nếu khóa học chưa có bài học nào được publish, hiển thị empty state đúng quy chuẩn.

---

### 4.3. Workspace Giảng Viên & Dialog Tạo Câu Hỏi (BUG-001 -> BUG-004, BUG-016)
- [x] **[TC-INST-01] Vòng lặp tải trong Dialog tạo câu hỏi trắc nghiệm (BUG-004)**
  - **Tiền điều kiện:** Đăng nhập tài khoản giảng viên (`instructor`), mở màn hình chỉnh sửa khóa học/quiz.
  - **Thao tác:** Mở dialog `QuestionGeneratorDialog`, nhập yêu cầu và bấm tạo câu hỏi.
  - **Kỳ vọng:** Dialog hiển thị trạng thái loading rõ ràng; khi hoàn tất (hoặc khi gặp lỗi) phải thoát khỏi trạng thái loading và cho phép người dùng thao tác tiếp, không bị treo spinner vô tận.
- [x] **[TC-INST-02] Validate payload API tạo câu hỏi (BUG-001, BUG-002, BUG-003)**
  - **Thao tác kiểm thử API:**
    - Gửi request thiếu tài nguyên liên quan -> Nhận 404 HttpStatusError chuẩn.
    - Gửi request body JSON sai định dạng -> Nhận 400 Bad Request.
    - Gửi trường `count` không phải số nguyên (ví dụ: chuỗi hoặc float) -> Nhận 400 Bad Request.
- [x] **[TC-INST-03] Thân thiện hóa mã lỗi mời đồng giảng viên (BUG-016)**
  - **Thao tác:** Giảng viên gửi lời mời đồng giảng viên cho một email đã được mời hoặc đã có quyền.
  - **Kỳ vọng:** Toast hiển thị thông báo tiếng Việt/tiếng Anh thân thiện dễ hiểu, không để lộ mã lỗi thô từ database (ví dụ: không hiển thị `duplicate key value violates unique constraint` hay `PGRST116`).

---

### 4.4. Lộ Trình Nghề Nghiệp & Profile Giảng Viên (BUG-005, BUG-008, BUG-013)
- [x] **[TC-CAREER-01] Truy cập trình chỉnh sửa lộ trình nghề nghiệp với ID sai (BUG-005)**
  - **Thao tác:** Truy cập URL: `/career-tracks/00000000-0000-0000-0000-000000000000/edit`.
  - **Kỳ vọng:** Trang hiển thị thông báo "Không tìm thấy lộ trình nghề nghiệp"; toàn bộ form và các nút bấm Lưu/Xóa bị ẩn hoàn toàn.
- [x] **[TC-CAREER-02] Invalidate cache danh mục khi cập nhật lộ trình (BUG-013)**
  - **Thao tác:** Giảng viên chỉnh sửa tên một lộ trình nghề nghiệp và lưu lại; sau đó truy cập ngay trang danh mục lộ trình `/career-tracks`.
  - **Kỳ vọng:** Tên mới cập nhật hiển thị ngay lập tức trên danh mục mà không cần người dùng phải xóa cache trình duyệt.
- [x] **[TC-CAREER-03] Validate UUID trang profile giảng viên (BUG-008)**
  - **Thao tác:** Nhập URL trang giảng viên với ID không phải UUID: `/instructors/invalid-instructor-param`.
  - **Kỳ vọng:** Giao diện trả về trang 404 thân thiện, không làm phát sinh exception SQL trong DevTools console.

---

### 4.5. Tìm Kiếm Responsive Trên Mobile (BUG-010)
- [x] **[TC-SEARCH-01] Thanh tìm kiếm inline trên giao diện điện thoại (BUG-010)**
  - **Môi trường:** Kích hoạt chế độ giả lập thiết bị di động trong DevTools (viewport 375px hoặc 390px).
  - **Thao tác:** Truy cập trang tìm kiếm `/search`.
  - **Kỳ vọng:** Form tìm kiếm với ô input và nút tìm kiếm hiển thị nổi bật ở đầu trang nội dung; người dùng có thể nhập từ khóa và tìm kiếm trực tiếp trên màn hình mobile mà không bị tràn khung hay vỡ giao diện.

---

## 5. Bảng Tổng Kết Kết Quả Kiểm Thử (Sign-off Summary)

| Trục kiểm thử | Tổng số ca | Đạt (Pass) | Lỗi (Fail) | Bị chặn (Blocked) |
|---|---|---|---|---|
| **1. Auth, Navigation & Locale** | 9 | 9 | 0 | 0 |
| **2. Contests, Hackathons & Projects** | 11 | 11 | 0 | 0 |
| **3. Emails, Notifications & Outbox** | 6 | 6 | 0 | 0 |
| **4. Courses, Learning & Bug Hunt** | 13 | 13 | 0 | 0 |
| **TỔNG CỘNG** | **39** | **39 (100%)** | **0** | **0** |

### Ghi chú lỗi phát sinh (Defect Log nếu có):
```text
[TC-COURSE-01 / TC-LEARN-02] - Lộ mã lỗi thô cơ sở dữ liệu COURSE_NOT_PUBLISHABLE khi lưu khóa học 0 bài học ở chế độ công khai.
-> Đã xử lý triệt để qua PR: fix/localize-course-publish-validation-error (i18n vi/en, hook parse lỗi chuẩn xác, unit test 100% pass).
```

**Người thực hiện kiểm thử:** `Corelia QA & Development Team`  
**Ngày hoàn thành:** `13 / 09 / 2026`  
**Trạng thái nghiệm thu:** `[x] ĐẠT YÊU CẦU / [ ] CẦN FIX THÊM`
