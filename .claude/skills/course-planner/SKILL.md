---
name: course-planner
description: Xác định khóa học nào nên tạo tiếp theo trong Corelia và lộ trình các khóa kế tiếp trong cùng path. Chạy trước course-author, dựa trên bằng chứng thị trường, catalog hiện có và ma trận tiên quyết.
---

# Course Planner

Bạn là coordinator của skill `course-planner`. Skill này chạy trước `course-author` để trả lời hai câu hỏi:
1. Khóa học nào nên tạo tiếp theo?
2. Các khóa kế tiếp trong cùng lộ trình (skill map) là gì?

Kết quả phải lặp lại được, giải thích được, tách bạch rõ ràng giữa bằng chứng trực tiếp (`direct`), suy luận (`inferred`) và phần dữ liệu còn thiếu (`missing`).

Skill không ghi cơ sở dữ liệu và không import khóa học lên hệ thống.

---

## Dữ liệu và Hợp đồng

Tất cả dữ liệu được lưu trong thư mục `.course-plan/` ở gốc repo:

- `.course-plan/backlog.json`: Danh sách backlog duy nhất lưu toàn bộ đề xuất khóa học (đang mở `open`, đã chọn `chosen`, đã bị loại `rejected`, đã sản xuất `produced`). Chứa trường `focus: { "path": "<map slug>" }` hoặc `null`. Do role `00-shortlist.md` bổ sung cho các ô sẵn sàng của map đang focus, script `rank.mjs` xếp hạng đề xuất `open`.
- `.course-plan/paths/<slug>.json`: Bản đồ kỹ năng (Skill Map) thuộc một trong 3 loại: `ecosystem`, `role`, `skill`. Do role `01-path.md` dựng từ tài liệu chính thức, Human duyệt một lần chuyển sang `status: "approved"`.
- `.course-plan/catalog.json`: Bản chụp catalog hiện có (sinh bởi `scripts/catalog-snapshot.mjs`, không sửa tay).
- `.course-plan/evaluations/<slug>.json`: Đánh giá chi tiết từng ứng viên khóa học (do role `02-candidate.md` lập).
- `.course-plan/decisions/<YYYY-MM-DD>-<n>.json`: Nhật ký quyết định của từng phiên chạy `scripts/next.mjs`.

---

## Trình tự Điều phối (Coordinator Workflow)

Coordinator thực hiện tuần tự các bước sau. Mỗi lần chạy dừng đúng một lần: duyệt map mới hoặc chọn dòng. Sau đó coordinator tự động thực hiện liên tục các bước tiếp theo mà không dừng giữa chừng khi có handoff.

### Bước 1: Làm mới và Snapshot Catalog
1. Làm mới dữ liệu catalog từ DB local (chỉ đọc):
```bash
node .claude/skills/course-planner/scripts/export-catalog.mjs
```
Script chạy `export-catalog.sql` qua container `supabase_db_corelia-app` và ghi vào `.course-plan/catalog-export.json`. Nếu container không chạy hoặc lệnh lỗi, script giữ nguyên file export cũ và phát cảnh báo.

2. Chạy script chụp snapshot:
```bash
node .claude/skills/course-planner/scripts/catalog-snapshot.mjs
```
Script quét toàn bộ thư mục `.course-runs/*/` và `.course-plan/catalog-export.json` để cập nhật `.course-plan/catalog.json`.

### Bước 2: Kiểm tra Skill Map Focus
1. Đọc trường `focus` trong `.course-plan/backlog.json`. Nếu `focus` có trỏ tới một map (ví dụ `{ "path": "solana" }`):
   - Kiểm tra xem file `.course-plan/paths/<map-slug>.json` đã tồn tại và có `status: "approved"` hay chưa.
   - Nếu map **chưa tồn tại** hoặc đang ở **`status: "draft"`**:
     - Nếu chưa tồn tại: Chạy role `roles/01-path.md` để nghiên cứu tài liệu chính thức và dựng map ở `status: "draft"`.
     - Chạy `plan-lint.mjs .course-plan/paths/<map-slug>.json` để đảm bảo map hợp lệ.
     - **Trình map cho Human và DỪNG:** Đây là điểm dừng Human của phiên chạy để Human duyệt map mới. Sau khi Human duyệt, chuyển status sang `"approved"`.
   - Nếu map đã có `status: "approved"`: Đi tiếp sang Bước 3.

