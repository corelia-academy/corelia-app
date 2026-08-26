# Corelia Streak System

Tài liệu này mô tả implementation hiện tại của Streak trên `origin/staging` tại commit `4b22d0d2cc70c4e8aed58efcd7c5ffcb9b33ee1d`. UI chi tiết nằm tại [Streak UI](./streak-ui.md).

## 1. Mục tiêu và định nghĩa

Streak tạo một nhịp quay lại hằng ngày bằng thao tác điểm danh rõ ràng, đồng thời ghi nhận điểm và các mốc liên tiếp.

Luồng cốt lõi:

```text
User đã đăng nhập
→ mở Streak từ header
→ xem trạng thái theo timezone
→ nhấn Điểm danh nếu hôm nay chưa claim
→ RPC ghi claim, cập nhật streak, điểm và milestone trong một transaction
→ Edge Function chạy kiểm tra OCB milestone theo cơ chế best-effort
→ UI nhận trạng thái mới và hiển thị toast
```

Thuật ngữ trong contract:

| Thuật ngữ | Ý nghĩa hiện tại |
|---|---|
| Check-in / Điểm danh | Claim chủ động qua CTA trong Streak drawer |
| Current streak | Số ngày claim liên tiếp còn hiệu lực |
| Longest streak | Giá trị current streak lớn nhất từng đạt |
| Claim date | Ngày địa phương tính theo timezone đã lưu cho user |
| Milestone unlock | Bản ghi mở khóa vĩnh viễn ở mốc `3/7/14/30` |
| Activity credential | OCB được mint từ template `activity_milestone`; không đồng nhất với milestone unlock |

Tên feature có chữ “Learning”, nhưng implementation hiện tại không xác minh lesson activity. Login cũng không tự claim; `AuthSync` chủ động không gọi claim khi `SIGNED_IN`.

## 2. Baseline hiện tại

Các khối đang chạy trong source:

- Header chỉ mount `DailyStreakMenu` cho user đã authenticated.
- Frontend gọi hai operation được bảo vệ của `corelia-api`:
  - `gamification.dailyStreakStatus`
  - `gamification.claimDailyStreak`
- Edge Function xác minh bearer token, lấy `user.id` từ session và gọi RPC bằng service-role client.
- `get_daily_streak_status` trả trạng thái hiệu lực, tổng điểm và trạng thái kết nối tài khoản.
- `claim_daily_streak` là writer duy nhất cho claim, streak, daily point và milestone unlock.
- Sau claim thành công, `runActivityMilestoneCheck` có thể tạo/mint credential từ template phù hợp.
- `user_daily_streaks` là canonical aggregate. `profiles.streak_days` được giữ lại nhưng đã được đánh dấu deprecated.

Không có endpoint cho client truyền `user_id` tùy ý. Client chỉ gửi timezone ở lần claim đầu; backend gắn mọi thao tác với bearer user.

## 3. API contract

Frontend dùng một shape chung cho status và kết quả claim:

```ts
type DailyStreakStatus = {
  claimed: boolean;
  currentStreak: number;
  longestStreak: number;
  lastClaimDate: string | null;
  timezone: string;
  canClaim: boolean;
  nextClaimAt: string | null;
  totalPoints: number;
  unlockedMilestones: number[];
  newMilestones: number[];
  ocidConnected: boolean;
  githubConnected: boolean;
};
```

### `gamification.dailyStreakStatus`

Request:

```json
{}
```

Behavior:

- Xác minh bearer user.
- Đồng bộ điểm kết nối OCID/GitHub theo dữ liệu server-controlled.
- Không tạo daily claim.
- Trả `claimed: false` vì field này chỉ biểu thị kết quả của lần gọi claim, không phải trạng thái “đã claim hôm nay”. UI dùng `canClaim` cho trạng thái đó.
- Trả HTTP `401` khi auth không hợp lệ và `500` khi không đọc được status.

### `gamification.claimDailyStreak`

Request:

```json
{
  "timezone": "Asia/Ho_Chi_Minh"
}
```

