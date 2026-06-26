# OCA Mint — Course Credential Flow

Kịch bản test end-to-end việc học viên claim & mint **OCA** (OpenCampus Achievement,
`credential_templates.scope_type='course'`, `collection_symbol IS NULL`) sau khi hoàn
thành khoá học. Bám theo luồng code thực tế: client `handleClaim`
([useAchievementsPage.ts](../../src/pages/achievements/hooks/useAchievementsPage.ts)) →
edge `runCourseCredentialCheck` → `mintCredentialOnce`
([check_course.ts](../../supabase/functions/corelia-api/credentials/check_course.ts),
[mint.ts](../../supabase/functions/corelia-api/credentials/mint.ts)).

> OCA ≠ OCB ≠ Milestones. OCA = `scope_type='course'` + `collection_symbol IS NULL`.
> OCA **không bao giờ tự mint** — luôn cần học viên claim thủ công để render certificate
> kèm tên trước khi gọi Open Campus.

## Tiền đề / Setup data

| Hạng mục | Yêu cầu |
|---|---|
| Khoá học | `published=true`, có chứng nhận (`data.has_certificate=true` hoặc có `certificate_template_url`) |
| Template OCA | 1 row `credential_templates`: `scope_type='course'`, `course_id=<KHOÁ>`, `is_active=true`, **`collection_symbol IS NULL`**, có `identifier_prefix`, `image_url` (CDN), `trigger_rule` (mặc định `completion_pct=100`) |
| User test | Học viên sạch (chưa có issuance cho khoá này) |
| OCID | 1 tài khoản **đã** connect OCID (`profiles.ocid` hoặc `ocid_eth_address`) và 1 tài khoản **chưa** connect |
| Secret | `OPENCAMPUS_API_KEY_*` cho network đang dùng đã cấu hình ở môi trường test |
| Email | `profiles.email` hợp lệ để kiểm tra mail `course_oca` |

## Nơi quan sát kết quả

- **DB**: `enrollments` (`completed_at`, `certificate_issued_at`), `credential_issuances`
  (`status`, `oc_credential_id`, `error_message`, `retry_count`, `minted_at`),
  `user_notifications` (`type='oc_credential_minted'`), `activity_events`
  (`verb='user.earned_credential'`)
- **UI**: trang Achievements + `/@handle` → CertificateCard (nút "Claim/View OC credential"),
  StatsBar ô **OCA**, NotificationBell, tab OCA trong vault
- **Email**: hộp thư học viên (mail kind `course_oca`)
- **CDN**: `{origin}/certificates/{userId}/{courseId}.png` (ảnh certificate render tên)

## TC-01 — Happy path

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Học viên enroll khoá | Có row `enrollments` |
| 2 | Hoàn thành **tất cả** lesson | `lesson_progress.completed_at` đủ; `enrollments.completed_at` set (qua `syncCourseCompletion`) |
| 3 | Hệ thống auto cấp certificate | `certificate_issued_at` set. **OCA KHÔNG tự mint** — `runCourseCredentialCheck(autoIssue=true)` trả `skipped: oca_requires_manual_claim` |
| 4 | Vào Achievements / `/@handle` | CertificateCard hiện nút **"Claim OC credential"**; ô OCA = 0; trạng thái `unclaimed` |
| 5 | Bấm Claim (tài khoản **đã** có OCID) | Client: `renderAndUploadCertificate` upload PNG lên `…/certificates/{userId}/{courseId}.png` → gọi `invokeCheckCourseCredential(courseId)` |
| 6 | Backend `runCourseCredentialCheck` | Tìm template OCA active → readiness `completion_pct>=100` → insert `credential_issuances` status `pending` → `mintCredentialOnce` |
| 7 | `mintCredentialOnce` | HEAD ảnh cert = 200 → `subjectImageOverride` ok → POST OC endpoint thành công → update `status='minted'`, `minted_at`, **`oc_credential_id` có giá trị** |
| 8 | Side-effects | Gửi email `course_oca`; insert `user_notifications` type `oc_credential_minted`; trigger emit `activity_events` `user.earned_credential` (payload có `course_title`) |
| 9 | Client reload issuance map | `status=minted` + `oc_credential_id` → cert chuyển **"OC claimed"**, hiện nút "View OC credential" (link explorer) |
| 10 | Kiểm tra StatsBar | Ô **OCA = 1** (scope course, on-chain thật); Certificates +1; Badges(OCB)/Milestones không đổi |
| 11 | NotificationBell | Hiện thông báo credential minted |

## Case biên / âm

