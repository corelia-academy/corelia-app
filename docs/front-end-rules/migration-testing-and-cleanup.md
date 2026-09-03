# Migration, Testing, and Cleanup

## Thứ tự migration

1. QueryClient foundation, auth/session và profile.
2. Home, Header, notifications và feed unread.
3. Courses, Course Detail, Learn và progress.
4. Account, achievements và public profile.
5. Instructor workspace và editors.
6. Admin và các domain còn lại.

Mỗi wave phải giữ route/public behavior, có test và có thể review/rollback độc lập. Không chạy một big-bang rewrite toàn frontend.

## Quy trình cho mỗi domain

1. Inventory reads, writes, subscriptions, polling, cache và consumers hiện tại.
2. Định nghĩa canonical service, types, query keys/options và mutation behavior.
3. Migrate consumer theo vertical slice; tránh duy trì hai cache cho cùng data lâu hơn cần thiết.
4. Thêm regression tests và đo request/render behavior.
5. Chỉ sau consumer cuối cùng mới xóa implementation cũ.
6. Review diff để loại compatibility shim không còn cần.

## Điều kiện xóa code

Cache `Map`/Promise/TTL, data-fetching effect, polling, loading state, hook, helper, type hoặc asset chỉ được xóa khi:

- `rg` xác nhận không còn static/dynamic consumer hoặc string-based entrypoint liên quan.
- Replacement đã cover behavior, error path và invalidation cũ.
- Typecheck, targeted tests và build chạy xanh.
- Public route/API behavior không vô tình thay đổi.
- Với contract quan trọng, có retirement/regression test ngăn code cũ quay lại.

Không xóa hàng loạt theo tên hoặc vì code “trông có vẻ thừa”. Không sửa unrelated formatting trong cleanup diff.

## Test scenarios bắt buộc

- Reload authenticated không render guest UI/login CTA trước khi session sẵn sàng.
- Anonymous bootstrap, sign-in, sign-out, recovery, token refresh và đổi account hoạt động đúng.
- Cache private của user cũ không xuất hiện với user mới.
- Hai consumer cùng query key chỉ tạo một in-flight request.
- Prefetch được reuse; request cũ bị cancel/không overwrite khi đổi route nhanh.
- Mutation update/invalidate đúng key và rollback optimistic state khi lỗi.
- Realtime, focus, reconnect và polling không tạo duplicate request.
- Loading skeleton không gây layout shift đáng kể; error/empty/offline state render đúng.

## Validation order

1. `pnpm vitest run <targeted-test>`.
2. Tests của feature/domain liên quan.
3. `pnpm test` cho thay đổi cross-cutting.
4. `pnpm lint`.
5. `pnpm build` và mode-specific build khi release yêu cầu.
6. Inspect bundle graph, request count, Lighthouse/RUM theo performance budgets.

Document-only changes không cần giả lập runtime migration, nhưng phải kiểm tra links, references, package scripts và build nếu xóa tooling có thể được import/call.
