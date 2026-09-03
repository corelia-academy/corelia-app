# Hackathon & Project Test Checklist

Checklist này dùng cho manual regression trên local hoặc Staging. Đánh dấu `[x]` khi kết quả thực tế khớp expected result; ghi bug kèm route, tài khoản, dữ liệu, ảnh/video và console/network error nếu có.

## 1. Chuẩn bị dữ liệu và tài khoản

### Tài khoản

- [ ] Có một tài khoản `admin`.
- [ ] Có một tài khoản `support_staff`.
- [ ] Có participant A chưa đăng ký hackathon.
- [ ] Có participant B đã đăng ký hackathon.
- [ ] Có participant C để kiểm tra quyền trên project không thuộc sở hữu.
- [ ] Có một phiên anonymous hoặc cửa sổ ẩn danh.

### Hackathon

- [ ] Có một draft với slug duy nhất và đủ nội dung VI/EN.
- [ ] Có một hackathon `published`, chưa qua hạn đăng ký và hạn nộp.
- [ ] Có một hackathon `running`.
- [ ] Có một hackathon `ended` hoặc đã qua submission deadline.
- [ ] Hackathon test có ít nhất hai track, hai chuyên môn kỹ thuật và hai công nghệ đang active.
- [ ] Có ít nhất một taxonomy option đã archive.
- [ ] Có project thường và project winner để kiểm tra thứ tự hiển thị.

### Dọn dữ liệu sau test

- [ ] Ghi lại ID/slug của mọi draft, registration và project được tạo trong phiên test.
- [ ] Chuẩn bị ảnh PNG/JPEG/WebP hợp lệ, ảnh sai signature, ảnh lớn hơn 2 MB và ảnh lớn hơn 5 MB.
- [ ] Chuẩn bị nội dung/ảnh bị moderation từ chối và demo/repo/slide URL không xác minh được.
- [ ] Chuẩn bị link demo/slide public, GitHub repository public và video YouTube/Vimeo/Loom hợp lệ.
- [ ] Không dùng dữ liệu production hoặc thông tin cá nhân thật.
- [ ] Xóa fixture test có thể xóa; khôi phục status/deadline/taxonomy đã thay đổi.

## 2. Admin — danh sách và tạo Hackathon

- [ ] `/admin/hackathons` chỉ mở được với admin/support; participant và anonymous bị chặn.
- [ ] Danh sách Admin hiển thị cả draft và các trạng thái public.
- [ ] Draft có hành động **Xem trước**, không có hành động xem public thông thường.
- [ ] Published/running/ended có hành động **Xem public**.
- [ ] Vào `/admin/hackathons/new`, Admin sidebar tự thu thành rail icon và vẫn mở thủ công được.
- [ ] Route tạo mới luôn mở `#overview`, kể cả khi URL ban đầu chứa hash section khác.
- [ ] Chỉ Overview hoạt động; các section sau bị disabled trước khi có draft.
- [ ] Flow tạo mới không hiển thị nút dịch AI bị disabled.
- [ ] Nhập title tiếng Việt tự sinh slug chuẩn, bỏ dấu và chuyển chữ thường.
- [ ] Gõ slug tuần tự như `manual-slug-check` không làm mất dấu `-` đang nhập.
- [ ] Slug có dấu gạch nối cuối được canonicalize khi blur hoặc lưu.
- [ ] Thiếu title VI hoặc slug thì không tạo draft và có thông báo rõ ràng.
- [ ] Tạo draft thành công chuyển sang `/admin/hackathons/:id/edit#overview`.
- [ ] Sau khi tạo draft, toàn bộ section được mở khóa.
- [ ] Draft mới có sẵn taxonomy VI/EN với cùng ID và đúng thứ tự.
- [ ] `document.tracks` được tạo trong document chính, không chỉ có trong locale.

## 3. Admin — chỉnh sửa Hackathon

### Điều hướng và trạng thái draft

