# Bàn giao khóa Web3 Foundations

Cập nhật: 2026-11-07. Tác vụ đã dừng theo yêu cầu; không tiếp tục sinh nội dung sau khi tạo handoff này.

## Phạm vi hiện tại

- Chỉ chạy khóa **Web3 Foundations: Networks, Wallets, and dApps**.
- Bản gốc tiếng Anh; chỉ tạo locale tiếng Việt cho run này.
- User đã cho phép publish **trong app local** để xem. Không publish staging/production, push, merge hoặc deploy.
- User yêu cầu dừng tại trạng thái hiện tại để bàn giao. Khóa chưa được publish local.

## Định danh và trạng thái

| Mục | Giá trị |
|---|---|
| `course_id` | `b63eae7d-ab52-4852-b3f6-69a320dd78da` |
| `run_id` | `3711e06f-5f4c-40aa-b5ce-2ff82c4d9dad` |
| Web3 path | `4f2f0409-3cfa-4a59-9027-e6d19e8c165f` |
| Run state | `running`, đã pause; `paused_at=2026-11-07T02:59:38.268078Z` |
| Current step | `translate` pending |
| Publish step | pending |
| Course row | `studio_courses.status=generating`, `research_status=evidence_ok` |

Local Supabase services, Edge Functions, and the loopback MCP proxy at `127.0.0.1:8791` remain running for a future continuation. No key or bearer token was written to the handoff or report.

DB trực tiếp xác nhận run đã pause, 19 bài tiếng Anh được chấp nhận, 19 review A6 hoàn tất, `structure_check` và `journey_test` đều done. A4 curriculum review pass với 0 findings.

## Bản dịch đang dang dở

Có 20 đơn vị cần dịch theo scope VI-only: thông tin khóa + 19 bài. Đến lúc dừng, 11/20 đã accepted: thông tin khóa và 10 bài. Tất cả generation dịch hiện có đều locale `vi`; không có generation locale khác và không có bản dịch bị reject.

Generation đang chờ:

- ID: `ffaeb8f1-fbfd-43fe-a320-34738fd7aea0`
- Locale: `vi`
- Bài: `m3-independent`
- Trạng thái DB: `submitting`, attempt 0; chưa có output được nộp.

Tám đơn vị chưa được tạo bản dịch:

`calculate-claim-fee`, `final-check`, `interpret-claim-status`, `m4-independent`, `m4-quick-check`, `m5-independent`, `m5-quick-check`, `verify-the-pass-request`.

## Blocker giữa VI-only và publish local

`publish.ts` hiện duyệt đủ sáu locale dịch (`zh-CN`, `ko`, `es`, `zh-TW`, `vi`, `ja`) và từ chối khi thiếu locale đầu tiên; payload cũng khai báo cả bảy locale gồm English. Vì vậy run VI-only hiện tại **không thể publish local theo code hiện hành**. Chưa gọi bước publish nên đây là blocker được xác nhận từ source, chưa phải lỗi runtime đã reproduce. Cần thay đổi run-scoped để payload chỉ chứa `en` và `vi`, giữ default app không đổi; sau đó test publish local rồi hoàn nguyên override tạm. Tham chiếu: `supabase/functions/corelia-api/studio/publish.ts:37`, `:123-126`, `:168-180`.

## Catalog ranking

- Catalog research job gần nhất: `fdff555b-ea9e-4750-bb5b-3ae666bb1e82`, trạng thái `evidence_ok`, chạy ngày 2026-11-06.
- Local `studio_catalog_rankings` và `studio_catalog_scores` hiện chưa có dòng nào; chưa có total, confidence hoặc rank cho khóa này.
- Sau khi publish local, user yêu cầu research lại rồi rerank. Backend có admin operation `studio.catalog_research` và `studio.catalog_rerank`; chúng hiện không được expose thành tool trong local `studio-mcp`. `studio.catalog_rerank` tạo ranking pass cho catalog, không chỉ khóa này.

## Lỗi gặp và xử lý

- Hai lần `studio_get_next_task` báo `path not found` khi đọc `supabase/functions/corelia-api/og/assets/resvg.wasm`. File có trên host/container và `supabase/config.toml` đã khai báo static assets. Sau Edge Runtime hot-reload, retry hoàn tất `structure_check`; chưa đủ chứng cứ quy lỗi cho source code.
- Script điều phối VI đầu tiên dừng do lỗi cú pháp PowerShell tại `$i:` trước khi gọi MCP; sửa delimiter rồi chạy tiếp. Lần lỗi này không ghi generation vào DB.
- Đã có các rejection/retry A5/A6 trước đó; chúng được giữ nguyên và chi tiết nằm trong `2026-11-07-codex-studio-three-course-e2e.md`. Trạng thái cuối cùng hiện tại vẫn là 19/19 bài và 19/19 review được chấp nhận.

## Thay đổi tạm đã hoàn nguyên

Trong lúc chạy đã tạm đặt `TRANSLATION_LOCALES=["vi"]` và giới hạn MCP tối đa một workflow tick mỗi `studio_get_next_task` call. Cả hai đã được trả về mặc định trước khi bàn giao: sáu locale dịch và giới hạn 12 tick. Vì vậy **không được continue run trước khi có lại cơ chế VI-only**, nếu không Studio có thể tạo các locale khác.

## Bước tiếp theo khi user cho tiếp tục

1. Giữ run pause đến khi có run-scoped VI-only và publish payload `en` + `vi`; tránh thay đổi default cho các run khác.
2. Dùng `studio_continue_run`, xử lý generation `ffaeb8f1-fbfd-43fe-a320-34738fd7aea0` trước, rồi tạo và submit tám bài còn thiếu bằng Codex CLI qua local Studio MCP.
3. Kiểm tra DB chỉ có locale `vi`; hoàn tất translate aggregation và xác nhận `translate=done`.
4. Publish khóa vào app local theo payload `en` + `vi`; xác nhận các bảng app local có khóa và 19 bài. Không dùng staging/production.
5. Khởi chạy catalog research mới bằng admin operation local `studio.catalog_research`, hoàn tất A1, rồi chạy `studio.catalog_rerank`. Xác minh score, confidence, rank và ranking pass mới trong DB.
6. Hoàn nguyên mọi override tạm; cập nhật report và handoff bằng kết quả thực tế.
