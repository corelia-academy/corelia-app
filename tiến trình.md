# Tiến trình — Issue #391: Input Field

## Quy tắc đã xác nhận

- Tái sử dụng `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuList` và `DropdownMenuItemContent` có sẵn; không dựng menu riêng cho Input Field.
- Danh sách tag là chọn nhiều nên giữ checkbox. Hàng chỉ có tiêu đề dùng kích thước gọn `size="compact"` (chiều cao tối thiểu 42px), không có supporting text.
- Country code và currency là chọn một nên dùng `DropdownMenuItem`, không hiện checkbox hoặc dấu check. Chọn item vẫn cập nhật giá trị đang hiển thị trên trigger.
- Các danh sách chọn trong Input Field dùng chiều rộng theo nội dung (`w-max`) và chiều rộng tối thiểu hiện có (`min-w-32`).
- Màu sắc tiếp tục lấy từ token dùng chung; không thêm mã màu trực tiếp vào component.
- Số `+n` của tag là số tag bị ẩn: tổng tag đã chọn trừ số tag đang hiển thị.

## Cập nhật ngày 2026-09-26

- Theo yêu cầu mới, đã chuyển API và hành vi của trường Figma vào component `Input` có sẵn; các thuộc tính mở rộng đều tùy chọn, còn cách dùng `Input` gốc không truyền API mở rộng vẫn render ô nhập đơn giản.
- `Input` hiện cung cấp API cho nhãn, gợi ý, lỗi, biểu tượng dẫn đầu/trạng thái, menu chọn một, tag chọn nhiều và số tag ẩn; nơi sử dụng quyết định cấu hình nào cần bật.
- `DropdownMenuSearch` chỉ làm khung chứa; nơi sử dụng truyền `Input` với biến thể biểu tượng dẫn đầu và token kiểu dáng của menu. Không còn ô `<input>` riêng trong component dropdown.
- Trang minh họa chuyển sang import `Input`; triển khai `InputField` độc lập đã được bỏ để tránh có hai component cho cùng một trường nhập.
- Component dùng chung nằm tại `src/components/ui/input.tsx`; chế độ input cũ vẫn giữ nguyên khi không truyền API của field. Không còn module component `input-field.tsx` riêng.
- API icon cho phép dùng icon Figma mặc định, truyền icon tùy chỉnh hoặc truyền `null` để ẩn. Màu của icon mặc định được đặt ở slot để `leadingIconClassName` từ nơi sử dụng có thể ghi đè.
- API dropdown hỗ trợ `dropdownIcon` để thay/ẩn mũi tên và `searchable` để bật/tắt ô tìm kiếm; API tag hỗ trợ `tagOptions`, `selectedTagValues`, callback cập nhật và `maxVisibleTags`.
- Ô tìm kiếm ở dropdown tag, dropdown chọn một và showcase dropdown đều compose `Input`; các nơi gọi cũ và fixture trong test đã được chuyển sang API này, loại bỏ vòng phụ thuộc giữa `input.tsx` và `dropdown-menu.tsx`.
- Đã chuyển tham chiếu trong file kiểm tra hiện có sang `Input` và sửa selector/role của mục dropdown một lựa chọn cho đúng với `DropdownMenuItem`; chưa chạy test.
- Đã thêm API `size="compact"` vào `DropdownMenuCheckboxItem` dùng chung.
- Common use trong trang showcase dùng API compact dùng chung thay cho class ghi đè tại chỗ.
- Dropdown tag dùng cùng API compact và item content dùng chung; giữ logic chọn nhiều.
- Dropdown leading/trailing dùng layout danh sách dùng chung, item chỉ có title, không có dấu chọn và không có supporting text.
- Đã khôi phục ô Search dùng chung cho tag và country/currency; tìm theo label/value và hiện trạng thái rỗng khi không có kết quả.
- Tất cả năm lựa chọn tag trong showcase dùng lại ảnh avatar mẫu; menu tag truyền `leadingVisual` vào slot leading của `DropdownMenuItemContent`, nên các hàng lựa chọn và tag đang hiển thị đều có ảnh dẫn đầu. Quy tắc hiển thị một tag và `+n` không đổi.
- Không đổi màu token, route, dữ liệu hoặc business flow khác.

## Kiểm tra

- Đã rà lại diff và chạy `git diff --check`; chưa chạy test hoặc build theo quy tắc của phiên làm việc.
- Chưa làm visual QA trên trình duyệt sau thay đổi này.
- Test hiện có đã được chuyển sang import component `Input`; chưa chạy test hoặc build.

## Trạng thái

- API trường nhập đã được tích hợp vào `Input` hiện có; đã rà code và `git diff --check`, chưa chạy test/build và chưa thực hiện visual QA trên trình duyệt.
- Issue #391: tiếp tục ghi nhận phản hồi và cập nhật tiến trình đến khi người dùng xác nhận hoàn tất.

## Rà soát Issue và Figma — 2026-09-26

