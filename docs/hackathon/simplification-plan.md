# Data contract và migration

## Hackathon document

Các field dùng chung giữa locale:

- `slug`, `mode`, `host`, `social_links`
- `registration_deadline`, `submission_deadline`, `starts_at`, `ends_at`
- prize `amount`, `currency`
- taxonomy ID, `active`, `sort_order`
- timeline ID/timestamps/order
- `winner_awards[].project_id` và order

Các field localize qua `hackathon_locales`:

- `title`, `short_description`
- `description_markdown`, `resources_markdown`
- prize description
- track/sector/tech-stack name và description
- timeline title và Markdown description

Primary locale mặc định là VI; EN có draft độc lập.

## Project contract

`projects` thêm:

- `slug`
- `hackathon_track_ids[]`
- `hackathon_sector_ids[]`
- `hackathon_tech_stack_ids[]`

`hackathon_submissions.project_id` trỏ tới project canonical. Submission giữ quan hệ hackathon và snapshot nộp; project giữ nội dung/media.

`project_slug_history` bảo toàn redirect và ngăn tái sử dụng slug cũ.

## Migration tiến tới

Migration `20260901093558_simplify_hackathons_and_projects.sql`:

- backfill tagline/description/location sang contract mới;
- backfill project slug và submission `project_id`;
- chuẩn hóa registration thành `registered` và backfill counter;
- thêm trigger registration deadline/counter;
- thêm RPC transactional `upsert_hackathon_project`;
- thêm trigger khóa deadline, validate taxonomy và chống xóa taxonomy đang dùng;
- đổi policy authoring hackathon thành admin/support;
- drop `hackathon_scores`, `hackathon_access_invites` cùng policy/function/trigger phụ thuộc;
- giữ nguyên credential issuance lịch sử; FK nguồn hiện hành dùng `ON DELETE SET NULL`.

Forward migration `20260901104414_harden_hackathon_project_rpc_boundary.sql` chuyển implementation đặc quyền của RPC project vào schema private và giữ public RPC dưới dạng `SECURITY INVOKER`. Hai migration này là cùng một pending release batch cho Production.

Không sửa migration lịch sử.

## Rollout cleanup dữ liệu cũ

Hackathon chưa từng được vận hành, vì vậy `hackathon_scores` và `hackathon_access_invites` được xem là dữ liệu thử nghiệm/legacy và bị xóa trực tiếp. Không cần export hoặc lưu snapshot hai bảng này trước rollout.

Trình tự rollout:

1. Chạy isolated local migration gate.
2. Apply staging và kiểm tra object cũ đã biến mất.
3. QA create → publish → register → submit → winner → end.
4. Chỉ sau staging green mới theo release process để lên production.
