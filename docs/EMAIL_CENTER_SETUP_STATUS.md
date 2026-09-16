# Trạng thái cấu hình Email Center — 16/09/2026

Đây là evidence cấu hình hạ tầng, không phải xác nhận Email Center đã được phát hành.

## Resend và DNS

Tài khoản Corelia Pro, region Tokyo (`ap-northeast-1`). Bốn domain đều đã hiển thị **Verified** trong Resend và được kiểm tra qua DNS public:

| Domain | Resend domain ID |
| --- | --- |
| `system.corelia.academy` | `25a7608a-c88d-4a76-ad64-db108b9e9e07` |
| `learn.corelia.academy` | `e0d85f21-2f86-4152-92c6-e67b76fb3f97` |
| `events.corelia.academy` | `f6b529f6-b1f8-4acd-9d51-b3b7e893d05b` |
| `news.corelia.academy` | `36c97c66-2548-4099-91b8-a3f1c288cf22` |

Mỗi domain có TXT `resend._domainkey.<subdomain>`, CNAME `send.<subdomain>` tới `send.forge.rmta.net`, CNAME `rsend.<subdomain>` tới `rsend-apne1.forge.rmta.net`. Các CNAME là DNS only. Tích hợp tự động ban đầu tạo `rsend.forge.rmta.net`; đã sửa theo giá trị region-specific hiển thị trong Resend.

Đã loại bỏ bản DMARC trùng `v=DMARC1; p=none;`. Bản duy nhất còn lại tại `_dmarc.corelia.academy` là `v=DMARC1; p=none; rua=mailto:dmarcreports@corelia.academy;`. Sau khi được xác nhận, đã xóa 7 bản ghi SendGrid/Firebase cũ và rút gọn SPF gốc thành `v=spf1 include:_spf.google.com ~all`. Google Workspace MX/DKIM và các bản ghi Resend được giữ nguyên; đã xác minh DNS authoritative. Chưa kiểm chứng hộp thư nhận báo cáo DMARC hoặc các alias Reply-To `support@corelia.academy`, `hello@corelia.academy`.

## Supabase

| Môi trường | Project ref | App origin |
| --- | --- | --- |
| Staging | `opoozbmfbezkrpzxsusx` | `https://staging.corelia.academy` |
| Production | `lawhkvyyoznwygzsycan` | `https://app.corelia.academy` |

Đã thêm `RESEND_WEBHOOK_SIGNING_SECRET`, `EMAIL_WORKER_SECRET` riêng cho từng project. Đã cấu hình `CORELIA_APP_ORIGIN`, `APP_URL` theo bảng trên và `MAIL_FROM=Corelia <no-reply@system.corelia.academy>`. Giữ API key Resend và cấu hình CORS hiện có.

Đã thêm Vault secrets `corelia_email_project_url`, `corelia_email_worker_secret` qua Supabase Dashboard. Worker secret được sao chép từ cùng giá trị đã ghi vào Edge secrets; kiểm tra digest Edge thành công ở cả hai môi trường. Đối chiếu giá trị Vault production thành công bằng truy vấn chỉ trả boolean. MCP staging không có quyền giải mã Vault nên đã xác minh việc lưu qua Dashboard, chưa đối chiếu digest bằng SQL ở staging.

## Supabase Auth SMTP

Đã cấu hình cả hai project: host `smtp.resend.com`, port `465`, username `resend`, From `no-reply@system.corelia.academy`. Tên hiển thị staging là `Corelia Staging`, production là `Corelia Academy`.

Tạo hai key riêng chỉ có Sending access, giới hạn domain `system.corelia.academy`: `Corelia Auth Staging - system` và `Corelia Auth Production - system`. Không thu hồi các key cũ vì có thể còn consumer khác.

Đã kiểm tra SMTP TLS/authentication cho cả hai key: server trả `235`. Đã mở trang SMTP mới để xác nhận From/host/port được lưu phía server. Chưa gửi email đến người nhận thật hoặc kiểm tra luồng reset mật khẩu đầu cuối.

## Webhook

Endpoint mỗi môi trường: `https://<project-ref>.supabase.co/functions/v1/corelia-api?op=email.webhook`.

| Môi trường | Webhook ID | Trạng thái |
| --- | --- | --- |
| Staging | `dca9ba98-3ae9-467f-839f-e59145672b06` | Disabled, chờ backend |
| Production | `cc44c0de-7323-4bad-b0a9-f2c1d08920f9` | Disabled, chờ backend |

Đã chọn `email.bounced`, `email.complained`, `email.delivered`, `email.failed`; signing secret tương ứng đã lưu trong Edge secrets.

## Quota và điều kiện kích hoạt

Tại thời điểm kiểm tra: gói Sending API/SMTP Pro có quota **50.000 email/tháng**, đã dùng 19, rate limit **10 request/giây**, 6/10 domain. Pay-as-you-go cho email đang tắt; không đổi gói hoặc bật chi phí vượt quota. Chiến dịch thực tế 100.000 người nhận không thể hoàn tất trong quota tháng hiện tại nếu không điều chỉnh quota hoặc chia qua kỳ quota.

Hai project chưa có bảng `public.email_settings`; endpoint webhook staging trả 404. Migration, Edge Functions và frontend Email Center chưa được release trong đợt cấu hình này. Vì vậy chưa tạo cron hoạt động, chưa cập nhật sender records sang verified, chưa bật campaign hoặc automation.

Trước khi mở gửi: hoàn tất review/validation code, phát hành theo `docs/RELEASE_PROCESS.md`, kiểm tra Vault staging và scheduler, cập nhật sender verified theo evidence Resend, bật webhook sau khi endpoint hoạt động, kiểm tra gửi nội bộ cùng unsubscribe/webhook, xác minh Reply-To, rồi mới mở công tắc gửi. Cơ chế đóng băng payload/thành viên lô khi retry cần được kiểm chứng trước khi bật chiến dịch lớn.

Không lưu giá trị credential trong tài liệu hoặc Git. Các file secret tạm được xóa sau khi cấu hình.
