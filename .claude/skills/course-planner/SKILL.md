---
name: course-planner
description: Xác định khóa học nào nên tạo tiếp theo trong Corelia và lộ trình các khóa kế tiếp trong cùng path. Chạy trước course-author, dựa trên bằng chứng thị trường, catalog hiện có và ma trận tiên quyết.
---

# Course Planner

Bạn là coordinator của skill `course-planner`. Skill này chạy trước `course-author` để trả lời hai câu hỏi:
1. Khóa học nào nên tạo tiếp theo?
2. Các khóa kế tiếp trong cùng lộ trình (path) là gì?

Kết quả phải lặp lại được, giải thích được, tách bạch rõ ràng giữa bằng chứng trực tiếp (`direct`), suy luận (`inferred`) và phần dữ liệu còn thiếu (`missing`).

Skill không tự động gọi `course-author`, không ghi cơ sở dữ liệu và không import khóa học lên hệ thống.

---

## Dữ liệu và Hợp đồng

Tất cả dữ liệu được lưu trong thư mục `.course-plan/` ở gốc repo:

- `.course-plan/shortlists/<YYYY-MM-DD>-<n>.json`: Danh sách đề xuất khóa học rút gọn (do role `00-shortlist.md` tạo, script `rank.mjs` xếp hạng).
- `.course-plan/paths/<path-slug>.json`: Lộ trình học dựng quanh khóa đã chốt từ shortlist (do role `01-path.md` dựng nháp, Human duyệt và đặt `priority`).
- `.course-plan/catalog.json`: Bản chụp catalog hiện có (sinh bởi `scripts/catalog-snapshot.mjs`, không sửa tay).
- `.course-plan/evaluations/<slug>.json`: Đánh giá chi tiết từng ứng viên khóa học (do role `02-candidate.md` lập).
- `.course-plan/decisions/<YYYY-MM-DD>-<n>.json`: Nhật ký quyết định của từng phiên chạy `scripts/next.mjs`.

---

## Trình tự Điều phối (Coordinator Workflow)

Coordinator thực hiện tuần tự các bước sau:

### Bước 1: Snapshot Catalog
Chạy script chụp snapshot:
```bash
node .claude/skills/course-planner/scripts/catalog-snapshot.mjs
```
Script quét toàn bộ thư mục `.course-runs/*/` và file export tùy chọn `.course-plan/catalog-export.json` để cập nhật `.course-plan/catalog.json`.

### Bước 2: Lập Shortlist và Xếp hạng Đề xuất
Kiểm tra xem đã có file shortlist nào trong `.course-plan/shortlists/` có `chosen_slug` mà khóa đó chưa vào sản xuất hay chưa.
Nếu chưa có:
1. Chạy role `roles/00-shortlist.md` để nghiên cứu, đọc `docs/learn/learn-proposal.md`, catalog hiện tại và lập 4–6 đề xuất khóa học thuộc ít nhất 3 hướng nội dung khác nhau, lưu vào `.course-plan/shortlists/<YYYY-MM-DD>-<n>.json`. (Nếu Human đưa chủ đề cụ thể: chủ đề đó trở thành một dòng trong shortlist, đủ trường và được xếp hạng như các dòng khác).
2. Chạy kiểm tra lint cho shortlist:
   ```bash
   node .claude/skills/course-planner/scripts/plan-lint.mjs .course-plan/shortlists/<file>.json
   ```
3. Chạy kiểm tra URL bằng chứng:
   ```bash
   node .claude/skills/course-planner/scripts/evidence-check.mjs .course-plan/shortlists/<file>.json
   ```
   Nếu có URL lỗi không trả 2xx, yêu cầu role sửa lại; không trình Human khi còn lỗi URL.
4. Chạy script xếp hạng:
   ```bash
   node .claude/skills/course-planner/scripts/rank.mjs .course-plan/shortlists/<file>.json --table
   ```
5. **Trình Human và DỪNG:**
   Trình bày đúng bảng Markdown do `rank.mjs --table` in ra (không tự viết lại, không thêm bớt cột). Bên dưới bảng chỉ nêu khuyến nghị là dòng rank 1 và các cảnh báo của script.
   **DỪNG LẠI TẠI ĐÂY:** Tuyệt đối không dựng path, không đánh giá candidate, không ghi handoff trong lượt này khi Human chưa chốt khóa.

### Bước 3: Tiếp nhận Lựa chọn của Human
Sau khi Human phản hồi và chốt một dòng (không bắt buộc là dòng rank 1):
1. Coordinator cập nhật vào file shortlist:
   - `chosen_slug`: slug của khóa Human chọn.
   - `user_quote`: nguyên văn câu chốt của Human.
   - `rejected`: danh sách các slug bị loại kèm lý do Human nêu nếu có.
2. Nếu Human không chốt dòng nào: ghi `rejected` cho tất cả, lượt sau sinh shortlist mới và không lặp lại các slug đã bị loại.

### Bước 4: Dựng Path Quanh Khóa Đã Chốt
1. Gọi child với role `roles/01-path.md` để dựng path ở trạng thái `draft` quanh khóa đã chốt: chuỗi tiên quyết và tối đa 2 khóa kế tiếp. Path bắt buộc có trường `origin: { "shortlist": "<đường-dẫn-shortlist>", "pitch_slug": "<slug-đã-chốt>" }`.
2. Chạy `plan-lint.mjs` kiểm tra path.
3. Trình Human duyệt path chuyển sang `status: "approved"` và đặt `priority`. (Path ở trạng thái `draft` tuyệt đối không sinh candidate).

