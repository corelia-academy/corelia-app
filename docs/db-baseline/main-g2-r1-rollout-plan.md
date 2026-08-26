# CORELIA Production Rollout Plan — R5

## 1. Trạng thái

`R5_PRE_PRODUCTION_PLAN_ONLY`

Kế hoạch này mô tả release candidate R5. Nó không cho phép tự động ghi Production, push/merge `main`, hoặc bỏ qua bước xác nhận của operator.

## 2. Định danh và target

- Production base: `66981c2044b515a6fa07a71d06f8265d171d6a74`
- R5 technical RC và Git tree: lấy trực tiếp từ immutable release manifest.
- Production Supabase ref: `lawhkvyyoznwygzsycan`
- Staging Supabase ref: `opoozbmfbezkrpzxsusx`
- Production pre-state bắt buộc: 139 migrations, latest `20260818120000`
- Production post-state dự kiến: 155 migrations, latest `20260826110000`
- Forward migration set: đúng 16 migration được khóa trong release manifest.

Technical RC SHA, Git tree SHA, candidate tree SHA-256 và manifest SHA-256 phải lấy từ immutable manifest/final manifest commit đã verify; không nhập thủ công từ tài liệu này.

## 3. Phạm vi R5

- Atomic payment settlement và repair idempotent cho giao dịch đã paid nhưng thiếu effect.
- Chặn chuyển trạng thái bất hợp lệ sang paid.
- Refund accounting theo tổng refund thành công, khóa chống race và giới hạn remaining refundable amount.
- Access/certificate provenance theo đúng payment transaction.
- Loại bỏ fallback refund không atomic.
- Đóng đường tạo AI entitlement mới từ late callback, voucher và direct settlement.
- Reconcile catalog bằng forward migrations `20260825150000`, `20260825151000`, `20260825152000`, `20260825153000`.
- Bảo đảm RLS của retained AI tables được tái lập từ migration chain và nằm trong semantic catalog fingerprint.
- Chặn service-role/direct-write tạo mới hoặc tái kích hoạt AI subscription/voucher entitlement sau retirement.
- Canonicalize `rls_auto_enable()` và event trigger `ensure_rls` bằng forward migration, không còn loại object này khỏi fingerprint.
- Giữ nguyên 7 AI tombstones và các bảng snapshot được bảo vệ.
- Không thực hiện cleanup phá hủy của issue #330.

## 4. Pre-release hard gates

- [ ] Final RC là commit bất biến và khớp external manifest SHA-256.
- [ ] Clean detached checkout chạy PASS: install frozen, test, lint, build Production/Staging, `db:verify`, `db:verify:local`.
- [ ] Payment/refund SQL integration và concurrency PASS.
- [ ] Backup PostgreSQL restore rehearsal PASS.
- [ ] Production read-only preflight xác nhận đúng ref, ledger 139/latest `20260818120000` và các invariant tương thích.
- [ ] Operator kiểm tra backup vật lý, chấp nhận recovery limitations và xác nhận exact `main` push/deploy nếu có.
- [ ] Chính sách tài chính AI lịch sử fail-closed của R5 được giữ nguyên; không xóa lịch sử và không tạo entitlement mới.
- [ ] Có phương thức hợp lệ để rehearsal callback provider; không thay hoặc làm lộ secret chỉ để chạy test.

Nếu một gate thất bại hoặc bằng chứng đã cũ, release dừng fail-closed.

Workflow input `recovery_limitations_accepted` chỉ ghi nhận operator đã chấp nhận rõ ràng các giới hạn phục hồi. Đây không phải tuyên bố recovery đã được kiểm chứng operationally.

## 5. Thứ tự Production bắt buộc

1. Verify release SHA, base SHA, manifest SHA-256 và exact changed-file set.
2. Verify Production target ref là `lawhkvyyoznwygzsycan`.
3. Chạy full application/DB/release gates từ exact RC.
4. Deploy `corelia-api` R5 trước DB để late AI callback fail-closed trong migration window.
5. Verify ledger pre-state đúng 139 migrations và đúng 16 migration đang pending.
6. Apply migrations bằng canonical migration command; cấm `migration repair` và cấm `--include-all`.
7. Chạy live post-migration semantic gate: ledger 155/latest `20260826110000`, payment/refund invariants, AI retirement guards, RPC privileges, RLS và catalog contracts.
8. Deploy lại đủ 7 AI tombstones.
9. Chạy post-Edge invariant gate và non-money smoke test.
10. Chỉ sau khi toàn bộ gate PASS và m xác nhận trực tiếp mới được merge/push `main` hoặc phát hành frontend Production.
11. Bắt đầu Production observation window; issue #330 vẫn BLOCKED tối thiểu 7–14 ngày không có AI traffic trước khi đánh giá cleanup riêng.

## 6. Post-migration invariants

- Paid `course_purchase` không được thiếu active course access hoặc enrollment.
- Tổng completed refunds không vượt original payment amount.
- `anon` và `authenticated` không có EXECUTE trên financial SECURITY DEFINER RPCs.
- `process_successful_payment` và `process_payment_refund` chỉ cấp EXECUTE cho `service_role` ngoài owner.
- Conversation/session ownership, aggregate, voucher FK và project provenance invariants đều bằng 0.
- Guard/sync trigger, canonical RLS, credential activity function và provenance columns đúng semantic definition.

## 7. Recovery boundary

| Thành phần | Trạng thái trước release | Yêu cầu |
|---|---|---|
| Physical backup | Recheck required | Operator kiểm tra ngay trước deploy |
| PITR | Không được giả định có | Xác minh độc lập nếu muốn dựa vào PITR |
| DB restore | Local backup restore đã rehearsal; Production restore chưa rehearsal | Forward-fix là đường chính, restore là incident path |
| Edge rollback | Source pin có sẵn, operational rehearsal chưa được chứng minh | Có runbook/redeploy exact source |
| Frontend rollback | External evidence required | Xác minh Cloudflare trước main push |
| RPO/RTO | Chưa đo | Không cam kết zero data loss/zero downtime |

## 8. Staging evidence và giới hạn

- Staging đã nhận đủ R4 migrations, hai forward R5 migrations và `corelia-api` R5.
- Ledger Staging: 155, latest `20260826110000`.
- Candidate ↔ Staging semantic catalog diff: 0; fingerprint bao gồm `public.rls_auto_enable()`, event trigger `ensure_rls` và trạng thái RLS/force-RLS.
- Payment/refund DB runtime fixtures, idempotency, refund và cleanup PASS.
- `corelia-api` health/invalid-secret boundary và 7/7 tombstones PASS.
- Exact signed provider callback chưa rehearsal vì secret thật không được lộ hoặc thay đổi. Đây là external gate, không được mô tả thành PASS.
- Observation baseline R4.1 cũ vẫn là bằng chứng lịch sử, không thay thế R5 runtime verification.

## 9. Human policy gates

- Xác nhận provider callback rehearsal mechanism.
- Chấp nhận recovery limitations và exact Production rollout window.

Code R5 phải tiếp tục fail-closed và bảo toàn lịch sử; mọi retention/refund decision khác chỉ xử lý trong issue riêng có phê duyệt.

## 10. Safety record

- Production DB writes trong remediation: NONE
- Production migrations: NONE
- Production deploys: NONE
- Remote `main` pushes/merges: NONE
- Staging writes: R4 migrations, hai forward R5 migrations và fixture test có rollback/cleanup xác minh
- Staging deploy: `corelia-api` R5; 7 tombstones được xác minh còn live
