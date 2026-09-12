# Hướng dẫn soạn bài và review Learning

Tài liệu cho bản local đang triển khai. Xem [Local QA](./local-qa.md) để biết các phần đã kiểm thử và phần chưa nghiệm thu; chưa dùng bản này làm release candidate.

## Vào đúng workspace

Mở `/instructor/courses`, chọn khóa học và dùng `/instructor/courses/:id/edit` như trước. Course owner và staff giữ quyền hiện hữu; co-instructor dùng quyền theo feature. Danh sách attribution không tự cấp quyền.

Thông tin chung, sponsor/partner, chứng nhận PDF, OpenCampus, thông báo và học viên vẫn nằm trong editor này. Không có editor course thứ hai dưới admin.

Trong **Bài tập cuối khoá**, mở **Xem đầy đủ bài nộp** để đọc nội dung, artifacts, file đính kèm và nhận xét cũ. Nhập **Nhận xét bài nộp** trước khi duyệt hoặc yêu cầu chỉnh sửa. Chỉ bản mới nhất đang chờ duyệt có nút thao tác; lịch sử các lần nộp vẫn được giữ.

## Giảng viên hiển thị

Trong Thông tin chung, mục Giảng viên hiển thị cho phép chọn profile, sửa role label, đổi thứ tự bằng nút lên/xuống và gỡ attribution. Bấm Save để lưu cùng metadata và bản dịch course; lỗi Save giữ bản nháp. Attribution không gửi invite hoặc cấp quyền. Các control quyền/hiển thị của co-instructor hiện hữu vẫn hoạt động: co-instructor bị ẩn không hiện trên course page; người mới được chấp nhận và cho phép hiển thị vẫn xuất hiện. Profile không còn khả dụng không tạo link hỏng.

## Soạn lesson

Trong **Nội dung & bài học**, bấm **Thêm bài học** ở chương muốn thêm (hoặc nút cùng tên khi không chia chương). Chọn loại **Video, Bài đọc, Trắc nghiệm, Thực hành hoặc Bài tập code** trong dialog tạo bài. Chọn code sẽ mở builder với đúng chương và nội dung đã nhập. Không có nút thêm bài tương tác riêng. Với bài đã có, nút sửa của quiz/practice/code mở dialog tương ứng; nút **Xuất bản & xem thử** dùng để chỉnh publication và preview. Article/video vẫn có editor cũ.

Bản nháp nội dung course VI/EN được giữ riêng khi đổi ngôn ngữ trong cùng phiên editor. Bấm Lưu ở từng ngôn ngữ cần lưu. Rời route khi copy course hoặc lesson chưa lưu sẽ có lựa chọn tiếp tục sửa/bỏ thay đổi, kể cả copy ở ngôn ngữ đang ẩn. Draft chưa có lưu trữ bền vững sau đóng editor.

Chọn ngôn ngữ chính để chỉnh format, config và scoring. Chọn ngôn ngữ còn lại để dịch câu chữ. Lưu bằng nút **Lưu**; lỗi save giữ form. Preview ngay trong dialog dùng nội dung chưa lưu. Preview route dùng nội dung đã lưu, có lựa chọn locale và chiều rộng mô phỏng điện thoại.

Trong dialog bài đã có, **Nhân bản thành bản nháp** sao chép nội dung đang chỉnh và các bản dịch sang lesson mới. Bản sao chưa ghi database cho tới khi bấm **Lưu**, luôn bắt đầu unpublished và được thêm cuối chương. Câu hỏi quiz nhận ID mới; option IDs và machine IDs trong code/practice giữ mapping nội bộ. Attempts, progress và bài nộp của lesson gốc không được sao chép.

| Format | Nội dung cần chuẩn bị |
| --- | --- |
| Article | Tiêu đề, Markdown dễ đọc, resources có URL hợp lệ. |
| Video | YouTube URL, start/end nếu cần. Không autoplay. Kiểm tra phát video trước publish. |
| Quiz | Câu hỏi, lựa chọn có stable ID, đáp án đúng, giải thích; mặc định ngưỡng 70% và cho phép retry. Bản dịch thay text theo ID, không tạo bộ đáp án riêng. |
| Practice | Chọn instruction/checklist/submission/guided project. Với step cần artifact, chỉ rõ field cần có và đưa field đó vào yêu cầu nộp. |
| Code exercise | Rust một file, fill hoặc edit. Có starter, reference solution và test rule. Nguồn tối đa 64 KiB; đây là text validation trong browser, không phải compiler. |