Behavior:

- Frontend lấy timezone bằng `Intl.DateTimeFormat().resolvedOptions().timeZone`; fallback là `Asia/Ho_Chi_Minh`.
- RPC chỉ nhận timezone candidate khi tạo streak row lần đầu.
- Claim đầu tiên hoặc claim sau khi đứt chuỗi đặt current streak về `1`.
- Claim ở ngày kế tiếp tăng current streak thêm `1`.
- Claim lặp trong cùng ngày trả `claimed: false`, không cộng điểm và không tạo milestone mới.
- Claim mới thành công trả `claimed: true` và danh sách `newMilestones` vừa insert.
- Sau khi transaction claim đã commit, Edge Function kiểm tra credential milestone. Lỗi ở bước này chỉ được log và không đổi response claim thành lỗi.

## 4. Quy tắc ngày và timezone

Ngày claim được tính bằng:

```sql
(now() AT TIME ZONE user_timezone)::date
```

Quy tắc hiện tại:

- Timezone candidate phải tồn tại trong `pg_timezone_names`; nếu không hợp lệ thì dùng `Asia/Ho_Chi_Minh`.
- Timezone được cố định sau lần claim đầu tiên. Gửi timezone khác ở các claim sau không thay đổi row.
- Nếu `last_claim_date` là hôm nay hoặc hôm qua, current streak còn hiệu lực.
- Nếu `last_claim_date < today - 1`, status trả effective current streak là `0`, dù giá trị lưu trong aggregate chưa được reset ngay.
- Claim tiếp theo sau khoảng trống ghi current streak mới là `1` và giữ longest streak cũ.
- Khi đã claim hôm nay, `nextClaimAt` là `00:00` của ngày kế tiếp trong timezone đã lưu.

Việc cố định timezone ngăn một user đổi timezone liên tục để claim hai ngày địa phương trong cùng khoảng thời gian ngắn. Source hiện chưa có flow đổi timezone có hiệu lực từ ngày kế tiếp.

## 5. Data model

### `user_daily_streaks`

Canonical aggregate, một row cho mỗi user:

| Field | Contract |
|---|---|
| `user_id` | Primary key, cascade theo `auth.users` |
| `timezone` | Timezone dùng tính local day |
| `current_streak` | Giá trị aggregate gần nhất đã ghi, không âm |
| `longest_streak` | Kỷ lục lớn nhất, không âm |
| `last_claim_date` | Local date của claim gần nhất |
| `created_at`, `updated_at` | Audit timestamps |

### `user_daily_streak_claims`

Event log của từng lần claim thành công:

- Primary key `(user_id, claim_date)` ngăn duplicate claim theo ngày.
- Lưu `claimed_at`, `timezone`, `previous_streak` và `current_streak`.
- Không có client insert policy.

### `user_point_ledger`

Ledger điểm append-only theo contract hiện tại:

| Source | `source_key` | Điểm |
|---|---|---:|
| Daily claim | `daily:YYYY-MM-DD` | `+1` |
| OCID connected | `ocid_connected` | `+50` |
| GitHub connected | `github_connected` | `+50` |

Unique `(user_id, source_key)` bảo đảm retry không cộng trùng. Tổng điểm là `sum(points)`; source hiện chưa có balance cache hay redemption flow.

### `user_streak_milestone_unlocks`

- Chỉ chấp nhận `milestone_days IN (3, 7, 14, 30)`.
- Primary key `(user_id, milestone_days)` bảo đảm mỗi mốc chỉ mở một lần.
- Lưu `unlocked_at` và `claim_date`.
- Unlock không bị xóa khi current streak đứt.

Tất cả bốn bảng bật RLS và chỉ có policy `SELECT` row của chính user cho role `authenticated`. Writer đi qua RPC server-mediated; execute trên các RPC streak chỉ cấp cho `service_role`.

## 6. Claim transaction và concurrency

`claim_daily_streak` thực hiện các bước sau trong cùng transaction:

