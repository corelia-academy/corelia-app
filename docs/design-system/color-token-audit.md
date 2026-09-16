# Color Token Audit

- Branch: `feature/admin-components-showcase`
- Issue: TBD (sẽ tạo sau khi page showcase ổn định)
- PR: TBD
- Last updated: 2026-09-16

## Scope

Đối chiếu cách các component dùng color token giữa light mode và dark mode:

- Action
- Badge
- Tag / Chips
- Selection
- Toggle / IconToggle
- Separator
- Scrollbar

## Global token baseline

Nguồn chính: `src/styles/globals.css`.

- Light mode dùng `--primary: var(--blue-600)`, `--destructive: var(--error-500)`, `--border: var(--neutral-200)`, `--action-hover: var(--neutral-100)` và `--action-text: var(--foreground)`.
- Dark mode dùng `--primary: var(--blue-400)`, `--destructive: var(--error-300)`, `--border` bằng `color-mix`, `--action-hover: var(--neutral-800)` và `--action-text: var(--neutral-200)`.
- `src/main.tsx` import `globals.css` trước `brand-palette.css`, nên cần xem `brand-palette.css` là lớp override (ghi đè) khi đánh giá kết quả cuối.
- Các giá trị hex/raw primitive trong global CSS là lớp định nghĩa token. Cảnh báo hotfix tập trung vào component dùng trực tiếp primitive thay vì semantic token (token có ý nghĩa trạng thái) khi đã có mapping tương ứng.

## Status legend

- 🔴 `Open / Hotfix`: có hardcode màu hoặc sai semantic token, cần ưu tiên sửa.
- 🟡 `Pending audit`: cần migrate sang semantic token sau khi page showcase hoàn tất.
- 🟢 `No page blocker`: component không chặn việc tạo showcase page.
- ✅ `Verified`: đã kiểm tra light mode, dark mode và trạng thái tương tác.

## Priority 0 — Hotfix nghiêm trọng

### 🔴 Action — active/destructive dùng primitive trực tiếp

- File: `src/components/ui/action.tsx`
- Evidence: `bg-blue-900`, `bg-error-700` và các pseudo-state (trạng thái CSS như hover/active) tương ứng.
- Risk: active/destructive state không đi qua semantic action token thống nhất giữa hai theme.
- Status: `Open / Hotfix`
- Verification required: default, active, destructive, hover, pressed, disabled, light mode, dark mode.

### 🔴 Tag — datetime separator dùng neutral primitive

- File: `src/components/ui/tag.tsx`
- Evidence: `border-neutral-600` trên separator giữa date và time.
- Risk: contrast của divider phụ thuộc màu cố định thay vì border token theo theme.
- Status: `Open / Hotfix`
- Verification required: label, datetime, disabled, light mode, dark mode.

## Priority 1 — Cần migration semantic token

### 🟡 Badge

- File: `src/components/ui/badge.tsx`
- Evidence: trực tiếp dùng blue, error, warning, success, accent và neutral palette cho outline/filled.
- Assessment: các class đang trỏ vào global primitive, nhưng chưa có semantic badge mapping riêng.
- Status: `Pending audit`

### 🟡 Selection

- File: `src/components/ui/selection.tsx`
- Evidence: `var(--blue-600)`, `bg-blue-600/10`, `bg-blue-600/20`, `has-data-[checked]:border-blue-600`.
- Risk: checked/focus state có thể không đồng nhất với `--primary` khi đổi theme.
- Status: `Pending audit`

### 🟡 Toggle / IconToggle

- File: `src/components/ui/toggle.tsx`
- Evidence: `bg-blue-600`, `bg-blue-800`, `bg-success-500`, `bg-success-700`, `bg-neutral-500` và các text primitive.
- Risk: checked/disabled state chưa biểu đạt bằng semantic interaction token.
- Status: `Pending audit`

## Priority 2 — Đối chiếu sau

### 🟢 Separator

- File: `src/components/ui/separator.tsx`
- Evidence: đang dùng `border-border`; hỗ trợ horizontal/vertical và solid/dashed.
- Status: `No page blocker; audit pending`

### 🟢 Scrollbar

- File: `src/styles/globals.css`, utility `.scrollbar-design`.
- Evidence: thumb dùng `var(--border-strong)`, hover dùng `var(--foreground-muted)`.
- Status: `No page blocker; audit pending`

## Admin component showcase