- [ ] Mở URL edit có hash bất kỳ sẽ render đúng section tương ứng.
- [ ] Đổi section cập nhật hash; refresh, back và forward giữ đúng section.
- [ ] Đổi section không làm mất các thay đổi draft chưa lưu.
- [ ] Trạng thái **Thay đổi chưa lưu** xuất hiện sau khi sửa field.
- [ ] Reload/đóng tab khi còn thay đổi hiển thị xác nhận rời trang.
- [ ] Lưu thành công xóa trạng thái chưa lưu và không đổi section hiện tại.
- [ ] Rời editor về trang Admin khác làm sidebar Admin mở đầy đủ trở lại.

### Overview và media

- [ ] Title, slug, mô tả ngắn, mode, host và website host lưu/đọc lại đúng.
- [ ] Telegram, X và Facebook giữ đúng giá trị sau refresh.
- [ ] Upload/đổi/xóa banner hoạt động và preview đúng tỷ lệ.
- [ ] Upload/đổi/xóa logo host hoạt động; ảnh không bị méo.
- [ ] Focus ring và label upload truy cập được bằng keyboard.
- [ ] Registration deadline sau submission deadline bị từ chối.
- [ ] Online/offline/hybrid hiển thị đúng trên public detail.

### Nội dung song ngữ và dịch AI

- [ ] VI và EN giữ hai draft nội dung độc lập.
- [ ] Một lần lưu ghi đúng cả hai locale.
- [ ] Đổi VI/EN không tự lưu và không làm mất draft còn lại.
- [ ] Nút dịch AI chỉ xuất hiện sau khi draft đã được tạo.
- [ ] Dịch AI yêu cầu xác nhận trước khi ghi đè locale đích đã có nội dung.
- [ ] Kết quả AI chỉ cập nhật draft, không tự lưu hoặc publish.
- [ ] AI dịch title, short description, Markdown, track, taxonomy và timeline.
- [ ] AI giữ nguyên ID, status, prize amount, sort order và timestamp.
- [ ] Instructor/participant gọi scope dịch Hackathon bị backend từ chối.
- [ ] Lỗi AI/network hiển thị lỗi an toàn và không làm mất nội dung hiện tại.

### Prize, track, timeline và taxonomy

- [ ] Tổng prize pool và currency lưu/đọc lại đúng.
- [ ] Currency ngoài định dạng 2–10 ký tự A–Z hoặc số bị từ chối.
- [ ] Tổng giải theo track vượt prize pool bị từ chối.
- [ ] Thêm/sửa/xóa track cập nhật đồng thời VI/EN theo cùng ID.
- [ ] Create/update luôn serialize track vào `hackathons.document.tracks` với ID, active, thứ tự, prize và rubric.
- [ ] Thêm/sửa timeline giữ đúng thứ tự, start/end và Markdown description.
- [ ] Taxonomy có hai nhóm **Chuyên môn kỹ thuật** và **Công nghệ**.
- [ ] AI/Web3 đứng trong nhóm chuyên môn; TypeScript/Python/Rust/Solidity/Solana nằm trong nhóm công nghệ.
- [ ] Có thể thêm, đổi tên và archive taxonomy chưa dùng.
- [ ] Taxonomy đã được project sử dụng không thể xóa; archive vẫn hoạt động.
- [ ] Taxonomy archived không xuất hiện trong form/filter public mới.

### Winner và trạng thái

- [ ] Admin chọn project winner, đặt nhãn giải và thứ tự thành công.
- [ ] Một project có thể nhận nhiều nhãn giải và giữ đúng thứ tự do Admin đặt.
- [ ] Publish làm hackathon xuất hiện trong catalog public.
- [ ] End cập nhật badge/CTA public đúng.
- [ ] Delete yêu cầu xác nhận và chỉ xóa đúng hackathon mục tiêu.

## 4. Draft preview và catalog public

