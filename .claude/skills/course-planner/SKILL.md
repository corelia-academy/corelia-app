---
name: course-planner
description: Xác định khóa học nào nên tạo tiếp theo trong Corelia và lộ trình các khóa kế tiếp trong cùng path. Chạy trước course-author, dựa trên bằng chứng thị trường, catalog hiện có và ma trận tiên quyết.
---

# Course Planner

Bạn là coordinator của skill `course-planner`. Skill này chạy trước `course-author` để trả lời hai câu hỏi:
1. Khóa học nào nên tạo tiếp theo?
2. Các khóa kế tiếp trong cùng lộ trình (skill map) là gì?

Kết quả phải lặp lại được, giải thích được, tách bạch rõ ràng giữa bằng chứng trực tiếp (`direct`), suy luận (`inferred`) và phần dữ liệu còn thiếu (`missing`).
Nội dung khóa học phải là kiến thức thực chiến có giá trị khi build app: cơ chế → dùng khi build app → bẫy/bảo mật → code để củng cố. Một khóa gom 3–7 ô liên tiếp của map thành một khóa hoàn chỉnh.

Skill không ghi cơ sở dữ liệu và không import khóa học lên hệ thống.

---

## Dữ liệu và Hợp đồng

Tất cả dữ liệu được lưu trong thư mục `.course-plan/` ở gốc repo:

- `.course-plan/backlog.json`: Danh sách backlog duy nhất lưu toàn bộ đề xuất khóa học (đang mở `open`, đã chọn `chosen`, đã bị loại `rejected`, đã sản xuất `produced`). Chứa trường `focus: { "paths": ["..."] }` hoặc `null`. Do role `00-shortlist.md` bổ sung đề xuất gom 3–7 ô cho các ô sẵn sàng của các map đang focus, script `rank.mjs` xếp hạng đề xuất `open`.
- `.course-plan/paths/<slug>.json`: Bản đồ kỹ năng (Skill Map) thuộc một trong 3 loại: `ecosystem`, `role`, `skill`. Do role `01-path.md` dựng từ tài liệu chính thức, coordinator tự động kiểm tra và chuyển sang `status: "approved"` khi đạt kiểm tra.
- `.course-plan/catalog.json`: Bản chụp catalog hiện có (sinh bởi `scripts/catalog-snapshot.mjs`, không sửa tay).
- `.course-plan/evaluations/<slug>.json`: Đánh giá chi tiết từng ứng viên khóa học (do role `02-candidate.md` lập).
- `.course-plan/decisions/<YYYY-MM-DD>-<n>.json`: Nhật ký quyết định của từng phiên chạy `scripts/next.mjs`.

---

## Trình tự Điều phối (Coordinator Workflow)

Coordinator thực hiện tuần tự các bước sau. Mỗi lần chạy dừng đúng một lần: Human chọn dòng trong bảng rank. Sau đó coordinator tự động thực hiện liên tục các bước tiếp theo mà không dừng giữa chừng khi có handoff.

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

### Bước 2: Kiểm tra và Dựng Skill Map Focus (AC-06)
1. Đọc trường `focus` trong `.course-plan/backlog.json` (`focus.paths` hoặc `focus.path` cũ).
2. Nếu có `focus.paths`:
   - Xác định danh sách các map còn thiếu file `.course-plan/paths/<map-slug>.json`.
   - **Dựng tối đa 3 map còn thiếu mỗi lần chạy** theo đúng thứ tự trong danh sách:
     - Với mỗi map cần dựng (tối đa 3 map):
       - Chạy role `roles/01-path.md` để nghiên cứu tài liệu chính thức và dựng map (ban đầu ở `status: "draft"`).
       - Coordinator chạy kiểm tra tự động:
         1. `node .claude/skills/course-planner/scripts/plan-lint.mjs .course-plan/paths/<map-slug>.json`
         2. `node .claude/skills/course-planner/scripts/evidence-check.mjs .course-plan/paths/<map-slug>.json`
       - Nếu cả hai kiểm tra đạt: Coordinator tự động đặt `status: "approved"`.
       - Nếu không đạt sau 2 lần sửa: giữ `draft` và ghi lỗi vào báo cáo.
   - Các map còn thiếu tiếp theo vượt quá trần 3 map được ghi nhận vào báo cáo phiên để tiếp tục xử lý ở lần chạy sau.
