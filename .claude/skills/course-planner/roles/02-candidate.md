# Role: Đánh giá Ứng viên Khóa học (Candidate Evaluation)

Vai trò này thẩm định tính khả thi, đối chiếu với catalog hiện có và chuẩn bị gói bàn giao (`handoff`) cho một ô ứng viên khóa học trong path.

Kết quả được ghi vào file `.course-plan/evaluations/<slug>.json`.

---

## Các Hạng mục Thẩm định Bắt buộc

### 1. Đối chiếu Catalog (`catalog`)
- Phải đọc trực tiếp file `.course-plan/catalog.json` (từng module và từng lesson name).
- **TUYỆT ĐỐI không kết luận trùng lặp chỉ dựa trên tiêu đề khóa học.** Bắt buộc phải so sánh outcome và nội dung bài học.
- `refs`: Danh sách các tham chiếu cụ thể tới `slug`, `module_id` hoặc tên lesson trong `catalog.json`.
- `verdict`:
  - `new`: Hoàn toàn mới, catalog chưa có nội dung tương đương.
  - `covered`: Catalog đã có khóa/bài học đáp ứng trọn vẹn nhiệm vụ và mục tiêu này.
  - `update_existing`: Nội dung chỉ cần bổ sung vào một khóa đã tồn tại trong catalog thay vì tạo khóa mới.
  - `overlap_warning`: Có sự trùng lặp một phần đáng kể với bài học trong catalog, cần xem xét lại phạm vi.

### 2. Tính Khả thi trên Nền tảng (`feasibility`)
- Bắt buộc đọc trực tiếp và đối chiếu với `.claude/skills/course-author/references/platform.md`.
- Trích dẫn mục liên quan trong `platform.md` vào `basis`. Tuyệt đối không tự suy đoán khả năng nền tảng vượt ngoài `platform.md`.
- Kiểm tra các giới hạn thực tế theo `platform.md`:
  - Định dạng bài học dự kiến phải nằm trong các loại được hỗ trợ: `article`, `video` (từ kênh được phép), `quiz`, `code_exercise`, `practice`.
  - Giới hạn của `code_exercise`: chỉ hỗ trợ chấm bằng so khớp chuỗi (`contains`, `not_contains`, `equals`), KHÔNG biên dịch, KHÔNG chạy mã, KHÔNG terminal. Dạng `fill` tối đa 1–5 ô điền; dạng `edit` chỉ khi khung code cố định và kiểm được bằng chuỗi. Ngôn ngữ phải thuộc danh sách đang bật.
  - Các bài tập đòi hỏi biên dịch thật hoặc môi trường ngoài phải tổ chức bằng `practice` (người học tự tick checklist) hoặc bài cuối khóa do giảng viên chấm.
- `verdict`:
  - `feasible`: Khả thi hoàn toàn trên nền tảng Corelia hiện tại theo `platform.md`.
  - `feasible_with_limits`: Khả thi nếu giới hạn phạm vi bài thực hành (nêu rõ giới hạn trong `basis`).
  - `not_feasible`: Vượt quá khả năng nền tảng và không thể kiểm tra được outcome theo `platform.md`.

### 3. Bằng chứng và Căn cứ Nền tảng (`evidence` & `foundation_basis`)
- Thu thập bằng chứng thị trường cho khóa học cụ thể nếu có.
- Nếu khóa học là khóa nền tảng (`is_foundation: true`) nhưng bản thân nó không có bằng chứng thị trường trực tiếp (`direct` evidence):
  - Phải điền `foundation_basis` trỏ tới khóa đích mà nó phục vụ:
    ```json
    "foundation_basis": {
      "target_slug": "<slug-khóa-đích>",
      "reason": "Giải thích vì sao kiến thức của khóa này là bắt buộc để học được khóa đích"
    }
    ```
  - Bắt buộc: `reason` không được để trống và khóa đích phải có quan hệ `requires` phụ thuộc vào khóa nền này (trực tiếp hoặc bắc cầu).
  - Nếu khóa có bằng chứng trực tiếp hoặc không phải khóa nền theo cơ chế này: để `"foundation_basis": null`.

