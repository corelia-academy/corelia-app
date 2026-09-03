# Checklist nghiệm thu Hackathon

## Routing và public UI

- [ ] `/hackathons/:slug` redirect sang `/overview`.
- [ ] Deep link, refresh, back/forward giữ đúng tab.
- [ ] Chuyển tab không fetch lại header và không cuộn toàn trang.
- [ ] Tab mobile cuộn ngang, dùng được bằng keyboard, có focus/active/`aria-current`.
- [ ] Mọi tab trống có empty state.
- [ ] Draft không lộ cho anonymous.

## Registration và project

- [ ] Registration tạo tức thời với status `registered`.
- [ ] Insert/delete làm `participants_count` chính xác.
- [ ] Backend chặn registration quá hạn.
- [ ] RPC chặn người chưa đăng ký, quá hạn hoặc thiếu/sai taxonomy.
- [ ] Project bắt buộc ít nhất một track, sector và tech stack.
- [ ] Owner chỉ sửa project của mình; admin/support có thể hỗ trợ.
- [ ] UUID và slug lịch sử redirect sang slug canonical.
- [ ] Slug cũ không tái sử dụng được.

## Filter và winner

- [ ] OR trong cùng nhóm, AND giữa các nhóm.
- [ ] `/projects` không trộn course hoặc hackathon cards.
- [ ] Taxonomy filter chỉ hiện sau khi chọn hackathon trong catalog.
- [ ] Newest/oldest và load more hoạt động.
- [ ] Winner phù hợp filter đứng trước, theo `sort_order`, không phụ thuộc score.
- [ ] Taxonomy đang được project sử dụng chỉ archive được.

## Admin và locale

- [ ] Chỉ admin/support mở được ba route admin hackathon.
- [ ] Create/edit/publish/end/delete hoạt động.
- [ ] Route create chỉ mở Overview; tạo draft xong redirect sang edit và mở khóa các section còn lại.
- [ ] Editor dùng cùng layout primitives với course editor: header metrics, sidebar sticky, locale switcher trong sidebar và nút lưu cuối section.
- [ ] Mỗi lần chỉ render một section; hash, refresh và back/forward giữ đúng section.
- [ ] Cảnh báo khi đóng tab lúc còn draft chưa lưu.
- [ ] VI/EN giữ nội dung draft độc lập và một lần lưu ghi cả hai locale.
- [ ] Sau khi có draft, nút dịch AI dịch toàn bộ nội dung localizable từ locale nguồn sang locale đang chọn, cảnh báo trước khi thay nội dung đã có và không tự lưu/publish.
- [ ] AI translation chỉ dành cho admin/support; backend xác thực `hackathonId` và giữ nguyên ID taxonomy/timeline cùng các field dùng chung.
- [ ] Tổng prize theo track không vượt prize pool.
- [ ] Registration deadline không sau submission deadline.

## Cleanup và bảo toàn dữ liệu

- [ ] Xóa trực tiếp toàn bộ score/access-invite legacy; không tạo snapshot hoặc export.
- [ ] `hackathon_scores` và `hackathon_access_invites` không còn tồn tại.
- [ ] RPC/function/trigger scoring và scoped invite không còn tồn tại.
- [ ] Public `upsert_hackathon_project` là `SECURITY INVOKER`; implementation đặc quyền nằm ngoài exposed schema.
- [ ] URL workspace cũ trả Not Found.
- [ ] Không còn UI runtime judging, review application, analytics, email blast hoặc credential award.
- [ ] Project và credential issuance lịch sử được bảo toàn.

## Verification

- [ ] Vitest mục tiêu và full test xanh.
- [ ] `pnpm lint` xanh.
- [ ] `pnpm build` xanh.
- [ ] `pnpm db:verify` xanh sau khi migration được thêm vào manifest release đã duyệt.
- [ ] `pnpm db:verify:local` xanh.
- [ ] QA responsive mobile/desktop hoàn tất trước khi release.