3. Với các map đã có sẵn:
   - Nếu `status === "approved"`: tái sử dụng, không sinh lại.
   - Nếu `status === "draft"` có sẵn: coordinator không tự duyệt và báo giữ lại.

### Bước 3: Quản lý Backlog và Xếp hạng Đề xuất
Kiểm tra xem trong `.course-plan/backlog.json` đã có đề xuất nào có `status === "chosen"` mà khóa đó chưa vào sản xuất (`produced`) hay chưa.
Nếu đã có đề xuất `chosen`: tiếp tục với đề xuất đó, không cần chọn lại.
Nếu chưa có:
1. Xác định các ô sẵn sàng trong các map focus (thỏa điều kiện: `ref` null, `coverage` ≠ covered, mọi ô requires đã covered hoặc có đề xuất chosen/produced). Map nào có < 3 ô sẵn sàng liên tiếp thì không đề xuất cho map đó.
2. Kiểm tra các đề xuất `open` trong `backlog.json`:
   - Tối đa 2 đề xuất `open` cho mỗi map.
   - Khi có ≥3 map focus có ô sẵn sàng, các đề xuất `open` phải trải trên ít nhất 3 map khác nhau.
   - Nếu thiếu đề xuất `open`: Chạy role `roles/00-shortlist.md` để nghiên cứu và bổ sung các đề xuất mới gom 3–7 ô (`path_nodes: { path, nodes }`, `modules: [...]`) vào `proposals` với `status: "open"`, `added_on: "<YYYY-MM-DD>"`, `decided_on: null`, `reject_reason: null`.
3. Chạy kiểm tra lint cho backlog và map:
   ```bash
   node .claude/skills/course-planner/scripts/plan-lint.mjs .
   ```
4. Chạy kiểm tra URL bằng chứng:
   ```bash
   node .claude/skills/course-planner/scripts/evidence-check.mjs .course-plan/backlog.json
   ```
5. Chạy script xếp hạng:
   ```bash
   node .claude/skills/course-planner/scripts/rank.mjs .course-plan/backlog.json --table
   ```
   Script xếp hạng theo thứ tự: layer thấp nhất của khóa → độ sâu requires → tiêu chí cũ để phá hòa. Bảng hiển thị cột Map và Modules. Bảng tổng quan map được in cho từng map focus.
6. **Trình Human và DỪNG:**
   Trình bày cho Human gồm đúng output của `rank.mjs --table`.
   - Nếu có map có < 3 ô sẵn sàng: script in cảnh báo trong tổng quan.
   - Bên dưới bảng chỉ nêu khuyến nghị là dòng rank 1 và các cảnh báo của script.
   **DỪNG LẠI TẠI ĐÂY:** Chờ Human chọn một dòng trong bảng xếp hạng (mỗi lần chạy dừng đúng một lần).

### Bước 4: Tiếp nhận Lựa chọn của Human
Sau khi Human phản hồi và chốt một dòng:
1. Coordinator cập nhật vào `.course-plan/backlog.json`:
   - Dòng Human chọn: đặt `status: "chosen"` và `decided_on: "<YYYY-MM-DD>"`.
   - Dòng Human loại kèm lý do: đặt `status: "rejected"`, `reject_reason: "<lý do>"`, và `decided_on: "<YYYY-MM-DD>"`.
   - Các dòng Human không nhắc tới: giữ nguyên `status: "open"`, không bị loại hàng loạt.

### Bước 5: Đánh giá Candidate Sẵn sàng
Gọi role `roles/02-candidate.md` để tạo/cập nhật evaluation cho khóa đã chọn:
- Bổ sung đầy đủ `promise`, `final_product`, `differentiation`, `corelia_hook`, `modules` vào handoff.
- Chạy `evidence-check.mjs` kiểm tra các URL bằng chứng trong evaluation. Nếu có URL lỗi, role sửa lại tối đa 2 lần.