- [ ] Draft xuất hiện tại `/admin/hackathons`.
- [ ] Draft không xuất hiện tại `/hackathons`, trang chủ hoặc filter hackathon của `/projects`, kể cả khi người xem là Admin.
- [ ] Admin/support mở được `/hackathons/:slug/overview?preview=1`.
- [ ] Participant và anonymous mở URL preview nhận Not Found.
- [ ] Preview dùng dữ liệu draft mới nhất và không rò qua cache public.
- [ ] Banner **Bản xem trước — hackathon này chưa được công khai** hiển thị rõ.
- [ ] Preview không hiển thị CTA đăng ký hoặc tạo project.
- [ ] Chuyển Overview/Prizes/Timeline/Resources/Projects vẫn giữ `preview=1`.
- [ ] Bỏ `preview=1` khỏi draft URL trả Not Found.
- [ ] Published/running/ended vẫn mở được qua URL public bình thường.

## 5. Public Hackathon

- [ ] `/hackathons/:slug` redirect sang `/hackathons/:slug/overview`.
- [ ] Slug không tồn tại hoặc record không public trả Not Found.
- [ ] Header hiển thị title, mô tả ngắn, host, mode, số đăng ký và deadline đúng.
- [ ] Banner/logo thiếu có fallback ổn định, không làm vỡ layout.
- [ ] Overview render Markdown và summary đúng.
- [ ] Prizes hiển thị tổng giải, currency và track allocation đúng.
- [ ] Timeline sắp xếp theo thời gian/sort order.
- [ ] Resources render Markdown/link an toàn.
- [ ] Mỗi tab không có dữ liệu hiển thị empty state tương ứng.
- [ ] Chuyển tab không fetch lại header và không cuộn toàn trang lên đầu.
- [ ] Link VI/EN hiển thị đúng locale nhưng giữ nguyên ID taxonomy.

## 6. Registration

- [ ] Anonymous nhấn đăng ký được chuyển tới login với đường dẫn quay lại phù hợp.
- [ ] Participant chưa đăng ký thấy CTA **Đăng ký ngay** khi còn hạn.
- [ ] Đăng ký thành công tạo đúng một registration với status `registered`.
- [ ] Nhấn lại hoặc retry không tạo registration trùng.
- [ ] `participants_count` tăng đúng sau insert và giảm đúng sau delete.
- [ ] Participant đã đăng ký thấy trạng thái đăng ký và CTA tạo project phù hợp.
- [ ] Hackathon chưa mở, đã kết thúc hoặc quá hạn đăng ký không cho đăng ký.
- [ ] Backend vẫn từ chối registration không hợp lệ dù gọi trực tiếp API/RPC.

## 7. Tạo Project dự thi

- [ ] Anonymous không mở được form tạo project.
- [ ] `/projects/new` không có query hackathon tạo được standalone project public.
- [ ] Participant chưa đăng ký không thể tạo project cho hackathon.
- [ ] Participant đã đăng ký mở được `/projects/new?hackathon=:slug` trước deadline.
- [ ] Form có title, slug, short summary, demo URL, GitHub URL, slide URL, demo video URL, logo, screenshots, team members và taxonomy hiện có.
- [ ] Form bắt buộc title và slug canonical hợp lệ; title tối đa 160 ký tự và summary tối đa 1.000 ký tự.
- [ ] Gõ slug tuần tự giữ dấu `-`; blur/save loại dấu nối thừa.
- [ ] Auto-slug từ tiếng Việt bỏ dấu và tạo chuỗi chữ thường hợp lệ.
- [ ] Khi chưa sửa slug thủ công, đổi title tiếp tục cập nhật slug; sau khi sửa slug thủ công, đổi title không ghi đè slug.
- [ ] Bắt buộc chọn ít nhất một track, một chuyên môn kỹ thuật và một công nghệ.
- [ ] Chọn nhiều mục trong mỗi nhóm được lưu đúng ID.
- [ ] Track custom vừa lưu trong Hackathon editor được RPC chấp nhận.
- [ ] Taxonomy ID không thuộc hackathon hoặc đã bị xóa bị backend từ chối.
- [ ] Demo URL, GitHub repo URL, slide URL, video URL, summary và visibility được lưu đúng.
- [ ] Project mới mặc định public và xuất hiện ngay tại `/projects` sau khi lưu thành công.
- [ ] Không xuất hiện trạng thái moderation `approved`, `pending`, badge kiểm duyệt hoặc hàng chờ Admin.
- [ ] Submit thành công tạo project canonical và submission liên kết tới hackathon.
- [ ] Retry không tạo project/submission trùng.
- [ ] Quá submission deadline bị backend từ chối, không chỉ disabled ở UI.

