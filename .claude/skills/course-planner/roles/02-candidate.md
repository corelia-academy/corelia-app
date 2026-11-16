# Role: Đánh giá Ứng viên Khóa học (Candidate Evaluation)

Vai trò này thẩm định tính khả thi, đối chiếu với catalog hiện có và chuẩn bị gói bàn giao (`handoff`) cho một đề xuất khóa học gom nhiều ô trong path.
Tham khảo mẫu chuẩn tại `.claude/skills/course-author/references/exemplar-course.md` về cỡ khóa, nhịp module và cách viết nội dung thực chiến.

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
- **Không loại đề xuất vì thiếu công cụ cài đặt:** Các công cụ CLI hay môi trường phát triển (như Anchor CLI, Rust, Foundry) do học viên tự cài đặt theo hướng dẫn trong phần "Trước khi bắt đầu" của bài thực hành đầu tiên, hoặc được kiểm tra bằng bài tập quiz/code_exercise dạng so khớp chuỗi trên nền tảng. Thiếu công cụ cài đặt không làm đề xuất bị coi là `not_feasible`.
- Trích dẫn mục liên quan trong `platform.md` vào `basis`.
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
- `title`: Tiêu đề tiếng Việt hiển thị (nêu năng lực rộng, không đặt theo chủ đề hẹp).
- `topic`: Một nhiệm vụ cụ thể người học hoàn thành được khi học xong (dùng động từ quan sát được).
- `audience`: Đối tượng người học.
- `level`: Trình độ (`"beginner"` | `"intermediate"` | `"advanced"`).
- `promise`: Một câu, một hành động quan sát được người học làm được khi học xong (không mở đầu bằng "hiểu", "nắm", "biết", "tìm hiểu", "làm quen").
- `final_product`: Sản phẩm cụ thể người học nộp ở bài cuối khóa và tình huống thực tế kèm `notes` giải thích lựa chọn, nộp được qua các trường trong `platform.md` (`github_url`, `deployment_url`, `contract_address`, `transaction_url`, `demo_url`, `notes`).
- `differentiation`: Điểm khác biệt vượt trội mà khóa học này lấp được (gộp từ gap của các nguồn thay thế).
- `corelia_hook`: Sản phẩm cuối gắn với tính năng nào của Corelia (dự án, hackathon, chứng chỉ).
- `scope_note`: Ghi chú phạm vi BẮT BUỘC, suy trực tiếp từ path: nêu rõ điều khóa này giả định từ khóa tiên quyết và điều để lại cho khóa sau.
- `path`: Slug của path chứa khóa.
- `modules`: Mảng `modules` nguyên văn từ đề xuất.
- `mental_models`: Mảng các `mechanism` trích từ `modules`.
- `misconceptions`: Mảng gộp toàn bộ các `pitfalls` từ `modules` (loại bỏ trùng lặp).
- `reasoning_outcomes`: Mảng các `outcome` trích từ `modules`.
- `prerequisite_courses`: Mảng các đường dẫn tới thư mục khóa tiên quyết mà khóa này kế thừa (dạng `[".course-runs/<prereq-slug>"]`), suy trực tiếp từ `requires` của path.

Ngoài ra, evaluation BẮT BUỘC ghi trường:
- `catalog_courses`: Mảng các slug của toàn bộ các khóa học đang có trạng thái `"produced"` hoặc `"in_catalog"` trong `.course-plan/catalog.json` tại thời điểm đánh giá.

---

## Cấu trúc File Đầu Ra

File được ghi tại `.course-plan/evaluations/<slug>.json`:

```json
{
  "slug": "solana-program-design",
  "evaluated_on": "2026-11-16",
  "catalog_courses": [
    "solana-bootcamp"
  ],
  "compared_published_counts": {
    "solana-bootcamp": 12
  },
  "draft_lessons_ignored": 4,
  "catalog": {
    "verdict": "new",
    "basis": "solana-bootcamp mới publish các bài dự án; bài khái niệm đang là nháp nên theo rule không tính là đã phủ; khóa này dạy sâu về thiết kế account, PDA và CPI.",
    "refs": []
  },
  "feasibility": {
    "verdict": "feasible",
    "basis": "Khả thi theo platform.md: code_exercise fill chấm bằng so khớp chuỗi trên mã nguồn Rust, practice tự tick checklist kiểm thử local validator, bài cuối khóa nộp repo GitHub kèm notes.",
    "notes": "Học viên tự cài Anchor CLI trên máy theo hướng dẫn trước bài thực hành đầu tiên."
  },
  "evidence": [
    {
      "claim": "Các vụ exploit trên Solana xuất phát chủ yếu từ việc thiếu kiểm tra owner và ràng buộc PDA",
      "kind": "direct",
      "quote": "Solana is a blockchain built for mass adoption with fast finality and high throughput",
      "urls": ["https://solana.com/docs"],
      "observed_on": "2026-11-16"
    }
  ],
  "missing": [],
  "handoff": {
    "title": "Thiết kế Program Solana với Anchor",
    "topic": "Thiết kế account, PDA và CPI cho program Anchor của một app, rồi chặn được các lỗ hổng phổ biến trước khi deploy.",
    "audience": "Lập trình viên đã viết được Rust cơ bản và đã dùng ví, Devnet.",
    "level": "intermediate",
    "promise": "Thiết kế account, PDA và CPI cho program Anchor của một app, rồi chặn được các lỗ hổng phổ biến trước khi deploy.",
    "final_product": "Tình huống câu lạc bộ cần quỹ chung; nộp repo GitHub chứa program Anchor tối thiểu kèm test và notes giải thích thiết kế account, seed PDA, kiểm tra lỗ hổng và compute limit.",
    "differentiation": "Khóa học tiếng Việt chuyên sâu đầu tiên tập trung vào tư duy thiết kế state và checklist review bảo mật Anchor.",
    "corelia_hook": "Dự án tốt nghiệp cấp Chứng chỉ Lập trình viên Solana Chuyên sâu Corelia.",
    "scope_note": "Giả định người học đã biết Rust cơ bản; phần cài đặt công cụ nằm trong phần chuẩn bị của bài thực hành đầu tiên.",
    "path": "solana",
    "modules": [
      {
        "node": "accounts-model",
        "mechanism": "Mọi state nằm trong account; chỉ program owner mới sửa được data hoặc lamport; account càng lớn phí rent càng cao.",
        "app_use": ["Quyết định tách state thành account lớn hay nhỏ"],
        "pitfalls": ["Quên dành chỗ cho dữ liệu mở rộng"],
        "outcome": "Thiết kế các account cho một chức năng của app: chọn owner, ước tính kích thước và khoản lamport tối thiểu phải giữ"
      }
    ],
    "mental_models": [
      "Mọi state nằm trong account; chỉ program owner mới sửa được data hoặc lamport; account càng lớn phí rent càng cao."
    ],
    "misconceptions": [
      "Quên dành chỗ cho dữ liệu mở rộng"
    ],
    "reasoning_outcomes": [
      "Thiết kế các account cho một chức năng của app: chọn owner, ước tính kích thước và khoản lamport tối thiểu phải giữ"
    ],
    "prerequisite_courses": []
  }
}
```
