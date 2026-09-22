# Feed thành tựu — đặc tả triển khai và QA

**Cập nhật: 2026-09-22.** Tài liệu này là một điểm vào duy nhất cho phạm vi, trải nghiệm, dữ liệu, quyền riêng tư và nghiệm thu feed mới. Trạng thái triển khai theo từng môi trường được xác nhận bằng workflow và pipeline phát hành, không suy ra từ mã nguồn.

<a id="product"></a>

## Mục tiêu và nguyên tắc nội dung

Feed là nơi chúc mừng **kết quả học tập và đóng góp đã được Corelia xác minh**, không phải nhật ký thao tác của người dùng. Không có ô viết bài, caption, bình luận, repost, nội dung tự do hay thuật toán xếp hạng theo hành vi đọc. Một thao tác chỉ lên feed nếu nó đạt một trong ba mốc bên dưới.

| Mốc | Câu hiển thị trên card | Nguồn xác thực | Điều kiện xuất hiện |
|---|---|---|---|
| Hoàn thành khóa học | “A đã hoàn thành khóa học B” | Course completion hợp lệ trong `enrollments` | Course đã publish và hồ sơ A công khai |
| Đạt XP | “A đã đạt 250 XP” | Tổng XP trong `user_point_ledger` vượt một ngưỡng | Hồ sơ A công khai; một card cho mỗi ngưỡng |
| Nộp dự án hackathon | “A đã nộp dự án vào hackathon B” | Submission liên kết với project đúng chủ sở hữu | Hồ sơ A và hackathon công khai; project công khai, chưa bị chặn, đã qua cổng kiểm tra nội dung hiện hữu |

XP dùng các mốc tổng **250, 500, 1.000, 2.500, 5.000, 10.000, 25.000, 50.000, 100.000**. Không kể từng lần cộng XP. Không đưa lên feed các sự kiện enroll, hoàn thành từng lesson, follow, đăng ký hackathon, nhận tim, điểm danh, kết nối ví hoặc các thao tác tương tự. Không chuyển dữ liệu `activity_events` cũ thành card mới.

**Ranh giới kiểm duyệt:** Câu trên card do hệ thống tạo từ loại mốc, tên hồ sơ công khai và tên course/hackathon do Corelia quản lý. Card dự án **không hiển thị tiêu đề, mô tả, ảnh, trích đoạn hoặc link trực tiếp đến project do người dùng nhập**; chỉ dẫn đến hackathon. Hiện quy trình project có kiểm tra nội dung/ảnh bằng AI và quyền admin chặn sau đăng; **không có hàng chờ admin duyệt trước đăng**, nên không được gọi submission là “đã được admin duyệt”. Nếu kiểm tra nội dung thất bại hoặc chưa xác nhận lưu thành công, feed không tạo card. Nếu project bị chặn, chuyển private hoặc bị xóa, card biến mất khi đọc lại.

## Trải nghiệm

- `/feed` có **Khám phá** (mốc công khai mới nhất) và **Đang theo dõi** (mốc của người hoặc nguồn course/hackathon/project mà mình follow). Thứ tự mới nhất trước, không chấm điểm/ranking người dùng.
- Trên desktop, cột bên phải có hai tab **Đang theo dõi** và **Gợi ý theo dõi**, luôn có thể chuyển qua lại. Tab đầu hiển thị tối đa 6 hồ sơ công khai mà chính người xem đang follow, gồm ảnh, tên, link mở hồ sơ và nút **Xem tất cả** để mở danh sách đầy đủ có tải thêm. Danh sách sắp theo lần follow gần nhất, chỉ gồm người; course/hackathon/project vẫn dùng cho tab Đang theo dõi của feed nhưng không trộn vào mục này. Khi chưa follow hồ sơ công khai nào, cột phải mở tab gợi ý mặc định.
- Tab **Gợi ý theo dõi** chọn tối đa 4 người chưa follow từ nhóm 20 hồ sơ công khai có XP cao nhất, ưu tiên người đạt ít nhất 250 XP, rồi xáo trộn trong từng nhóm. Hiển thị tổng XP cạnh tên và nút Follow; không gợi ý chính người xem, người đã follow hoặc hồ sơ private. Nếu chưa ai có XP, vẫn gợi ý ngẫu nhiên từ các hồ sơ công khai đủ điều kiện.
- Trên mobile, mục **Bạn đang theo dõi** nằm sau danh sách card dưới dạng khối thu gọn; không chiếm phần đầu màn hình hay làm hẹp card. Danh sách của chính mình phải hoạt động cả khi hồ sơ của mình private; không lấy danh sách follow của tài khoản khác chỉ vì quyền staff hoặc cache dùng chung.
- Mỗi mục feed là một hàng gọn: **avatar → tên và câu thành tựu có link ngay trong câu → “x giờ trước” → tim**. Không lặp lại avatar/tên ở chân card, không đặt nhãn loại mốc hay icon lớn riêng. Thời gian cập nhật tương đối khi trang đang mở; hover/focus vào thời gian cho biết ngày giờ đầy đủ. Card XP dẫn về hồ sơ; card khóa học dẫn đến course; card submission chỉ dẫn đến hackathon.
- Tổng XP công khai chỉ hiện trong mục gợi ý theo dõi hoặc hồ sơ công khai; card XP trong feed vẫn chỉ nêu ngưỡng thành tựu, không lộ lịch sử cộng/trừ XP chi tiết.
- Chỉ người đăng nhập được thả tim, mỗi người tối đa một tim mỗi card, không tự thả tim, tim không cấp XP và không tạo thêm card feed. Thao tác lỗi phải báo lỗi và giữ trạng thái trước đó.
- Có trạng thái tải, lỗi, rỗng, tải thêm và thông báo có mốc mới. Khi đang đọc, mốc mới không tự chen vào danh sách; bấm tải lại để xem. Phân trang ổn định theo `(created_at, id)`.
- Trang hồ sơ công khai chỉ hiển thị các mốc cùng điều kiện với feed; thông báo cá nhân giữ riêng, không biến thành feed.

