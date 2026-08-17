# Issue: Skill, milestone, learning reminders và tái sử dụng OCB Badge

## Bối cảnh

Người học hiện chưa biết rõ sau khi hoàn thành một khóa học sẽ nhận được gì. Hệ thống cần làm rõ mối quan hệ giữa skill, badge và certificate; đồng thời mở rộng milestone, bổ sung cơ chế nhắc người học quay lại và cải thiện quy trình admin mint OCB thủ công.

## Mục tiêu

- Hiển thị rõ các skill và phần thưởng người học có thể nhận trước khi bắt đầu học.
- Tạo thêm động lực học tập thông qua daily streak và các milestone mặc định.
- Nhắc người học quay lại khi đang học dở nhưng không hoạt động trong một khoảng thời gian.
- Giúp admin theo dõi các OCB đã mint thủ công.
- Cho phép admin lưu và tái sử dụng badge template khi cấp OCB thủ công.

## Phạm vi yêu cầu

### 1. Skill của khóa học

- Một khóa học có thể cấu hình nhiều skill; trường hợp thông thường có thể chỉ cấu hình một skill.
- Skill là dữ liệu off-chain, gắn với khóa học sau khi người học hoàn thành.
- Hiển thị các skill đạt được ở đầu trang khóa học.
- Hiển thị thông báo cho người học rằng skill sẽ được công khai trên hồ sơ sau khi hoàn thành khóa học.
- Trên profile, skill chỉ hiển thị dưới dạng text trong một mục/tab Skill riêng.
- Skill không được xem là badge và không được mint lên Open Campus.
- Làm rõ sự khác nhau giữa:
  - Skill: năng lực hoặc kiến thức đạt được.
  - Badge: huy hiệu ghi nhận thành tích, có thể được mint lên Open Campus.
  - Certificate/OCA: chứng nhận hoàn thành khóa học hoặc chương trình.
- Hiển thị trước cho người học khóa học sẽ cấp skill, badge hoặc certificate nào và điều kiện nhận tương ứng.

### 2. Milestone và daily streak

- Bổ sung daily learning streak.
- Bổ sung các milestone mặc định, tối thiểu gồm:
  - Học liên tục 3 ngày.
  - Học liên tục 7 ngày.
  - Học liên tục 14 ngày.
  - Học liên tục 30 ngày.
  - Hoàn thành khóa học đầu tiên.
  - Hoàn thành nhiều khóa học.
  - Hoàn thành project đầu tiên.
- Thiết kế để có thể bổ sung thêm milestone trong tương lai.

### 3. Email nhắc học

- Nếu người dùng đang học dở và không học tiếp trong 3 ngày, gửi email nhắc quay lại học.
- Có thể gửi nhắc lại theo chu kỳ phù hợp nhưng không gửi quá dày.
- Nếu người dùng không học trong khoảng 1 tháng, hệ thống ngừng gửi email nhắc cho khóa học đó.
- Không gửi email nếu:
  - Khóa học đã hoàn thành.
  - Người dùng đã tắt loại email nhắc học.
  - Khóa học không còn khả dụng hoặc người dùng không còn quyền truy cập.

### 4. Dashboard OCB mint thủ công

Admin cần có dashboard hiển thị danh sách các OCB đã được mint thủ công, gồm:

- Người nhận.
- Tên badge.
- Người thực hiện mint.
- Thời điểm mint.
- Trạng thái mint.
- Link xem credential trên Open Campus.
- Lý do cấp badge, nếu có.

### 5. Kho badge tái sử dụng

- Trong modal cấp badge thủ công, thêm nút **Lưu để tái sử dụng**.
- Badge đã lưu được hiển thị trong một tab hoặc khu vực riêng.
- Khi cấp badge thủ công lần sau, admin có thể chọn badge đã lưu thay vì nhập lại.
- Sau khi chọn badge template, hệ thống tự điền:
  - Tên badge cố định theo template.
  - Hình ảnh badge.
  - Các thông tin cấu hình liên quan.
- Mô tả có thể để trống và cho phép admin bổ sung nếu cần.
- Việc chỉnh sửa template không được làm thay đổi các badge đã mint trước đó.

## Tiêu chí nghiệm thu

- Người học nhìn thấy rõ skill và phần thưởng trước khi bắt đầu học.
- Skill, badge và certificate được phân biệt rõ trên UI và nội dung mô tả.
- Daily streak được ghi nhận đúng theo ngày học hợp lệ.
- Milestone chỉ được cấp một lần cho cùng một người dùng và cùng một mốc.
- Email nhắc học được gửi sau ngưỡng không hoạt động đã cấu hình.
- Email nhắc học dừng sau khoảng thời gian tối đa đã quy định.
- Người dùng có thể tắt email nhắc học.
- Admin xem được toàn bộ lịch sử OCB mint thủ công.
- Admin có thể lưu, chọn và tái sử dụng badge template.
- Badge đã mint giữ nguyên dữ liệu tại thời điểm mint.
- Các trạng thái lỗi mint hoặc gửi email không làm mất dữ liệu cấp badge và có thể tra cứu để xử lý.

## Các điểm cần chốt

- Một khóa học được cấp một skill hay nhiều skill?
- Skill có được mint on-chain hay chỉ hiển thị trên hồ sơ Corelia?
- Skill có luôn đi kèm badge hay có thể tồn tại độc lập?
- Badge khóa học và milestone badge có dùng chung kho template không?
- Khoảng thời gian và tần suất cụ thể giữa các email nhắc học là bao nhiêu?
- Sau khi ngừng nhắc tự động, admin có được gửi nhắc thủ công không?
- Badge template đã được sử dụng có được chỉnh sửa hay chỉ được nhân bản thành template mới?

## Ngoài phạm vi

- Không thay đổi cơ chế mint Open Campus hiện tại nếu chưa có yêu cầu kỹ thuật riêng.
- Không tự động thay đổi hoặc thu hồi các credential đã mint.
- Không thay đổi nội dung skill của các khóa học hiện có nếu chưa có dữ liệu xác nhận từ phía quản trị nội dung.
