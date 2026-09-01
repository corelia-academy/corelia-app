# Perf: fetch paths, queries, indexes

Tài liệu này chốt kết quả rà soát **hiệu năng fetch** (client → Edge → Postgres): baseline ước lượng, query shape, index, RPC, và checklist verify staging. Không chỉnh sửa trong môi trường production mà dùng để triển khai có kiểm soát.

## 1) Baseline & heatmap (ước lượng tĩnh từ code)

Tham số cần đo thực tế trên staging: **p95/p99 latency**, **số query PostgREST/Edge mỗi request**, **payload size** (Network).

| Flow | Nơi | ~DB round-trips (trước) | Ghi chú risk |
|------|-----|-------------------------|--------------|
| `certificates.issue` | `supabase/functions/corelia-api` `handleIssueCertificate` | 2 parallel (`courses` + `enrollments`) + 1 optional `course_payment_access` + **2 parallel** (`course_lessons` full ids + `lesson_progress` all rows) + optional `final_assignment_submissions` | Payload lessons/progress phình theo số bài; CPU set diff client-side |
| `certificates.issue` | (sau migration + deploy Edge) | Giữ các bước trên nhưng **1 RPC** `corelia_certificate_readiness` thay 2 select lớn | Một vòng SQL aggregate, không trả full list lesson/progress |
| `payments.sepay.verify` | `handleVerifySePayPayment` | 1–2 `payment_transactions` + song song `course_payment_access` + `enrollments` + có thể `grant*` + re-fetch 3 song song + HTTP SePay | Index `(user_id, course_id, purpose, created_at desc)` giúp resolve order không `orderId` |
| Danh sách khoá học publish / instructor | `src/lib/courses.ts` | `select("*")` full rows | Thiếu pagination → transfer lớn khi catalog tăng |
| Hackathon catalog/project gallery | `src/lib/hackathons.ts`, `src/features/projects/projectQueries.ts` | Query public hackathon và project theo filter | Giữ pagination/load more; public header đọc `participants_count`, không tải participant rows |
| `getSubmissionsForCourse` | `src/lib/finalAssignment.ts` | Full rows theo course | Thêm limit/pagination khi lớp học lớn |
| `getPublicProfileByHandle` | `src/lib/profile.ts` | `public_profiles` OR | Index composite trên `public_profiles` (migration) |

**Heatmap ưu tiên xử lý:** Edge `certificates.issue` + `payments.sepay.verify` → sau đó catalog `courses`/`hackathons`/`projects` (pagination / narrow select).

## 2) Query shape audit (tóm tắt)

- **`select("*")`**: phổ biến ở `courses`, `contests`, enrollments lists — nên thu cột sau khi có audit field-level từ UI.
- **Thiếu pagination**: published courses, contests, enrollments by course, discounts list — nên thêm `limit` + `range` hoặc keyset khi dữ liệu tăng.
- **Edge `verify`**: chuỗi read/write + re-fetch; đã có short-circuit một phần (`alreadyGranted`); cải thiện tiếp: gộp transaction (tài liệu hóa, làm theo sprint).
- **Client `payments.ts`**: mỗi call lấy session token — chấp nhận được; tránh gọi dồn loop (đã tối ưu chỗ checkout poll trong bài trước).

## 3) Index coverage (đã chốt migration)

File: [`supabase/migrations/20260607100000_perf_indexes_and_certificate_readiness_rpc.sql`](../supabase/migrations/20260607100000_perf_indexes_and_certificate_readiness_rpc.sql)

| Index | Bảng | Khớp truy vấn |
|-------|------|----------------|
| `payment_tx_user_course_purpose_created_idx` | `payment_transactions` | `.eq(user_id).eq(course_id).eq(purpose).order(created_at desc)` |
| `fas_user_course_idx` | `final_assignment_submissions` | `user_id` + `course_id` |
| `public_profiles_handle_lookup_idx` | `public_profiles` | `lower(username)` + `ocid` (OR / handle) |

**Lưu ý:** Migration cũ tạo `public_profiles_handle_idx` trên `profiles`; ứng dụng đọc `public_profiles` — index mới bám đúng bảng projection.

## 4) SQL / RPC tối ưu (đã triển khai)

**`public.corelia_certificate_readiness(p_course_id text, p_user_id uuid)`**  
- `SECURITY DEFINER`; **`EXECUTE` chỉ cho `service_role`**. **`REVOKE ALL` khỏi `PUBLIC`, `anon`, `authenticated`** để PostgREST không cho client gọi RPC (Supabase linter: `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable`).  
- Migration khóa quyền: [`20260607110000_revoke_certificate_readiness_from_clients.sql`](../supabase/migrations/20260607110000_revoke_certificate_readiness_from_clients.sql); file [`20260607100000...`](../supabase/migrations/20260607100000_perf_indexes_and_certificate_readiness_rpc.sql) cũng chứa cùng revoke cho fresh install.
- Trả JSON: `lesson_total`, `completed_distinct`, `all_lessons_complete`, `final_assignment_required`, `final_submission_status`. Edge `handleIssueCertificate` gọi RPC thay hai select lessons/progress.

**Đo hiệu quả:**

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT public.corelia_certificate_readiness('COURSE_ID', 'USER_UUID'::uuid);
```

So sánh trước/sau: bytes trả về API, thời gian handler (log Edge), và `EXPLAIN` trên staging.

**Ý tưởng tiếp (chưa bắt buộc):** RPC/transaction gộp `grantPaymentAccessForTransaction` để giảm round-trip IPN/verify.

## 5) Staging verify checklist

Trước khi promote:

1. **Migrate**
   - `supabase db push` / `migration up` trên DB staging.
   - Xác nhận index tồn tại: `\di *payment_tx*`, `\di *fas_user*`, `\di *public_profiles_handle*`.
2. **Plans**
   - `EXPLAIN ANALYZE` trên các query nóng (payment verify path, `getPublicProfileByHandle` tương đương SQL, RPC certificate).
3. **Chức năng**
   - Cấp chứng nhận: học viên hoàn thành đủ bài + final assignment (nếu có).
   - Thanh toán verify: có/không `orderId`, reconcile SePay.
   - Trang public profile theo handle + OCID.
4. **Regression RLS / PostgREST**
   - RPC certificate không được gọi qua `/rest/v1/rpc` với `anon`/`authenticated` sau migration revoke; chỉ Edge (`service_role`).
5. **Quan sát**
   - Latency p95 `certificates.issue` và `payments.sepay.verify` sau deploy.
