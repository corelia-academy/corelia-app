# Chuẩn thiết kế khóa học Corelia

Nguồn gốc: trang `/learn/learning-principles` (nội dung tại `src/locales/vi/instructor.json` → `learningPrinciples`). Khi file này và trang đó khác nhau về nguyên tắc học, theo trang đó. Khi trang đó khác code về khả năng nền tảng, theo code (xem `platform.md`).

## 7 nguyên tắc và cách áp dụng

1. **Bắt đầu từ việc người học sẽ làm được.** Mục tiêu viết bằng hành động quan sát được ("xử lý đầu vào sai mà chương trình không dừng đột ngột"), không viết "hiểu X". Chọn bài kiểm tra chứng minh mục tiêu trước, rồi mới soạn nội dung chuẩn bị cho bài kiểm tra đó. Mục tiêu "viết được chương trình" cần có thực hành viết và chạy; quiz định nghĩa chỉ kiểm một phần.
2. **Kiểm tra điểm xuất phát.** Ghi rõ kiến thức và công cụ cần có. Mỗi bài dạy mở bằng phần "Trước khi bắt đầu" và một câu hỏi tình huống (xem mục Mở bài). Không mặc định mọi người đã biết terminal hay Git. Đây là định hướng, không phải bài thi loại người học.
3. **Cho xem cách làm, rồi tạo chỗ để tự làm.** Bài dạy giải thích vì sao từng bước cần thiết. Sau đó người học làm có hỗ trợ (điền phần thiếu, sửa một lỗi), rồi làm biến thể ít gợi ý hơn.
4. **Yêu cầu nhớ lại và giải thích.** Câu hỏi bắt dự đoán kết quả hoặc giải thích lựa chọn, không chỉ nhớ thuật ngữ. Phương án nhiễu lấy từ lỗi hiểu thường gặp. Đáp án giải thích vì sao đúng và vì sao từng phương án nhiễu sai.
5. **Đưa kiến thức cũ trở lại sau một khoảng nghỉ.** Từ module thứ hai, có câu hỏi gọi lại kiến thức module trước. Bài cuối khóa dùng lại kỹ năng của các module.
6. **Phản hồi phải giúp sửa được bài.** Giải thích đáp án và gợi ý chỉ ra khái niệm cần xem lại hoặc bước sửa cụ thể. "Sai rồi" hoặc "cần cố gắng hơn" không đạt.
7. **Kiểm tra khả năng vận dụng.** Bài cuối khóa dùng tình huống khác ví dụ mẫu, công bố tiêu chí chấm, yêu cầu sản phẩm kèm notes giải thích lựa chọn.

## Flow học

Không có trình tự loại bài cố định. Mỗi kỹ năng phải đi qua đủ các bước sau, theo đúng thứ tự:

1. Được dạy, có ví dụ mẫu, trước khi bị kiểm tra.
2. Ngay sau phần dạy: một lần làm có hỗ trợ.
3. Sau đó: một lần tự làm với ít gợi ý hơn.
4. Được gọi lại ở một module sau.

Khóa kết thúc bằng bài vận dụng trong tình huống mới. Curriculum chọn loại bài cho từng bước; không cần dùng đủ mọi loại bài trong một module.

**Số bài mỗi module:** mặc định 3–6 bài (không tính bài cuối khóa). Module lệch khỏi khoảng này phải có `size_reason` nêu lý do cụ thể.

## Mở bài dạy

Mỗi bài dạy (article hoặc video) mở bằng hai phần ngắn, theo cách một người dạy thật vẫn làm trên lớp:

1. **Trước khi bắt đầu:** 2–3 dòng nêu cần biết gì trước, mỗi dòng có link tới bài hoặc nguồn để ôn lại. Không chấm, không chặn.
2. **Tình huống và câu hỏi:** một tình huống quen thuộc với người học, kết thúc bằng một câu hỏi tự nhiên ("Bạn lưu danh sách việc rồi tắt ứng dụng. Mở lại thì danh sách còn không?"). Người học không cần trả lời. Đoạn ngay sau trả lời câu hỏi đó, rồi mới vào khái niệm. Trước khi kết thúc bài, quay lại giải quyết trọn tình huống.

Không mở bài bằng định nghĩa, lịch sử hay bước cài đặt.

## Gọi tên bài và phần

Chữ người học thấy phải gọi bài và phần đúng như app hiển thị, không dùng mã tự đặt.

- **Phần** (module) gọi là "Part A", "Part B", "Part C"... theo thứ tự module trong khóa, đúng badge ở danh sách bài của app.
- **Bài** gọi là "Bài N", với N là số thứ tự của bài trong cả khóa, đếm cả quiz và practice, theo thứ tự curriculum, đúng số "Bài N" app hiện ở đầu trang bài.
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
- Xưng hô: gọi người học là "bạn". Dùng "chúng ta" (và "cùng ... nhé") khi cả bài cùng phân tích hoặc dựng một ví dụ chung. Dùng câu mệnh lệnh có "hãy" hoặc "bạn thử" khi người học tự thực hành. Không dùng "mình", "tôi", "chúng tôi" để tự xưng; không dùng "mày", "m", "các em".
- Không hứa hẹn, không cổ vũ hay khen sáo rỗng ("tuyệt vời", "rất dễ"), không chép nguyên văn nguồn.
- Khái niệm dùng lần đầu trong khóa được giải thích ngay tại chỗ bằng lời đơn giản và một ví dụ nhỏ.

## Checklist trước khi giao khóa

- Mục tiêu là hành động quan sát được; bài kiểm tra đo đúng điều đã dạy.
- Kiến thức nền, công cụ và hướng dẫn chuẩn bị đủ để người mới bắt đầu.
- Ví dụ và các bước thực hành đã được chạy lại; nguồn, phiên bản, link đã kiểm tra.
- Người học có việc tự làm và kết quả mong đợi, không chỉ đọc hoặc chép mẫu.
- Đáp án giải thích được lý do; gợi ý chỉ ra bước sửa cụ thể.
- Có gọi lại kiến thức cũ và vận dụng trong tình huống thay đổi.
- Thuật ngữ nhất quán trong toàn khóa; video có phần tóm tắt bằng chữ.
