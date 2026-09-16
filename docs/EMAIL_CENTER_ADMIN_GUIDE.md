# Hướng dẫn vận hành Email Center

Email Center nằm tại `/admin/email`. Admin và support có thể quản lý danh bạ, template và chiến dịch. Chỉ admin được bật gửi toàn hệ thống, quản lý sender và automation hệ thống.

## 1. Cấu hình domain

Tạo bốn domain trong Resend và chép **đúng các bản ghi do Resend hiển thị** sang Cloudflare DNS:

| Mục đích | Domain | From mặc định |
| --- | --- | --- |
| Hệ thống | `system.corelia.academy` | `no-reply@system.corelia.academy` |
| Học tập | `learn.corelia.academy` | `notifications@learn.corelia.academy` |
| Chương trình/hackathon | `events.corelia.academy` | `notifications@events.corelia.academy` |
| Marketing | `news.corelia.academy` | `hello@news.corelia.academy` |

Các bản ghi email phải để **DNS only** trên Cloudflare. Không thay hoặc xóa MX/SPF/DKIM đang phục vụ hộp thư hiện có. Sau khi Resend báo `Verified`, cập nhật sender tương ứng trong Email Center. Kiểm tra DMARC alignment trước khi bật gửi thật.

Supabase Edge Functions cần ba secret: `RESEND_API_KEY`, `RESEND_WEBHOOK_SIGNING_SECRET`, `EMAIL_WORKER_SECRET`. Tạo webhook Resend trỏ tới:

```text
https://<project-ref>.supabase.co/functions/v1/corelia-api?op=email.webhook
```

Chọn ít nhất `email.delivered`, `email.bounced`, `email.complained` và `email.failed`. Mail xác thực/reset mật khẩu cấu hình riêng trong Supabase Auth SMTP bằng Resend SMTP; không chạy qua campaign worker.

Scheduler dùng thêm hai secret trong Supabase Vault: `corelia_email_project_url` là URL project và `corelia_email_worker_secret` phải có cùng giá trị với Edge secret `EMAIL_WORKER_SECRET`. Migration tạo cron `corelia-email-center` chạy mỗi phút; pipeline phát hành sẽ chặn nếu Vault hoặc Edge secret còn thiếu.

## 2. Import người nhận

CSV dùng UTF-8 với các cột khuyến nghị:

```csv
email,full_name,locale,marketing_consent
learner@example.com,Nguyễn An,vi,true
```

Email được chuẩn hóa chữ thường và gộp theo địa chỉ. Giá trị consent hợp lệ gồm `true`, `yes`, `1`, `có`, `đồng ý`. Import lại không bật lại contact đã hủy đăng ký và không tự đưa contact vào automation. File nằm trong bucket private `email-imports`; báo cáo lỗi được lưu cạnh file import.

Màn hình import hỗ trợ nguồn CSV thường hoặc Luma, xem trước 10 dòng và ánh xạ thủ công các cột email, họ tên (hoặc họ/tên riêng), ngôn ngữ và consent. Dữ liệu tham dự sự kiện của Luma không được suy diễn thành consent marketing. Tài khoản Corelia luôn giữ tên/ngôn ngữ từ profile; CSV chỉ bổ sung membership vào danh sách và không ghi đè hồ sơ đó.

## 3. Template và chiến dịch

1. Tạo template đúng mục đích; dùng biến `{{name}}`, `{{course_name}}`, `{{event_url}}` khi cần.
2. Xuất bản một version. Chiến dịch đóng băng version và sender, nên chỉnh template sau đó không làm đổi chiến dịch đang chờ.
3. Chọn danh sách, sender đã xác thực và ngữ cảnh khóa học/chương trình/hackathon nếu có.
4. Chuẩn bị chiến dịch để server chốt danh sách và loại contact thiếu consent hoặc đang bị suppression.
5. Gửi thử đến danh sách nội bộ. Kiểm tra From, Reply-To, CTA và hiển thị Gmail/Outlook.
6. Đặt lịch hoặc bắt đầu. Worker tiếp tục chạy khi admin đóng trình duyệt.

`Accepted` chỉ có nghĩa Resend đã nhận request; `Delivered` đến từ webhook. Pause/cancel chỉ ngăn phần chưa dispatch.

## 4. Scheduler và chiến dịch lớn

Scheduler gọi `cron-email-center` mỗi phút với header `x-corelia-email-worker-secret`. Mỗi invocation xử lý một số batch giới hạn; batch Resend tối đa 100 email. Giới hạn mặc định 100.000 người/chiến dịch nằm trong `email_settings` và có thể điều chỉnh sau kiểm thử tải.

Không tăng tốc độ vượt quota Resend. Khi gặp 429 worker tôn trọng `Retry-After`; lỗi tạm thời dùng exponential backoff. Một batch giữ nguyên thành viên và idempotency key khi retry.

## 5. Automation

Automation mới luôn tắt. Chỉ bật sau khi đã xuất bản template và gửi thử. UniHackFest hoặc bất kỳ chương trình nào chỉ là một `hackathon`/đối tượng được chọn; không có logic riêng theo tên chương trình.

Các trigger hỗ trợ: xác thực tài khoản, ghi danh khóa học, không hoạt động học tập, duyệt đăng ký chương trình/hackathon, hoàn thành khóa học và consent marketing. Việc nối trigger nghiệp vụ vào automation thực hiện theo từng rollout; không bật đồng thời handler cũ và mới cho cùng một loại mail.

### Ba ví dụ cấu hình

- **Khóa “Solana căn bản”:** purpose `learning`, sender `notifications@learn.corelia.academy`, template hướng dẫn bắt đầu và automation `course_enrolled` gắn `object_type=course` cùng ID khóa học. Bước hai chờ 2 ngày; worker dừng bước này khi học viên đã bắt đầu học.
- **Hackathon A:** purpose `event`, tên gửi “Hackathon A”, địa chỉ `hackathon-a@events.corelia.academy`, template có `{{event_name}}` và automation `object_registration_approved` gắn ID Hackathon A.
- **Hackathon B:** dùng cùng domain `events.corelia.academy` nhưng sender, template và automation gắn ID riêng. Tạo Hackathon C chỉ cần thêm cấu hình tương tự, không sửa schema hoặc code.

Với email nhắc trước mốc sự kiện, đặt lịch chiến dịch theo UTC từ giờ hiển thị Asia/Ho_Chi_Minh. Khi đổi lịch sự kiện, hủy phần chưa gửi của lịch cũ và tạo lịch thay thế; không gửi lại request đã được provider nhận.

## 6. Xử lý sự cố

1. Admin tắt **Công tắc gửi toàn hệ thống**.
2. Giữ nguyên các bản ghi `indeterminate`; đối chiếu message trong Resend trước khi quyết định.
3. Kiểm tra webhook secret, backlog, 429, bounce và complaint.
4. Không gỡ suppression do hard bounce/complaint bằng import.
5. Khi đã xác định nguyên nhân, xử lý forward-only và bật worker lại. Không chia lại một batch chưa rõ kết quả dưới idempotency key mới.

Production chỉ bật sau khi migration, Edge Functions, scheduler, DNS và webhook đều xanh trên Staging. Frontend Cloudflare là pipeline riêng và cần evidence deploy riêng.