### Bước 5: Gọi Child Đánh giá Candidate Sẵn sàng
Chỉ gọi child đánh giá cho các candidate SẴN SÀNG (tất cả `requires` đã đạt trong `catalog.json`). Các khóa chưa đủ tiên quyết (`blocked`) không gọi child đánh giá ở lượt này.
Với mỗi candidate sẵn sàng:
- Nếu chưa có file `.course-plan/evaluations/<slug>.json`, hoặc file evaluation cũ hơn file path chứa nó:
  Gọi child với role `roles/02-candidate.md` để tạo/cập nhật evaluation (bổ sung đầy đủ `promise`, `final_product`, `differentiation`, `corelia_hook` vào handoff).
- Chạy `evidence-check.mjs` kiểm tra các URL bằng chứng trong evaluation. Còn lỗi thì yêu cầu sửa, không trình Human.

### Bước 6: Tính toán Quyết định (`next.mjs`)
Chạy script quyết định:
```bash
node .claude/skills/course-planner/scripts/next.mjs --write
```
Script kiểm tra 6 Gate:
1. Thuộc ít nhất một path `approved`.
2. Path có ít nhất một evidence `direct`, hoặc khóa có `foundation_basis` trỏ tới khóa đích thuộc path có evidence `direct`.
3. `catalog.verdict` là `new`.
4. `feasibility.verdict` khác `not_feasible`.
5. `handoff` đủ `title`, `audience`, `level`, `scope_note`. Evaluation không bị hết hạn bởi khóa mới trong catalog.
6. Path của ứng viên có `origin` trỏ tới một shortlist tồn tại, trong đó `chosen_slug` bằng `origin.pitch_slug` và `user_quote` khác rỗng.

Phân loại:
- `update_existing` -> đưa vào `updates`.
- `covered` -> đưa vào `rejected`.
- Vi phạm gate -> đưa vào `needs_research`.
- Tiên quyết chưa đạt (`content_state` là `empty` hoặc chưa có trong catalog) -> đưa vào `blocked` kèm khóa chặn. Tiên quyết `unknown` coi là đạt kèm cảnh báo.
- Các khóa thỏa mãn tất cả và đủ điều kiện tiên quyết -> `sẵn sàng` (ready).

### Bước 7: Báo cáo và Chuẩn bị Handoff
Trình bày kết quả có cấu trúc:
- Khóa được đề xuất (`pick`) kèm căn cứ và lộ trình kế tiếp (`queue`).
- Các khóa bị chặn (`blocked`) và khóa chặn.
- Các khóa cần cập nhật (`updates`).
- Các khóa cần nghiên cứu thêm (`needs_research`).
- Các khóa bị từ chối (`rejected`) kèm lý do.

Sau khi user đồng ý tạo khóa `pick`:
Tạo thư mục `.course-runs/<slug>/` và ghi file `.course-runs/<slug>/handoff.json` lấy từ mục `handoff` trong evaluation tương ứng (bao gồm `promise`, `final_product`, `differentiation`, `corelia_hook`).
   ```json
   {
     "slug": "<slug>",
     "title": "<title>",
     "topic": "<topic>",
     "audience": "<audience>",
     "level": "<level>",
     "scope_note": "<scope_note>",
     "path": "<path-slug>",
     "is_foundation": false,
     "prerequisite_courses": [".course-runs/<prereq-slug>"]
   }
   ```
   Thông báo cho user rằng handoff đã sẵn sàng để gọi `course-author`.

---

## Xử lý khi User Đưa Chủ đề Cụ thể

Khi người dùng chủ động đưa vào một chủ đề hoặc tên khóa, coordinator đối chiếu với catalog và các path hiện có, rồi trả lời theo một trong năm trường hợp:

1. **Khớp ô có sẵn trong path approved:**
   Chỉ ra path và ô khóa tương ứng. Tiến hành đánh giá qua gate và chạy `next.mjs` như mọi candidate.
2. **Đề xuất ô mới trong một path đã có:**
   Chỉ ra path phù hợp, soạn bản cập nhật nháp cho path đó và xin user duyệt sửa path. Sau khi user duyệt, ô mới đi tiếp qua quy trình candidate thông thường.
3. **Đã được catalog đáp ứng:**
   Chỉ ra khóa học hoặc bài học cụ thể trong catalog hiện tại (`catalog.json`) đã phủ nội dung này.
4. **Cần cập nhật khóa có sẵn:**
   Chỉ ra khóa hiện có cần bổ sung hoặc sửa đổi, đưa vào danh sách `updates`.
5. **Chưa có path phù hợp:**
   Giải thích lý do chưa có lộ trình tương thích, đề xuất chạy role `01-path.md` để dựng một path mới ở trạng thái `draft`.

Chủ đề do user đưa vào TUYỆT ĐỐI không được bỏ qua 5 Gate.

---

## Bảng Model cho Subagents

Coordinator tuân thủ quy ước đặt Model như sau:

| Vai trò | Model | Ghi chú |
|---|---|---|
| Coordinator (`course-planner`) | Model của session | Điều phối, chạy script, tổng hợp |
| Role 1: Dựng path (`roles/01-path.md`) | `sonnet` | Yêu cầu web research và đọc trang thật |
| Role 2: Đánh giá candidate (`roles/02-candidate.md`) | `sonnet` | Đối chiếu platform và thẩm định outcome |