- Index URL: `/components`
- Detail URL pattern: `/components/:component` for the seven supported slugs.
- Legacy URL: `/admin/components/*` redirects to the matching canonical URL.
- Access: chỉ role `admin`.
- Support staff: không hiển thị menu và bị redirect nếu truy cập trực tiếp.
- Status: `Implemented in pages; token migration intentionally deferred`
- Index render toàn bộ 7 component section trong một standalone page (trang độc lập), có sidebar navigation (điều hướng thanh bên) và scroll tới section tương ứng.
- Các URL `/components/action`, `/components/badge`, `/components/tag`, `/components/selection`, `/components/toggle`, `/components/separator` và `/components/scrollbar` là deep-link (URL trỏ thẳng tới section), nhưng dùng chung page shell.
- Mỗi detail page có state matrix (ma trận trạng thái) và criterion (tiêu chí kiểm tra) ở đầu section.
- Showcase content hiện dùng English default (tiếng Anh mặc định) trực tiếp trong page, không phụ thuộc locale key.
- `src/locales/en/admin.json` và `src/locales/vi/admin.json` đã được khôi phục về trạng thái trước khi dựng showcase; translation của các feature admin khác không bị xóa.
- Sidebar và page meta của route Components cũng dùng literal English riêng cho route này để không tạo lại key dịch mới.

## Phase 2 backlog — page showcase only

Phạm vi của phase hiện tại được chốt là hoàn thiện trải nghiệm xem và test trực tiếp trên các page component. Không sửa `src/styles/globals.css`, `src/styles/brand-palette.css` hoặc các primitive trong `src/components/ui/` ở phase này. Các vấn đề cần sửa ở global/UI được tách riêng bên dưới để xử lý ở phase sau.

### 🔴 P0 — Action showcase đã thu gọn về State reference

- Page: `src/pages/admin/components/AdminActionComponentPage.tsx`
- Evidence hiện tại:
  - Page chỉ còn 4 block `variant × size`; mỗi block có 4 state `Default/HoverAsActive/Pressed/Disabled`.
  - Static gallery và Interactive playground đã được xóa khỏi page để tránh trộn mục đích kiểm tra.
  - Action enabled có click thật để chuyển `isActive`; disabled không chuyển active.
  - State `hover` đã đổi tên thành `hoverAsActive` và truyền đúng prop hiện có.
  - Supporting text được render cho cả `large` và `small`.
- Đối chiếu model/API hiện được page kiểm tra: `Default/Destructive × Large/Small × Default/HoverAsActive/Pressed/Disable`, leading icon, supporting text, active và disabled.
- Page action: `Implemented — State reference only; 16 state samples are clickable where enabled`.
- Trailing icon đã được bật lại bằng prop `showTrailingIcon`; icon vẫn dùng asset/logic sẵn có của `src/components/ui/action.tsx`.
- UI/global follow-up riêng: `src/components/ui/action.tsx` đang hardcode `bg-blue-900`, `bg-error-700` và pressed/route variants; tiếp tục giữ trong backlog 🔴 P0 color-token hotfix, không sửa ở phase này.

### 🟡 P1 — Badge showcase chưa thể hiện đủ tổ hợp thực tế

- Page: `src/pages/admin/components/AdminBadgeComponentPage.tsx`
- Evidence hiện tại:
  - Đã đối chiếu Figma Badge page/frame `15:8083` / `44:1948`: matrix có `9 colors × 4 sizes × 2 variants`, mỗi màu là một hàng dọc riêng và thứ tự là `Disabled, Gray, Primary, Error, Warning, Success, Cyan, Gold, Lime Green`.
  - Matrix hiện tách thành hai block độc lập: `Outline` (màu rỗng) và `Filled` (màu đục). Trong mỗi block, mỗi màu là một hàng riêng với các cột `XSmall, Small, Medium, Large`; nội dung dùng `Label` theo mẫu Figma.
  - Đã cố định cùng một template cột `Color + 4 size columns` cho header và mọi color row, căn giữa Badge theo cột và căn trái label màu để không bị lệch khi cuộn ngang.
  - Đã dùng `Cube` từ Phosphor Icons làm icon tương đương cho `Small`, `Medium`, `Large`, gồm cả leading và trailing icon; `XSmall` giữ đúng Figma là không có icon.
  - Đã bỏ section icon riêng vì toàn bộ tổ hợp icon đã nằm trực tiếp trong matrix theo từng màu/size/variant.
  - Badge là `span` hiển thị, không phải control có `onClick`; vì vậy “disabled” hiện là visual state (trạng thái hiển thị), không phải cơ chế khóa click.
- Page badge: `Implemented — Figma matrix and icon coverage completed`.
- Phạm vi thay đổi lần này chỉ ở showcase page và test; không sửa `src/components/ui/badge.tsx`, global tokens hoặc UI primitive.
- UI/global follow-up riêng: `src/components/ui/badge.tsx` đang dùng trực tiếp blue/error/warning/success/accent/neutral primitive classes; ghi nhận để migrate semantic badge tokens ở phase sau.