### AI content gate và link validation

- [ ] Title, summary và nội dung locale an toàn vượt moderation và được lưu.
- [ ] Nội dung có hại ở title/summary/locale bị từ chối với error code chỉ rõ field; project mới không được tạo.
- [ ] Khi edit bị AI từ chối, dữ liệu project cũ giữ nguyên hoàn toàn.
- [ ] Logo hoặc screenshot có nội dung bị cấm bị từ chối trước khi xuất hiện trong Storage.
- [ ] `repo_url` chỉ chấp nhận HTTPS `github.com/:owner/:repository`; GitHub issue/profile/path phụ bị từ chối.
- [ ] Demo/slide URL dùng HTTP, credentials, localhost, loopback hoặc private IP bị từ chối.
- [ ] Demo/repo/slide không public hoặc không xác minh được bị hard-block.
- [ ] AI timeout, provider error, response sai schema hoặc thiếu API key đều hard-block và không ghi project.
- [ ] `video_url` không xuất hiện trong request Moderations/Responses; link video không bị AI content/link check.

### Logo và screenshots

- [ ] Logo nhận đúng một ảnh PNG/JPEG/WebP tối đa 2 MB.
- [ ] Screenshots nhận nhiều ảnh, tối đa 6 ảnh và tối đa 5 MB mỗi ảnh.
- [ ] MIME không khớp file signature, file rỗng hoặc định dạng khác bị từ chối.
- [ ] Upload nhiều screenshots trong một lần giữ đủ ảnh và đúng thứ tự.
- [ ] Nút lên/xuống thay đổi thứ tự screenshots và thứ tự giữ nguyên sau refresh.
- [ ] Thay/xóa logo và xóa screenshot lưu đúng; object cũ không còn được tham chiếu.
- [ ] Media lưu dưới `project-media/{userId}/{projectId}/logo|screenshots/...`; database chỉ lưu storage path.
- [ ] Media private không mở trực tiếp được; signed URL hợp lệ hiển thị được cho người có quyền.
- [ ] Rời form hoặc save thất bại xóa upload tạm; upload quá 24 giờ được cleanup khi media/save cleanup chạy.

### Team members khi tạo project

- [ ] Có thể tìm và chọn nhiều tài khoản Corelia trước khi tạo project.
- [ ] Project hackathon chỉ liệt kê/mời participant có registration hợp lệ của chính hackathon.
- [ ] Standalone project có thể mời tài khoản Corelia hợp lệ.
- [ ] Nếu AI gate chặn project thì không có collaboration invite hoặc notification nào được tạo.
- [ ] Chỉ gửi invitation sau khi project đã lưu thành công.
- [ ] Duplicate invitation đang pending bị từ chối, không tạo notification trùng.
- [ ] Người được mời chưa accept chưa xuất hiện như team member.

## 8. Project detail và chỉnh sửa

