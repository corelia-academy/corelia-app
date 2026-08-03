# MA TRẬN TỔNG HỢP CÁC NHÁNH TÍCH HỢP (INTEGRATION SUMMARY MANIFEST)

**Nhánh tổng hợp (Integration Branch):** `feat/master-integration-summary`  
**Nhánh đích (Target Base):** `staging`  
**Ngày cập nhật:** 27/07/2026

Tài liệu này truy vết chi tiết từng nhánh thực thi gốc được hợp nhập vào nhánh tổng hợp `feat/master-integration-summary` theo phương pháp Merge bảo toàn lịch sử (`git merge --no-ff`).

---

## Bảng Ma trận Ánh xạ Nhánh Gốc & Tính năng

| STT | Nhánh Thực thi Gốc | Commit Gốc tiêu biểu | Chức năng Đóng gói | Các File Đính kèm / Diff chính |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **`fix/auth-session-timeout`** | `5d2a7f0` | Sửa lỗi sập ứng dụng/văng 401 sau thời gian dài không thao tác | [src/lib/supabase.ts](file:///G:/Documents/CORELIA/corelia-app/src/lib/supabase.ts), [AuthSync.tsx](file:///G:/Documents/CORELIA/corelia-app/src/components/auth/AuthSync.tsx) |
| 2 | **`fix/mint-flow`** | `e5f7c95` | Tách biệt luồng đúc OCA/OCB, hỗ trợ admin manual mint và retry chứng nhận | `check_course.ts`, `grant_pending.ts`, `mint.ts`, `retry_pending.ts` |
| 3 | **`fix/mint-flow-router-context`** | `6675eab` | Gắn `<CredentialRealtimeSync />` vào trong `<BrowserRouter>` tránh lỗi Router Context | [src/App.tsx](file:///G:/Documents/CORELIA/corelia-app/src/App.tsx), `App.routerContext.test.ts` |
| 4 | **`feat/profile-occ-visibility`** | `e64c462` | Tính năng cho phép tùy chọn công khai OCC trên Profile (`show_on_profile`), xem Followers/Following | `20260727031028_*.sql`, `ProfileCredentialManagerDialog.tsx`, `FollowingListDialog.tsx` |
| 5 | **`fix/ghost-mint`** | `4c39646` | Khắc phục triệt để Bug Ghost Mint mồ côi (`status = 'pending'`, `error_message = NULL`) & đồng bộ counter follower | [mint.ts](file:///G:/Documents/CORELIA/corelia-app/supabase/functions/corelia-api/credentials/mint.ts), [retry_pending.ts](file:///G:/Documents/CORELIA/corelia-app/supabase/functions/corelia-api/credentials/retry_pending.ts), `20260727072722_*.sql` |
| 6 | **`fix/mobile-hamburger-drawer`** | `1f0b779` | Khắc phục lỗi rỗng menu Hamburger drawer trên giao diện di động Mobile | [AppSidebar.tsx](file:///G:/Documents/CORELIA/corelia-app/src/components/base/AppSidebar.tsx) |

---

## Hướng dẫn Kiểm thử & Deploy Staging

1. **Kiểm thử Compile:** `pnpm run build` pass 100%.
2. **Kiểm thử CSDL:** Áp dụng đầy đủ các migration SQL trong thư mục `supabase/migrations/`.
3. **Chuyển tiếp (Pull Request):** Đã sẵn sàng mở 1 PR duy nhất từ `feat/master-integration-summary` vào `staging`.
