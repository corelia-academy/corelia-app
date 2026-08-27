# Streak UI Implementation Spec

Tài liệu này mô tả UI đang có của `DailyStreakMenu` trên `origin/staging` tại commit `4b22d0d2cc70c4e8aed58efcd7c5ffcb9b33ee1d`. Product contract và data ownership nằm tại [Streak System](./streak-system.md).

## 1. Vị trí và điều kiện hiển thị

Streak nằm trong global Header, trước notification bell và account menu.

```text
Anonymous
→ Login CTA

Authenticated
→ [🔥 current streak] [Notifications] [Account] [optional OCID CTA]
```

- Header chờ auth initialization trước khi quyết định render.
- Anonymous user không thấy Streak trigger.
- Authenticated user thấy trigger dạng pill với icon flame và current streak.
- Khi status chưa tải hoặc tải lỗi, counter dùng fallback `0`.
- `aria-label` của trigger chứa current streak theo locale.

## 2. Entry point và drawer

Click trigger mở right-side `Sheet`:

```text
┌──────────────────────────────────────┐
│ 🔥 Learning Streak          102 pts │
│ Check in daily...                    │
├──────────────────────────────────────┤
│                 🔥                   │
│                  7                   │
│              DAY STREAK              │
│                                      │
│            [Check In]                │
│                                      │
│  ●────●────●────○────○────○          │
│  0    3d   7d   14d  30d  ∞         │
│  Dynamic motivation / best record    │
│                                      │
│  Daily Quests | External Quests      │
│  quest rows                          │
└──────────────────────────────────────┘
```

Sizing hiện tại:

- Mobile: full width.
- `sm`: `520px`.
- `md`: `560px`.
- `lg`: tối đa `580px`.
- Header drawer cố định; body tự scroll và ẩn scrollbar trực quan.

Drawer không render nút close mặc định. User đóng bằng behavior của `Sheet` như dismiss/overlay/escape theo component primitive.

## 3. Data refresh lifecycle

Frontend gọi status trong các thời điểm:

1. Khi `DailyStreakMenu` mount để có counter trên header.
2. Mỗi lần drawer mở.
3. Khi document trở lại visible.
4. Khi window nhận focus.
5. Khi countdown chạm `nextClaimAt`.

Mỗi refresh đặt toàn drawer vào `loading`. Request mới không có request-id/cancellation guard, nên các refresh gần nhau có thể hoàn thành khác thứ tự.

## 4. Loading và error states

### Loading

Drawer hiển thị skeleton cho:

- flame circle;
- streak number và label;
- CTA;
- timeline;
- quest rows.

### Status load failed

```text
          [Alert icon]
  Could not sync streak data.
  Could not complete check-in...
             [Retry]
```

- `status` bị đặt về `null`.
- User có thể gọi lại `refresh` bằng nút retry.
- Header counter hiển thị `0`, không phân biệt “streak thật bằng 0” với “chưa tải được”.

### Claim failed

- Giữ status cũ.
- Hiện error toast.
- Mở lại CTA sau khi request kết thúc.

## 5. Claim CTA state machine

| State | CTA | Behavior |
|---|---|---|
| `loading` | Skeleton | Không cho claim |
| `status = null` | Retry status | Không cho claim |
| `canClaim = true`, idle | `Check In` / `Điểm danh` | Gọi claim với browser timezone |
| `canClaim = true`, claiming | Spinner, disabled | Chặn double click ở UI |
| `canClaim = false` | `Checked in today`, disabled | Hiện countdown hoặc claim hint |

Claim thành công với `claimed: true`:

- cập nhật toàn bộ status từ response;
- chạy flame burst trong `850ms`;
- hiện success toast với current streak;
- nếu `newMilestones` không rỗng, hiện thêm milestone toast.

Claim response có `claimed: false` không hiện success toast. Trạng thái CTA sau đó vẫn do `canClaim` quyết định.

## 6. Streak showcase và motivation copy

Khu vực trung tâm hiển thị:

- flame circle;
- current streak bằng font mono/tabular;
- label `day streak` hoặc locale tương ứng;
- motivation line dưới timeline.

Motivation branch:

| Điều kiện | Nội dung |
|---|---|
| `longestStreak = 0` | Mời user bắt đầu điểm danh |
| `currentStreak = 0`, `longestStreak > 0` | Khuyến khích bắt đầu lại và vượt kỷ lục |
| `currentStreak >= longestStreak` | Báo đang ở kỷ lục cao nhất |
| Còn lại | Hiển thị số ngày còn thiếu để bắt kịp longest streak |

## 7. Timeline

Timeline có sáu node:

```text
0 → 3d → 7d → 14d → 30d → ∞
```

Progress bar được nội suy theo segment:

| Current streak | Progress |
|---:|---:|
| `0` | `0%` |
| `3` | `20%` |
| `7` | `40%` |
| `14` | `60%` |
| `30` | `80%` |
| `>= 60` | `100%` |

Node thường được coi là unlocked nếu:

- mốc đã có trong `unlockedMilestones`; hoặc
- current streak hiện tại đã đạt mốc.

Node `0` luôn unlocked. Node `∞` hiện được đánh dấu unlocked khi current streak đạt `30`; đây là behavior UI hiện tại, không phải DB milestone và không đồng nhất với ngưỡng `60` để fill 100% thanh progress.

Current-position arrow không còn trong timeline. Track line và milestone nodes vẫn được giữ.

## 8. Quest tabs

Drawer có hai tab với underline trượt ngang.

### Daily Quests

Hiện một row:

| Quest | Reward label | Complete khi |
|---|---:|---|
| Daily check-in | `+1` | `canClaim = false` |

### External Quests