| # | Tình huống | Setup | Kết quả mong đợi |
|---|---|---|---|
| TC-02 | **Chưa connect OCID** | User không có `ocid` & `ocid_eth_address`; bấm Claim | UI mở `OpenCampusConnectDialog`. Nếu issuance đã tạo: giữ `status=pending`, `error_message='awaiting_holder_id'` (không gọi OC). Sau khi connect + retry → mint thành công |
| TC-03 | **Thiếu ảnh certificate render** | Chặn/để fail bước upload PNG | `mintCredentialOnce` → `status='failed'`, `error_message='missing_rendered_certificate'`, **không** gọi OC. UI hiện "Failed" |
| TC-04 | **Chưa hoàn thành 100%** | Hoàn thành thiếu 1 lesson | `skipped: completion_pct_not_met`; không tạo issuance; toast "not eligible" |
| TC-05 | **Bài tập cuối chưa duyệt** | `trigger_rule.require_assignment_pass=true`, submission ≠ `approved` | `skipped: assignment_not_approved` |
| TC-06 | **Cert trả phí chưa thanh toán** | `access_model='free_with_paid_certificate'`, `certificate_fee_paid≠true` | `skipped: certificate_fee_unpaid` |
| TC-07 | **Thiếu API key** | Bỏ secret `OPENCAMPUS_API_KEY_*` | `status='failed'`, `error_message='Missing OPENCAMPUS_API_KEY_* secret'` |
| TC-08 | **OC báo trùng (duplicate)** | Mint lại credential đã tồn tại bên OC | Bắt regex duplicate → `status='minted'`, `oc_credential_id` extract từ response lỗi, gửi mail + notify; trả `duplicate:true` |
| TC-09 | **minted nhưng thiếu oc_credential_id** | OC trả minted nhưng không có id | DB `status=minted, oc_credential_id=null`. **UI coi là "Failed"** (`ocClaimStatus='failed'`), **không** đếm vào OCA |
| TC-10 | **Idempotency — claim 2 lần** | Bấm Claim lại khi đã minted | `skipped: already_issued_or_pending`, không mint trùng, không tạo issuance mới |
| TC-11 | **Retry sau failed** | Claim lại sau TC-03/07 | check reset `failed→pending`, `retry_count+1`, mint lại; nếu điều kiện ok → minted |
| TC-12 | **Backfill oc_credential_id** | Row minted cũ thiếu id nhưng có `oc_response` | check re-parse `oc_response` → set `oc_credential_id`, trả `minted:true` (không gọi lại OC) |

## Câu lệnh kiểm tra DB (thay biến `:uid`, `:cid`)

```sql
-- Trạng thái issuance
select id, status, oc_credential_id, error_message, retry_count, minted_at
from credential_issuances
where user_id = :uid and course_id = :cid order by created_at desc;

-- Completion + certificate
select completed_at, certificate_issued_at from enrollments
where id = :uid || '_' || :cid;

-- Notification + activity
select type, payload, created_at from user_notifications
where user_id = :uid and type='oc_credential_minted' order by created_at desc limit 3;
select verb, object_type, target_type, payload from activity_events
where actor_id = :uid and verb='user.earned_credential' order by created_at desc limit 3;
```

## TC-09 manual SQL — activity feed không emit khi thiếu `oc_credential_id`

> Thay `:issuance_id`, `:uid` bằng dữ liệu test. Nên chạy trong transaction
> hoặc trên database test/staging vì các lệnh dưới đây thay đổi `credential_issuances`.

```sql
-- Baseline: clear only the event for this issuance in a test database.
delete from activity_events
where actor_id = :uid
  and verb = 'user.earned_credential'
  and object_type = 'credential'
  and object_id = :issuance_id::text;

-- 1) status='minted', oc_credential_id=null -> không tạo user.earned_credential.
update credential_issuances
set status = 'minted',
    oc_credential_id = null,
    error_message = null,
    minted_at = now()
where id = :issuance_id;

select count(*) as earned_event_count
from activity_events
where actor_id = :uid
  and verb = 'user.earned_credential'
  and object_type = 'credential'
  and object_id = :issuance_id::text;
-- expected: 0

-- 2) status='minted', oc_credential_id='' -> không tạo event.
update credential_issuances
set oc_credential_id = ''
where id = :issuance_id;

select count(*) as earned_event_count
from activity_events
where actor_id = :uid
  and verb = 'user.earned_credential'
  and object_type = 'credential'
  and object_id = :issuance_id::text;
-- expected: 0

-- 3) status='minted', oc_credential_id='abc' -> có event.
update credential_issuances
set oc_credential_id = 'abc'
where id = :issuance_id;

select count(*) as earned_event_count
from activity_events
where actor_id = :uid
  and verb = 'user.earned_credential'
  and object_type = 'credential'
  and object_id = :issuance_id::text;
-- expected: 1

-- 4) Backfill từ null sang có id -> có event, update lại không tạo trùng.
delete from activity_events
where actor_id = :uid
  and verb = 'user.earned_credential'
  and object_type = 'credential'
  and object_id = :issuance_id::text;

update credential_issuances
set oc_credential_id = null
where id = :issuance_id;

update credential_issuances
set oc_credential_id = 'abc-backfilled'
where id = :issuance_id;

update credential_issuances
set oc_credential_id = 'abc-backfilled-again'
where id = :issuance_id;

select count(*) as earned_event_count
from activity_events
where actor_id = :uid
  and verb = 'user.earned_credential'
  and object_type = 'credential'
  and object_id = :issuance_id::text;
-- expected: 1
```

## Regression cần check kèm

- **StatsBar** ([StatsBar.tsx](../../src/pages/achievements/components/StatsBar.tsx)): ô OCA chỉ
  đếm `credentialScope='course'` + `ocClaimStatus='claimed'`; OCB/Milestones tách riêng
  (TC-09 không làm tăng OCA).
- **Activity feed** ([UserProfileActivitySection.tsx](../../src/pages/users/user-profile/components/UserProfileActivitySection.tsx)):
  dòng "earned credential" hiện **tên khoá** (không phải chữ "credential"), link "Open" trỏ `/courses/...`.