### 🔴 P0 — Tag/Chips page đang ép card bằng chiều rộng cố định

- Page: `src/pages/admin/components/AdminTagComponentPage.tsx`
- Evidence hiện tại:
  - Label rows dùng `min-w-[42rem]` và grid có 4 cột `minmax(8rem, 1fr)`.
  - Datetime rows cũng dùng `min-w-[42rem]`; đây là nguyên nhân trực tiếp khiến card không co theo nội dung trên viewport nhỏ.
  - Primitive `Tag` không khai báo width cố định, nhưng có `inline-flex shrink-0`; cần phân biệt đây là kích thước theo nội dung, không phải nguyên nhân chính của card bị ép rộng.
  - Tag hiện là `span`, `disabled` chỉ là visual state; không có click handler để test “disable không click”.
- Page tag/chips: `Implemented — P0 page layout fix completed`.
- UI/global follow-up riêng: `src/components/ui/tag.tsx` có `border-neutral-600` cho datetime separator; đây vẫn là 🔴 P0 color-token hotfix đã ghi ở trên.

### 🟡 P1 — Selection page đã hoàn thiện state matrix và interactive flow

- Page: `src/pages/admin/components/AdminSelectionComponentPage.tsx`
- Evidence hiện tại:
  - Nhóm `Controls` đặt Checkbox reference matrix trước, khôi phục Radio state matrix cũ ngay bên dưới với 3 cột `Size`, `Normal`, `Active`; Radio matrix không có `Indeterminate`.
  - Bên dưới Radio matrix là một `RadioGroup` duy nhất với `Free plan`, `Pro plan`, `Plus plan`; ba option hiển thị cùng một hàng trên màn hình đủ rộng, chọn option mới chuyển active state, không cho click lần hai để deselect.
  - Nhóm `Selection cards` dùng chung cấu trúc cho CheckboxCard và RadioCard theo Figma: `Horizontal/Vertical` → `Small/Large` xếp dọc → mỗi size có grid tối đa 3 cột `Default/Selected/Disabled`; không ép width cố định cho từng card.
  - Text của control và supporting text của card được giữ lại; không còn đưa `read-only` vào page showcase.
  - Checkbox reference dùng hai child state `Normal/Active` và một aggregate state `Indeterminate`; `none selected` là unchecked, `one selected` là dấu trừ, `all selected` là checked.
  - Click aggregate Indeterminate sẽ chọn cả hai child checkbox; thay đổi một child sẽ tự tính lại aggregate state; disabled row không đổi trạng thái.
  - Plan options dùng vùng full-width responsive grid, ba option tự chia đều theo khung hình và không set width cứng.
  - CheckboxCard reference cho phép multi-select (chọn nhiều) trực tiếp trên từng card; card disabled không đổi trạng thái.
  - RadioCard reference dùng một `RadioGroup` cho từng tổ hợp orientation + size để kiểm tra chuyển active giữa các card và deselect card đang active; CheckboxCard vẫn là các card độc lập để kiểm tra multi-select.
  - Card `Indeterminate` chưa được bật. Nếu cần bổ sung, chỉ áp dụng cho CheckboxCard bằng cách mở lại prop `indeterminate` trong primitive, tính aggregate state của nhóm card và bổ sung test tri-state; RadioCard không có trạng thái này.
  - Primitive selection có `data-[disabled]:pointer-events-none` và tests đã kiểm tra disabled không đổi trạng thái; đây là điểm đang đúng luồng, không đánh dấu lỗi page.
- Page selection: `Implemented — controls và selection cards dùng flow tương tác riêng đúng bản chất; cards dùng orientation + size groups và không ép width cứng`.
- UI/global follow-up riêng: checked/focus/card border đang dùng blue primitive trực tiếp (`var(--blue-600)`, `bg-blue-600/10`, `bg-blue-600/20`, `border-blue-600`); migrate semantic token ở phase sau.
- UI primitive follow-up riêng: Radio active icon hiện chưa khớp reference Figma; cần kiểm tra lại center dot/inner ring trong `src/components/ui/selection.tsx` ở phase sau. Chưa sửa trong phase dựng pages.

### 🟡 P1 — Toggle/IconToggle page chưa thể hiện toàn bộ model trên cùng một page

