# Corelia Streak

Thư mục này mô tả feature Streak đang có trên `origin/staging` tại commit `4b22d0d2cc70c4e8aed58efcd7c5ffcb9b33ee1d`.

Đây là tài liệu baseline theo source code, không phải xác nhận rằng cùng phiên bản đã được deploy và chạy thành công trên môi trường Staging.

## Tài liệu

- [Streak system](./streak-system.md): product contract, data flow, API, schema, timezone, điểm, milestone, credential và các invariant.
- [Streak UI](./streak-ui.md): vị trí trong header, drawer, prompt, timeline, quest tabs, responsive layout và UI states.

## Thứ tự ưu tiên

Khi copy UI, tài liệu cũ hoặc ý tưởng sản phẩm mâu thuẫn với nhau:

1. Migration và RPC trên `origin/staging` quyết định dữ liệu, quyền ghi và quy tắc claim.
2. Edge Function quyết định authentication, response contract và side effect sau claim.
3. Frontend quyết định cách hiển thị và thao tác hiện tại.
4. Tài liệu trong thư mục này mô tả lại baseline đó; không tự mở rộng thành target chưa có trong code.

Mọi thay đổi làm khác contract claim, timezone, điểm, milestone hoặc credential phải cập nhật `streak-system.md`. Thay đổi drawer, prompt, timeline, quest hoặc locale phải cập nhật `streak-ui.md`.

## Product constraints hiện tại

- Streak là chuỗi **điểm danh thủ công theo ngày**, không tự tăng khi đăng nhập, mở app hoặc hoàn thành lesson.
- Mỗi user chỉ claim được một lần cho một `claim_date` trong timezone đã chốt ở claim đầu tiên.
- Current streak có thể về `0` khi bỏ lỡ một ngày; longest streak và milestone đã mở khóa không bị mất.
- Điểm hiện có là ledger tích lũy: `+1` cho daily check-in, `+50` cho OCID và `+50` cho GitHub, mỗi nguồn hợp lệ chỉ được ghi theo khóa idempotency tương ứng.
- Milestone UI cố định ở `3`, `7`, `14`, `30` ngày. OCB milestone là một lớp cấu hình riêng qua credential template.
- Lỗi mint OCB không rollback claim, điểm hoặc milestone UI đã commit.
