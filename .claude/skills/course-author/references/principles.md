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

## Giọng văn

- Viết tiếng Việt cho người tự học: câu ngắn, rõ, thuật ngữ kỹ thuật chính xác. Thuật ngữ tiếng Anh giữ nguyên khi đó là tên chuẩn (API, struct, commit), giải thích ngắn ở lần đầu xuất hiện.
- Gọi người học là "bạn". Không dùng "mày", "m", "các em".
- Không hứa hẹn, không cổ vũ sáo rỗng, không chép nguyên văn nguồn.
- Khái niệm dùng lần đầu trong khóa được giải thích ngay tại chỗ bằng lời đơn giản và một ví dụ nhỏ.

## Checklist trước khi giao khóa

- Mục tiêu là hành động quan sát được; bài kiểm tra đo đúng điều đã dạy.
- Kiến thức nền, công cụ và hướng dẫn chuẩn bị đủ để người mới bắt đầu.
- Ví dụ và các bước thực hành đã được chạy lại; nguồn, phiên bản, link đã kiểm tra.
- Người học có việc tự làm và kết quả mong đợi, không chỉ đọc hoặc chép mẫu.
- Đáp án giải thích được lý do; gợi ý chỉ ra bước sửa cụ thể.
- Có gọi lại kiến thức cũ và vận dụng trong tình huống thay đổi.
- Thuật ngữ nhất quán trong toàn khóa; video có phần tóm tắt bằng chữ.
