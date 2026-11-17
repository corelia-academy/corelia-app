# Quy ước viết khóa của skill course-author

Quy ước riêng của skill, bổ sung cho `principles.md` (bản của trang `/learn/learning-principles`, không sửa trong skill). Khi file này nói chi tiết hơn `principles.md` về cùng một điểm (ví dụ Giọng văn), theo file này.

## Gọi tên bài và phần

Chữ người học thấy phải gọi bài và phần đúng như app hiển thị, không dùng mã tự đặt.

- **Phần** (module) gọi là "Part A", "Part B", "Part C"... theo thứ tự module trong khóa, đúng badge ở danh sách bài của app.
- **Bài** gọi là "Bài N", với N là số thứ tự của bài trong Part chứa nó, bắt đầu lại từ 1 ở mỗi Part, đếm cả quiz, practice và video, theo thứ tự curriculum. Đã gọi Part thì số bài thuộc Part đó ("Part B, Bài 2" là bài thứ hai của Part B), không dùng số đếm xuyên cả khóa. Tiêu đề trang bài của app đang hiện số xuyên cả khóa, nên nhãn trong văn bản khớp theo vị trí trong danh sách của Part, không khớp số ở tiêu đề trang.
- Khi nhắc một bài khác viết "Part A, Bài 2". Nhắc nhiều bài cùng phần thì gộp: "Part A (Bài 1, Bài 2)".
- Không bao giờ đưa mã nội bộ vào chữ người học: `lesson_id` (L1-2), `module_id` (M3), `source_ids` (S02). Dẫn nguồn bằng tên nguồn hoặc URL.
- Nhãn được tính từ `curriculum.json`; coordinator đưa bảng nhãn (`lesson_id` → "Part X, Bài N") cho child viết lesson và child review. Curriculum đổi thứ tự thì bảng nhãn và các câu nhắc chéo phải cập nhật.

## Minh họa bằng sơ đồ

Điều gì có hình dạng thì cho người học nhìn thấy, không chỉ đọc. Dùng sơ đồ khi một đoạn văn đang phải kể ra nhiều bên và mối quan hệ giữa chúng, một luồng nhiều bước, một so sánh hai trạng thái (đáng tin / chưa kiểm chứng, trước / sau), hoặc một màn hình mà người học sẽ gặp ngoài đời. Quan hệ không kiểm chứng được hoặc không còn hợp lệ vẽ bằng cạnh đứt có gạch chéo.

**Tránh lạm dụng.** Mỗi sơ đồ phải làm được việc mà một đoạn văn một mình làm kém: cho thấy cấu trúc, luồng hoặc sự đối lập. Không vẽ sơ đồ trang trí, sơ đồ chỉ nhắc lại đúng một câu, hay sơ đồ cần vượt giới hạn nền tảng (khi đó giữ bằng chữ). Tối đa một sơ đồ cho mỗi mục `##`, và một bài thường chỉ có 1–3 sơ đồ. Nếu hai sơ đồ trong cùng bài có thể gộp thành một thì gộp.

**Chữ và hình bổ trợ nhau, mỗi bên tự đứng được.** Với mỗi sơ đồ phải đạt đủ ba điều:

1. *Bỏ chữ, còn hình:* nhãn node và nhãn cạnh mang đủ ý chính. Người chỉ nhìn hình vẫn nói lại được điều sơ đồ muốn nói (ai gọi ai, bước nào trước, chỗ nào không đáng tin). `alt` mô tả đủ ý đó.
2. *Bỏ hình, còn chữ:* đoạn văn quanh sơ đồ vẫn trọn ý, người đọc không cần hình mới hiểu. Không viết "như hình bên" thay cho nội dung.
3. *Dùng lẫn nhau:* văn dẫn người học nhìn hình bằng chính nhãn node ("Nhìn ô *Ví chờ bạn ký*, ví chưa biết gì về địa chỉ nhận") và nói điều hình không nói được (lý do, ví dụ, điều cần cẩn thận). Hình cho người học thấy vị trí và quan hệ của từng ý trong văn. Văn và hình dùng cùng tên gọi cho cùng một thứ.

## Giọng văn

- Viết tiếng Việt cho người tự học, như một người hướng dẫn đang nói chuyện trực tiếp với người học. Thuật ngữ kỹ thuật chính xác; thuật ngữ tiếng Anh giữ nguyên khi đó là tên chuẩn (API, struct, commit), giải thích ngắn ở lần đầu xuất hiện.
- Dùng câu đầy đủ chủ ngữ và vị ngữ, không viết kiểu liệt kê cụt hay ghi chú tóm tắt. Giữa các câu và đoạn dùng từ nối nói rõ quan hệ (vì vậy, nhưng, trong khi đó, nói cách khác, ví dụ, tiếp theo). Mỗi đoạn mở bằng một câu cho biết đoạn sẽ làm gì và kết bằng điều người học mang theo sang đoạn sau. Mục nào cũng nêu lý do trước khi nêu thao tác.
- Câu dẫn tự nhiên được phép và nên có ở chỗ chuyển mục hoặc chuyển bước ("Giờ ta thử...", "Để ý chỗ này nhé", "Trước khi đi tiếp, hãy..."). Đó là cách dẫn dắt, không phải lời khen.
- Xưng hô: gọi người học là "bạn". Dùng "chúng ta" hoặc "ta" (hai cách tương đương; và "cùng ... nhé") khi cả bài cùng phân tích hoặc dựng một ví dụ chung. Dùng câu mệnh lệnh có "hãy" hoặc "bạn thử" khi người học tự thực hành. Không dùng "mình", "tôi", "chúng tôi" để tự xưng; không dùng "mày", "m", "các em".
- Không hứa hẹn, không cổ vũ hay khen sáo rỗng ("tuyệt vời", "rất dễ"), không chép nguyên văn nguồn.
- Khái niệm dùng lần đầu trong khóa được giải thích ngay tại chỗ bằng lời đơn giản và một ví dụ nhỏ.