- Page: `src/pages/admin/components/AdminToggleComponentPage.tsx`
- Evidence hiện tại:
  - Variants section mới render `2 sizes × 2 variants`; `defaultChecked` chỉ tạo enabled state và chưa tạo đủ checked/unchecked/disabled matrix.
  - States section mới có một toggle controlled và một toggle checked-disabled; thiếu rõ ràng các tổ hợp `Default/Disabled × Selected/Unselected × Small/Large × Default/Alternative`.
  - IconToggle section có enabled controlled và disabled pressed, nhưng chưa có cả pressed/unpressed theo Figma và chưa có luồng keyboard/đổi icon trực tiếp.
  - Primitive toggle tests đã bao phủ 12 toggle variants và 4 IconToggle states; thiếu sót hiện tại chủ yếu nằm ở page showcase chưa trình bày các model đó cho admin thao tác.
- Page toggle: `Implemented — P1 page matrix/interactions completed; primitive token follow-up deferred`.
- UI/global follow-up riêng: primitive toggle đang dùng trực tiếp `bg-blue-600`, `bg-blue-800`, `bg-success-500`, `bg-success-700` và neutral primitives; migrate semantic interaction token ở phase sau.

### 🟢 Separator — page đã đủ 4 biến thể chính

- Page: `src/pages/admin/components/AdminSeparatorComponentPage.tsx`.
- Evidence: đã có horizontal/vertical và solid/dashed; đây là đúng `2 orientation × 2 dash` của Figma.
- Không có interaction/disabled contract; không cần thêm click test.
- Page separator: `No page blocker`.
- UI/global follow-up riêng: primitive đang dùng `border-border`, nên không có cảnh báo hardcode màu nghiêm trọng.

### 🟢 Scrollbar — đã có thao tác cuộn thật nhưng cần giữ responsive

- Page: `src/pages/admin/components/AdminScrollbarComponentPage.tsx`.
- Evidence: đã có vertical/horizontal × 25/50/75; vùng demo có `overflow-auto`, focus bằng keyboard và nội dung đủ dài để kéo thật.
- Chưa thấy page blocker về trạng thái; cần giữ kiểm tra viewport nhỏ để vùng demo không bị cắt.
- Page scrollbar: `No page blocker`.
- UI/global follow-up riêng: utility `.scrollbar-design` dùng `var(--border-strong)` và `var(--foreground-muted)`, không ghi nhận hotfix page.

### Disabled interaction — phân loại đúng phạm vi

- Control có interaction: `Action`, `Checkbox/Radio`, `CheckboxCard/RadioCard`, `Toggle`, `IconToggle`. Các primitive này đã chuyển `disabled` xuống Base UI và có CSS/logic chặn thay đổi trạng thái; Selection và Toggle đã có test trực tiếp cho click/keyboard disabled.
- Visual-only: `Badge`, `Tag`, `Separator`, `Scrollbar`. Các component này không nhận click contract; không được kết luận là lỗi “disabled vẫn click” nếu page chỉ dùng để hiển thị trạng thái.
- Cần bổ sung test page cho từng control interactive để chứng minh `disabled` không gọi callback; đây là page work ở phase tiếp theo. Nếu yêu cầu biến Badge/Tag thành clickable thì đó là thay đổi API/business contract, phải duyệt riêng trước khi sửa.

## Phase decision

- Phase hiện tại: chỉ dựng và audit page showcase; không sửa global/UI primitive. Trạng thái: `Page navigation implemented — pending user visual QA`.
- Phase dựng pages đã triển khai các thay đổi được duyệt: Action State reference tương tác, Tag/Chips intrinsic sizing, Badge icon combinations, Selection state matrix, Toggle/IconToggle state matrix và standalone single-page navigation cho Components.
- Content source của toàn bộ catalog và 7 detail pages đã thống nhất English default; locale JSON showcase đã trở về baseline.
- Phase tiếp theo: `Global + UI primitive token remediation`; bắt đầu bằng manual QA trên admin URL rồi xử lý color-token hotfix theo thứ tự P0 → P1 → P2.
- Phạm vi phase tiếp theo: `src/styles/globals.css`, lớp override `brand-palette.css` nếu cần, các primitive được liệt kê trong báo cáo và test tương ứng; không dựng lại showcase page.
- Issue/PR: chưa tạo trong lúc audit; sẽ tạo sau khi page scope được chốt và implementation page hoàn tất.
- Final audit 2026-09-16: admin/component test suite trước thay đổi pass `51/51`, gồm catalog, 7 detail pages, Hackathon editor và Selection primitive; TypeScript, ESLint và `git diff --check` pass. Components giữ link trong Admin Sidebar và role guard admin, nhưng đã được tách khỏi `MainLayout`/`AdminLayout` để render như trang standalone. Phase dựng pages được đóng. Các cảnh báo UI/global token vẫn giữ nguyên backlog cho phase tiếp theo.
- Page navigation audit 2026-09-16: gộp 7 component vào một page `/admin/components`, thêm nút `Back to app`, sidebar menu responsive, smooth scroll (cuộn mượt) và deep-link scroll cho từng URL component. Targeted page tests pass `14/14`, TypeScript và ESLint pass; không sửa global token hoặc UI primitive.
- URL audit 2026-09-16: đổi canonical URL sang `/components` và `/components/:component`, giữ `RequireRole` chỉ cho `admin`, cập nhật Admin Sidebar và navigation links; `/admin/components/*` được giữ làm legacy redirect để tương thích bookmark/link cũ.