```text
Advisory transaction lock theo user_id
→ SELECT streak row FOR UPDATE
→ tạo row lần đầu nếu chưa có
→ xác định local date
→ short-circuit nếu đã claim hôm nay
→ tính current streak mới
→ update aggregate
→ insert claim event
→ insert +1 point với unique source_key
→ insert các mốc 3/7/14/30 chưa có
→ đồng bộ bonus kết nối
→ trả status mới
```

Ba lớp idempotency bảo vệ retry và concurrent tabs:

1. `pg_advisory_xact_lock` serialize claim theo user.
2. Primary key `(user_id, claim_date)` chặn duplicate claim event.
3. Unique `(user_id, source_key)` chặn duplicate point.

## 7. Điểm kết nối tài khoản

`sync_account_connection_points` không tin browser flag:

- OCID được xác minh từ `profiles.ocid` khác rỗng.
- GitHub được xác minh từ `auth.identities` với `provider = 'github'`.
- Mỗi bonus được insert bằng `ON CONFLICT DO NOTHING`.

Hàm này chạy cả khi đọc status và khi claim. Vì vậy operation “status” có side effect hợp lệ là ghi bonus connection còn thiếu vào ledger.

Frontend chỉ khởi tạo flow kết nối:

- OCID: đóng Streak drawer rồi gọi callback của Header để mở flow Open Campus hiện có.
- GitHub: gọi `supabase.auth.linkIdentity({ provider: "github" })` và redirect về root.

Điểm kết nối chỉ xuất hiện sau khi backend quan sát được dữ liệu liên kết thật.

## 8. Milestone và OCB credential

Có hai lớp độc lập:

| Lớp | Nguồn cấu hình | Kết quả |
|---|---|---|
| Streak milestone | Cố định trong RPC: `3/7/14/30` | Ghi `user_streak_milestone_unlocks` |
| Activity credential | Admin tạo `credential_templates` | Tạo/mint `credential_issuances` nếu rule đạt |

Sau một claim mới, Edge Function phát event:

```ts
runActivityMilestoneCheck(db, user.id, "daily_streak", {
  days: status.currentStreak,
});
```

Template hợp lệ phải có:

- `scope_type = 'activity_milestone'`
- `is_active = true`
- `trigger_type = 'auto'`
- `trigger_rule.manual !== true`
- `trigger_rule.event` là `daily_streak` hoặc alias `login_streak`
- `trigger_rule.days > 0` và `currentStreak >= days`

Credential issuance idempotent theo template, user và network. Issuance đang `minted` hoặc `pending` được skip; issuance `failed` được reset về `pending` để retry. Lỗi mint được ghi nhận ở credential flow nhưng không rollback claim đã commit.

`login_streak`, `daily_streak` và incoming event `login_streak_updated` được matcher coi là tương thích. Tuy vậy, flow claim hiện phát `daily_streak`; login không tự tạo event hay claim.

## 9. Error states và fallback

| Trường hợp | Backend | Frontend |
|---|---|---|
| Chưa đăng nhập / token lỗi | `401` | Menu không được mount cho anonymous; API client throw nếu thiếu session |
| Không tải được status | `500` | Hiển thị error state và nút retry; header counter tạm là `0` |
| Claim network/RPC lỗi | Không commit hoặc trả `500` | Giữ trạng thái trước đó và hiện error toast |
| Claim lặp cùng ngày | Không ghi thêm dữ liệu | Trả status với `claimed: false`; CTA vẫn dựa vào `canClaim` |
| Timezone không hợp lệ ở claim đầu | Fallback `Asia/Ho_Chi_Minh` | Không có thông báo riêng |
| Mint milestone lỗi | Claim vẫn giữ nguyên; lỗi được log | Không hiện lỗi mint trong Streak drawer |
| Không có credential template phù hợp | Không mint | Claim và milestone UI vẫn hoạt động |

## 10. Security và invariant

