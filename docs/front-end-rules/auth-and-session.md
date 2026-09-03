# Authentication and Session

## State machine chuẩn

Frontend phải biểu diễn auth bằng các trạng thái loại trừ nhau:

- `booting`: đang khôi phục initial session; chưa được kết luận anonymous.
- `anonymous`: đã hoàn tất bootstrap và không có session.
- `authenticated`: có session hợp lệ.
- `recovery`: session đang phục vụ password-recovery flow.

Không dùng `user === null` làm bằng chứng anonymous khi bootstrap chưa kết thúc.

## Bootstrap và listener

- Chỉ có một Supabase auth listener ở app root.
- Listener xử lý tối thiểu `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED` và `PASSWORD_RECOVERY` theo nhu cầu flow.
- Callback auth phải ngắn; network work phụ được schedule ngoài callback để tránh block auth client.
- Subscription phải unsubscribe khi owner unmount.
- Không thêm session listener trong page hoặc feature. Flow đặc biệt phải consume auth boundary hiện có.

## Không auth flicker

Trong `booting`:

- Không render guest home, login CTA, anonymous navigation hoặc redirect về login.
- Render app shell/placeholder có cùng header height, content bounds và responsive breakpoint với trạng thái cuối.
- Không để profile-dependent content co giãn header/sidebar khi profile tới muộn.

Sau bootstrap, chỉ `anonymous` mới được render guest UI hoặc redirect. Route cần role phải đợi cả authenticated session và profile query trước khi quyết định quyền.

## Session và profile ownership

- Supabase sở hữu session persistence và token lifecycle.
- Zustand chỉ giữ auth bootstrap status và identity/session tối thiểu cần dùng xuyên route.
- Profile là server state, được load bằng TanStack Query với key chứa `userId`.
- Authorization backend phải dựa trên RLS/verified claims; UI role guard chỉ là UX boundary, không phải security boundary.
- Không dùng `user_metadata` do người dùng chỉnh sửa để ra quyết định authorization.

## Sign-in, sign-out và đổi tài khoản

Khi identity thay đổi:

1. Cancel query đang chạy của identity cũ.
2. Xóa query cache scoped theo user cũ.
3. Reset client-only state có thể tiết lộ context của user cũ.
4. Khởi tạo query của identity mới với query keys mới.

Không persist authenticated query cache trong browser nếu chưa có threat model, encryption/retention decision và test chống cross-account leakage. Sign-out failure phải có recovery rõ ràng nhưng không tự sửa method của Supabase SDK toàn cục nếu một wrapper/service có thể biểu diễn behavior và test được.