## Phase tiếp theo — Global + UI primitive token remediation

### Mục tiêu

- Chuẩn hóa cách dùng color token giữa light mode và dark mode.
- Migrate (chuyển đổi) các primitive đang dùng trực tiếp blue/error/warning/success/neutral palette sang semantic token (token có ý nghĩa trạng thái) khi global đã có mapping tương ứng.
- Giữ nguyên route, business flow, showcase layout và interaction đã pass ở phase dựng pages.
- Mỗi component chỉ được sửa trong phạm vi token/state đã ghi nhận; không mở rộng sang refactor API nếu chưa có yêu cầu riêng.

### Phần đã hoàn tất từ phase dựng pages

- Catalog `/components` và 7 detail URL đã hoạt động, chỉ role `admin` được truy cập; `/admin/components/*` chỉ còn là legacy redirect.
- Action, Badge, Tag/Chips, Selection, Toggle/IconToggle, Separator và Scrollbar đã có showcase page riêng theo phạm vi đã duyệt.
- Selection đã có checkbox/radio/card matrix, tri-state checkbox, plan option flow, disabled state và interaction test.
- Sidebar detail route đã tự thu mượt cho component detail và Hackathon editor; test route đã được đồng bộ.
- English default content đã được giữ thống nhất; locale JSON showcase đã trở về baseline.
- Validation phase trước: admin tests `35/35`, Selection primitive tests `18/18`, TypeScript, ESLint và `git diff --check` pass.

### Phần đã ghi nhận nhưng cố tình hoãn từ phase trước

- `src/components/ui/action.tsx`: active/destructive và pressed/route variants còn dùng primitive màu trực tiếp; đây là P0.
- `src/components/ui/tag.tsx`: datetime separator còn dùng `border-neutral-600`; đây là P0.
- `src/components/ui/badge.tsx`: outline/filled đang dùng trực tiếp blue/error/warning/success/accent/neutral; đây là P1.
- `src/components/ui/selection.tsx`: checked/focus/card border đang dùng trực tiếp blue primitive; radio active icon mismatch với Figma là UI follow-up riêng; đây là P1.
- `src/components/ui/toggle.tsx`: checked/disabled đang dùng trực tiếp blue/success/neutral primitive; đây là P1.
- `src/components/ui/separator.tsx`: hiện đã dùng `border-border`; chỉ cần audit light/dark và không có hotfix blocker.
- `src/styles/globals.css` utility `.scrollbar-design`: hiện dùng `var(--border-strong)` và `var(--foreground-muted)`; chỉ cần audit contrast và không có hotfix blocker.
- Badge, Tag, Separator và Scrollbar là visual-only trong showcase; không được biến lỗi “disabled vẫn click” thành thay đổi API nếu chưa có yêu cầu mới.

### Phạm vi 0 — Global token baseline

- Review `src/styles/globals.css` cho light mode, dark mode và semantic mapping hiện có.
- Review `brand-palette.css` vì file này được import sau `globals.css` và có thể override (ghi đè) kết quả cuối.
- Lập mapping rõ cho primary, destructive, border, action hover, action text, focus ring, selected background và disabled foreground/background.
- Xác định token semantic còn thiếu trước khi sửa primitive; không tạo token trùng hoặc token chỉ phục vụ một component.
- Validation: kiểm tra computed color ở light/dark và chạy test/typecheck sau mỗi nhóm thay đổi.

### Phạm vi 1 — P0 Action

- File chính: `src/components/ui/action.tsx` và test tương ứng.
- Xử lý active, destructive, hover-as-active, pressed, trailing icon và disabled theo semantic token.
- Đối chiếu light/dark để bảo đảm active không bị tối hoặc mất contrast.
- Không thay đổi API page showcase nếu primitive hiện tại đã đủ contract.
- Definition of done (tiêu chí hoàn tất): không còn hardcode primitive P0 trong các state đã liệt kê; test default/active/destructive/hover/pressed/disabled pass ở cả theme.

### Phạm vi 2 — P0 Tag / Chips

- File chính: `src/components/ui/tag.tsx` và test tương ứng.
- Thay `border-neutral-600` của datetime separator bằng border semantic phù hợp.
- Kiểm tra label, datetime, icon, disabled và contrast light/dark.
- Không thay đổi intrinsic sizing (kích thước theo nội dung) đã hoàn tất ở showcase page.
- Definition of done: datetime separator không còn phụ thuộc neutral primitive cố định; test render và theme audit pass.

