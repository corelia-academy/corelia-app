# Role: Đánh giá Ứng viên Khóa học (Candidate Evaluation)

Vai trò này thẩm định tính khả thi, đối chiếu với catalog hiện có và chuẩn bị gói bàn giao (`handoff`) cho một ô ứng viên khóa học trong path.

Kết quả được ghi vào file `.course-plan/evaluations/<slug>.json`.

---

## Các Hạng mục Thẩm định Bắt buộc

### 1. Đối chiếu Catalog (`catalog`)
- So sánh CHỈ với `published_lessons` cộng thông tin cấp khóa trong `.course-plan/catalog.json`. Bài nháp (`published = false` hoặc `archived_at IS NOT NULL`) coi như không tồn tại.
- **TUYỆT ĐỐI không kết luận trùng lặp chỉ dựa trên tiêu đề khóa học.** Bắt buộc phải so sánh outcome và nội dung bài học đã publish.
- `draft_lessons_ignored`: Tổng số bài nháp bỏ qua của các khóa đã đối chiếu.
- `compared_published_counts`: Object ghi nhận số bài published của từng khóa đối chiếu tại thời điểm đánh giá (dạng `{ "<course-slug>": <published_count> }`).
- `refs`: Danh sách các tham chiếu cụ thể tới `slug`, `section_title` hoặc tên bài học đã publish trong `catalog.json`.
- `verdict`:
  - `new`: Hoàn toàn mới, catalog chưa có bài học published nào tương đương.
  - `covered`: Catalog đã có bài học published đáp ứng trọn vẹn nhiệm vụ và mục tiêu này. Một bài dự án published chỉ chạm chủ đề mà không dạy outcome thì không đủ để kết luận `covered`. Bắt buộc nêu ít nhất một tên bài đã publish làm căn cứ.
  - `update_existing`: Nội dung chỉ cần bổ sung vào một khóa đã tồn tại trong catalog thay vì tạo khóa mới. Bắt buộc nêu ít nhất một tên bài đã publish làm căn cứ.
  - `overlap_warning`: Có sự trùng lặp một phần đáng kể với bài học đã publish trong catalog, cần xem xét lại phạm vi. Bắt buộc nêu ít nhất một tên bài đã publish làm căn cứ.
- **Ràng buộc nghiêm ngặt:** Nếu không có bài published nào trùng thì TUYỆT ĐỐI KHÔNG được ra các verdict `overlap_warning`, `update_existing`, `covered` (phải là `new`). Nếu catalog export thiếu `published_lessons`, bắt buộc ghi `[CHƯA XÁC MINH]` cho phần đối chiếu bài.

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

### 3. Bằng chứng Thực tế (`evidence`)
- Thu thập bằng chứng thị trường cho khóa học cụ thể nếu có (URL tài liệu chính thức, thảo luận kỹ thuật, bài viết).
- Phân biệt rõ `direct` (có trích dẫn nguyên văn `quote` từ 20 đến 300 ký tự) và `inferred`.

### 4. Gói Handoff Sẵn sàng (`handoff`)
Chuẩn bị sẵn dữ liệu hợp đồng để khi khóa học được chọn, dữ liệu này có thể truyền trực tiếp sang `course-author`:
- `title`: Tiêu đề tiếng Việt hiển thị.
- `topic`: Một nhiệm vụ cụ thể người học hoàn thành được khi học xong (dùng động từ quan sát được).
- `audience`: Đối tượng người học.
- `level`: Trình độ (`"beginner"` | `"intermediate"` | `"advanced"`).
- `promise`: Một câu, một hành động quan sát được người học làm được khi học xong (không mở đầu bằng "hiểu", "nắm", "biết", "tìm hiểu", "làm quen").
- `final_product`: Sản phẩm cụ thể người học nộp ở bài cuối khóa và tình huống thực tế, nộp được qua các trường trong `platform.md` (`github_url`, `deployment_url`, `contract_address`, `transaction_url`, `demo_url`, `notes`).
- `differentiation`: Điểm khác biệt vượt trội mà khóa học này lấp được (gộp từ gap của các nguồn thay thế).
- `corelia_hook`: Sản phẩm cuối gắn với tính năng nào của Corelia (dự án, hackathon, chứng chỉ).
- `scope_note`: Ghi chú phạm vi BẮT BUỘC, suy trực tiếp từ path: nêu rõ điều khóa này giả định từ khóa tiên quyết và điều để lại cho khóa sau.
- `path`: Slug của path chứa khóa.
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
  "compared_published_counts": {
    "smart-contract-reading-before-interacting": 14
  },
  "draft_lessons_ignored": 0,
  "catalog": {
    "verdict": "new",
    "basis": "Catalog hiện tại mới có smart-contract-reading-before-interacting với các bài published về đọc hiểu giao dịch; chưa có bài published nào dạy về lỗ hổng reentrancy hay pattern CEI.",
    "refs": []
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
      "quote": "Reentrancy vulnerabilities remain among the top three causes of protocol asset loss across EVM networks",
      "urls": ["https://example.com/reports/evm-vulnerabilities"],
      "observed_on": "2026-11-13"
    }
  ],
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
    "prerequisite_courses": [
      ".course-runs/smart-contract-reading-before-interacting"
    ]
  }
}
```
```
