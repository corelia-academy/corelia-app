# Performance and Loading

## Phân loại loading

- **Auth boot**: chưa biết identity; dùng stable app shell và không render anonymous/authenticated branch.
- **Initial query loading**: chưa có data cho vùng nội dung; dùng skeleton có geometry gần nội dung thật.
- **Background fetching**: đã có data; giữ content và chỉ dùng progress/subtle status khi hữu ích.
- **Mutation pending**: khóa đúng control/resource liên quan, không khóa toàn app nếu không cần.

Error, retry, empty và offline states phải là first-class behavior. Full-page spinner chỉ dùng khi toàn route thực sự không thể render shell hoặc dữ liệu có ích nào khác.

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
