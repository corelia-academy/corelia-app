# Routes, luồng và quyền

## Public routes

| Route | Hành vi |
|---|---|
| `/hackathons` | Catalog hackathon public |
| `/hackathons/:slug` | Redirect sang `overview` |
| `/hackathons/:slug/overview` | Overview tab |
| `/hackathons/:slug/prizes` | Prizes tab |
| `/hackathons/:slug/timeline` | Timeline tab |
| `/hackathons/:slug/resources` | Resources tab |
| `/hackathons/:slug/projects` | Project gallery của hackathon |
| `/projects` | Catalog chỉ gồm project cards |
| `/projects/new?hackathon=:slug` | Tạo project cho participant đã đăng ký |
| `/projects/:slug` | Project detail canonical |
| `/projects/:slug/edit` | Owner/admin edit |

`/hackathons/manage`, `/hackathons/new` và `/hackathons/:slug/manage/*` trả Not Found.

## Admin routes

| Route | Mục đích |
|---|---|
| `/admin/hackathons` | Danh sách và metrics |
| `/admin/hackathons/new` | Tạo draft |
| `/admin/hackathons/:id/edit` | Editor đầy đủ |

Các route nằm dưới admin gate hiện có và chỉ chấp nhận `admin`, `support_staff`.

## Luồng participant

1. Mở hackathon và đăng nhập nếu cần.
2. Nhấn đăng ký; registration được tạo tức thời.
3. Nhấn tạo project trước hạn nộp.
4. Nhập title, slug, mô tả/link và chọn ít nhất một giá trị ở cả ba nhóm taxonomy.
5. RPC kiểm tra auth, registration, deadline và taxonomy trong một transaction.
6. Project canonical và submission liên kết được upsert idempotent.
7. Owner có thể sửa project trước deadline; khi đổi slug, slug cũ trở thành redirect.

## Quyền

| Hành động | Khách | Participant | Owner project | Admin/support |
|---|---:|---:|---:|---:|
| Xem hackathon/project public | ✓ | ✓ | ✓ | ✓ |
| Đăng ký | — | ✓ | ✓ | ✓ |
| Tạo project dự thi | — | ✓ nếu đã đăng ký | ✓ | ✓ khi hỗ trợ |
| Sửa project | — | — | ✓ trước deadline | ✓ |
| Tạo/sửa/publish hackathon | — | — | — | ✓ |
| Chọn winner | — | — | — | ✓ |

RLS và trigger/RPC là lớp thực thi cuối cùng; UI không phải biên bảo mật.

## Cleanup hệ thống cũ

- Xóa thẳng `hackathon_scores`, `hackathon_access_invites` và object phụ thuộc, không export dữ liệu.
- Không giữ fallback route hoặc runtime cho judge, reviewer, role invite và registration review.
- Credential issuance đã tồn tại vẫn được giữ; chỉ quan hệ nguồn có thể được detach theo foreign key hiện hành.
