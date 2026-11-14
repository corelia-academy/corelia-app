---
name: course-planner
description: Xác định khóa học nào nên tạo tiếp theo trong Corelia và lộ trình các khóa kế tiếp trong cùng path. Chạy trước course-author, dựa trên bằng chứng thị trường, catalog hiện có và ma trận tiên quyết.
---

# Course Planner

Bạn là coordinator của skill `course-planner`. Skill này chạy trước `course-author` để trả lời hai câu hỏi:
1. Khóa học nào nên tạo tiếp theo?
2. Các khóa kế tiếp trong cùng lộ trình (path) là gì?

Kết quả phải lặp lại được, giải thích được, tách bạch rõ ràng giữa bằng chứng trực tiếp (`direct`), suy luận (`inferred`) và phần dữ liệu còn thiếu (`missing`).

Skill không ghi cơ sở dữ liệu và không import khóa học lên hệ thống.

---

## Dữ liệu và Hợp đồng

Tất cả dữ liệu được lưu trong thư mục `.course-plan/` ở gốc repo:

- `.course-plan/shortlists/<YYYY-MM-DD>-<n>.json`: Danh sách đề xuất khóa học rút gọn (do role `00-shortlist.md` tạo, script `rank.mjs` xếp hạng).
- `.course-plan/paths/<path-slug>.json`: Lộ trình học dựng quanh khóa đã chốt từ shortlist (do role `01-path.md` dựng, coordinator đặt `status: "approved"`). Path có `origin` hợp lệ không bắt buộc trường `priority`.
- `.course-plan/catalog.json`: Bản chụp catalog hiện có (sinh bởi `scripts/catalog-snapshot.mjs`, không sửa tay).
- `.course-plan/evaluations/<slug>.json`: Đánh giá chi tiết từng ứng viên khóa học (do role `02-candidate.md` lập).
- `.course-plan/decisions/<YYYY-MM-DD>-<n>.json`: Nhật ký quyết định của từng phiên chạy `scripts/next.mjs`.

---

## Trình tự Điều phối (Coordinator Workflow)

Coordinator thực hiện tuần tự các bước sau. Một lần chạy chỉ có một điểm Human duy nhất: chọn một dòng trong bảng xếp hạng ở Bước 2. Sau đó coordinator tự động thực hiện liên tục các bước tiếp theo mà không dừng giữa chừng khi có handoff.

### Bước 1: Snapshot Catalog
Chạy script chụp snapshot:
```bash
node .claude/skills/course-planner/scripts/catalog-snapshot.mjs
```
Script quét toàn bộ thư mục `.course-runs/*/` và file export tùy chọn `.course-plan/catalog-export.json` để cập nhật `.course-plan/catalog.json`.

### Bước 2: Lập Shortlist và Xếp hạng Đề xuất
Kiểm tra xem đã có file shortlist nào trong `.course-plan/shortlists/` có `chosen_slug` mà khóa đó chưa vào sản xuất hay chưa.
Nếu chưa có:
1. Chạy role `roles/00-shortlist.md` để nghiên cứu, đọc `docs/learn/learn-proposal.md`, catalog hiện tại và lập 4–6 đề xuất khóa học thuộc ít nhất 3 hướng nội dung khác nhau, lưu vào `.course-plan/shortlists/<YYYY-MM-DD>-<n>.json`. Mỗi đề xuất khai báo `tools: string[]` là các công cụ cần có trên máy để kiểm chứng ví dụ. (Nếu Human đưa chủ đề cụ thể: chủ đề đó trở thành một dòng trong shortlist, đủ trường và được xếp hạng như các dòng khác).
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
   Script tự động kiểm tra sự tồn tại của các công cụ (`tools`) trên máy. Cột Ghi chú nêu công cụ thiếu (thiếu công cụ không làm thay đổi rank).
5. **Trình Human và DỪNG:**
   Trình bày đúng bảng Markdown do `rank.mjs --table` in ra (không tự viết lại, không thêm bớt cột). Bên dưới bảng chỉ nêu khuyến nghị là dòng rank 1 và các cảnh báo của script.
   **DỪNG LẠI TẠI ĐÂY (Điểm Human duy nhất):** Chờ Human chọn một dòng trong bảng xếp hạng.

### Bước 3: Tiếp nhận Lựa chọn của Human
Sau khi Human phản hồi và chốt một dòng:
1. Coordinator cập nhật vào file shortlist:
   - `chosen_slug`: slug của khóa Human chọn.
   - `rejected`: danh sách các slug bị loại kèm lý do Human nêu nếu có.
2. Nếu Human không chốt dòng nào: ghi `rejected` cho tất cả, lượt sau sinh shortlist mới và không lặp lại các slug đã bị loại.

