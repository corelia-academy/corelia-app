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

- `.course-plan/paths/<path-slug>.json`: Lộ trình học (do role `01-path.md` dựng nháp, người dùng duyệt và đặt `priority`).
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

### Bước 2: Lint Paths
Chạy script kiểm tra toàn vẹn path:
```bash
node .claude/skills/course-planner/scripts/plan-lint.mjs
```
Script kiểm tra schema của mọi path trong `.course-plan/paths/`, xác minh mọi `requires.slug` tồn tại, `reason` không rỗng và kiểm tra không có chu trình phụ thuộc. Nếu phát hiện chu trình, script in đủ các cạnh và thoát mã khác 0; coordinator dừng lại và không đưa ra lựa chọn (`pick`).

### Bước 3: Xác định Candidate
- Đọc các path có `status: "approved"`. (Path ở trạng thái `draft` tuyệt đối không sinh candidate).
- Nếu chưa có path nào `approved`, hoặc không path nào còn ô sẵn sàng:
  Chuyển sang chạy role `roles/01-path.md` để dựng hoặc cập nhật path nháp, trình cho user duyệt và đặt `priority`. Trong lượt này không chọn khóa.
- Lọc ra các ô khóa có `state` chưa phải `in_production`, `produced` hoặc `in_catalog`.

### Bước 4: Gọi Child Đánh giá Candidate Sẵn sàng
Chỉ gọi child đánh giá cho các candidate SẴN SÀNG (tất cả `requires` đã đạt `produced` hoặc `in_catalog` trong `catalog.json`). Các khóa chưa đủ tiên quyết (`blocked`) không gọi child đánh giá ở lượt này.
Với mỗi candidate sẵn sàng:
- Nếu chưa có file `.course-plan/evaluations/<slug>.json`, hoặc file evaluation có thời gian sửa đổi cũ hơn file path chứa nó:
  Gọi child với role `roles/02-candidate.md` để tạo/cập nhật evaluation.
- Child đối chiếu khả năng kiểm outcome với `.claude/skills/course-author/references/platform.md` và catalog hiện tại (ghi mảng `catalog_courses` gồm các slug đang `produced` hoặc `in_catalog` để phát hiện hết hạn khi catalog có khóa mới).

### Bước 5: Tính toán Quyết định (`next.mjs`)
Chạy script quyết định:
```bash
node .claude/skills/course-planner/scripts/next.mjs --write
```
Script kiểm tra 5 Gate:
1. Thuộc ít nhất một path `approved`.
2. Path có ít nhất một evidence `direct`, hoặc khóa có `foundation_basis` trỏ tới khóa đích thuộc path có evidence `direct`.
3. `catalog.verdict` là `new`.
4. `feasibility.verdict` khác `not_feasible`.
5. `handoff` đủ `title`, `audience`, `level`, `scope_note`. Evaluation không bị hết hạn bởi khóa mới trong catalog.

Và phân loại:
- `update_existing` -> đưa vào `updates`.
- `covered` -> đưa vào `rejected`.
- Thiếu evaluation, thiếu evidence hoặc thiếu trường bắt buộc -> đưa vào `needs_research`.
- Khóa chưa đủ điều kiện tiên quyết (`requires` chưa `produced` hoặc `in_catalog`) -> đưa vào `blocked` kèm khóa chặn.
- Các khóa thỏa mãn tất cả và đủ điều kiện tiên quyết -> `sẵn sàng` (ready).

Thứ tự ưu tiên: `priority` path cao nhất (số nhỏ hơn) -> topo theo `requires` -> `suggested_order` -> `slug`.
Nếu hai path cùng `priority` đều có khóa đứng đầu sẵn sàng: trả `pick: null`, `tie: [...]`.

### Bước 6: Báo cáo và Chờ Quyết định của User
Trình bày kết quả có cấu trúc:
- Khóa được đề xuất (`pick`) kèm căn cứ và lộ trình kế tiếp (`queue`).
- Các khóa bị chặn (`blocked`) và khóa chặn.
- Các khóa cần cập nhật (`updates`).
- Các khóa cần nghiên cứu thêm (`needs_research`).
- Các khóa bị từ chối (`rejected`) kèm lý do.
- Nếu có `tie`: nêu rõ các path hòa điểm và xin ý kiến user lựa chọn.

### Bước 7: Lưu Quyết định và Chuẩn bị Handoff
Sau khi user phản hồi và chốt:
1. Cập nhật trường `user_decision` vào file quyết định trong `.course-plan/decisions/`.
2. Nếu user đồng ý tạo khóa `pick`:
   Tạo thư mục `.course-runs/<slug>/` và ghi file `.course-runs/<slug>/handoff.json` lấy từ mục `handoff` trong evaluation tương ứng:
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
