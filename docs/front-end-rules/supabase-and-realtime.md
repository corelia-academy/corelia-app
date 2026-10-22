# Supabase and Realtime

## Data-service boundary

Domain service là nơi duy nhất gọi Supabase database, RPC, Storage và Edge Functions cho application data. Service phải:

- Nhận input đã typed và trả canonical domain type.
- Chỉ select cột cần dùng; không mặc định `select('*')` cho hot path.
- Chuẩn hóa Supabase/PostgREST error thành error contract mà query/UI hiểu được.
- Không chứa React state, toast, navigation hoặc translation.
- Không expose secret/service-role key ra browser; client chỉ dùng publishable key hoặc legacy anon key khi cần tương thích.

Direct auth operations chỉ được đặt trong auth service/boundary hoặc flow auth chuyên biệt đã được review.

## RLS và quyền truy cập

- RLS/ownership là security boundary; filtering trong UI không thay thế policy.
- Mọi table trong exposed schema phải bật RLS và có policy đúng actor/operation.
- `TO authenticated` không đủ cho dữ liệu theo owner; policy phải có ownership predicate.
- Update policy cần cả `USING` và `WITH CHECK` khi ownership có thể thay đổi.
- Không dùng `SECURITY DEFINER` để sửa lỗi permission. Nếu thực sự cần privileged function, đặt ngoài exposed schema, kiểm tra actor trong function và giới hạn execute grants.
- View exposed phải giữ RLS behavior, ưu tiên `security_invoker` trên Postgres hỗ trợ.

## Realtime

- Một subscription owner cho mỗi concern và scope; nhiều consumer đọc cùng TanStack Query cache.
- Channel name phải ổn định và đủ scope để debug; subscription phải remove/unsubscribe khi không còn owner.
- Event realtime dùng `queryClient.setQueryData` khi payload đủ để cập nhật chắc chắn, hoặc invalidate query liên quan khi cần refetch canonical data.
- Không giữ một bản sao realtime list trong Zustand/local state.
- Reconnect/focus và polling fallback không được tạo request đồng thời; TanStack Query chịu trách nhiệm dedupe/refetch policy.
- Pause polling khi tab ẩn trừ khi product requirement bắt buộc background work.

## Tránh waterfall và N+1

- Bắt đầu các reads độc lập song song.
- Sau khi có row gốc, mọi lookup chỉ phụ thuộc vào row đó (locale content, signed media URL, owner/public profile, taxonomy) chạy cùng một `Promise.all`, không `await` lần lượt. Mẫu: `loadCourseBundle`, `getProjectBySlugOrId`, `localizeProjectEntries`.
- Fallback lookup (slug history, tìm theo id khi slug không khớp) chạy song song với lookup chính khi chi phí thấp; không bắt mọi request trả giá cho trường hợp hiếm.
- Một detail read trên critical path tối đa 2 round trip nối tiếp (row gốc → nhánh song song). Nhiều hơn phải có lý do ghi trong code.
- Batch IDs thay vì gọi một query cho từng card/row.
- Reuse query cache giữa list, detail và destination route qua query options chung.
- Không chạy mutation/backfill trong critical read path.
- Chỉ thêm aggregate RPC/read model khi frontend orchestration vẫn cần nhiều round trips trên critical path và đã có request trace chứng minh.
- RPC mới phải trả payload tối thiểu, giữ RLS/ownership, có type contract và regression test.

Supabase thay đổi thường xuyên; trước khi thay auth, Data API hoặc Realtime behavior phải kiểm tra changelog và tài liệu chính thức của phiên bản đang dùng.