### Bước 3: Quản lý Backlog và Xếp hạng Đề xuất
Kiểm tra xem trong `.course-plan/backlog.json` đã có đề xuất nào có `status === "chosen"` mà khóa đó chưa vào sản xuất (`produced`) hay chưa.
Nếu đã có đề xuất `chosen`: tiếp tục với đề xuất đó, không cần chọn lại.
Nếu chưa có:
1. Xác định các ô sẵn sàng trong map focus (thỏa 4 điều kiện: `ref` null, `coverage` ≠ covered, mọi ô requires đã covered hoặc có đề xuất chosen/produced, ô chưa có đề xuất open/chosen).
2. Đếm số đề xuất `status === "open"` thuộc map focus trong `.course-plan/backlog.json`. Nếu số đề xuất `open` < 4 (hoặc ít hơn số ô sẵn sàng):
   Chạy role `roles/00-shortlist.md` để nghiên cứu và bổ sung các đề xuất mới vào `proposals` với `status: "open"`, `added_on: "<YYYY-MM-DD>"`, `decided_on: null`, `reject_reason: null`, kèm trường `path_node: { path, node }`. Bổ sung tối đa 4 đề xuất (hoặc ít hơn nếu không đủ ô sẵn sàng).
   Tuyệt đối không sửa hay xóa đề xuất đã có. Không thêm lại các slug đã tồn tại ở bất kỳ trạng thái nào (kể cả `rejected`).
3. Chạy kiểm tra lint cho backlog và map:
   ```bash
   node .claude/skills/course-planner/scripts/plan-lint.mjs .
   ```
4. Chạy kiểm tra URL bằng chứng (mặc định chỉ kiểm tra đề xuất `open` và `chosen`):
   ```bash
   node .claude/skills/course-planner/scripts/evidence-check.mjs .course-plan/backlog.json
   ```
   Nếu có URL lỗi không trả 2xx, yêu cầu role sửa lại; không trình Human khi còn lỗi URL.
5. Chạy script xếp hạng:
   ```bash
   node .claude/skills/course-planner/scripts/rank.mjs .course-plan/backlog.json --table
   ```
   Script xếp hạng theo thứ tự layer, sau đó đến độ sâu requires; tiêu chí cũ dùng phá hòa. Bảng hiển thị cột Layer / Nhánh.
6. **Trình Human và DỪNG:**
   Trình bày đúng bảng Markdown do `rank.mjs --table` in ra. Bên dưới bảng chỉ nêu khuyến nghị là dòng rank 1 và các cảnh báo của script.
   **DỪNG LẠI TẠI ĐÂY:** Chờ Human chọn một dòng trong bảng xếp hạng.

### Bước 4: Tiếp nhận Lựa chọn của Human
Sau khi Human phản hồi và chốt một dòng:
1. Coordinator cập nhật vào `.course-plan/backlog.json`:
   - Dòng Human chọn: đặt `status: "chosen"` và `decided_on: "<YYYY-MM-DD>"`.
   - Dòng Human loại kèm lý do: đặt `status: "rejected"`, `reject_reason: "<lý do>"`, và `decided_on: "<YYYY-MM-DD>"`.
   - Các dòng Human không nhắc tới: giữ nguyên `status: "open"`, không bị loại hàng loạt.

### Bước 5: Đánh giá Candidate Sẵn sàng
Gọi role `roles/02-candidate.md` để tạo/cập nhật evaluation cho khóa đã chọn:
- Bổ sung đầy đủ `promise`, `final_product`, `differentiation`, `corelia_hook` vào handoff.
- Chạy `evidence-check.mjs` kiểm tra các URL bằng chứng trong evaluation. Nếu có URL lỗi, role sửa lại tối đa 2 lần.

### Bước 6: Tính toán Quyết định (`next.mjs --only <slug>`)
Chạy script quyết định giới hạn vào khóa đã chọn:
```bash
node .claude/skills/course-planner/scripts/next.mjs --write --only <slug>
```
Script kiểm tra các Gate:
1. Đề xuất có status `"chosen"`.
2. Có `path_node` trỏ tới map `approved` và ô tồn tại trong map.
3. Các ô trong `requires` của ô đó thỏa mãn (đã covered hoặc đã có đề xuất chosen/produced).
4. `catalog.verdict` là `new`.
5. `feasibility.verdict` khác `not_feasible`.
6. `handoff` đủ `title`, `audience`, `level`, `scope_note`. Evaluation không bị hết hạn bởi khóa mới trong catalog.