- [ ] Project public mở được tại `/projects/:slug`.
- [ ] Visibility `unlisted`/`private` tuân thủ đúng quyền xem hiện hành.
- [ ] Owner mở được `/projects/:slug/edit`; người khác bị chặn.
- [ ] Admin/support có thể hỗ trợ sửa theo quyền hiện hành.
- [ ] Form edit tải đúng track, chuyên môn và công nghệ đã chọn.
- [ ] Sửa title, summary, demo/repo/slide/video URL, logo, screenshots và taxonomy lưu/đọc lại đúng.
- [ ] Đổi slug chuyển sang URL canonical mới.
- [ ] UUID và slug cũ redirect sang slug mới.
- [ ] Slug lịch sử không thể được project khác tái sử dụng.
- [ ] Owner không sửa được nội dung/taxonomy sau submission deadline.
- [ ] Sửa project không làm submission mất source provenance hoặc hackathon link.
- [ ] Logo hiển thị dạng vuông `object-contain` ở project card và đầu trang detail, không bị crop như cover.
- [ ] Video YouTube/Vimeo/Loom được chuẩn hóa và embed an toàn.
- [ ] Video provider khác chỉ có link mở ngoài, không render iframe tùy ý.
- [ ] Khối video đứng trước gallery screenshots trên trang detail.
- [ ] Gallery hiển thị đúng toàn bộ screenshots và đúng thứ tự đã lưu.
- [ ] Project card/detail/profile/hackathon showcase chỉ có nút thả tim; không còn form, danh sách hoặc bộ đếm bình luận.
- [ ] Anonymous được nhắc đăng nhập khi thả tim; user đăng nhập thả/bỏ tim và số tim cập nhật đúng.

### Quản lý team trong trang edit

- [ ] Owner thấy accepted members và pending invitations.
- [ ] Owner gửi thêm invite, thu hồi pending invite và xóa accepted member thành công.
- [ ] Invitee accept/decline bằng đúng tài khoản hoạt động; tài khoản khác bị từ chối.
- [ ] Owner không thể chèn trực tiếp accepted collaborator để bỏ qua bước tự accept.
- [ ] Accepted member không có quyền mở/lưu form edit project.
- [ ] Owner và staff vẫn là các bên duy nhất có quyền sửa project.
- [ ] Detail hiển thị owner và accepted member có avatar/link profile; không hiển thị pending invite.
- [ ] Member đặt `show_in_portfolio=false` biến mất khỏi detail public và portfolio cá nhân.
- [ ] Member đặt `show_in_portfolio=true` xuất hiện lại trên project public/unlisted và portfolio.

## 9. Project gallery và bộ lọc

- [ ] Tab Projects chỉ hiển thị project thuộc hackathon hiện tại.
- [ ] `/projects` không trộn sai project course/hackathon/showcase.
- [ ] Taxonomy filter trên `/projects` chỉ xuất hiện sau khi chọn hackathon.
- [ ] Filter bar hiển thị Tracks, Chuyên môn kỹ thuật, Công nghệ và Sort.
- [ ] Chọn/bỏ chip cập nhật query URL và `aria-pressed` đúng.
- [ ] Số bộ lọc tổng và số đã chọn theo nhóm cập nhật đúng.
- [ ] **Xóa lọc** chỉ xóa `tracks`, `sectors`, `tech`; giữ `sort`, `preview` và tham số không liên quan.
- [ ] Chọn filter, xóa filter hoặc đổi sort không cuộn trang lên đầu.
- [ ] OR trong cùng một nhóm: chọn hai sector trả project thuộc một trong hai sector.
- [ ] AND giữa các nhóm: track + sector + tech chỉ trả project khớp cả ba nhóm.
- [ ] Archived taxonomy không được render thành chip mới.
- [ ] Newest/oldest thay đổi thứ tự chính xác.
- [ ] Sort chỉ còn newest, oldest và nhiều tim nhất; không còn lựa chọn nhiều bình luận nhất.
- [ ] Load more không lặp hoặc bỏ sót project.
- [ ] Winner phù hợp filter đứng trước project thường và theo `sort_order`.
- [ ] Empty state xuất hiện khi không có project phù hợp.
- [ ] **Mở trang tổng hợp dự án** dẫn tới `/projects?hackathon=:slug`.

## 10. Responsive, keyboard và accessibility

Kiểm tra tối thiểu ở 1440px, 1024px, 768px và 390px.