- User identity đến từ bearer token, không đến từ request body.
- Client không có quyền gọi trực tiếp các RPC streak bằng role `authenticated`.
- Client chỉ đọc row thuộc chính user qua RLS.
- Claim, point và milestone unlock được ghi server-side.
- Claim một ngày, point một source key và milestone một mốc đều có unique constraint.
- Lỗi credential không được làm mất daily claim.
- `longest_streak` chỉ tăng bằng `GREATEST(old, current)`.
- `profiles.streak_days` không phải source of truth; code mới phải đọc `user_daily_streaks` hoặc status RPC.

## 11. Implementation map

```text
src/components/layouts/Header.tsx
→ mount DailyStreakMenu cho authenticated user

src/components/layouts/DailyStreakMenu.tsx
→ orchestration và toàn bộ drawer UI

src/lib/dailyStreak.ts
→ frontend type, status call, claim call, browser timezone

src/lib/coreliaEdgeApi.ts
→ bearer-authenticated POST tới corelia-api

supabase/functions/corelia-api/index.ts
→ protected operation routing

supabase/functions/corelia-api/gamification/daily_streak.ts
→ auth, RPC adapter, response normalization, best-effort credential check

supabase/functions/corelia-api/credentials/check_activity.ts
→ evaluate activity template và mint idempotent

supabase/migrations/20260814020000_daily_streak_claims.sql
→ tables, RLS, point sync, status RPC, claim RPC

supabase/migrations/20260816181500_fix_daily_streak_and_integrity_guards.sql
→ forward fix cho claim RPC

supabase/migrations/20260823130000_g2_canonical_state_and_data_integrity.sql
→ đánh dấu profiles.streak_days deprecated
```

## 12. Giới hạn và điểm chưa được chứng minh bởi source

- Đây là check-in streak, chưa phải learning-activity streak.
- Copy UI nói đến perk, gift, on-chain score, OCB và OCA; source streak chỉ chứng minh việc tích điểm và gọi activity credential templates. Không có redemption/perk engine trong feature này.
- Node `∞` là biểu diễn UI. Database không có infinity milestone; UI hiện đánh dấu node này unlocked khi current streak đạt `30`, trong khi thanh progress chỉ đạt `100%` ở `60` ngày.
- Admin vẫn cho chọn rule legacy `login_streak`, dù flow đăng nhập không claim.
- Status operation có side effect ghi bonus connection, nên không phải read thuần túy.
- Không thấy dedicated automated test cho claim RPC hoặc `DailyStreakMenu` trong snapshot. Repo có contract test cho classification của bảng streak và một manual test artifact cho milestone/longest streak.
- Tài liệu này chưa xác minh migration ledger, catalog hoặc runtime deployment trên Supabase Staging.

## 13. Validation checklist

### Source contract

- [ ] `DailyStreakMenu` chỉ xuất hiện sau khi auth initialized và user authenticated.
- [ ] Status và claim operations nằm trong protected operation list.
- [ ] Handler lấy user từ bearer token.
- [ ] RPC execute chỉ cấp cho `service_role`.
- [ ] RLS chỉ cho user đọc row của chính mình.

### Functional

- [ ] User chưa có row claim lần đầu được ngày `1`.
- [ ] Claim lại cùng local day không tạo claim/point thứ hai.
- [ ] Claim ngày kế tiếp tăng streak đúng một đơn vị.
- [ ] Bỏ lỡ một ngày làm effective current streak về `0`; claim kế tiếp bắt đầu lại ở `1`.
- [ ] Longest streak không giảm sau khi chuỗi bị đứt.
- [ ] Mốc `3/7/14/30` chỉ được insert một lần.
- [ ] OCID và GitHub bonus mỗi loại chỉ cộng một lần.
- [ ] Concurrent claim từ nhiều tab không tạo duplicate.
- [ ] Mint OCB lỗi không rollback claim, point hoặc milestone unlock.

### Runtime evidence

- [ ] Xác minh migration ledger trên đúng Supabase Staging project/branch.
- [ ] Xác minh schema, RLS, grants và function definitions trong catalog thực tế.
- [ ] Smoke test bằng hai user và ít nhất hai timezone.
- [ ] Ghi bằng chứng cho retry, concurrency và thời điểm qua midnight.