Lesson đang published chỉ lưu được khi nội dung mới hợp lệ. Để soạn nội dung chưa hoàn chỉnh, bỏ published và lưu trước. Draft vẫn phải đúng cấu trúc config. Reference solution chưa pass có thể giữ ở draft; publish phải pass required tests. Starter đã pass cần được xem lại và xác nhận theo cảnh báo editor.

Nếu nội dung legacy không đạt cấu trúc mới, vẫn có thể archive/unpublish bằng thao tác trạng thái giữ nguyên nội dung. Restore đưa về draft để sửa; publish lại chỉ được phép sau khi config hợp lệ. Ngoại lệ này không cho phép lưu thêm nội dung malformed hoặc bỏ validation khi publish.

Các lỗi validation trong dialog có thông báo tiếng Việt/Anh và nút **Sửa lỗi đầu tiên**. Bấm nút hoặc từng lỗi để trở về nội dung gốc và focus trường cần sửa; quiz chỉ ra câu hỏi/lựa chọn còn thiếu. Lỗi do backend trả về vẫn hiển thị trong form; không đóng dialog hoặc xóa nội dung đang chỉnh.

Tài nguyên có thể thêm, sửa hoặc bỏ từng dòng. Draft cho phép để trống tên/URL; URL đã nhập phải hợp lệ. Trước publish, mỗi tài nguyên phải có tên và URL HTTP/HTTPS. Lỗi trong tài nguyên bản dịch mở đúng ngôn ngữ và focus đúng trường; bỏ tài nguyên ở bản dịch không xóa tài nguyên của nội dung gốc.

Đổi machine config tạo revision mới cho nháp; bản dịch không tạo question/test/lesson ID mới. Không xóa rồi tạo lại câu hỏi chỉ để sửa text: authoring API cập nhật stable ID và archive câu hỏi có lịch sử attempts.

Với practice, sửa nhãn checklist hoặc tiêu đề/hướng dẫn bước giữ revision để learner không mất nháp. Thêm/bỏ/đổi thứ tự bước, đổi mode hoặc yêu cầu artifact tạo revision mới. Database quyết định revision, kể cả khi nội dung được cập nhật trực tiếp.

Code exercise cũng tính revision tại database: hints, feedback và mô tả test không tăng revision; đổi starter, reference solution, đáp án hoặc quy tắc test tăng revision. Giá trị revision client gửi không được dùng để ghi đè revision đã tính.

Trong cấu hình Practice, **Hackathon liên quan** chọn từ catalog công khai có route khả dụng. Chọn “Không liên kết hackathon” để bỏ liên kết. Learner tự mở trang và quyết định tham gia; lưu lesson không đăng ký hoặc nộp bài thay learner. Nếu hackathon bị ẩn/xóa sau đó, lesson hiển thị nội dung liên quan không khả dụng. Dự án tham khảo chọn từ directory công khai như hướng dẫn bên dưới.

## Practice nối với bài cuối khóa

Review chỉ có ở final assignment cấp course. Không tạo review riêng từng lesson. Checklist và guided steps lưu nháp trên thiết bị theo user/course/lesson/revision; hoàn thành step không tạo một progress row riêng.

Trong **Bài tập cuối khoá**, điền tiêu đề, hướng dẫn và rubric. Chọn các artifact bắt buộc: GitHub URL, deployment URL, contract address, transaction URL, demo URL hoặc notes. Với pilot Rust, yêu cầu GitHub URL và notes. Artifact từ guided lesson chuyển sang form cuối khóa khi learner hoàn thành lesson; learner vẫn phải chủ động bấm nộp. Khi đã cấu hình các artifact bắt buộc, nội dung bổ sung là tùy chọn; điền đủ artifact là có thể nộp. Khóa không có artifact bắt buộc vẫn yêu cầu nội dung bài làm.