- [ ] Không có horizontal document overflow.
- [ ] Title hackathon dài wrap an toàn, không bị cắt.
- [ ] Header, metrics, CTA và project cards không chồng lấn.
- [ ] Tab bar mobile cuộn ngang và active tab luôn được đưa vào viewport.
- [ ] Tab/Shift+Tab đưa tab hoặc filter chip được focus vào vùng nhìn thấy.
- [ ] Filter chip mobile cuộn ngang độc lập, không kéo cả document.
- [ ] Touch target chính đạt tối thiểu 44px trên mobile.
- [ ] Focus ring nhìn rõ trên tab, chip, select, upload và CTA.
- [ ] Icon-only button có accessible name.
- [ ] Selected/disabled/archived state không chỉ phân biệt bằng màu.
- [ ] Zoom 200% vẫn thao tác được và không mất nội dung chính.
- [ ] Light/dark theme giữ contrast và trạng thái selected rõ ràng.

## 11. Security và regression

- [ ] RLS/RPC chặn participant tạo/sửa/publish Hackathon.
- [ ] RLS/RPC chặn người dùng sửa project của owner khác.
- [ ] Browser role không có quyền INSERT/UPDATE trực tiếp `projects` hoặc INSERT/UPDATE/DELETE `project_locales`.
- [ ] Browser role không thể ghi trực tiếp `hackathon_submissions` để đồng bộ project và bỏ qua AI gate.
- [ ] Không còn trigger tự tạo/sync project từ hackathon/course submission ngoài `projects.save`.
- [ ] Browser role không có quyền truy cập registry `project_media_uploads` hoặc ghi trực tiếp prefix `project-media`.
- [ ] Bảng `project_comments`, trigger, function guard và các index/policy liên quan không còn tồn tại trong database.
- [ ] RLS/grant của `project_hearts` vẫn cho phép đọc count và thả/bỏ tim đúng quyền.
- [ ] Public chỉ đọc được collaborator của project public/unlisted khi `show_in_portfolio=true`.
- [ ] Invitation/pending state và thao tác quản lý team không lộ cho anonymous/người không có quyền.
- [ ] Cột project `cover_image_url` và `screenshot_url` không còn tồn tại; chỉ còn `logo_path` và `screenshot_paths` với constraint tối đa 6.
- [ ] Public query không trả draft dù JWT thuộc admin.
- [ ] Preview query key/cache có user ID và không dùng chung với public detail.
- [ ] Không có service-role key hoặc secret trong frontend/network payload.
- [ ] Markdown không thực thi script hoặc URL nguy hiểm.
- [ ] Route workspace Hackathon cũ trả Not Found.
- [ ] UI không còn judging, score, role invite, review registration, analytics, email blast hoặc credential award cũ.

## 12. Automated verification và release

- [x] Targeted Vitest cho project video, URL/MIME/path validation và AI gate xanh: 13/13.
- [x] `pnpm test` trên release candidate chỉ chứa Project xanh: 41 files, 210/210 tests.
- [x] `pnpm lint` xanh.
- [x] `pnpm build:staging` xanh trên release candidate.
- [x] `pnpm db:verify:local` recreate toàn bộ migration chain và SQL integration assertions thành công.
- [x] Local schema assertions xác nhận legacy columns/triggers đã mất, browser write grants đã bị thu hồi và `project_comments` đã bị xóa hoàn toàn.
- [x] `pnpm db:verify` xanh: 127/127 database guardrails.
- [x] Hai migration Project đã được thêm vào approved pending release manifest; release candidate không chứa migration Jobs đang làm dở.
- [x] Secret scan trên staged diff không phát hiện credential/API key được điền giá trị.
- [ ] Workflow **Deploy Staging** xanh khi push chạm `supabase/**`.
- [ ] Xác nhận frontend Staging pipeline đã publish đúng commit trước khi manual QA.
- [ ] Ghi lại commit SHA, build/deploy URL và thời gian test.

## 13. Biên bản chạy test

| Trường | Giá trị |
|---|---|
| Môi trường | Local / Staging |
| Commit SHA | |
| Tester | |
| Thời gian bắt đầu | |
| Trình duyệt/thiết bị | |
| Hackathon ID/slug | |
| Project ID/slug | |
| Kết quả | Pass / Fail / Blocked |
| Bug/link bằng chứng | |
| Dữ liệu đã cleanup | Có / Không / Không áp dụng |