| Quest | Reward label | Complete khi | Action |
|---|---:|---|---|
| Connect Open Campus ID | `+50` | `ocidConnected = true` | Đóng drawer và mở OCID connect flow |
| Connect GitHub account | `+50` | `githubConnected = true` | Bắt đầu Supabase identity linking |

Quest hoàn thành được giảm opacity, gạch ngang label và thay reward/action bằng check icon.

GitHub connect có loading label và disabled state. Nếu khởi tạo link lỗi, UI hiện error toast. Thành công chuyển sang redirect flow nên component không tự clear loading trước navigation.

## 9. Floating prompt

Một speech bubble nằm dưới Streak trigger và có `role="status"`, `aria-live="polite"`.

Timing:

```text
Mount
→ chờ 600ms
→ hiện prompt trong 5s
→ ẩn
→ chờ ngẫu nhiên 35–60s
→ lặp lại
```

Nếu drawer đang mở, prompt hoãn `15s` rồi thử lại. Click bubble mở drawer; click nút close chỉ ẩn bubble.

Pool nội dung gồm:

- câu nhắc điểm danh khi `canClaim = true`;
- câu nhắc OCID khi chưa kết nối;
- câu nhắc GitHub khi chưa kết nối;
- các câu benefits luôn được thêm.

Một câu được chọn bằng `Math.random`. Timer được clear khi component unmount.

Vì benefits luôn có trong locale, prompt vẫn có thể chạy khi status chưa tải hoặc status load lỗi. Copy về perk, gift, OCB/OCA là nội dung truyền thông; UI không kiểm tra những reward đó đã được cấu hình trước khi chọn câu.

## 10. Responsive và interaction details

- Trigger cao `36px` trên mobile và `40px` từ `md`.
- Prompt rộng `260px` trên mobile, `280px` từ `sm`, căn phải ở viewport nhỏ và căn giữa dưới trigger từ `sm`.
- Drawer padding tăng dần theo breakpoint.
- Main body dùng vertical spacing nhỏ hơn trên mobile.
- CTA claim có `min-width: 180px`, `max-width: 100%` và không wrap label.
- Timeline label và icon scale nhẹ từ `sm`.
- Quest actions giữ kích thước compact; source chưa áp dụng target touch size `44×44px` cho mọi action nhỏ.

Animation tôn trọng reduced motion ở flame burst qua `motion-safe`. Các transition và prompt animation khác chưa được bọc `motion-safe` trong component.

## 11. Accessibility

Đã có trong source:

- Trigger là `button` với localized `aria-label`.
- Decorative icons dùng `aria-hidden`.
- Floating prompt dùng live region polite.
- Timeline nodes có `title` theo locale.
- Loading/error/claim action đều có text, không chỉ biểu tượng.
- Focus ring có trên header trigger.

Giới hạn hiện tại:

- Nút close của floating prompt dùng literal English `aria-label="Close prompt"`, chưa qua i18n.
- Milestone nodes là `span` với `title`; không có danh sách semantic hoặc screen-reader text riêng cho locked/unlocked state.
- Quest tab buttons chưa khai báo `role="tab"`, `aria-selected` hoặc liên kết `aria-controls`.
- Counter fallback `0` khi load lỗi có thể bị screen reader hiểu là dữ liệu thật.
- Compact connect/close controls chưa bảo đảm touch target `44×44px`.

## 12. Locale contract

UI dùng namespace `common.dailyStreak` ở cả English và Vietnamese.

Các nhóm key chính:

```text
openAria, title, subtitle, points
currentStreak, longest, motivation variants
milestone labels
claim, claimed, nextClaimIn, claimHint
daily/external quest labels
connection labels and errors
claim/load/retry toasts and errors
prompts.unclaimed, prompts.ocidBonus, prompts.githubBonus, prompts.benefits
```

Snapshot `origin/staging` hiện dùng:

- English: `Learning Streak`, action `Check In`.
- Vietnamese: `Streak`, action `Điểm danh`.

Mọi key mới phải được thêm đồng thời vào `src/locales/en/common.json` và `src/locales/vi/common.json`; không dựa vào fallback text.

## 13. Implementation map

```text
Header.tsx
└── DailyStreakMenu
    ├── trigger + floating prompt
    ├── Sheet header + point total
    ├── loading/error state
    ├── streak showcase
    ├── claim CTA + countdown
    ├── milestone timeline
    └── quest tabs
        └── BonusTaskRow
```

Files:

- `src/components/layouts/Header.tsx`
- `src/components/layouts/DailyStreakMenu.tsx`
- `src/lib/dailyStreak.ts`
- `src/styles/globals.css`
- `src/locales/en/common.json`
- `src/locales/vi/common.json`

## 14. UI acceptance checklist

- [ ] Anonymous user không thấy Streak trigger.
- [ ] Authenticated header tải và hiển thị current streak.
- [ ] Drawer có loading, success và retryable error states.
- [ ] Claim CTA khóa trong request và không tạo duplicate khi double click.
- [ ] Countdown cập nhật mỗi giây và refresh khi sang ngày mới.
- [ ] Visibility/focus refresh không làm UI quay về status cũ do response race.
- [ ] Timeline hiển thị đúng permanent unlock sau khi current streak bị reset.
- [ ] Daily và External tabs hoạt động bằng keyboard và có semantics phù hợp.
- [ ] OCID/GitHub actions phản ánh trạng thái backend sau redirect/refocus.
- [ ] Floating prompt không che nội dung hoặc thoát viewport ở mobile.
- [ ] Prompt, toast và drawer copy đúng cả English/Vietnamese.
- [ ] Reduced-motion behavior bao phủ mọi animation lặp lại.
- [ ] Screen reader phân biệt load failure với streak thật bằng `0`.