Không yêu cầu learner công khai thông tin cá nhân, private task files hoặc secrets trong repository. Corelia không tự tạo project public từ bài nộp. Nếu learner muốn portfolio, họ chủ động dùng flow tạo project hiện hữu.

## Review

Người có quyền `submissions` mở **Bài tập cuối khoá → Bài nộp của học viên**. Xem đúng tên learner, tiến độ lesson, nội dung, artifact và ngày nộp. API roster chỉ trả người có bài nộp cho reviewer; quyền `students` mới cho xem email và danh sách ghi danh. Không cấp quyền đọc toàn bộ hồ sơ cá nhân chỉ để review.

Đối với pilot: chạy `cargo test`, thử add/list/done qua các process riêng, kiểm tra dữ liệu hỏng, persistence, README và khả năng chạy lại. Reference local nằm tại `docs/learning/pilot/reference`; repository nộp thật phải được reviewer kiểm tra độc lập.

- **Pending:** chờ review; chưa hoàn thành course.
- **Cần chỉnh sửa:** gửi nhận xét cụ thể để learner nộp lại. Giữ submission cũ làm lịch sử.
- **Approved:** trusted transaction đồng bộ completion nếu đủ mọi lesson published. Chỉ bản nộp mới nhất được review; approve lặp không đổi timestamp completion đã có.

Credential delivery chạy riêng, lỗi credential không đảo review hoặc completion. Với course bật credential, thao tác cấp/thử lại vẫn ở phần chứng nhận hiện hữu. Pilot QA tắt credential và không phát chứng nhận thật.

## Báo cáo và xử lý lỗi

Mục **Học viên** có báo cáo course/lesson, lượt bắt đầu/hoàn thành, số người đã bắt đầu nhưng chưa hoàn thành, tỷ lệ quiz pass và submission/approval. Lượt start chỉ có từ lúc bật telemetry cho learner đăng nhập; không suy diễn dữ liệu lịch sử thiếu event thành chưa học. Code completion thể hiện trên các hàng format code.

Nếu submit/save báo lỗi mạng, giữ bài làm và retry. Quiz retry cùng request không nhân attempt. Nếu publication báo lỗi, sửa nội dung/config được báo rồi lưu lại; Dùng Sửa lỗi đầu tiên để mở đúng panel/lesson/locale/field; coverage nghiệm thu hiện tại nằm trong acceptance-status.md.

Không dùng hard-delete để xử lý course/lesson có learning data. Dùng **Lưu trữ** trên hàng lesson hoặc trong mục cuối của editor course để ẩn nội dung và giữ lịch sử. **Khôi phục thành bản nháp** không tự publish lại. Danh sách course có tìm kiếm theo tên/slug và lọc Published/Draft/Archived. UI khóa thao tác xóa khi biết nội dung đã publish/archive hoặc có learning data; database kiểm tra lại cả lịch sử attempts. Browser QA cho các controls mới này vẫn chưa hoàn tất; không dùng SQL thủ công để vượt guard.

### Thời lượng bài học

Không cần nhập số phút khi tạo hoặc sửa bài. Video sử dụng metadata YouTube và đoạn start/end; các bài mới thuộc format khác mặc định duration bằng 0. Thời lượng đã lưu của bài cũ vẫn được giữ khi sửa nội dung, kể cả giá trị không tròn phút.

### Xóa section

Sau xác nhận xóa, server xử lý tất cả lesson trong section và section trong cùng một transaction. Nếu bất kỳ bài nào đang publish, archived hoặc có lịch sử học tập, thao tác bị chặn và nội dung được giữ nguyên. Với nội dung đã có learner data, dùng archive thay cho hard-delete.

### Trạng thái sẵn sàng trong curriculum