Xử lý kết quả:
- Nếu `pick` khác khóa đã chọn hoặc rỗng: chạy lại role `02-candidate.md` một lần; nếu vẫn không được pick thì DỪNG, ghi báo cáo `.course-runs/<slug>/run-report.md` với lý do của `next.mjs`, không ghi handoff.
- Nếu `pick` đúng khóa đã chọn: cập nhật `user_decision: "picked_from_shortlist"` trong file decision.

### Bước 7: Bàn giao và Kích hoạt Course Author
1. Ghi file hợp đồng `.course-runs/<slug>/handoff.json` từ mục `handoff` trong evaluation.
2. Gọi skill `course-author` để bắt đầu sản xuất nội dung khóa học cho slug đó.
   - Đối với khóa có `kind: "complete_existing"`: chạy tới hết bước sản xuất file, không nhập DB, báo cáo nêu rõ lý do (pipeline chỉ tạo khóa mới; import dừng khi khóa tồn tại).
3. Sau khi `course-author` hoàn thành hoặc dừng, ghi báo cáo tổng hợp cuối phiên tại `.course-runs/<slug>/run-report.md` và in ra cùng nội dung.
4. **Cập nhật trạng thái Backlog và Skill Map (AC-08)**:
   - Sau khi `course-author` import local thành công, coordinator:
     - Đặt `status: "produced"` và `decided_on: "<YYYY-MM-DD>"` cho đề xuất trong `.course-plan/backlog.json`.
     - Cập nhật ô tương ứng trong skill map: đặt `course_slug` = slug khóa vừa sản xuất và `coverage: "covered"`.
   - Nếu import dừng hoặc khóa bị loại sau review thì đặt `status: "rejected"` kèm `reject_reason` và `decided_on`. Coordinator không bao giờ tiếp tục một slug đang `rejected`.

---

## Xử lý khi User Đưa Chủ đề Cụ thể

Khi người dùng chủ động đưa vào một chủ đề hoặc tên khóa, coordinator đối chiếu với catalog và skill map hiện có, rồi xử lý theo một trong các trường hợp:

1. **Khớp với một ô có sẵn trong map approved:**
   Ánh xạ chủ đề vào ô đó, tiến hành đánh giá qua gate và chạy `next.mjs` như mọi candidate.
2. **Không có ô nào phù hợp trong map:**
   Đề xuất bổ sung ô mới vào map với đầy đủ layer, requires, required_tools, scope; trình Human duyệt map trước khi tiến hành.
3. **Đã được catalog đáp ứng:**
   Chỉ ra khóa học hoặc bài học cụ thể trong catalog hiện tại (`catalog.json`) đã phủ nội dung này.
4. **Cần cập nhật khóa có sẵn:**
   Chỉ ra khóa hiện có cần bổ sung hoặc sửa đổi, đưa vào danh sách `updates`.

---

## Bảng Model cho Subagents

Coordinator chạy bằng model của session, không dừng, không báo trước; ghi tên model coordinator vào `run-log.jsonl` và `run-report.md`.

Bảng model child có hai cột: Claude và ChatGPT. Quy ước: `haiku` → `luna`, `sonnet` → `terra`, `opus` → `astra`. Coordinator dùng cột ứng với nền tảng đang chạy. Nền tảng không cho chọn model của child: chạy bằng model mặc định và ghi điều đó vào báo cáo.

| Vai trò | Model (Claude) | Model (ChatGPT) | Ghi chú |
|---|---|---|---|
| Coordinator (`course-planner`) | Model của session | Model của session | Điều phối, chạy script, tổng hợp |
| Role 1: Dựng skill map (`roles/01-path.md`) | `sonnet` | `terra` | Yêu cầu web research và đọc trang thật |
| Role 2: Đánh giá candidate (`roles/02-candidate.md`) | `sonnet` | `terra` | Đối chiếu platform và thẩm định outcome |
