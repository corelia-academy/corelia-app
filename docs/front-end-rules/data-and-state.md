# Data and State

## TanStack Query là server-state owner

Mọi read từ Supabase, RPC, Storage metadata hoặc Edge API dùng TanStack Query khi được consume trong React. Mọi write dùng mutation. Không duy trì một data-fetching/cache framework thứ hai.

Public interface nội bộ của một domain gồm:

- Query-key factory tạo key ổn định và JSON-serializable.
- `*QueryOptions(params)` chứa `queryKey`, `queryFn` và policy dùng chung.
- `use*Query(params)` hoặc `use*Mutation()` chỉ thêm composition cần thiết cho React.

Route prefetch và component phải dùng cùng query options để cache được reuse.

## Query keys

- Key phải chứa mọi input làm thay đổi kết quả: entity ID, `userId`, locale, filter, sort và pagination cursor.
- Không dùng object có field không ổn định hoặc function trong key.
- Dữ liệu private luôn scoped theo identity; không reuse key public cho private projection khác shape/quyền.
- Key factory phải hỗ trợ invalidation theo domain, collection và detail mà không invalidate toàn cache.

## Chính sách cache

- Default khởi điểm: `staleTime` 30 giây và `gcTime` 10 phút cho dữ liệu động thông thường; domain phải override theo độ mới thực tế.
- Không để mọi query mặc định stale ngay lập tức nếu điều đó tạo refetch trùng khi chuyển route.
- Retry tối đa hai lần cho network/transient 5xx; không retry auth, permission, validation hoặc deterministic 4xx.
- Dùng `AbortSignal` từ query function và truyền xuống service khi transport hỗ trợ.
- Background refetch giữ dữ liệu hiện có; không thay toàn màn hình bằng spinner.

## Mutations

- Sau mutation, cập nhật cache trực tiếp khi response là canonical record đầy đủ; nếu không, invalidate key nhỏ nhất bảo đảm đúng dữ liệu.
- Optimistic update chỉ dùng khi rollback xác định được và failure UX rõ ràng.
- Await invalidation khi UI phụ thuộc dữ liệu mới trước khi tiếp tục navigation/close flow.
- Không gọi lại thủ công nhiều `refresh()` rời rạc sau mutation.

## Zustand và React state

Zustand chỉ giữ client state thực sự cần chia sẻ xuyên route. Không lưu profile, notifications, course lists, progress hoặc bất kỳ Supabase row collection nào trong Zustand.

Không copy query `data` vào `useState`. Dùng `select`, derived values hoặc form state được khởi tạo có chủ đích. Nếu form cần snapshot để edit, phải định nghĩa rõ lúc reset/rebase khi server data thay đổi.

`useEffect` dành cho external synchronization như event listener, analytics, DOM API hoặc realtime owner. Effect phải cleanup và chống stale work; không dùng effect như một query runner.