Mỗi bài chưa archive được kiểm tra bằng validator publication trên server. Badge **Sẵn sàng** nghĩa là nội dung đã lưu qua kiểm tra; badge Draft vẫn còn nếu chưa publish. **Cần sửa (n)** cho biết số lỗi, có tooltip liệt kê lỗi và bấm để mở editor bài đó. Khi không tải được kết quả, dùng **Chưa kiểm tra được — thử lại**; không coi kết quả tải lỗi là sẵn sàng. Việc kiểm tra không tự publish hay ghi progress.

Bấm **Cần sửa** hoặc **Sửa lỗi đầu tiên** ở thanh công cụ curriculum để mở bài có lỗi và xem hướng dẫn ngay. Trong editor, nút sửa lỗi focus field/locale mà client xác định được. Mã lỗi chỉ server xác định vẫn được hiển thị để không bị bỏ sót. Mở hướng dẫn không thay đổi trạng thái publish hoặc tự lưu draft.

### Lỗi video và thử lại

Video lesson dùng YouTube IFrame API để nhận lỗi phát từ player, gồm lỗi không cho nhúng. Nếu API/player không tải được trong thời gian chờ, thông báo lỗi và nút thử lại vẫn hiện. Thử lại hủy player cũ và tạo mới; autoplay luôn tắt và start/end giữ theo cấu hình bài. Link mở YouTube vẫn có để learner chủ động dùng.

### Code đã pass nhưng chưa lưu tiến độ

Nếu kiểm tra code pass nhưng lưu completion lỗi, đáp án/kết quả được giữ và nút chính chuyển sang **Thử lưu tiến độ lại**. Khi chưa sửa bài, nút này chỉ retry lưu completion. Sửa source/ô điền hoặc reset sẽ yêu cầu check lại; trạng thái pass cũ không dùng để hoàn thành đáp án đã thay đổi.

### Khi cấu hình bài cũ không mở được theo schema mới

Editor nhận diện cấu hình practice/code exercise sai cấu trúc và hiển thị hướng dẫn khôi phục. Không tự xóa hoặc chuyển đổi dữ liệu khi mở bài; preview/save bị chặn cho đến khi cấu hình hợp lệ.

Nút đặt lại có xác nhận, nêu rõ checklist/steps hoặc source/answers/tests sẽ được thay. Hủy xác nhận giữ nguyên dữ liệu. Đồng ý chỉ thay state trong form và chuyển lesson về draft; bấm Lưu mới ghi xuống database. Tiêu đề, markdown, duration và các bản dịch được giữ, cần rà soát bản dịch của steps/tests sau khi tạo cấu hình mới. Có thể đóng và bỏ thay đổi trước khi Lưu để giữ bài gốc.

Ở ngôn ngữ phụ, chọn mở cấu hình ngôn ngữ gốc để khôi phục. Sau đó soạn lại cấu hình, kiểm tra reference solution và preview trước khi publish lại. Đây là phục hồi cấu trúc bị lỗi; bài draft có reference solution chưa pass vẫn dùng builder bình thường.

### Artifact của practice và bài cuối khóa

Lesson dạng submission hoặc guided project phải có bài cuối khóa cấp course. Những field đánh dấu bắt buộc trong practice (ví dụ GitHub, notes) phải đồng thời được chọn trong các field bắt buộc của bài cuối khóa. Bổ sung chúng trong panel bài cuối khóa hiện hữu trước khi publish lesson.

Nếu muốn bỏ field khỏi bài cuối khóa, hãy sửa hoặc unpublish các practice lesson đang yêu cầu field đó trước. Server cũng chặn thay đổi không hợp lệ khi course đang draft nhưng lesson còn published. Checklist/instruction không yêu cầu artifact không bắt buộc course phải có bài cuối khóa.


### Dự án tham khảo trong practice

Chọn dự án từ directory công khai ở trường Dự án tham khảo; dùng Tải thêm dự án để xem các trang tiếp theo. ID được lưu trong related_project_id. Project phải tồn tại, public và không bị chặn khi publish; learner không nhận link tới project đã private/unlisted/blocked/xóa. Reference legacy related_project_template_id phải được gỡ bằng nút riêng; không tự chuyển nó thành project ID. Guided project có link tự tạo portfolio và cập nhật hồ sơ qua flow hiện hữu, không truyền artifact hoặc tự public bài nộp.