- Đọc lại [Issue #391](https://github.com/corelia-academy/corelia-app/issues/391): issue vẫn mở; các checkbox tiêu chí hoàn thành chưa được đánh dấu. Issue phụ thuộc #379 (typography), #380 (color tokens) và #381 (spacing/radius) đều đã đóng.
- Đọc Figma node `15:8082` và các node con của Input Field. Thiết kế có 5 kiểu (`default`, `icon leading`, `tags`, `leading dropdown`, `trailing dropdown`) và các trạng thái placeholder, filled, focused, disabled, destructive placeholder, destructive filled.
- Khớp Figma ở các thông số chính: control cao 40px, radius 8px, padding ngang 12px, khoảng cách 8px; token toàn cục đang tách giá trị light/dark. Icon tìm kiếm, thông tin, cảnh báo và mũi tên được lấy từ asset cục bộ; xem hình Figma thấy đúng loại glyph và kích thước.
- Showcase có đủ 5 kiểu và 5 trạng thái tĩnh; không show focused tĩnh theo yêu cầu trước đó, có hướng dẫn dùng Tab. Tag hint bị ẩn sau khi chọn tag theo yêu cầu người dùng, dù ảnh filled trong Figma vẫn có hint.
- Còn sai lệch chữ cần xử lý: Figma dùng hint/error 14px, nhưng `FieldDescription` đang mặc định `text-body-small` 12px; label trong `input.tsx` ghi đè letter spacing thành `-0.5px`, trong khi Figma/code token `text-label-medium` tương ứng `-0.07px` ở 14px.
- Nội dung menu trong component còn hardcode (`Search`, `No items found`, `Select an option`, `Tag options`). `common.search` là object nội dung trang tìm kiếm; chuỗi “Search” riêng lẻ có ở `common.actions.search`. Chưa thấy khóa chung tương ứng cho các fallback/accessibility label còn lại.
- Kiểm thử `input-field.test.tsx` hiện bao phủ API, nhãn/required/error, hint/counter, dropdown click và chọn tag; chưa có kiểm thử bàn phím/Tab cho focus và menu.
- Figma node hiện chỉ cung cấp bản dark; light có token độc lập trong `globals.css`, nhưng chưa thể xác nhận độ khớp hình ảnh light với Figma.
- Xác thực mới nhất: `pnpm lint` chạy đạt; `input-field.test.tsx` đạt 12/12 ở lượt kiểm tra gần nhất. `pnpm run build` chưa đạt vì TypeScript bị `EPERM` khi ghi cache trong `node_modules/.tmp`.
- Lượt rà soát này không sửa mã nguồn; Issue #391 chưa đủ căn cứ để kết luận hoàn tất.

## Kế hoạch xử lý sai lệch còn lại — 2026-09-26

- Người dùng đã tự kiểm tra mục kiểm thử bàn phím và yêu cầu bỏ qua mục so sánh hình ảnh light mode; cả hai đều nằm ngoài kế hoạch sửa.
- Kế hoạch còn lại: (1) hint/error dùng token cỡ chữ 14px theo Figma, (2) bỏ letter spacing `-0.5px` ghi đè token label, (3) đưa nội dung fallback và nhãn truy cập trợ năng trong `Input` về i18n EN/VI.
- `common.search` là object của trang tìm kiếm, không phải chuỗi “Search”. Dùng `actions.search` cho placeholder ngắn; cân nhắc tái sử dụng `combobox.emptyLabel` cho empty state và chỉ thêm các khóa còn thiếu cho aria label.
- Người dùng đã xác nhận triển khai. `src/components/ui/input.tsx` đã dùng token 14px cho hint/error, bỏ tracking ghi đè ở label, và lấy nội dung tìm kiếm/trạng thái rỗng/nhãn trợ năng từ i18n.
- Đã thêm các khóa EN/VI trong `src/locales/en/common.json` và `src/locales/vi/common.json`; nhãn số tag ẩn xử lý số ít/số nhiều tiếng Anh bằng hậu tố `_one`/`_other`.
- Nhãn trợ năng lấy chữ từ `getOptionLabelText` để tránh biến label JSX thành `[object Object]`; không thêm prop công khai mới. Không sửa token toàn cục, `FieldDescription` dùng chung hoặc counter.
- Rà soát tĩnh và `git diff --check` hoàn tất; JSON EN/VI hợp lệ. Không chạy test/build. Test hiện có `src/components/ui/input-field.test.tsx` vẫn so sánh aria-label tiếng Anh cố định và chưa khởi tạo i18n; cần xử lý riêng nếu muốn xác nhận bộ test sau này.
- Các mục kiểm tra bàn phím và so sánh light mode tiếp tục được bỏ qua theo yêu cầu; chờ người dùng xem giao diện và phản hồi.

## Tái kiểm tra Issue #391 và Figma — 2026-09-26

- Đọc lại [Issue #391](https://github.com/corelia-academy/corelia-app/issues/391): issue vẫn mở, chưa có bình luận; năm checkbox tiêu chí vẫn chưa được đánh dấu. Các phụ thuộc #379 (typography), #380 (color tokens), #381 (spacing/radius) đều đã đóng.
- Lấy lại thiết kế trực tiếp từ node Figma `15:8082` và các node con cho default, icon-leading, tags, leading/trailing dropdown; có kiểm tra placeholder, filled, disabled, destructive và focused.
- Đã xác nhận phần lớn cấu trúc khớp: năm biến thể, control cao 40px, radius 8px, padding ngoài 12px, khoảng cách 8px; label 14px/letter spacing -0.07px; hint/error 14px, line-height 1.4 và tracking 0.28px. Token màu semantic dùng giá trị light/dark riêng; không thấy mã màu trực tiếp trong `input.tsx`.
- Còn sai lệch typography: Figma hiển thị giá trị country/currency 16px, tracking 0.32px; `DropdownSelector` trong `src/components/ui/input.tsx:178` đang dùng `text-body-small` (12px).
- Còn sai lệch khoảng đệm ở selector: Figma dùng padding ngang 12px quanh segment; code dùng `pr-md`/`pl-md` và `gap-md` 8px ở `src/components/ui/input.tsx:563` và `:682`. Đây là sai khác khoảng 4px mỗi vùng sát divider (đường ngăn).
- Còn sai lệch chip `+n`: Figma dùng nền neutral-600 (#354467), px 8px hai bên và line-height 1.4. API hiện tái sử dụng `Tag` nhưng chip đếm nhận cùng `tag-background` neutral-700 (#1f3050) với tag nội dung; style chung của `Tag` cũng dùng `pr-sm` 6px và `leading-none`. Cần một cách cấu hình theo token để vừa tái sử dụng component vừa khớp chip Figma.
- Kiểm thử Input Field: 11/12 đạt. Một test thất bại vì test harness chưa khởi tạo i18n; `src/main.tsx` mới là nơi import `./i18n`. Do đó test nhận key `combobox.hiddenTagsLabel` thay vì aria-label tiếng Anh mà assertion cũ mong đợi. Đây là thiếu sót setup/assertion của test, chưa phải bằng chứng chuỗi production hiển thị sai.
- `pnpm lint` đạt. `pnpm build` dừng trước bước biên dịch vì `tsc` không ghi được `node_modules/.tmp/tsconfig.*.tsbuildinfo` (EPERM); chưa thể xác nhận build xanh.
- Focus state vẫn có style thật bằng `focus-within`/`focus-visible`; không thêm mẫu focused tĩnh theo yêu cầu trước đó. Kiểm thử bàn phím và so sánh trực quan light mode vẫn nằm ngoài phạm vi kiểm tra đã thống nhất.
- Lượt rà soát này không sửa source code; chỉ ghi nhận kết quả vào file tiến trình. Issue #391 chưa đủ căn cứ để kết luận hoàn thành.

## Sửa ba sai lệch cỡ chữ, khoảng cách và màu chip — 2026-09-26

- Đổi chữ giá trị dropdown từ token (mã thiết kế dùng chung) 12px `text-body-small` sang token 16px `text-body-large`, theo Figma.
- Tăng khoảng đệm hai phía selector quanh đường ngăn lên 12px; dùng các token `pr-lg`/`pl-lg` và bù khoảng cách bằng `mr-xs`/`ml-xs`, không đổi khoảng cách chung của input.
- Tạo token màu ngữ nghĩa riêng cho chip `+n`: chế độ tối dùng `neutral-600`/`neutral-200` theo Figma; chế độ sáng dùng `neutral-300`/`neutral-800` từ bảng màu toàn cục. Đây là lựa chọn suy luận vì Figma chưa có thiết kế sáng.
- Chip `+n` vẫn tái sử dụng `Tag`, đồng thời dùng khoảng đệm ngang 8px, dọc 4px và chiều cao dòng 1.4.
- Chỉ cập nhật `src/components/ui/input.tsx`, `src/styles/globals.css` và file tiến trình này. Chưa chạy test/build theo phạm vi đã thống nhất.

## Rà soát lại Issue #391 và Figma — 2026-09-26

- Lấy lại Issue #391 từ GitHub: trạng thái vẫn `open` (đang mở), không có bình luận và cả năm tiêu chí vẫn chưa được đánh dấu hoàn thành.
- Lấy lại metadata và thiết kế từ Figma `15:8082`, gồm các node Tags Filled `49:3535`, Tags Disabled `49:3493`, Leading Dropdown `49:3683`, Trailing Dropdown `49:3827`, cùng các trạng thái Focused.
- Xác nhận component đang dùng `Field`, `Tag`, `DropdownMenu` và component `Input` cho ô tìm kiếm; năm kiểu trường, trạng thái focus tương tác, nhãn, hint/error, counter, `aria-describedby` và `aria-invalid` đều có trong code. Hint của Tags ẩn sau khi chọn tag theo yêu cầu riêng của người dùng.
- Còn sai lệch thiết kế: (1) mũi tên của Trailing Dropdown cần cách chữ 8px theo Figma nhưng `DropdownSelector` dùng `gap-xs` 4px cho cả leading và trailing; (2) khoảng cách ngang giữa tag và chip `+n` trong Figma là 6px nhưng `tagTrigger` dùng 4px; (3) Figma ở Tags Disabled giữ tag nội dung màu `neutral-700`/`neutral-200` và avatar không mờ, còn code truyền `disabled` cho `Tag`, làm đổi màu và giảm opacity avatar; (4) mẫu showcase Disabled hiện có hai tag nên hiển thị `+1`, trong khi node Figma Disabled hiển thị `+2`.
- Còn điểm tái sử dụng token kiểu chữ: hai ô tìm kiếm dùng `text-[16px]`, dù token toàn cục `text-body-large` đã định nghĩa 16px. Màu trong `input.tsx` dùng class token; màu chip `+n` đã được tách token light/dark. Figma hiện không có bản light; so sánh trực quan light mode tiếp tục được bỏ qua theo yêu cầu trước đó.
- Các asset cục bộ cho search/info/warning có kích thước 20px, mũi tên 16px; kích thước và slot khớp metadata/code Figma. Không thực hiện chụp màn hình trình duyệt trong lượt rà soát này.
- Kiểm thử mục tiêu `pnpm test src/components/ui/input-field.test.tsx`: 11/12 đạt. Test aria-label thất bại vì test chưa khởi tạo i18n và nhận chuỗi khóa thay vì bản dịch; các test về variants, native input type, validation, counter, tag count và dropdown selection đạt.
- `pnpm lint` đạt. `pnpm build` vẫn dừng ở `tsc` vì `EPERM` khi ghi `node_modules/.tmp/tsconfig.app.tsbuildinfo` và `tsconfig.node.tsbuildinfo`, chưa xác nhận được build.
- Lệnh test đầu tiên dùng sai cú pháp và khởi chạy bộ test rộng; đã dừng lượt đó. Trong phần output trước khi dừng có test ngoài phạm vi lỗi do `localStorage.setItem/clear` không khả dụng. Không sửa test hay mã nguồn trong lượt rà soát.
- Kiểm thử bàn phím đã được người dùng tự kiểm tra; không thêm kiểm tra này vào phạm vi hiện tại. Issue #391 chưa đủ căn cứ để đánh dấu hoàn thành.

## Sửa các sai lệch còn lại theo Figma — 2026-09-26

- `DropdownSelector` nhận khoảng cách nội bộ qua prop private: dropdown đầu dùng token `gap-xs` (4px), dropdown cuối dùng `gap-md` (8px), theo các segment ở Figma.
- Hàng tag dùng `gap-x-sm`/`gap-y-xs` để khớp khoảng cách ngang 6px và dọc 4px của node Tags.
- Bỏ `disabled` khỏi tag nội dung và chip `+n` đang chỉ hiển thị dữ liệu. Field và trigger vẫn disabled; chip giữ token màu tag/overflow hiện tại, avatar không bị opacity giảm.
- Mẫu showcase disabled chọn ba tag. Với `maxVisibleTags=1`, nó hiển thị đúng `+2` tag đang ẩn.
- Hai ô search con đổi `text-[16px]` thành token kiểu chữ toàn cục `text-body-large`; không thay đổi màu.
- Test dùng `I18nextProvider` và ngôn ngữ EN để kiểm tra nhãn trợ năng đã dịch; thêm kiểm tra khoảng cách hai selector và diện mạo tag trong trạng thái disabled.
- Kiểm tra `pnpm test src/components/ui/input-field.test.tsx`: đạt 14/14. `pnpm lint`: đạt. `git diff --check` trên các file mã: đạt, có cảnh báo quy đổi LF/CRLF của Git.
- `pnpm build` chưa đạt vì TypeScript không được phép ghi `node_modules/.tmp/tsconfig.app.tsbuildinfo` và `tsconfig.node.tsbuildinfo` (`EPERM`). Đây là lỗi quyền ghi cache; chưa xác nhận kết quả build.
- Thay đổi mã của lượt này chỉ nằm ở `src/components/ui/input.tsx`, `src/pages/admin/components/AdminInputFieldComponentPage.tsx` và `src/components/ui/input-field.test.tsx`; không sửa token màu toàn cục, bản dịch, component `Tag` dùng chung, hoặc các file khác.
- Issue #391 vẫn mở. Chờ người dùng xem giao diện và xác nhận phần này trước khi kết luận hoàn tất toàn issue.

## Kiểm tra khoảng cách dropdown với đường phân cách — 2026-09-26

- Người dùng gửi ảnh cho thấy mũi tên của dropdown mã quốc gia nhìn sát đường phân cách hơn thiết kế.
- Figma node `49:3687` quy định dropdown có padding ngang 12px; khoảng cách giữa mã quốc gia và mũi tên là 4px.
- Mã hiện tại ở `src/components/ui/input.tsx:566` đặt `pr-lg`; token `--corelia-spacing-lg` trong `src/styles/globals.css:454` là `0.75rem` (12px). CSS Vite được phục vụ tại localhost cũng sinh `.pr-lg { padding-right: var(--corelia-spacing-lg) }`.
- Ảnh người dùng cho thấy khoảng trống hữu hiệu nhỏ hơn giá trị Figma, trong khi mã nguồn và CSS token đang khai báo 12px. Cần xác nhận CSS tính toán trên trang đang xem để phân biệt trạng thái trang cũ với quy tắc bị ghi đè.
- Không sửa source ở lượt chẩn đoán này. Kết nối đọc tab trình duyệt bị timeout hai lần; chưa thể lấy computed style (giá trị CSS sau cascade) để xác định nguyên nhân chính xác. Không tăng padding tùy ý vì thông số Figma hiện xác nhận là 12px.

## Chặn kéo chọn chữ trong Input Tags khi disabled — 2026-09-26

- Nguyên nhân trong mã: trạng thái `disabled` đã đặt `select-none` trên control và overlay, nhưng wrapper gom các tag chưa có lớp này theo trạng thái. Các Tag vẫn giữ nguyên giao diện Figma; không truyền prop `disabled` vào Tag vì sẽ đổi style màu/độ mờ.
- Sửa `src/components/ui/input.tsx`: wrapper `tagTrigger` chỉ thêm `select-none [&_*]:select-none` khi Input Tags bị disabled. Phạm vi gồm tag và placeholder bên trong; màu, spacing và trạng thái hoạt động bình thường không đổi.
- `git diff --check` không báo lỗi nội dung. `pnpm build` bị chặn vì `tsc` không ghi được cache `node_modules/.tmp/*.tsbuildinfo` (`EPERM`); chạy Vite riêng và ESLint riêng đều không nhận diện được executable trong môi trường hiện tại. Chưa chạy kiểm thử trình duyệt thực tế.

## Rà soát khả năng thay SVG icon bằng Phosphor — 2026-09-26

- Chỉ rà soát, chưa thay source code. `@phosphor-icons/react` phiên bản 2.1.10 đã có trong `package.json` và lockfile; `vite.config.ts` gom Phosphor/Lucide vào `vendor-icons`.
- Bốn SVG icon trong `src/assets/input-field/` có tổng kích thước thô 8,145 byte; mỗi file dưới 4 KiB. Cấu hình Vite hiện không ghi đè `assetsInlineLimit`, nên theo mặc định chúng có thể được nhúng dạng data URL. Cần so sánh bundle trước/sau mới kết luận thay Phosphor giảm tải.
- Có thể thử ánh xạ icon: `CaretDown` cho dropdown, `MagnifyingGlass` cho search, `Info` cho trạng thái mặc định, `Warning` cho trạng thái lỗi; dùng `duotone` cho ba icon hai lớp và giữ token màu hiện có.
- Rủi ro: hình học/nét của Phosphor có thể không khớp SVG Figma tuyệt đối. `avatar-sample.png` là ảnh avatar minh họa, không phải icon; để ngoài phạm vi thay icon.
- Chưa xóa file SVG/PNG, chưa chỉnh component Input; cần người dùng duyệt trước khi đổi. Nên kiểm tra trực quan với Figma và so kích thước bundle sau khi có chấp thuận.

## Thay icon SVG của Input Field bằng Phosphor — 2026-09-26

- Người dùng xác nhận YES và yêu cầu xóa các SVG icon.
- `src/components/ui/input.tsx` dùng các import riêng `CaretDown`, `MagnifyingGlass`, `Info`, `Warning` từ Phosphor. Ba icon duotone giữ kích thước 20px và token màu hiện tại; mũi tên CaretDown giữ kích thước 16px. API cho icon tùy chỉnh và quy tắc `undefined`/`null` vẫn giữ nguyên.
- Xóa `arrow-down-leading.svg`, `icon-info.svg`, `icon-search.svg`, `icon-warning.svg` sau khi xác nhận không còn tham chiếu trong `src`. Giữ `avatar-sample.png` vì đây là ảnh avatar minh họa.
- Kiểm tra `pnpm lint`: đạt; `tsc --noEmit --incremental false --project tsconfig.app.json`: đạt. `pnpm build` chưa chạy qua bước TypeScript do lỗi quyền ghi `node_modules/.tmp/*.tsbuildinfo` (`EPERM`). Không chạy test theo yêu cầu phạm vi hiện tại; chưa chụp so sánh trực tiếp trên trình duyệt.

## Rà soát trước khi dọn tiến trình và push — 2026-09-26

- Đọc lại Issue #391 trực tiếp qua GitHub: issue vẫn mở, không có bình luận; cả năm tiêu chí hoàn thành đang để trống.
- Lấy ảnh Figma node `15:8082` và các node Tags Filled/Disabled, Leading Dropdown, Trailing Dropdown. Thiết kế hiển thị các biến thể và trạng thái dark; không có frame light để so sánh pixel.
- Nhánh hiện tại `issue-391-expand-input-field-component` trùng HEAD với `staging` local, không có commit riêng (`0` ahead); ref `origin/staging` đang có sẵn trong local ghi nhận nhánh chậm `73` commit. Chưa fetch để kiểm tra lại ref remote mới nhất.
- Các thay đổi hiện vẫn unstaged; worktree có 15 file tracked sửa đổi, 3 file/asset chưa track và `tiến trình.md`. Có thay đổi ngoài phạm vi Input Field trong `action.tsx`, `action.test.tsx`, `AdminAvatarComponentPage.tsx`; cần quyết định giữ trong PR này hay tách riêng, không tự ý bỏ.
- Component Input không chứa mã màu trực tiếp hoặc utility `text-neutral-*`/`bg-neutral-*`; màu được gắn qua semantic tokens. Token Input Field được khai báo riêng theo light/dark trong `globals.css`. Avatar PNG là asset duy nhất còn trong `src/assets/input-field`; không tìm thấy tham chiếu tới bốn SVG icon đã thay bằng Phosphor.
- `pnpm lint`: đạt. `tsc --noEmit --incremental false --project tsconfig.app.json`: đạt.
- Bộ test mục tiêu chạy đúng: 69/70 đạt, 1 thất bại tại `input-field.test.tsx:97` do assertion vẫn mong `mask-image` sau khi icon đã chuyển sang SVG của Phosphor. Bốn file test liên quan khác đạt.
- `pnpm build` dừng ở `EPERM` khi ghi `node_modules/.tmp/*.tsbuildinfo`. Thử Vite riêng cũng bị `EPERM` khi Cloudflare plugin ghi `.wrangler/deploy/config.json`; chưa xác nhận production build hoàn tất. Lệnh test đầu tiên truyền nhầm `--`, chạy rộng và lộ lỗi `localStorage` ngoài phạm vi; lượt đó đã dừng, sau đó chạy lại đúng các file mục tiêu.
- Tab Chrome cũ có accessibility tree hiện `Supporting text.` dưới Tags Placeholder; sau khi mở tab kiểm tra mới vào cùng route, Tags Placeholder/Filled/Disabled không còn hint, khớp source `hint: undefined`. Kết quả xác nhận tab cũ giữ nội dung render cũ; trạng thái Tags destructive vẫn hiển thị error text như thiết kế.
- Chưa xóa `tiến trình.md`, chưa stage, commit hoặc push. Còn test assertion sai, build chưa xanh, nghi vấn preview và khác biệt base branch; chưa đủ điều kiện kết thúc Issue #391.
- Sửa assertion test `src/components/ui/input-field.test.tsx`: kiểm tra SVG Phosphor mặc định xuất hiện, và icon SVG mặc định không xuất hiện khi truyền icon tùy chỉnh; bỏ kiểm tra `mask-image` đã lỗi thời.
- Chạy lại 5 file test mục tiêu bằng `pnpm test <5 file>`: 5/5 file, 70/70 test đạt. Có cảnh báo `react-i18next` do test chưa khởi tạo i18next; cảnh báo không làm test thất bại.

## Khôi phục màu cũ của Action — 2026-09-26

- Người dùng xác nhận giữ Action và Avatar trong cùng PR; không tách riêng.
- Khôi phục token `action-supporting` và `action-active-supporting` về `var(--neutral-400)` ở cả light/dark. Icon điều hướng mặc định dùng token supporting; icon disabled dùng alias `action-disabled-icon` trỏ tới `var(--neutral-500)`. Không thêm giá trị màu mới; giữ nguyên `action-disabled` cho chữ và `foreground-tertiary` của Input Field.
- Cập nhật assertion trong `src/components/ui/action.test.tsx` cho hai token icon. `pnpm lint` đạt; `git diff --check` không có lỗi khoảng trắng (Git có cảnh báo chuẩn hóa LF/CRLF). Chưa chạy test sau sửa màu.
- Chưa stage, commit, push hoặc xóa file tiến trình.

## Phân biệt single-line, auto-grow và giới hạn ký tự trong showcase — 2026-09-26

- Phần “Figma variants” tiếp tục dùng `fieldType: "single-line"`; hai ô Required field/Text input cuối trang được chuyển sang `fieldType="auto-grow"`.
- Ô Required field dùng textarea nên bỏ `type="email"`, giữ `required` và dùng `inputMode="email"` làm gợi ý bàn phím. `textarea` không áp dụng kiểm tra định dạng email native.
- Không cần thêm API giới hạn ký tự: `maxLength` đã được nhận từ kiểu native input/textarea, truyền vào cả `<input>` và `<textarea>`, đồng thời hiển thị bộ đếm khi được đặt. Bỏ `maxLength` thì không giới hạn và không hiện bộ đếm. Cách dùng đúng là `maxLength={10}`, không phải `type="10"`.
- Kiểm tra `pnpm lint`, TypeScript `--noEmit --incremental false --project tsconfig.app.json` và `git diff --check`: đạt; không chạy test trong lượt này. Chưa thêm ví dụ giới hạn ký tự mới vào showcase vì cần xác nhận vị trí hiển thị.

## Giới hạn cho trường điện thoại và số tiền trong showcase — 2026-09-26

- Người dùng xác nhận dùng API sẵn có tại nơi sử dụng: trường điện thoại (`type="tel"`) đặt `maxLength: 10`; trường số tiền (`type="number"`) đặt `max: 10`. Không thêm prop/API mới và không thay đổi logic component dùng chung.
- Đã cập nhật cấu hình `inputProps` trong `src/pages/admin/components/AdminInputFieldComponentPage.tsx`; điều kiện theo variant áp dụng cho các trạng thái showcase tương ứng.
- `max` giới hạn giá trị số hợp lệ, không giới hạn số chữ số và không nhất thiết chặn thao tác gõ. Giá trị mẫu `1250` hiện lớn hơn `max: 10`; giữ nguyên mẫu theo phạm vi được duyệt.

## Đối chiếu lại Issue #391 và Figma — 2026-09-26

- Đọc trực tiếp [Issue #391](https://github.com/corelia-academy/corelia-app/issues/391): issue vẫn `open`, không có comment; cả năm checkbox nghiệm thu vẫn chưa được đánh dấu.
- Đọc Figma node `15:8082`; component set `49:3304` có 30 biến thể: 5 kiểu (`Default`, `Icon leading`, `Tags`, `Leading dropdown`, `Trailing dropdown`) × 6 trạng thái. Mỗi mẫu medium là 320×96; ô điều khiển 40px, radius 8px.
- Showcase đang hiển thị 25 trạng thái tĩnh (5 kiểu × 5 trạng thái) và hướng dẫn dùng Tab để xem focused; đây là lựa chọn đã thống nhất trước đó, không phải thiếu trạng thái trong API. Figma sắp theo 5 cột, còn showcase sắp theo nhóm trạng thái và lưới responsive 3 cột.
- Ảnh Figma tham chiếu hiện là dark mode; không tìm thấy bộ biến thể light tương ứng. Mã có token Input Field riêng cho `:root` và `.dark`, vì vậy đã xác minh cấu hình hai theme nhưng chưa thể kết luận light mode khớp pixel với Figma.
- Đọc computed style tại showcase dark: control thường `#060b14`, border `#596587`, 40px cao, radius 8px, padding ngang 12px; disabled dùng surface `#0b1528` và border `#1f3050`; destructive dùng `#eb5146`. Các giá trị quan sát khớp với token và ảnh Figma dark. Component không có mã màu hex trực tiếp; token semantic nằm trong `src/styles/globals.css` theo theme.
- Xác nhận Input compose từ `Field`/`FieldLabel`/`FieldDescription`, `Tag` và `DropdownMenu` có sẵn; tag và selector dùng cùng menu primitive, tag dùng checkbox-item, selector đơn dùng menu-item. Search dropdown render bằng `Input` mới. API native được giữ qua `ComponentPropsWithoutRef`, và input cũ không bật field mode vẫn đi theo lớp hiển thị cũ.
- Tag overflow dùng `selected - visible` để tính `+n`; hint thường ẩn ở showcase theo yêu cầu trước, còn API tự ẩn hint khi có tag được chọn. Focus outline/ring được điều khiển bằng focus CSS và thao tác Tab, không ghim focused mẫu tĩnh.
- Điểm test đỏ: `src/components/ui/input-field.test.tsx` mong tag mở mặc định có `max-h-24` và `overflow-y-auto`, nhưng `src/components/ui/input.tsx` chỉ thêm các thuộc tính này nếu consumer truyền `expandedTagsMaxHeight`. Lượt chạy ghi nhận 18 test đạt và 1 test lỗi; tiến trình Vitest không thoát, nên các file test khác chưa có kết quả xác nhận.
- `pnpm lint`: đạt. `node node_modules/typescript/bin/tsc --noEmit --incremental false --project tsconfig.app.json`: đạt. `pnpm build`: dừng vì `EPERM` khi ghi `node_modules/.tmp/tsconfig.app.tsbuildinfo` và `tsconfig.node.tsbuildinfo`; chưa thể xác nhận build xanh.
- Kiểm tra native number trong DOM: showcase đặt `max=10` nhưng mẫu Filled là `1250`, và trình duyệt báo `validity.rangeOverflow=true`. `max` đang là giới hạn kiểm tra giá trị hợp lệ, không phải chặn gõ. Đây là điểm bổ sung ngoài checklist gốc; không thêm bộ lọc nhập chữ trong lượt rà soát.
- Icon mặc định hiện dùng Phosphor theo yêu cầu đã duyệt và nhìn cùng loại với icon trong Figma; do asset SVG gốc đã được xóa theo yêu cầu, chưa có so sánh đường path để khẳng định pixel-perfect. Ví dụ Figma hiển thị số tiền `3,000`, trong khi showcase dùng `1250`.
- Không sửa code, không stage, commit, push, hoặc xóa file tiến trình trong lượt audit này. Chưa đủ bằng chứng để đánh dấu Issue #391 hoàn tất.

## Đồng bộ test Input Field với hành vi hiện tại — 2026-09-26

- Trong `src/components/ui/input-field.test.tsx`, bỏ hai assertion yêu cầu danh sách tag có `max-h-24` và `overflow-y-auto` mặc định. Component chỉ đặt chiều cao khi nơi dùng truyền `expandedTagsMaxHeight` và không đặt `overflow-y-auto` lên wrapper tag.
- Không sửa component hoặc thay đổi hành vi giao diện.
- Chạy `pnpm test src/components/ui/input-field.test.tsx`: đạt 19/19 test. Cảnh báo `localstorage-file` của môi trường test vẫn xuất hiện nhưng không làm test thất bại.

## Tách trách nhiệm Field và Input — 2026-09-27

- Người dùng duyệt định hướng tách rõ phần trình bày/trạng thái trường dữ liệu khỏi điều khiển nhập liệu; không đổi giao diện, màu, token, spacing, luồng nghiệp vụ, dropdown hoặc tag.
- `Field` (khung trường dữ liệu) nhận trách nhiệm hiển thị label, dấu bắt buộc, hint, error và bộ đếm; dùng context (ngữ cảnh chia sẻ) để nối trạng thái/ID của control.
- `Input` (điều khiển nhập liệu) giữ loại input/textarea, biến thể, icon, dropdown, tag, `maxLength`, auto-grow và hành vi nhập; không tự dựng label/hint/error hay tự bọc `Field`.
- Phase 1 đã sửa `src/components/ui/field.tsx` và `src/components/ui/input.tsx`. ID control được giải quyết đồng bộ ngay lần render đầu; metric ban đầu về độ dài/tag được đọc từ `Input` con để giữ trạng thái hint/counter trước hydration.
- Các `Field` cũ chỉ dùng như khung bố cục cùng `FieldLabel`/`Input` không truyền metadata mới nên giữ cách render hiện tại. Search Input trong dropdown được cách ly khỏi context của Field ngoài.
- Phase 2 đã chuyển `src/pages/admin/components/AdminInputFieldComponentPage.tsx` và `src/components/ui/input-field.test.tsx` sang composition `<Field ...><Input ... /></Field>`; test bao phủ ID label, metadata, counter, tag hint, Input thuần, Field cũ và search trong dropdown.
- Test mục tiêu `pnpm test src/components/ui/input-field.test.tsx --pool=threads --poolOptions.threads.singleThread`: đạt 30/30 sau khi thêm các regression test cho ID qua wrapper, metadata boolean, disabled và auto-grow.
- Hai test dropdown liên quan search/composition và portal chạy riêng: mỗi test đạt 1/1. Chạy cả `dropdown-menu.test.tsx` trong cùng lượt bị treo sau khi Input Field test báo đạt; đã dừng tiến trình, nên toàn bộ file dropdown chưa được xác nhận.
- Một lượt test đầu dùng `.labels` trên HTML server-render tĩnh thất bại vì happy-dom không tạo collection đó từ `innerHTML`; assertion được đổi sang kiểm tra `label.htmlFor` khớp `input.id`. Test mount vẫn kiểm tra `.labels` và đạt.
- Rà soát độc lập phát hiện `error={false}`/hint/label boolean có thể bị xem như metadata có nội dung; chuẩn hóa boolean thành không có nội dung hiển thị và thêm test. Reviewer xác nhận không còn blocker trong phạm vi tách `Field`/`Input`.
- Hai test dropdown liên quan chạy lại sau khi sửa: popup composition đạt 1/1; menu portal đạt 1/1. Cả file `dropdown-menu.test.tsx` chưa được xác nhận do lượt chạy toàn file trước đó bị treo.
- `git diff --check` đạt; Git chỉ cảnh báo chuẩn hóa LF/CRLF ở các file đang sửa. Chưa chạy lint/build theo yêu cầu người dùng; chưa commit, push hoặc xóa file tiến trình.
- Quét các JSX callsite trong `src`: không thấy consumer nào truyền `label`, `hint`, `error` hoặc `fieldClassName` vào `Input`; các consumer cũ đang dùng native Input cùng `Field` bố cục nên không cần migrate. Showcase Input Field là nơi ghép API mới.
- Trong phần tách này không tạo component mới; chỉ sửa `field.tsx`, `input.tsx`, showcase và test đã thuộc phạm vi Input Field. `AGENTS.local.md` đã có quy tắc đọc styles toàn cục, quét repo, tìm phần dùng chung và ưu tiên tái sử dụng; giữ nguyên nội dung file này.
- Làm rõ tiêu chí copy/i18n: chuỗi mẫu trong showcase được phép viết trực tiếp để minh họa component; khi dùng `Field`/`Input` ở màn hình sản phẩm, nội dung label, hint, error và placeholder phải lấy từ khóa dịch hiện có (hoặc bổ sung khóa dịch khi được yêu cầu), không ghi cứng tại callsite.

## Đưa việc compose dropdown về nơi sử dụng — 2026-09-27

- Theo quyết định đã duyệt, `Input` không còn khai báo các kiểu `leading-dropdown`/`trailing-dropdown` hoặc tự dựng menu chọn một và menu tag.
- `Input` cung cấp `renderLeadingContent` và `renderTrailingContent`, truyền trạng thái `disabled`/`invalid` để nơi dùng tự ráp dropdown hoặc nội dung phụ bằng primitive có sẵn. Phone code và currency trong showcase là hai cách ráp tại `AdminInputFieldComponentPage.tsx`, không còn là loại dropdown được chọn từ `Input`.
- `variant="tags"` vẫn giữ phần chip, `+n`, trạng thái chọn và mở/đóng để phục vụ layout. Nơi dùng tùy chọn `renderTagMenu` để ghép trigger với `DropdownMenu` và tự quyết định search, item, lọc, checkbox hoặc cách hiển thị khác. Không truyền `renderTagMenu` thì tag chỉ hiển thị, không tự có menu.
- Menu tag và selector trong showcase tiếp tục dùng `DropdownMenu` dùng chung, token, search bằng `Input`, và cô lập `FieldContext` của ô Search bằng provider có giá trị `null`.
- Nội dung cũ trong các mục phía trên mô tả `Input` tự ráp dropdown đã được quyết định mới này thay thế; giữ nguyên đó làm lịch sử tiến trình.
- Đã cập nhật component, showcase và test để phản ánh API compose mới. Theo phạm vi được giao, chưa chạy test/lint/build; cần chạy kiểm thử mục tiêu sau lượt refactor.

## Rà soát tổng thể trước khi chuẩn bị push — 2026-09-27

- Đối chiếu lại Issue #391, Figma node `15:8082`, source hiện tại, trình duyệt showcase và test. Issue vẫn mở; các checkbox acceptance chưa được đánh dấu.
- Figma có 5 biến thể và 6 hàng trạng thái, trong đó Focused được kiểm tra bằng Tab theo yêu cầu trước đó. Showcase hiện trình bày 5 trạng thái tĩnh cho mỗi biến thể và giữ bố cục responsive 3 cột ở màn hình rộng; không phải ma trận 5 cột giống Figma.
- Trên showcase dark, chiều cao control 40px, bo góc 8px, padding ngang 12px, khoảng cách 8px, nền `#060b14`, viền `#596587`, disabled `#0b1528`/`#1f3050`, destructive `#eb5146` khớp các giá trị Figma đã kiểm tra. Token ngữ nghĩa Input Field được định nghĩa riêng cho `:root` và `.dark`; Figma hiện không có khung light tương ứng để xác minh hình ảnh light mode.
- Input ghép với Field; dropdown và tag menu được tạo tại nơi gọi bằng primitive `DropdownMenu`; search bên trong dùng lại Input. Các test mục tiêu hiện đạt: `input-field.test.tsx` 28/28, `dropdown-menu.test.tsx` 11/11, `AdminComponentPages.test.tsx` 19/19. Có cảnh báo i18n trong test Dropdown nhưng không làm test thất bại. `git diff --check` đạt.
- Điểm chưa khớp: showcase đặt `max={10}` cho số tiền nhưng giá trị Filled là `1250`; Figma minh họa `3,000`. Thuộc tính HTML `max` hiện chỉ báo giá trị vượt giới hạn không hợp lệ, không chặn thao tác nhập. Cần thống nhất/sửa ví dụ và hành vi theo yêu cầu trước đó trước khi kết luận hoàn tất.
- Phosphor icon đúng nhóm hình/kích thước đã kiểm tra, nhưng không thể cam kết đường nét trùng pixel 100% với SVG trong Figma sau khi đã bỏ asset SVG. Cần xem đây là giới hạn xác minh hình học icon.
- Không chạy lint/build trong lượt này theo yêu cầu người dùng sẽ tự kiểm tra. Lượt gọi `pnpm test -- ...` đầu tiên đã vô tình chạy phạm vi test rộng; đã dừng sau khi thấy lỗi `localStorage` ở test ngoài phạm vi. Các lượt chạy riêng ba file liên quan nêu trên đều đạt.
- Không sửa source code, không stage/commit/push. `tiến trình.md` vẫn chưa xóa; chưa đủ căn cứ kết luận hoàn tất/push do điểm `max` và xác minh lint/build còn chờ.

## Khắc phục giới hạn trường số tiền trong showcase — 2026-09-27

- Theo xác nhận YES, chỉ sửa hành vi trường số tiền trong showcase; không thay đổi `Input` dùng chung hoặc các màn hình số hiện có.
- Đổi giá trị mẫu từ `1250` sang `3000`, đặt giới hạn mẫu `999999999.99`, và `step="any"` để cho phép số thập phân.
- Chuyển riêng ô số tiền trong showcase sang giá trị được điều khiển tại nơi sử dụng; nếu nhập giá trị vượt max thì state không nhận giá trị mới, nên control trở về giá trị hợp lệ trước đó.
- Giữ `type="number"`; giá trị hiển thị là `3000` và không tự có dấu phân cách hàng nghìn. Không thêm formatter trong phạm vi đã duyệt.
- Thêm regression test cho việc từ chối số vượt max và chấp nhận số thập phân trong `AdminComponentPages.test.tsx`.
- Kiểm thử mục tiêu `pnpm test src/pages/admin/components/AdminComponentPages.test.tsx --pool=threads --poolOptions.threads.singleThread`: đạt 20/20. `git diff --check` đạt; lint/build chưa chạy theo yêu cầu người dùng tự kiểm tra.

- Sau phản ánh ô tiền có thể trống khi nhập vượt max, handler được cập nhật để kiểm tra `validity.badInput` và khôi phục giá trị hợp lệ gần nhất nếu dữ liệu nhập chưa hợp lệ hoặc vượt `999999999.99`.
- Phạm vi vẫn chỉ là ô tiền trong showcase; không sửa `Input` dùng chung. Chưa chạy test/lint/build trong lượt sửa lỗi này.
- Người dùng xác nhận lỗi vẫn còn và cần khóa thao tác nhập trước khi giá trị bị đưa vào ô. Tái hiện trên showcase: nhập một lần `1000000000` vào ô Placeholder rỗng làm ô vẫn rỗng vì handler phục hồi state trước đó là chuỗi rỗng; nhập tiếp `123` thì ô nhận được mà không cần tải lại trang. Đây là hoàn tác sau `onChange`, không phải chặn phím trước khi nhập.
- Chrome trả `selectionStart`/`selectionEnd` là `null` với `input[type="number"]`; cần tính rõ cách chặn nhập và dán mà vẫn giữ chỉnh sửa giữa chuỗi trước khi sửa tiếp. Chưa có thay đổi source sau lần sửa handler ở trên; chờ người dùng duyệt hướng xử lý tiếp theo.
- Sau khi người dùng duyệt hướng xử lý, chỉ showcase `Trailing dropdown` đổi sang `type="text"` cùng `inputMode="decimal"` để trình duyệt mở bàn phím số thập phân và cho phép đọc vùng đang chọn khi sửa giữa chuỗi. Không thay đổi `Input` dùng chung.
- Thêm kiểm tra ứng viên trong `onBeforeInput` và `onPaste`: nếu chèn/dán ký tự không phải số thập phân hoặc làm giá trị vượt `999999999.99`, hủy thao tác trước khi nội dung mới vào ô. `onChange` chỉ cập nhật state khi giá trị vẫn hợp lệ; nếu một nguồn nhập khác lọt qua bước chặn trước thì giá trị đang hợp lệ được giữ lại, không gán trực tiếp DOM về chuỗi rỗng.
- Bỏ thuộc tính native `max`/`step` khỏi ô này vì input dạng text không dùng chúng để chặn; cùng một ngưỡng tối đa hiện được kiểm tra trực tiếp trước khi state nhận giá trị. Không thêm format dấu phẩy hay đổi giao diện.
- Đồng bộ test hồi quy trong `src/pages/admin/components/AdminComponentPages.test.tsx`: bỏ kiểm tra native `max`/`step`, xác nhận cấu hình `type="text"`/`inputMode="decimal"`, từ chối chữ, giữ nguyên giá trị khi vượt ngưỡng và chấp nhận số thập phân.
- Chưa chạy test, lint hoặc build trong lượt này. `git diff --check` trên các file tracked không có lỗi khoảng trắng; đã quét khoảng trắng cuối dòng riêng trên hai file đang là untracked và không tìm thấy.
- Cần người dùng kiểm tra trực tiếp thao tác gõ, dán, sửa giữa chuỗi, ký tự chữ và nhập số thập phân trên showcase.