### Phạm vi 3 — P1 Badge

- File chính: `src/components/ui/badge.tsx` và test tương ứng.
- Xác định semantic mapping cho từng color/variant: gray, primary, error, warning, success, cyan, gold, lime green và các variant outline/filled.
- Bảo đảm icon leading/trailing và 4 size không làm sai foreground/background token.
- Giữ nguyên matrix page đã pass.
- Definition of done: badge không dùng primitive trực tiếp khi đã có semantic mapping; test color/variant/size/icon pass.

### Phạm vi 4 — P1 Selection

- File chính: `src/components/ui/selection.tsx` và test tương ứng.
- Migrate checked, focus, selected card border/background và disabled color sang semantic token.
- Tách riêng việc sửa radio active icon mismatch với việc migrate color token; không gộp hai nguyên nhân thành một thay đổi.
- Giữ nguyên tri-state checkbox, radio deselect và disabled behavior của showcase page.
- Definition of done: checkbox/radio/card giữ đúng behavior và màu light/dark; test primitive và page không regression (thoái lui).

### Phạm vi 5 — P1 Toggle / IconToggle

- File chính: `src/components/ui/toggle.tsx` và test tương ứng.
- Migrate checked, pressed, success/alternative, disabled và neutral state sang semantic interaction token.
- Kiểm tra cả Toggle và IconToggle, không chỉ toggle thường.
- Giữ nguyên state matrix và thao tác của showcase page.
- Definition of done: checked/disabled/pressed không còn phụ thuộc primitive hardcode; test variant/size/icon state pass.

### Phạm vi 6 — P2 Separator và Scrollbar

- `src/components/ui/separator.tsx`: xác nhận `border-border` đúng trong light/dark, solid/dashed và horizontal/vertical.
- `src/styles/globals.css`: xác nhận `.scrollbar-design` dùng semantic border/foreground token đúng contrast; không đổi nếu audit đã đạt.
- Đây là phạm vi audit sau P0/P1, không phải hotfix mặc định.

### Quy trình thực hiện trong phase mới

- Mỗi lượt chỉ xử lý một component hoặc một nhóm token có cùng nguyên nhân.
- Trước khi sửa: đọc primitive, global token, test hiện tại và ghi code path cụ thể vào báo cáo.
- Sau khi sửa: chạy test primitive, test page liên quan, TypeScript và ESLint.
- Chỉ cập nhật trạng thái component từ `Open / Hotfix` hoặc `Pending audit` sang `Verified` khi đã kiểm tra light mode, dark mode và interaction liên quan.
- Không sửa page showcase, route, sidebar hoặc content source nếu lỗi chỉ nằm ở global/UI primitive.
- Chưa tạo Issue/PR trong bước lập phase; chỉ tạo sau khi nhóm thay đổi được user xác nhận hoàn tất.

## Status log

