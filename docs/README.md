# Tài liệu Corelia

Bắt đầu từ mục tương ứng với công việc. Code và migrations là nguồn xác định hành vi; checklist là việc cần kiểm tra, không phải bằng chứng đã pass. Báo cáo có ngày/issue chỉ phản ánh lần kiểm tra được ghi trong đó.

## Tính năng

| Chủ đề | Điểm vào |
|---|---|
| Feed mốc thành tựu | [Đặc tả Feed và QA](feed/README.md): nội dung, quyền hiển thị, kiến trúc và nghiệm thu trong một file |
| Avatar | [Kế hoạch chuyển sang Humation](avatar/README.md) |
| Learning | [Learning](learning/README.md) |
| Hackathon | [Hackathon](hackathon/README.md) |
| Jobs | [Jobs](jobs/README.md) |
| Streak | [Streak](streak/README.md) |
| Quyền truy cập khóa học | [Course access](COURSE_ACCESS_MODELS.md) |
| Sở hữu khóa học, doanh thu | [Ownership & SePay](COURSE_OWNERSHIP_REVENUE_SEPAY.md) |
| Credentials | [Phase 1 specification](Credentials_Phase_1_Spec.md) — tài liệu theo phase |
| Email Center | [Hướng dẫn admin](EMAIL_CENTER_ADMIN_GUIDE.md), [trạng thái setup](EMAIL_CENTER_SETUP_STATUS.md) |

## Kiến trúc, vận hành và kiểm thử

| Công việc | Tài liệu |
|---|---|
| Quy tắc frontend | [Frontend rules](front-end-rules/README.md) |
| Phát hành staging/production | [Release process](RELEASE_PROCESS.md) |
| Kiểm tra artifact staging | [Staging build](STAGING_BUILD_VERIFY.md) |
| QA liên tính năng | [Test index](tests/README.md) |
| Database baseline và báo cáo rollout | [DB baseline](db-baseline/README.md) |
| Kiểm tra bảo mật Supabase | [Security checklist](SUPABASE_SECURITY_CHECK.md) |

## Cách duy trì

- Mỗi tính năng có một thư mục và `README.md` làm điểm vào; mô tả hiện trạng, kế hoạch và kết quả kiểm tra phải phân biệt rõ.
- Checklist hiện hành chỉ có một bản chính. `docs/tests/` liên kết tới bản đó khi tính năng có bộ tài liệu riêng.
- Báo cáo cũ giữ ngày, issue và kết quả gốc trong `archive/` của tính năng. Không dùng kết quả cũ để xác nhận build hiện tại.
- Khi di chuyển tài liệu, cập nhật liên kết và giữ trang chỉ dẫn ở đường dẫn đã được chia sẻ.
- Các tài liệu gốc chưa rà soát vẫn giữ vị trí để tránh đổi hàng loạt liên kết. Bản đồ trên là điểm vào; việc phân loại sâu tiếp tục theo từng tính năng.
