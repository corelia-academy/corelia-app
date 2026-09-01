# Corelia Frontend Rules

Thư mục này là nguồn chuẩn duy nhất cho kiến trúc frontend của Corelia. Các quy định áp dụng cho mọi thay đổi trong `src/`; khi một implementation hiện tại chưa tuân thủ, xem đó là technical debt cần migration có kiểm soát, không phải tiền lệ để nhân rộng.

## Thứ tự đọc

1. [Architecture and code organization](./architecture.md)
2. [Authentication and session](./auth-and-session.md)
3. [Data and state](./data-and-state.md)
4. [Supabase and Realtime](./supabase-and-realtime.md)
5. [Performance and loading](./performance-and-loading.md)
6. [Migration, testing, and cleanup](./migration-testing-and-cleanup.md)

`src/AGENTS.md` quy định cách làm việc trong source tree. Tài liệu trong thư mục này quy định kiến trúc đích và các invariant phải giữ trong quá trình migration.

## Nguồn chuẩn cho giao diện

Corelia không duy trì một design-system specification bằng Markdown. Code hiện hành là nguồn chuẩn cho giao diện:

- Ưu tiên primitives trong `src/components/ui`, shared components, CSS utilities và convention của feature lân cận.
- Có thể thay đổi CSS và component hiện hành khi yêu cầu sản phẩm cần; không xem visual implementation hiện tại là bất biến.
- Không sao chép palette, radius, typography hoặc visual hierarchy vào tài liệu kiến trúc.
- Accessibility, responsive behavior, i18n, layout stability, cùng loading/error/empty states vẫn là invariant kỹ thuật bắt buộc.
- Không thêm UI framework hoặc icon library trùng chức năng khi stack hiện tại giải quyết được yêu cầu.

## Ownership matrix

| Loại state/capability | Owner | Ví dụ |
| --- | --- | --- |
| Backend và transport | Supabase | Auth, Postgres, RPC, Storage, Realtime, Edge Functions |
| Server state trong browser | TanStack Query | Profile, courses, notifications, progress, lists, detail records |
| Cross-route client state | Zustand | Auth bootstrap status, sidebar state, UI preference thực sự dùng nhiều route |
| Local UI state | React | Dialog open, draft input, active tab chỉ thuộc một component |
| Canonical navigation state | URL/router | Route params, search, filter có thể share/bookmark, selected entity theo URL |

Không được lưu cùng một dữ liệu ở nhiều owner. Đặc biệt, dữ liệu do Supabase trả về không được copy sang Zustand hoặc `useState` chỉ để tạo cache thứ hai.

## Nguyên tắc quyết định

- Nếu dữ liệu có thể thay đổi ngoài component hoặc cần fetch/cache/refetch, dùng TanStack Query.
- Nếu state phải tồn tại xuyên route nhưng không đến từ server, cân nhắc Zustand.
- Nếu state chỉ phục vụ một vùng UI, giữ trong React gần consumer nhất.
- Nếu state quyết định URL có thể điều hướng hoặc chia sẻ, URL là canonical source.
- Chỉ tạo abstraction khi có consumer thực tế hoặc khi abstraction đó thiết lập boundary bắt buộc như data service hay query options.