### Bước 6: Tính toán Quyết định (`next.mjs --only <slug>`)
Chạy script quyết định giới hạn vào khóa đã chọn:
```bash
node .claude/skills/course-planner/scripts/next.mjs --write --only <slug>
```
Script kiểm tra các Gate:
1. Đề xuất có status `"chosen"`.
2. Có `path_nodes` trỏ tới map `approved`, toàn bộ các ô tồn tại trong map, chưa covered và không có ref.
3. Mọi ô trong `requires` của các ô đó thỏa mãn (nằm trong chính khóa hoặc đã thỏa theo `isNodeSatisfied`).
4. `catalog.verdict` là `new`.
5. `feasibility.verdict` khác `not_feasible` (không loại đề xuất vì thiếu công cụ cài đặt).
6. `handoff` đủ `title`, `audience`, `level`, `scope_note`. Evaluation không bị hết hạn bởi khóa mới trong catalog.

Xử lý kết quả:
- Nếu `pick` khác khóa đã chọn hoặc rỗng: chạy lại role `02-candidate.md` một lần; nếu vẫn không được pick thì DỪNG, ghi báo cáo `.course-runs/<slug>/run-report.md` với lý do của `next.mjs`, không ghi handoff.
- Nếu `pick` đúng khóa đã chọn: cập nhật `user_decision: "picked_from_shortlist"` trong file decision.

### Bước 7: Bàn giao và Kích hoạt Course Author (AC-07)
1. Ghi file hợp đồng `.course-runs/<slug>/handoff.json` từ evaluation. Gói `handoff.json` chứa:
   - `modules` (nguyên văn);
   - `mental_models` = các `mechanism` từ `modules`;
   - `misconceptions` = gộp các `pitfalls` từ `modules` (loại bỏ trùng lặp);
   - `reasoning_outcomes` = các `outcome` từ `modules`.
2. Gọi skill `course-author` để bắt đầu sản xuất nội dung khóa học cho slug đó.
   - Đối với khóa có `kind: "complete_existing"`: chạy tới hết bước sản xuất file, không nhập DB, báo cáo nêu rõ lý do.
3. Sau khi `course-author` hoàn thành hoặc dừng, ghi báo cáo tổng hợp cuối phiên tại `.course-runs/<slug>/run-report.md`.
4. **Cập nhật trạng thái Backlog và Skill Map (AC-08 & AC-06)**:
   - Sau khi `course-author` import local thành công, coordinator:
     - Đặt `status: "produced"` và `decided_on: "<YYYY-MM-DD>"` cho đề xuất trong `.course-plan/backlog.json`.
     - Cập nhật toàn bộ các ô trong `path_nodes.nodes` của map: đặt `course_slug` = slug khóa vừa sản xuất và `coverage: "covered"`.
   - Nếu import dừng hoặc khóa bị loại sau review thì đặt `status: "rejected"` kèm `reject_reason` và `decided_on`.

---

## Xử lý khi User Đưa Chủ đề Cụ thể

Khi người dùng chủ động đưa vào một chủ đề hoặc tên khóa, coordinator đối chiếu với catalog và skill map hiện có, rồi xử lý theo một trong các trường hợp:

1. **Khớp với một nhóm 3–7 ô có sẵn trong map approved:**
   Ánh xạ chủ đề vào các ô đó, tiến hành đánh giá qua gate và chạy `next.mjs` như mọi candidate.
2. **Không có ô nào phù hợp trong map:**
   Đề xuất bổ sung các ô mới vào map với đầy đủ layer, requires, mental_model, concepts, app_use, pitfalls; kiểm tra tự động qua lint và evidence-check trước khi tiến hành.
3. **Đã được catalog đáp ứng:**
   Chỉ ra khóa học hoặc bài học cụ thể trong catalog hiện tại (`catalog.json`) đã phủ nội dung này.
4. **Cần cập nhật khóa có sẵn:**
   Chỉ ra khóa hiện có cần bổ sung hoặc sửa đổi, đưa vào danh sách `updates`.

---

## Bảng Model cho Subagents

Coordinator chạy bằng model của session, không dừng, không báo trước; ghi tên model coordinator vào `run-log.jsonl` và `run-report.md`. Session chạy skill này dùng `sonnet` (`terra`) với effort `low`; không dùng `haiku` (`luna`) cho coordinator.