### 4. Gói Handoff Sẵn sàng (`handoff`)
Chuẩn bị sẵn dữ liệu hợp đồng để khi khóa học được chọn, dữ liệu này có thể truyền trực tiếp sang `course-author`:
- `title`: Tiêu đề tiếng Việt hiển thị.
- `topic`: Một nhiệm vụ cụ thể người học hoàn thành được khi học xong (dùng động từ quan sát được).
- `audience`: Đối tượng người học.
- `level`: Trình độ (`"beginner"` | `"intermediate"` | `"advanced"`).
- `promise`: Một câu, một hành động quan sát được người học làm được khi học xong (không mở đầu bằng "hiểu", "nắm", "biết", "tìm hiểu", "làm quen").
- `final_product`: Sản phẩm cụ thể người học nộp ở bài cuối khóa và tình huống thực tế, nộp được qua các trường trong `platform.md`.
- `differentiation`: Điểm khác biệt vượt trội mà khóa học này lấp được (gộp từ gap của các nguồn thay thế).
- `corelia_hook`: Sản phẩm cuối gắn với tính năng nào của Corelia (dự án, hackathon, chứng chỉ).
- `scope_note`: Ghi chú phạm vi BẮT BUỘC, suy trực tiếp từ path: nêu rõ điều khóa này giả định từ khóa tiên quyết và điều để lại cho khóa sau.
- `path`: Slug của path chứa khóa.
- `is_foundation`: Boolean.
- `prerequisite_courses`: Mảng các đường dẫn tới thư mục khóa tiên quyết mà khóa này kế thừa (dạng `[".course-runs/<prereq-slug>"]`), suy trực tiếp từ `requires` của path.

Ngoài ra, evaluation BẮT BUỘC ghi trường:
- `catalog_courses`: Mảng các slug của toàn bộ các khóa học đang có trạng thái `"produced"` hoặc `"in_catalog"` trong `.course-plan/catalog.json` tại thời điểm đánh giá. Khi catalog có thêm khóa mới xuất hiện, candidate sẽ bị coi là hết hạn và được xếp vào `needs_research` để đánh giá lại.

---

## Cấu trúc File Đầu Ra

File được ghi tại `.course-plan/evaluations/<slug>.json`:

```json
{
  "slug": "smart-contract-reentrancy-defense",
  "evaluated_on": "2026-11-13",
  "catalog_courses": [
    "smart-contract-reading-before-interacting"
  ],
  "catalog": {
    "verdict": "new",
    "basis": "Catalog hiện tại mới có smart-contract-reading-before-interacting (phân tích đọc hiểu), chưa có bài nào dạy về mã độc reentrancy hoặc pattern CEI.",
    "refs": [
      "smart-contract-reading-before-interacting/M2/L2-4"
    ]
  },
  "feasibility": {
    "verdict": "feasible",
    "basis": "Khả thi theo platform.md: bài code_exercise dạng fill (1–5 chỗ trống) kiểm tra đúng thứ tự checks-effects-interactions trên file .sol bằng so khớp chuỗi contains, kết hợp quiz kiểm tra nhận diện lỗi.",
    "notes": "Không yêu cầu biên dịch hay deploy vì platform.md nêu rõ Solidity chấm bằng so khớp chuỗi, không biên dịch."
  },
  "evidence": [
    {
      "claim": "Reentrancy vẫn nằm trong top 3 nguyên nhân thất thoát tài sản trên Ethereum theo các báo cáo bảo mật gần nhất",
      "kind": "direct",
      "urls": ["https://example.com/reports/evm-vulnerabilities"],
      "observed_on": "2026-11-13"
    }
  ],
  "foundation_basis": null,
  "missing": [
    "Chưa có số liệu về tỉ lệ học viên vượt qua bài test CEI ở lần thử đầu tiên"
  ],
  "handoff": {
    "title": "Phòng chống tấn công Reentrancy trong Smart Contract",
    "topic": "Tái hiện tấn công reentrancy trên test contract và áp dụng checks-effects-interactions pattern để chặn rút tiền trái phép.",
    "audience": "Lập trình viên Solidity đã biết đọc hiểu hàm nạp/rút tiền cơ bản và cấu trúc modifier.",
    "level": "intermediate",
    "promise": "Xây dựng và triển khai cơ chế kiểm tra checks-effects-interactions chặn đứng tấn công rút tiền reentrancy trên testnet.",
    "final_product": "Repo GitHub chứa smart contract đã được vá lỗi, kèm test suite tự động mô phỏng tấn công thất bại.",
    "differentiation": "Cung cấp bài tập thực hành sửa lỗi trực tiếp trên code thay vì chỉ phân tích lý thuyết như các khóa học khác.",
    "corelia_hook": "Sản phẩm cuối khóa nộp nhận Chứng chỉ chuyên môn Web3 Security Auditor của Corelia.",
    "scope_note": "Tập trung vào single-function và cross-function reentrancy cơ bản, không đi sâu vào read-only reentrancy.",
    "path": "blockchain-security-auditor",
    "is_foundation": false,
    "prerequisite_courses": [
      ".course-runs/smart-contract-reading-before-interacting"
    ]
  }
}
```
```
