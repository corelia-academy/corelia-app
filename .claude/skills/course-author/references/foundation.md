# Khóa nền tảng (đầu path) và khóa kế thừa

Áp dụng khi `brief.is_foundation = true` (khóa basic đầu một path mà các khóa sau xây lên), hoặc khi khóa đang làm có `brief.prerequisite_courses` (khóa kế thừa). Khóa thường không dùng file này.

Nguồn: ghi chú thiết kế do user đưa ngày 2026-11-12, đã bỏ phần phụ thuộc vào hệ thống không có trong repo (tag `canonical_stable`, thẩm định A4/A6, trường DB `is_foundation`). Những điều dưới đây là quy ước của skill và file trong `.course-runs/`, không đòi nền tảng thêm khả năng.

## Vấn đề cần chặn

Khóa nền tảng sai, mơ hồ hoặc nhanh lỗi thời sẽ làm các khóa dựng trên nó sai theo. Khóa nền tảng vì vậy là hợp đồng mà khóa sau gọi vào, không phải khóa "dễ dãi".

## 1. Tách nguyên lý bền khỏi công cụ đổi nhanh

- Phần lớn thời lượng và mọi `outcomes` cốt lõi dành cho nguyên lý và mô hình tư duy mà người dạy có nguồn chính thức xác nhận (ví dụ cách ký giao dịch, vòng đời giao dịch, nonce, mô hình trạng thái). Không có số phần trăm cố định; thước đo là: bỏ tên công cụ đi thì bài vẫn dạy được.
- Phần thao tác trên công cụ cụ thể (giao diện ví, trang explorer, CLI) giữ ngắn, đặt sau nguyên lý, và theo quy tắc `platform.md` về ảnh và ngày quan sát. Ưu tiên công cụ ổn định mà nguồn chính thức mô tả (tiêu chuẩn giao thức, CLI chính thức) khi người học ở trình độ dùng được; không bắt người mới đọc dữ liệu thô nếu khóa không dạy cách đọc.
- Câu dạy bằng nguyên lý ("giao dịch là chuỗi byte được ký bằng khóa riêng rồi gửi qua RPC") thay cho hướng dẫn bấm nút của một phiên bản giao diện.
- Không khẳng định một nguyên lý "không bao giờ đổi". Ghi phạm vi (giao thức, phiên bản) và nguồn cho từng định nghĩa cốt lõi.

## 2. Chuẩn chặt hơn khóa thường

| Tiêu chí | Khóa thường | Khóa nền tảng |
|---|---|---|
| Thuật ngữ | Có thể dùng từ đồng nghĩa | Một thuật ngữ chuẩn cho một khái niệm, theo tài liệu chuẩn (RFC, EIP, đặc tả); tên kỹ thuật lõi giữ nguyên, không dịch bừa. Cùng thuật ngữ cho cùng khái niệm trong toàn khóa |
| Độ phủ khái niệm | Phục vụ mục tiêu hẹp của bài | Không bỏ hạt nhân mà khóa sau bắt buộc dùng (ví dụ dạy giao dịch mà thiếu nonce thì bài về replay hay front-running sau này gãy) |
| Bằng chứng đầu ra | Quiz nhận biết được | Phải có hành động quan sát được: tự tính, tự debug một ví dụ hỏng, hoặc giải thích đúng/sai của một trạng thái. Phần nền tảng không kiểm được thì nêu rõ phần bài kiểm và phần giảng viên chấm (như quy tắc phủ outcome trong `roles/03-curriculum.md`) |

## 3. Hợp đồng xuôi dòng: `provided_prerequisites.json`

Khóa nền tảng ghi thêm file này vào `.course-runs/<slug>/` khi bước 3 xong (`roles/03-curriculum.md`):

```json
{ "course_slug": "", "canonical_version": "v1.0.0",
  "provided_mental_models": [""],
  "exact_terms_defined": [{ "term": "", "defined_in": "Part A, Bài 2", "source_ids": ["S01"] }],
  "guaranteed_outcomes": [""] }
```

- `provided_mental_models`: mô hình tư duy người học đã có khi xong khóa, mỗi mục kiểm được bằng một outcome của khóa.
- `exact_terms_defined`: thuật ngữ đã định nghĩa kèm bài định nghĩa và nguồn.
- `guaranteed_outcomes`: lấy từ `curriculum.outcomes` đã được phủ (xem định nghĩa "được phủ"); không hứa thêm.
- Mỗi mục phải truy ngược được tới lesson thật và `source_ids` của khóa đó. Mục không truy ngược được thì bỏ.

## 4. Khóa kế thừa

Khóa có `brief.prerequisite_courses` (danh sách đường dẫn tới thư mục khóa nền tảng hoặc `provided_prerequisites.json`):

- Bước 1 đọc các hợp đồng đó; `prerequisites` của brief lấy từ `provided_mental_models` và `guaranteed_outcomes`, không tự viết lại.
- Không dạy lại từ đầu thuật ngữ đã có trong `exact_terms_defined`; chỉ nhắc ngắn kèm nhãn bài trong khóa nền tảng nếu tên khóa đó có nhãn app, nếu không thì nêu tên khóa. Dùng đúng thuật ngữ của hợp đồng.
- Được giả định người học có các `provided_mental_models`; không giả định điều hợp đồng không nêu.
- Phát hiện hợp đồng thiếu một khái niệm khóa mới cần: ghi vào `open_questions` của brief, không bổ sung ngầm.

## 5. Giữ ổn định về sau

- Khóa nền tảng đã giao được coi là phiên bản chuẩn của path. Cập nhật không phá vỡ: chỉ thêm bài bổ sung hoặc cập nhật `resources` và ngày quan sát. Không xóa hay đổi nghĩa mục nằm trong `provided_prerequisites.json`.
- Đổi nghĩa chỉ khi nguồn chính thức đổi chuẩn (nâng cấp giao thức lớn). Khi đó tăng `canonical_version`, ghi lý do và danh sách khóa kế thừa cần rà lại; việc này user quyết định.
- Skill không thay đổi dữ liệu trên DB để đóng băng phiên bản; "đóng băng" là quy ước làm việc dựa trên file hợp đồng và lịch sử git của khóa.