## Quyền riêng tư và kiểm soát của người dùng

- Cả ba loại mốc **tự động được chia sẻ** khi hồ sơ actor công khai và nguồn đủ điều kiện. Không có khối cài đặt chia sẻ, checkbox theo loại hay thao tác ẩn từng mốc trên feed. Chuyển hồ sơ sang private sẽ ẩn toàn bộ mốc khỏi người xem; chuyển lại public sẽ hiện các mốc còn đủ điều kiện. Sự kiện xảy ra khi hồ sơ private không được tạo bù.
- Quyền hiển thị được kiểm tra lại theo dữ liệu hiện tại, không tin vào tiêu đề hay trạng thái công khai lưu trong card. Course bị gỡ publish, project/hackathon chuyển private hoặc project bị chặn thì link và card không còn lộ qua feed hay hồ sơ.
- Actor không thể tự sửa loại mốc, số XP, nguồn, thời gian hoặc số tim. Người khác không thể bỏ tim thay họ.

<a id="migration"></a>

## Kiến trúc triển khai

1. Tạo dữ liệu mốc riêng với ba loại cố định, khóa chống trùng theo actor + nguồn. Chỉ backend tạo mốc sau khi dữ liệu nghiệp vụ được ghi thành công; browser không có quyền tạo/sửa mốc.
2. Đọc feed qua RLS và truy vấn có cursor; kiểm tra lại hồ sơ và trạng thái course/hackathon/project tại thời điểm đọc. Tim có chính sách quyền riêng. Mục Bạn đang theo dõi đọc quan hệ follow theo đúng user đăng nhập, chỉ lấy hồ sơ công khai; có thể tái dùng giao diện danh sách follow hiện hữu sau khi kiểm tra quyền đọc cho cả tài khoản private. Realtime chỉ báo có mốc mới để client tải lại.
3. Thay `/feed` và phần hoạt động trên hồ sơ bằng card thành tựu; bỏ badge chưa đọc và các bản dịch/query/bundling dành cho nhật ký hành vi. Dừng trigger tạo social `activity_events` và auto-follow mới, giữ quan hệ follow hiện có cùng dữ liệu `learning.*` cần cho báo cáo. Không xóa lịch sử nghiệp vụ.
4. Chuyển đổi bằng migration tiến tới; xác nhận trên Supabase local trước khi đưa qua quy trình staging/production của repository. Không coi build local là bằng chứng đã triển khai.

## Điều kiện nghiệm thu

- Từ ba nguồn hợp lệ tạo đúng ba loại card; thử lại hoặc cập nhật cùng nguồn không tạo card trùng. XP nhảy qua nhiều ngưỡng chỉ tạo mốc cao nhất đạt được trong lần cộng đó; điều chỉnh giảm XP khiến mốc không còn đủ điều kiện bị ẩn.
- Nội dung project bị cổng kiểm tra từ chối không lên feed; card project không hiển thị text/ảnh user nhập. Chặn, xóa, đổi private hoặc gỡ public nguồn làm card biến mất sau tải lại.
- Hồ sơ private làm các mốc biến mất với người xem khác; đổi lại public hiện các mốc còn đủ điều kiện. User thường, staff và anonymous không được đọc/ghi vượt quyền; browser không thể giả mốc hoặc tự thả tim.
- Cột phải hiện đúng người mình follow, thứ tự mới nhất và link hồ sơ; tab gợi ý luôn mở được, ưu tiên XP cao nhưng xáo trộn, có tổng XP và nút Follow hoạt động ngay tại chỗ. Follow xong không tiếp tục gợi ý chính người đó; không gợi ý chính mình hoặc hồ sơ private. Thử riêng tài khoản có hồ sơ private và staff để chắc chắn danh sách vẫn thuộc người đăng nhập. Mobile hiển thị khối thu gọn sau card.
- Khám phá, Đang theo dõi, hồ sơ, tim, trạng thái lỗi/rỗng/tải thêm, cursor trùng timestamp và VI/EN hoạt động trên desktop/mobile. SQL smoke, RLS nhiều tài khoản, migration sạch, lint, test và build đều qua trước khi đề nghị phát hành.

Tài liệu cũ ở [archive](archive/) chỉ để đối chiếu và tháo phụ thuộc; không phải đặc tả sản phẩm mới.
