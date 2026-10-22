# Performance and Loading

## Phân loại loading

- **Global loading** (`AppLoadingScreen`: overlay mờ + logo Corelia): auth boot, kiểm tra session/MFA ở `/login`, và route chunk/guard của lần tải đầu tiên. Chưa có gì đáng hiển thị nên chỉ có một màn loading, không render anonymous/authenticated branch.
- **Initial query loading**: route đã render, vùng nội dung chưa có data; dùng skeleton có geometry gần nội dung thật.
- **Background fetching**: đã có data; giữ content và chỉ dùng progress/subtle status khi hữu ích.
- **Mutation pending**: khóa đúng control/resource liên quan, không khóa toàn app nếu không cần.

Error, retry, empty và offline states phải là first-class behavior. Full-page spinner chỉ dùng khi toàn route thực sự không thể render shell hoặc dữ liệu có ích nào khác.

## Loading và skeleton rules

- **Skeleton chỉ dành cho data đang fetch.** Component tự hiển thị skeleton khi query của chính nó đang `isPending` (vd. `HomeCourseCardSkeletonRow` trong section Home). Không dùng skeleton để che auth boot hay việc tải JS chunk ở lần vào app đầu tiên.
- **Lần tải đầu gom về một global loading.** `AuthBootstrapScreen` và mọi route fallback (`*Fallback` trong `App.tsx`, `LocationPlaceholder`) bọc qua `InitialLoadFallback`: trước lần điều hướng đầu tiên của người dùng chúng render `AppLoadingScreen`, sau đó mới render skeleton của route. Redirect (`replace`, vd. `/login` → `/`) vẫn tính là lần tải đầu.
- **Không xếp chồng hai skeleton cho cùng một vùng.** Nếu fallback của route và loading state của page cùng vẽ một vùng, chúng phải dùng chung component/geometry (pattern `RoutePlaceholder`: page export loading layout của mình, fallback dùng lại), không được hiện skeleton chung rồi đổi sang skeleton khác.
- **Fallback sau điều hướng trong app** dùng skeleton khớp layout đích (`RoutePlaceholder`, `RouteSkeleton`, skeleton riêng của page); `skeletonRevealClass()` ẩn chúng 200ms đầu để load nhanh không bị nháy.
- **Không thêm màn loading mới.** Dùng `AppLoadingScreen` cho loading toàn app, `AuthGateLoading` cho gate nhỏ trong trang, skeleton cho data. Không tạo spinner/full-page loader riêng cho từng feature.
- **Kiểm tra khi đổi loading flow**: tải lại trang khi đã đăng nhập và chưa đăng nhập, xác nhận chỉ có một global loading rồi đến skeleton data (nếu có), không có bước skeleton → skeleton khác.

## Request trên lần tải đầu

- Route chunk của layout và page đầu tiên được tải song song với auth boot (`preloadEntryRoute` trong `src/lib/routePrefetch.ts`). Route public mới có lưu lượng đáng kể phải được thêm vào `routeLoaders` ở đó (dùng chung cho prefetch khi hover).
- Component luôn mount (Header, sidebar, sync component) chỉ fetch dữ liệu mà chúng đang hiển thị. Dữ liệu chỉ dùng khi người dùng mở panel/menu (vd. trending searches) phải `enabled` theo trạng thái mở.
- Background sync không phục vụ UI hiện tại (vd. XP sync) chờ trình duyệt rảnh bằng `useBrowserIdle()` để không tranh băng thông với chunk và data của page, nhất là trên mobile.
- Khi thêm query mới, kiểm tra request trace của lần tải đầu (đã đăng nhập và chưa đăng nhập, viewport mobile): không có request trùng, không có chuỗi request nối tiếp tránh được.

## Layout stability

- Header, sidebar, toolbar, avatar và CTA placeholders phải giữ kích thước của trạng thái cuối.
- Ảnh/video/embed phải có intrinsic dimensions hoặc `aspect-ratio` trước khi tải.
- Không chèn banner/content phía trên viewport sau paint nếu không dành sẵn chỗ.
- Chỉ animate transform, opacity hoặc color cho transition thông thường; tránh animation thay đổi layout.
- Kiểm tra desktop, mobile, light và dark behavior cho thay đổi UI diện rộng.

## Code splitting và prefetch

- Route/feature nặng phải có lazy boundary thực sự; không gom chúng vào manual chunk được preload trên mọi route.
- Không preload editor, markdown, syntax highlighter, PDF/export, AI/OCID UI hoặc admin code trên route không dùng.
- Prefetch route chunk và query data khi hover/focus navigation, link sắp vào viewport hoặc browser idle sau critical rendering.
- Prefetch dùng cùng query options với destination và không được làm navigation fail nếu request prefetch lỗi.
- Không prefetch khi `Save-Data` bật hoặc effective connection quá chậm; giới hạn concurrent speculative work.
- Chỉ preload asset thực sự critical cho app shell/LCP.

## Assets và i18n

- Namespace i18n được lazy-load theo route/feature; boot chỉ mang namespace critical.
- Ảnh dưới fold dùng lazy loading và async decoding; LCP image được ưu tiên có chủ đích.
- Dùng thumbnail/responsive source thay vì asset gốc quá lớn trong card/list.
- Font chỉ tải subset/weight cần cho ngôn ngữ hỗ trợ và critical UI.

## Performance budgets

Mục tiêu production p75:

- CLS `< 0.1`.
- LCP `< 2.5s`.
- INP `< 200ms`.
- Initial JavaScript của route public `< 350 kB` gzip.
- Chunk UI thông thường `< 250 kB` gzip; chunk export-only lớn hơn cần justification.

Đo trên build production, mobile throttling và RUM theo route/device/network. Local feeling không thay thế metrics và request trace.