- 2026-09-14: Branch `feature/admin-components-showcase` được làm sạch về commit `d17b01cd` trước khi triển khai lại.
- 2026-09-14: Tạo báo cáo tổng hợp color token; chưa sửa UI primitive hoặc `globals.css`.
- 2026-09-14: Thêm catalog `/admin/components` và 7 detail URL lazy-load riêng, chỉ role `admin` được truy cập.
- 2026-09-14: Thêm state matrix và thao tác thực cho Action, Badge, Tag/Chips, Selection, Toggle, Separator và Scrollbar.
- 2026-09-14: Page tests pass 9/9; TypeScript app check pass; lint pass với 0 error. Production build bị môi trường chặn ghi `node_modules/.tmp` và `dist` bằng `EPERM`, không phải lỗi source đã xác định.
- 2026-09-14: Audit lại phase page theo phản hồi mới: ghi riêng backlog page/UI-global cho từng component; xác nhận Action và Tag/Chips là P0 page issues, Badge/Selection/Toggle là P1 page gaps, Separator/Scrollbar không có page blocker. Chưa sửa source.
- 2026-09-14: Đối chiếu git log: Action từ PR #430, Selection từ PR #441, Badge/Tag từ PR #383, Toggle/IconToggle từ PR #476, Separator từ `issue-384-divider-separator`, Scrollbar từ `issue-388-scrollbar-styles`. Các primitive đã có test model khá đầy đủ hơn page showcase; gap hiện tại chủ yếu là page chưa expose đủ trạng thái và luồng thao tác.
- 2026-09-14: Theo xác nhận `YES`, cập nhật page-only: Action matrix chuyển dọc và ghi nhận interaction, Badge bỏ `min-w-[44rem]` và thêm icon combinations, Tag/Chips bỏ `min-w-[42rem]` để tự wrap, Selection thêm disabled/checked matrix và radio deselect, Toggle/IconToggle thêm state matrix. Không sửa global hoặc UI primitive.
- 2026-09-14: Validation phase page: page tests pass 11/11, TypeScript app check pass, ESLint pass, `git diff --check` pass; UI/global diff xác nhận không thay đổi. Chưa tạo commit, Issue hoặc PR.
- 2026-09-14: Theo phản hồi tiếp theo, refactor riêng `AdminActionComponentPage` thành Static gallery, State reference và Interactive playground. Playground cho phép bật/tắt supporting text, date/time, badge, trailing group, trailing icon, hover active color, pressed feedback và disabled; các row Projects/Users/Destructive có active selection và event log thật. Không sửa `action.tsx`.
- 2026-09-14: Validation lại riêng Action page: 11/11 page tests pass, TypeScript pass, ESLint pass; đã kiểm tra `src/components/ui/*` và `src/styles/globals.css` không đổi.
- 2026-09-14: Ghi chú giới hạn phạm vi: page đã truyền `showPressed` đúng API, nhưng `src/components/ui/action.tsx` hiện áp dụng pressed CSS qua `max-lg:active:*`; nếu viewport desktop không thấy pressed visual thì đó là UI primitive follow-up, không tự sửa trong phase pages.
- 2026-09-14: Theo xác nhận `YES`, xóa Static gallery và Interactive playground khỏi Action page; chỉ giữ State reference gồm 4 block, đổi label `hover` thành `hoverAsActive`, thêm click-to-active cho enabled state và supporting text cho cả small. Không sửa primitive hoặc global.
- 2026-09-14: Theo xác nhận `YES`, bỏ i18n key khỏi catalog và toàn bộ 7 showcase pages, dùng English default, khôi phục hai admin locale JSON về `HEAD`, chuyển sidebar/page meta Components sang literal English, bật lại Action trailing icon và cập nhật test/report. Không sửa global token hoặc UI primitive.
- 2026-09-14: Theo xác nhận `YES`, refactor `AdminSelectionComponentPage` thành state reference và interactive playground riêng cho Checkbox, CheckboxCard, Radio và RadioCard; loại mẫu Checkbox/Radio trùng state, thêm select-all/indeterminate, multi-select, single-select, disabled, read-only và Radio allow-deselect. Không sửa `selection.tsx` hoặc global.
- 2026-09-14: Selection validation pass: page tests `12/12`, TypeScript app check pass, ESLint pass. Ghi nhận riêng giới hạn `RadioCard allowDeselect` do wrapper click select rồi deselect; để phase primitive follow-up.
- 2026-09-14: Theo xác nhận `YES`, refactor lại Selection reference page theo layout đã chốt: 4 cột `Small/Disabled-Small/Large/Disabled-Large`, giữ text control/card, bỏ read-only khỏi showcase, gom CheckboxCard/RadioCard theo orientation và loại control như Figma. Không sửa `selection.tsx` hoặc global.
- 2026-09-14: Theo phản hồi tiếp theo, sửa Selection reference để các nhóm size/disabled xếp dọc, grid responsive tối thiểu 3 cột và bỏ `min-w` cố định của reference/card layout. Giữ nguyên text, playground và phạm vi page-only.
- 2026-09-15: Theo xác nhận `YES`, đổi Selection Checkbox/Radio sang ma trận đúng yêu cầu: cột `Size/Normal/Active/Indi`, dòng `Small/Disabled-Small/Large/Disabled-Large`; Radio không giả lập indeterminate vì primitive không hỗ trợ. Card layout giữ riêng theo Figma.
- 2026-09-14: Validation sau content-source cleanup: targeted page tests pass 11/11, ESLint pass, TypeScript app check pass và `git diff --check` pass. Chưa tạo commit, Issue hoặc PR.
- 2026-09-15: Theo xác nhận `YES`, chuyển logic tương tác từ bốn playground của Selection vào trực tiếp các reference matrix/card; xóa playground trùng lặp. Checkbox/CheckboxCard hỗ trợ toggle và multi-select; Radio/RadioCard hỗ trợ click chọn, click lần hai deselect và chọn lại. Chỉ sửa page/test/report, không sửa `src/components/ui/selection.tsx` hoặc global.
- 2026-09-15: Validation Selection flow: page test `12/12` và primitive selection test `18/18` pass; riêng test page xác nhận disabled không đổi trạng thái và radio/card có thể deselect rồi reselect.
- 2026-09-15: Theo xác nhận `YES`, gộp page thành hai nhóm `Controls` và `Selection cards`; đưa Radio thường xuống dưới Checkbox, bỏ Radio Indeterminate matrix và khôi phục single-select option flow `Free plan/Pro plan/Plus plan`. Radio active icon mismatch được ghi backlog phase UI primitive, chưa sửa `selection.tsx`.
- 2026-09-15: Theo phản hồi tiếp theo và xác nhận `YES`, khôi phục lại Radio state matrix cũ với `Size/Normal/Active`, chỉ loại bỏ cột `Indeterminate`; giữ plan option group bên dưới và chuyển `Free plan/Pro plan/Plus plan` thành một hàng responsive. Không sửa RadioCard, `selection.tsx` hoặc global.
- 2026-09-15: Theo xác nhận `YES`, sửa Plan options thành full-width responsive grid và nối Checkbox Indeterminate với hai child state Normal/Active theo tri-state logic: none unchecked, one mixed/dấu trừ, all checked; click aggregate chọn hoặc bỏ chọn cả hai. Chỉ sửa page/test/report.
- 2026-09-15: Theo xác nhận `YES`, gộp CheckboxCard và RadioCard vào cùng một Selection cards reference: giữ `Horizontal/Vertical`, chia dọc `Small/Large`, mỗi size dùng grid tối đa 3 cột `Default/Selected/Disabled`. CheckboxCard hỗ trợ multi-select; RadioCard dùng RadioGroup theo orientation + size để chuyển active và deselect. Chỉ sửa page/test/report; chưa thêm Indeterminate cho card.
- 2026-09-15: Validation sau khi gộp Selection cards: Selection target test `1/1`, primitive selection test `18/18`, TypeScript và ESLint pass. Full admin page test `11/12`; test còn lại là mismatch có sẵn ở Toggle (`border-border-subtle` trong test, `border-border` trong page), không thuộc phạm vi card/Selection và chưa sửa.
- 2026-09-15: Theo xác nhận `YES`, chuyển sidebar admin sang controlled state trong `AdminLayout`: route component detail và Hackathon editor tự thu bằng state mà không remount `SidebarProvider`, để CSS transition hoạt động mượt. Không sửa `src/components/ui/sidebar.tsx` hoặc global.
- 2026-09-15: Đồng bộ `AdminLayout.test.ts` với route component: kiểm tra mở trực tiếp component detail, chuyển catalog → detail → catalog, thao tác mở lại bằng `SidebarTrigger`; test admin pass `35/35`, TypeScript, ESLint và `git diff --check` pass. Phase dựng pages `Closed`; chưa tạo Issue/PR.
- 2026-09-16: Theo xác nhận `YES`, đưa catalog và 7 detail route của Components ra ngoài `MainLayout`/`AdminLayout`, giữ nguyên link `Components` trong `AdminSidebar` và guard `ROLE_GROUPS.projectModerators` cho admin. Dọn test để AdminLayout chỉ kiểm tra Hackathon; catalog test xác nhận standalone page không render sidebar/inset. Admin/component test suite pass `51/51`, TypeScript, ESLint và `git diff --check` pass. Không sửa UI primitive hoặc global token.
- 2026-09-16: Theo xác nhận `YES`, gộp toàn bộ 7 component vào một standalone page `/admin/components`; thêm sidebar menu responsive, nút `Back to app`, scroll mượt theo menu và direct deep-link tới `/admin/components/:component`. Giữ nguyên các detail page làm nguồn nội dung nhúng bằng prop `embedded`, giữ nguyên admin role guard và không sửa global/UI primitive. Targeted tests pass `14/14`, TypeScript và ESLint pass.
- 2026-09-16: Theo xác nhận `YES`, thêm title lớn và mô tả riêng cho từng vùng `Action`, `Badge`, `Tag / Chips`, `Selection`, `Toggle`, `Separator` và `Scrollbar`; bổ sung `aria-labelledby` để định danh section rõ ràng. Chỉ sửa page/test/report, không sửa component logic hoặc global/UI primitive. Targeted tests pass `14/14`, TypeScript và ESLint pass.
- 2026-09-16: Theo xác nhận `YES`, đưa nhóm nút đổi theme `Light/Dark` lên header trên cùng bên phải của standalone Components page; thêm test id riêng để tránh nhầm với các control `aria-pressed` bên trong component. Targeted page tests pass `2/2`, TypeScript và ESLint pass.
- 2026-09-16: Theo xác nhận `YES`, đổi canonical URL của Components page từ `/admin/components/*` sang `/components/*`, giữ quyền admin bằng `RequireRole`, cập nhật Admin Sidebar và deep-link navigation. Thêm legacy redirect (redirect tương thích) từ `/admin/components/*` để không làm gãy URL cũ. Không sửa global token hoặc UI primitive.