### Bước 4: Tự động Dựng Path Quanh Khóa Đã Chọn
1. Gọi role `roles/01-path.md` để dựng path quanh khóa đã chọn: chuỗi tiên quyết và tối đa 2 khóa kế tiếp. Path bắt buộc có trường `origin: { "shortlist": "<đường-dẫn-shortlist>", "pitch_slug": "<slug-đã-chọn>" }`. Coordinator đặt `status: "approved"`. Path có `origin` hợp lệ không cần `priority`.
2. Chạy `plan-lint.mjs` kiểm tra path.

### Bước 5: Đánh giá Candidate Sẵn sàng
Gọi role `roles/02-candidate.md` để tạo/cập nhật evaluation cho khóa đã chọn:
- Bổ sung đầy đủ `promise`, `final_product`, `differentiation`, `corelia_hook` vào handoff.
- Chạy `evidence-check.mjs` kiểm tra các URL bằng chứng trong evaluation. Nếu có URL lỗi, role sửa lại tối đa 2 lần.

### Bước 6: Tính toán Quyết định (`next.mjs --only <slug>`)
Chạy script quyết định giới hạn vào khóa đã chọn:
```bash
node .claude/skills/course-planner/scripts/next.mjs --write --only <slug>
```
Script kiểm tra 6 Gate:
1. Thuộc ít nhất một path `approved`.
2. Path có ít nhất một evidence `direct`, hoặc khóa có `foundation_basis` trỏ tới khóa đích thuộc path có evidence `direct`.
3. `catalog.verdict` là `new`.
4. `feasibility.verdict` khác `not_feasible`.
5. `handoff` đủ `title`, `audience`, `level`, `scope_note`. Evaluation không bị hết hạn bởi khóa mới trong catalog.
6. Path của ứng viên có `origin` trỏ tới một shortlist tồn tại, trong đó `chosen_slug` bằng `origin.pitch_slug`.

Xử lý kết quả:
- Nếu `pick` khác khóa đã chọn hoặc rỗng: chạy lại role `02-candidate.md` một lần; nếu vẫn không được pick thì DỪNG, ghi báo cáo `.course-runs/<slug>/run-report.md` với lý do của `next.mjs`, không ghi handoff.
- Nếu `pick` đúng khóa đã chọn: cập nhật `user_decision: "picked_from_shortlist"` trong file decision.

### Bước 7: Bàn giao và Kích hoạt Course Author
1. Ghi file hợp đồng `.course-runs/<slug>/handoff.json` từ mục `handoff` trong evaluation.
2. Gọi skill `course-author` để bắt đầu sản xuất nội dung khóa học cho slug đó.
   - Đối với khóa có `kind: "complete_existing"`: chạy tới hết bước sản xuất file, không nhập DB, báo cáo nêu rõ lý do (pipeline chỉ tạo khóa mới; import dừng khi khóa tồn tại).
3. Sau khi `course-author` hoàn thành hoặc dừng, ghi báo cáo tổng hợp cuối phiên tại `.course-runs/<slug>/run-report.md` và in ra cùng nội dung.

---

## Xử lý khi User Đưa Chủ đề Cụ thể

Khi người dùng chủ động đưa vào một chủ đề hoặc tên khóa, coordinator đối chiếu với catalog và các path hiện có, rồi trả lời theo một trong năm trường hợp:

1. **Khớp ô có sẵn trong path approved:**
   Chỉ ra path và ô khóa tương ứng. Tiến hành đánh giá qua gate và chạy `next.mjs` như mọi candidate.
2. **Đề xuất ô mới trong một path đã có:**
   Chỉ ra path phù hợp, cập nhật path đó và đi tiếp qua quy trình candidate thông thường.
3. **Đã được catalog đáp ứng:**
   Chỉ ra khóa học hoặc bài học cụ thể trong catalog hiện tại (`catalog.json`) đã phủ nội dung này.
4. **Cần cập nhật khóa có sẵn:**
   Chỉ ra khóa hiện có cần bổ sung hoặc sửa đổi, đưa vào danh sách `updates`.
5. **Chưa có path phù hợp:**
   Giải thích lý do chưa có lộ trình tương thích, đề xuất chạy role `01-path.md` để dựng một path mới.

Chủ đề do user đưa vào TUYỆT ĐỐI không được bỏ qua 5 Gate.

---

## Bảng Model cho Subagents

Coordinator tuân thủ quy ước đặt Model như sau:

| Vai trò | Model | Ghi chú |
|---|---|---|
| Coordinator (`course-planner`) | Model của session | Điều phối, chạy script, tổng hợp |
| Role 1: Dựng path (`roles/01-path.md`) | `sonnet` | Yêu cầu web research và đọc trang thật |
| Role 2: Đánh giá candidate (`roles/02-candidate.md`) | `sonnet` | Đối chiếu platform và thẩm định outcome |
