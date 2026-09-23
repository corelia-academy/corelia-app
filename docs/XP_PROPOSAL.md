# Đề xuất XP cho Corelia

Ngày nghiên cứu: 2026-09-22. Trạng thái: đề xuất sản phẩm kèm bản triển khai local đang kiểm thử; chưa deploy hoặc xác minh database production. Đối chiếu source local trên nhánh `release/project-production`.

## 1. Phạm vi

Giai đoạn đầu: người dùng thực hiện hoạt động Corelia muốn khuyến khích → hệ thống xác nhận → tự động cộng XP → hiển thị tổng và lịch sử. Chưa làm cửa hàng, vật phẩm, đổi thưởng, level hay leaderboard.

XP ghi nhận đóng góp và tiến bộ; không đại diện cho năng lực đã được chứng nhận. Credential tiếp tục theo điều kiện cấp hiện có. Không cộng XP cho mua khóa học hay trả phí.

## 2. Hiện trạng đã kiểm tra

| Nguồn | Phát hiện và hệ quả |
|---|---|
| `supabase/migrations/20260814020000_daily_streak_claims.sql` | Có `user_point_ledger`, unique `(user_id, source_key)`, RLS đọc điểm của mình. Điểm cũ: điểm danh +1, OCID +50, GitHub +50. Constraint `source` hiện giới hạn ba loại này. |
| `supabase/migrations/20260827130000_remove_daily_streak_feature.sql` | Đã gỡ bảng/RPC streak và RPC đồng bộ điểm kết nối; cố ý giữ ledger. Không coi `docs/streak/streak-system.md` là mô tả runtime hiện tại. |
| `src/lib/courses.ts`, hàm ghi tiến độ | Browser upsert `lesson_progress` với `completed_at`, sau đó đồng bộ hoàn thành khóa. Không thể xem timestamp do browser gửi là bằng chứng đầy đủ để thưởng. Cần rà soát các guard/trigger thực tế trước khi tích hợp. |
| `src/lib/quizAttempts.ts` | Nộp đáp án qua `submit_quiz_attempt` / `submit_quiz_attempts`; frontend tổng hợp kết quả từ các lần trả lời gần nhất. `completed` hiện không đồng nghĩa với đạt một ngưỡng điểm. Cần định nghĩa và xác minh điều kiện XP ở server. |
| `supabase/functions/corelia-api/courses/completion.ts` | Có `syncCourseCompletionIfReady`, gọi readiness RPC, kiểm tra bài học và bài cuối khóa được duyệt nếu bắt buộc; cập nhật `enrollments.completed_at`. Đây là điểm tích hợp cho thưởng hoàn thành khóa. |

Hướng ưu tiên: mở rộng ledger hiện có sau khi kiểm tra catalog và dữ liệu thực tế, tránh tạo hai nguồn tổng XP. Không khôi phục tính năng streak chỉ để làm XP.

## 3. Các hành vi nên thưởng

Các con số dưới đây là mức thử nghiệm do đề xuất này đặt ra, chưa được kiểm chứng bằng dữ liệu người dùng Corelia.

| Hành vi | XP đề xuất | Điều kiện và giới hạn | Đợt |
|---|---:|---|---|
| Hoàn tất hồ sơ cơ bản | — | Tạm bỏ thưởng điền hồ sơ khỏi MVP; ưu tiên nhiệm vụ kết nối đã xác minh bên dưới. | — |
| Kết nối GitHub | 50 | Một lần/user; OAuth đã xác minh, giữ khóa `github_connected` để không thưởng lại điểm cũ. | MVP kết nối |
| Kết nối OCID | 50 | Một lần/user; backend xác minh kết nối, giữ khóa `ocid_connected`. | MVP kết nối |
| Liên kết ví Ethereum đầu tiên | 30 | Một lần/user cho hệ Ethereum; phải xác minh chữ ký. Thêm ví thứ hai không thêm XP. | MVP kết nối |
| Liên kết ví Solana đầu tiên | 30 | Một lần/user cho hệ Solana; phải xác minh chữ ký. Thêm ví thứ hai không thêm XP. | MVP kết nối |
| Hoàn thành bài học | 10 | Một lần/user/lesson; nội dung hợp lệ, có quyền học, server xác nhận điều kiện hoàn thành. Instructor không kiếm XP từ nội dung mình quản lý. | MVP |
| Vượt qua quiz | 20 | Một lần/user/quiz; trả lời toàn bộ câu đang áp dụng và đạt ít nhất 80% theo kết quả server. Quiz gắn với lesson được thêm 20 bên cạnh 10 của lesson. | MVP |
| Hoàn thành khóa học | 100 | Một lần/user/course; theo readiness hiện có và nội dung được phép thưởng. Là bonus ngoài XP bài học/quiz. | MVP |
| Ngày học có hoạt động hợp lệ | 5 | Một lần/ngày khi có ít nhất một bài học hoặc quiz mới đủ điều kiện nhận XP; không thưởng chỉ vì đăng nhập. | Tiếp theo |
| Bài cuối khóa được duyệt | 50 | Một lần/user/assignment; dựa trên kết quả duyệt thật. Sửa/nộp/duyệt lại không tạo thưởng mới. | Tiếp theo |
| Nộp project đầu tiên vào hackathon | 100 | Nhiệm vụ một lần/user: nộp thành công một project vào một hackathon theo điều kiện nộp bài hiện có. Không cần chờ deadline, chấm điểm hay duyệt giới thiệu. | MVP |
| Like project | 2 | Thưởng người thực hiện like; một lần/user/project, tối đa 5 project được thưởng/ngày (10 XP). Không thưởng like project mình sở hữu hoặc là thành viên. | MVP |

Kết nối OCID/GitHub: bảo toàn điểm lịch sử và tái sử dụng khóa cũ để không thưởng lần hai. Theo hướng trao đổi tiếp theo, bổ sung nhiệm vụ kết nối làm ưu tiên onboarding; mức XP vẫn là đề xuất. Google có thể là phương thức liên kết/đăng nhập nhưng chưa đề xuất thưởng riêng.

Không tự động thưởng: mở app/trang, xem video theo đồng hồ client, đăng ký khóa nhưng không học, comment/share, nhắn AI, gửi đơn xin việc, tạo project rỗng, upload hoặc mint lại credential. Những hoạt động này dễ tạo số lượng mà chưa chứng minh giá trị.

### Quy tắc project và hackathon

Diễn giải đề xuất cho “nộp 1 project vào 1 hackathon duy nhất”: đây là nhiệm vụ khởi đầu một lần cho mỗi người dùng, không phải thưởng cho từng cặp project–hackathon. Giới hạn chỉ áp dụng cho thưởng XP, không hạn chế người dùng tiếp tục nộp project hoặc tham gia hackathon khác.

- Thưởng +100 khi backend ghi nhận lần nộp thành công đáp ứng các điều kiện nộp bài hiện có. Tạo draft hoặc chỉ đăng ký hackathon chưa đủ; không bổ sung quy trình duyệt chất lượng riêng.
- MVP thưởng cho người có quyền thực hiện lần nộp, không tự phát cho toàn bộ thành viên. Dùng khóa `first_hackathon_submission` theo user và ghi project/hackathon trong metadata.
- Một project chỉ kích hoạt thưởng nộp lần đầu cho một người: cần thêm khóa duy nhất theo project ở sự kiện thưởng, ngăn đổi người nộp/chuyển chủ sở hữu/nộp sang hackathon khác để phát lại thưởng.
- Rút rồi nộp lại, sửa bài hoặc tham gia hackathon tiếp theo không thưởng lại nhiệm vụ này. Rút bài không tự trừ XP; thu hồi khi xác nhận thưởng sai hoặc gian lận bằng bản ghi điều chỉnh.
- Thay thế hai mục “project được duyệt để giới thiệu” và “nộp sản phẩm sau deadline”; bỏ mục chung chung “đóng góp cộng đồng hữu ích” khỏi phạm vi hiện tại.

### Quy tắc like project

Mức +2 XP/like và tối đa 10 XP/ngày là đề xuất ban đầu, chưa được chốt bằng dữ liệu thực tế.

- Người like nhận XP, chủ project không nhận XP theo số like ở MVP.
- Chỉ tính project công khai mà user được phép like; loại project do user sở hữu hoặc đang là thành viên. Backend kiểm tra trạng thái thật, không tin cờ từ browser.
- Khóa thưởng `project_liked:<project_id>` theo user tồn tại vĩnh viễn. Unlike không xóa dấu vết thưởng và không tự trừ XP; like lại không cộng thêm, kể cả ngày khác.
- Ghi nhận lần like hợp lệ đầu tiên riêng với ledger: vượt trần ngày vẫn like bình thường, nhưng không thưởng bù về sau và không thể unlike/re-like ngày sau để nhận thưởng cho lượt đã bị giới hạn.
- Kiểm tra lần like đầu, giới hạn ngày và ghi XP trong cùng transaction/khóa theo user để nhiều tab không vượt trần. Ngày tính theo UTC trong MVP, UI nêu rõ giờ reset quy đổi sang giờ địa phương; không cần phục hồi bảng streak đã gỡ.
- UI cho biết “+2 XP · còn N lượt nhận XP hôm nay”; khi hết trần vẫn cho like và thông báo rõ không nhận thêm XP.
- Giới hạn này giảm khả năng lạm dụng, không chứng minh chất lượng tương tác hay loại bỏ hoàn toàn nhiều tài khoản; theo dõi tỷ trọng XP từ like trước khi tăng mức thưởng.

## 4. Trải nghiệm MVP

- XP gắn với cụm avatar/tên như điểm đóng góp. Vị trí chính: hồ sơ cá nhân, thẻ tác giả/thành viên của project và thông tin người đăng trong feed. Không thêm bộ đếm XP độc lập trên thanh header.
- Bố cục ưu tiên: avatar bên trái; tên bên phải; dòng phụ `1.250 XP` dưới tên. Với thẻ rộng có thể đặt chip XP ngay sau tên; màn hình hẹp đưa xuống dòng, không đè số lên ảnh hoặc dùng dấu chấm kiểu thông báo chưa đọc.
- Header giữ avatar/tên hiện tại; trong menu tài khoản thêm phần avatar, tên và tổng XP, cùng mục “XP của tôi”. Avatar nhỏ trong danh sách xếp chồng/notification không bắt buộc có XP.
- Nhấn XP của mình mở “XP của tôi”: tổng XP, biểu đồ tuần, cách kiếm và lịch sử gần đây có phân trang. XP của người khác chỉ mở giải thích điểm tích lũy và thông tin hồ sơ được phép xem; không lộ lịch sử học, kết nối ví hay OAuth.
- MVP hiển thị số XP và biểu đồ hoạt động; chưa gắn nhãn “chuyên gia”, cấp bậc, huy hiệu top contributor hoặc vòng tiến độ vì chưa có hệ level/ranking. Đây là tổng XP toàn Corelia, không phải điểm riêng của từng hackathon/project.
- Tổng XP có thể hiển thị cùng danh tính theo quyền hiển thị hồ sơ hiện có. Nếu chưa được phép đọc tổng công khai, ẩn chip; không hiển thị `0` thay cho dữ liệu bị hạn chế. Ledger vẫn riêng tư; bổ sung read model tổng XP với quyền phù hợp, không mở RLS lịch sử cho mọi người.
- Source hiện có `UserAvatar.tsx` và cụm danh tính ở Header/feed. Khi triển khai, ghép chip XP ở component danh tính, không tự fetch XP bên trong mỗi avatar. Tổng XP được tải cùng dữ liệu danh tính hoặc theo batch để tránh một request cho mỗi avatar.
- Tại bài học/quiz, hiển thị trước phần thưởng và trạng thái đã nhận. Thưởng khóa học hiển thị trong phần hoàn thành khóa.
- Khi server xác nhận thưởng mới, thông báo ngắn: “+10 XP · Hoàn thành bài học”. Retry hoặc tải lại trang không phát thưởng/thông báo mới.
- Gộp các thưởng cùng thao tác: “+130 XP” kèm chi tiết nếu hoàn thành bài cuối, vượt quiz và hoàn thành khóa cùng lúc.
- Nếu chưa xác nhận được XP, hiển thị trạng thái đang đồng bộ; không đổi lỗi tải số dư thành `0 XP` và không làm mất kết quả học.
- Copy: “Tích lũy XP qua các hoạt động trên Corelia”. Chưa hứa giá trị quy đổi, thời điểm mở shop hay phần thưởng chưa tồn tại.
- Dùng i18n VI/EN, query hooks và primitives hiện có.

Ví dụ: hoàn thành 3 bài (+30), vượt 1 quiz (+20) → +50 XP; nếu đồng thời hoàn tất khóa, thêm +100 → +150 XP. Đợt MVP chưa có daily bonus.

### 4.1. Lịch hoạt động XP trong hồ sơ

Tên khối: **“Hoạt động kiếm XP”**. Đây là lịch ô vuông kiểu contribution calendar, mỗi ô tương ứng một ngày; không gọi là lịch học vì XP còn đến từ kết nối tài khoản, nộp project và like.

- Desktop mặc định 12 tháng gần nhất, mobile mặc định 3 tháng gần nhất; sắp theo cột tuần, có nhãn tháng và ngày trong tuần. Không ép cả năm vào chiều rộng màn hình nhỏ.
- Màu ô thể hiện tổng XP hợp lệ kiếm được trong ngày: 0, 1–10, 11–30, 31–100 và trên 100 XP. Đây là ngưỡng hiển thị ban đầu, dùng nhất quán giữa người dùng và có chú giải ít → nhiều.
- Hover, focus bằng bàn phím hoặc chạm vào ô hiển thị ngày và số XP. Với chủ tài khoản có thêm phân rã theo hoạt động, ví dụ `22/09 · +32 XP`: bài học +10, quiz +20, like project +2; có thể mở lịch sử đã lọc theo ngày.
- Người khác chỉ được xem ngày và tổng XP nếu có quyền xem phần hồ sơ này; không trả về chi tiết học tập, OAuth hoặc địa chỉ ví qua API tổng hợp.
- Ngày đã tải thành công nhưng không kiếm XP có ô nhạt; ngày tương lai không có ô tương tác. Khoảng trước khi có dữ liệu đáng tin được đánh dấu “Chưa có dữ liệu”, không suy ra là không hoạt động.
- Loading dùng skeleton; lỗi có thông báo và retry. Không tô toàn bộ lịch thành 0 XP khi tải thất bại. Người chưa kiếm XP có empty state hướng dẫn làm nhiệm vụ.

### 4.2. Biểu đồ tuần trong “XP của tôi”

- Phía trên biểu đồ ghi **“Tuần này: 180 XP”** cùng khoảng ngày đang xem; bảy cột từ thứ Hai đến Chủ nhật, trục giá trị là XP kiếm được mỗi ngày.
- Cho xem tuần trước/tiếp theo, không đi quá tuần hiện tại. Ngày tương lai trong tuần hiện tại thể hiện là chưa đến, không phải ngày không hoạt động.
- Hover/focus/chạm cột xem ngày và số XP; chọn ngày mở cùng lịch sử chi tiết như lịch ô vuông.
- Dùng màu, cách định dạng số và điều kiện tính điểm nhất quán với lịch hoạt động. Không thêm đường mục tiêu, streak hoặc cấp độ khi các tính năng đó chưa được thiết kế.

### 4.3. Dữ liệu, quyền riêng tư và khả năng tiếp cận

- Backend tổng hợp từ ledger theo ngày UTC trong MVP, thống nhất với giới hạn thưởng like; UI ghi rõ “Ngày tính theo UTC”. Không chia lại ngày theo timezone của người đang xem khiến hai người thấy lịch khác nhau.
- Ngày hoạt động lấy từ `occurred_at` đã xác minh của sự kiện; `created_at` dùng cho thời điểm ghi ledger. Worker xử lý trễ cập nhật đúng ngày sự kiện, đồng thời refresh tổng XP, lịch, biểu đồ tuần và lịch sử.
- Biểu đồ thể hiện XP kiếm hợp lệ sau điều chỉnh. Bản ghi thu hồi phải tham chiếu khoản thưởng gốc để giảm đúng ngày gốc, không tạo cột XP âm ở ngày xử lý. Lịch sử riêng vẫn thể hiện thời điểm và lý do điều chỉnh; không trừ cùng reversal hai lần.
- Tổng tuần bằng tổng bảy ngày trong tuần; lịch chỉ cộng phạm vi đang xem. Tổng XP cạnh avatar là toàn thời gian nên có thể lớn hơn phạm vi biểu đồ.
- Điểm lịch sử có timestamp đáng tin có thể hiển thị ở ngày tương ứng; khoản chuyển đổi không đủ thời gian nguồn hiển thị riêng là “XP lịch sử”, không gom toàn bộ vào ngày rollout để tạo hoạt động giả.
- API tổng hợp chỉ trả các trường cần thiết như ngày và XP, kiểm tra quyền ở server. Ledger chi tiết vẫn chỉ chủ tài khoản đọc; không mở quyền đọc toàn bộ ledger để vẽ lịch công khai.
- Dùng nhãn đọc được bằng trình đọc màn hình, tooltip truy cập qua bàn phím/chạm và bản tóm tắt bằng chữ; không chỉ dựa vào màu. Có thể dùng điều hướng phím mũi tên cho lịch thay vì bắt Tab qua hàng trăm ô.
- Tái sử dụng query cache và công cụ biểu đồ hiện có khi triển khai; không fetch từng ô/ngày hoặc từng avatar. Chỉ tải biểu đồ khi mở hồ sơ/chi tiết XP, chip avatar chỉ cần tổng.

## 5. Ghi nhận và chống cộng trùng

1. Browser gửi hành động nghiệp vụ, không gửi lượng XP hoặc user nhận thưởng tùy ý. Server suy ra actor từ session, kiểm tra quyền và dữ liệu nguồn.
2. Rule thưởng nằm ở backend, có mã và version; lưu lượng XP đã áp dụng vào ledger. Đổi mức thưởng không tính lại lịch sử.
3. `source_key` ổn định theo thành tích, ví dụ `lesson_completed:<lesson_id>` hoặc `course_completed:<course_id>`; unique cùng `user_id`. Không đưa timestamp, request ID hay rule version vào khóa để tránh phát lại thưởng cũ.
4. Reset tiến độ, sửa nội dung, đổi trạng thái hoàn thành hoặc học lại không tạo quyền nhận lần hai trong MVP.
5. Kiểm tra điều kiện và ghi XP phải nguyên tử trong transaction. Với flow nhiều transaction như course completion hiện tại, dùng sự kiện chờ xử lý bền vững ghi cùng transaction hoàn thành và worker retry idempotent; không chỉ gọi best-effort rồi bỏ mất thưởng khi lỗi.
6. Ledger append-only: điều chỉnh sai thưởng bằng bản ghi bù có lý do và tham chiếu, không xóa lịch sử. User chỉ được đọc dữ liệu của mình; mọi writer đều ở boundary được kiểm soát.
7. XP bài học/quiz chỉ bật khi đã kiểm chứng quyền học, nội dung publish, câu hỏi hợp lệ và kết quả server. Không gắn trigger thưởng vô điều kiện vào mọi row tiến độ do client ghi.
8. Cần theo dõi tốc độ kiếm điểm bất thường; không áp trần tổng XP âm thầm khiến người học thật mất thưởng. Hoạt động có thể lặp ở các đợt sau phải có giới hạn riêng, hiển thị trước.

MVP có thể dùng cấu hình rule trong code có version; chưa cần xây trình quản trị rule. Metadata đề xuất bổ sung: `rule_code`, `rule_version`, `entity_type`, `entity_id`, `occurred_at`, `reason`, tham chiếu reversal. Constraint `source` cần được mở rộng có chủ đích.

## 6. XP và đơn vị đổi vật phẩm là hai hệ riêng

Điều chỉnh sau trao đổi: bỏ mô hình “XP tích lũy / XP khả dụng”. Theo [hướng dẫn chính thức Duolingo](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/), XP dùng cho cạnh tranh/bảng xếp hạng; Gems là tiền trong ứng dụng dùng ở Shop.

Đề xuất cho Corelia:

- **XP:** ghi nhận hoạt động và thành tích tích lũy; có thể làm cơ sở cho level/milestone/leaderboard sau này. Không tiêu XP để đổi vật phẩm. Chỉ điều chỉnh giảm khi thu hồi điểm cấp sai, có lịch sử rõ ràng.
- **Đơn vị đổi thưởng riêng:** tên tạm Coins/Gems, chưa chốt tên hay cơ chế kiếm. Sau này có số dư, giao dịch nhận/chi/hoàn và dùng đổi vật phẩm. Tiêu đơn vị này không ảnh hưởng XP.
- **MVP:** chỉ triển khai XP và lịch sử; chưa tạo ví Coins/Gems, shop hoặc tỷ lệ quy đổi. Không mặc định 1 XP = 1 coin và không tự sinh coin từ toàn bộ XP cũ.
- Khi bổ sung cửa hàng, ledger tiền thưởng phải tách biệt hoặc phân loại đơn vị rõ ràng; không cộng gộp XP và coin thành một số dư. Một sự kiện có thể thưởng cả hai nếu rule tương lai quy định, với idempotency riêng cho mỗi loại.

Những nhiệm vụ kết nối tài khoản/ví trong đề xuất hiện vẫn thưởng XP cho onboarding. Nếu sau này XP được định nghĩa hẹp là tiến bộ học tập, cần xem xét chuyển thưởng onboarding sang coin trước khi rollout, không âm thầm đổi đơn vị điểm đã cấp.

## 7. Dữ liệu cũ và thời điểm bắt đầu

- Trước implementation: xác minh schema, tổng điểm theo source, khả năng có số âm, writer còn hoạt động và trạng thái migration ở đúng môi trường.
- Đề xuất bảo toàn ledger cũ theo tỷ lệ 1 điểm = 1 XP, có nhãn nguồn lịch sử. Đây là phương án chuyển đổi, chưa phải khẳng định về dữ liệu live.
- Bắt đầu thưởng hoạt động mới từ thời điểm rollout; không tự backfill toàn bộ quá trình học cũ vì chưa chứng minh được điều kiện thưởng lịch sử.
- GitHub/OCID đã kết nối trước rollout được xét bằng cùng khóa idempotency; đã có ledger thưởng thì không cộng lại. Chỉ backfill học tập nếu có kế hoạch riêng và dữ liệu đủ tin cậy.
- Kiểm tra việc giữ khóa nguồn cũ, constraint mới, quyền đọc/ghi và đối soát tổng trước/sau migration. Không thay đổi các migration lịch sử.

## 8. Thứ tự thực hiện và nghiệm thu

1. Xác minh ledger hiện tại và contract hoàn thành lesson/quiz; chốt các rule đủ bằng chứng để bật.
2. Mở rộng ledger, writer có kiểm tra điều kiện, read API tổng/lịch sử và cơ chế retry bền vững.
3. Tích hợp thưởng kết nối đã xác minh, bài học, quiz, hoàn thành khóa, nộp project đầu tiên và like project; thêm UI XP.
4. Thử nghiệm trên staging trước khi cân nhắc mở các nguồn thưởng tiếp theo.

Các kiểm thử bắt buộc khi implementation:

- Hai tab/request đồng thời, retry sau timeout và reset tiến độ đều chỉ thưởng một lần.
- User không thể tự đổi điểm, giả user khác hoặc sửa dữ liệu nguồn để bỏ qua điều kiện.
- Quiz rỗng, chưa trả lời đủ, dưới ngưỡng, câu hỏi không thuộc quiz, course không có quyền học đều không nhận thưởng.
- Tạo/chỉnh sửa nội dung của chính mình không được dùng để kiếm XP.
- Hoàn thành khóa + XP + sự kiện chờ xử lý phục hồi đúng khi lỗi từng bước.
- Đổi rule không phát lại thưởng; reversal đúng một lần và tổng khớp ledger.
- Điểm cũ được bảo toàn; người dùng không đọc được lịch sử của người khác.
- UI phân biệt loading/error/zero, thông báo chỉ cho thưởng mới và có đủ VI/EN.
- Tổng tuần khớp tổng ngày; lịch và cột tuần cùng giá trị ở ngày tương ứng. Kiểm tra qua nửa đêm UTC, giao tuần/năm, năm nhuận và worker xử lý trễ.
- Điều chỉnh giảm đúng ngày thưởng gốc một lần; XP lịch sử không có ngày nguồn không tạo đỉnh giả ở ngày rollout.
- Người khác chỉ đọc được tổng hợp theo quyền hồ sơ; không lấy được hoạt động chi tiết bằng đổi user ID hoặc gọi trực tiếp API.
- Lịch 12 tháng desktop/3 tháng mobile đọc được, tooltip dùng được với hover/focus/chạm; phân biệt ngày 0 XP, tương lai, không có dữ liệu và lỗi tải.
- Nộp project thành công chỉ thưởng một lần/user và một lần/project; draft, retry, rút/nộp lại, đổi người nộp và nộp sang hackathon khác không tạo thưởng lặp.
- Like nhiều tab không vượt trần 10 XP/ngày; self-like/team-like không thưởng, unlike/re-like không thưởng lại, lượt vượt trần không được thưởng bù ngày sau; kiểm tra reset ngày UTC.
- Nếu thêm daily bonus: kiểm tra ngày theo timezone cố định, nửa đêm, retry và đổi timezone.

Chỉ số đánh giá: tỷ lệ hoàn thành bài/khóa, tỷ lệ quay lại học sau 7 ngày, tỷ trọng XP theo nguồn, tốc độ kiếm bất thường, độ trễ ghi XP và tỷ lệ xử lý thất bại. So sánh với baseline trước rollout; XP tăng không tự chứng minh chất lượng học tăng.

## 9. Tham khảo bên ngoài

- [Duolingo: cách dùng XP](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/): ví dụ thưởng cho hoàn thành bài và hoạt động luyện tập.
- [Duolingo: Time Spent Learning Well](https://blog.duolingo.com/time-spent-learning-well/): mô tả nguy cơ người dùng lặp bài dễ để kiếm điểm và điều chỉnh XP theo tiến bộ trên lộ trình. Suy luận áp dụng cho Corelia: ưu tiên kết quả học mới, giới hạn thưởng lặp và đo kết quả học cùng engagement. Các mức XP trong đề xuất này không lấy từ nghiên cứu đó.

Khi triển khai, kiểm tra migration, API, quyền truy cập và build theo phần nghiệm thu ở trên.


## 10. Cập nhật: hồ sơ, nhiều tài khoản và ví

Source hiện tại: `AccountProfileRoute.tsx` / `ProfileSection.tsx` có tên, username, avatar, bio, website, điện thoại và tùy chọn công khai. Cờ nhắc thiết lập hiện dựa trên thiếu tên hoặc điện thoại; đây không phải điều kiện nhận XP đã được chốt. Tạm bỏ nhiệm vụ “hoàn thiện hồ sơ +20” vì quá chung chung; không bắt buộc điện thoại/website hoặc public profile để nhận XP kết nối.

Trước thay đổi, `src/lib/auth.ts` có đăng nhập Google/GitHub và trang hồ sơ có `ConnectOCIDCard`, nhưng chưa có giao diện quản lý liên kết Google/GitHub hoặc ví Ethereum/Solana. Đăng nhập GitHub không đồng nghĩa với “thêm GitHub vào tài khoản đang dùng”.

Thiết kế đề xuất:

- Một tài khoản Corelia liên kết nhiều loại danh tính: Google, GitHub, OCID và nhiều địa chỉ ví. MVP quản lý một kết nối cho mỗi OAuth provider; nhiều tài khoản GitHub cùng provider là phạm vi riêng.
- Mục “Tài khoản & ví” hiển thị từng kết nối: chưa kết nối → nút Connect và XP; đã kết nối → tên/địa chỉ và trạng thái thưởng. Ví hỗ trợ nhãn và chọn ví chính theo hệ nếu cần, không tự đổi ví nhận credential.
- OAuth dùng identity linking trong session hiện tại, phải kiểm tra cấu hình manual linking. Danh tính thuộc tài khoản Corelia khác báo xung đột, không tự merge. Không cho gỡ phương thức đăng nhập cuối cùng.
- Ví liên kết vào user đang đăng nhập qua challenge một lần do server tạo, gắn user/session, domain, địa chỉ, hệ ví và hạn dùng. Người dùng ký thông điệp; server kiểm tra chữ ký và tiêu thụ challenge nguyên tử trước khi lưu liên kết/phát XP. Kết nối extension hoặc dán địa chỉ đơn thuần chưa đủ.
- Flow này không chuyển tài sản, không yêu cầu số dư hay giao dịch on-chain. MVP chỉ liên kết ví; đăng nhập bằng ví là phạm vi riêng. Không dùng lệnh sign-in để giả định nó tự gắn ví vào user hiện có.
- Cho lưu nhiều ví nhưng chỉ thưởng ví đầu tiên của mỗi hệ. Ngắt rồi kết nối lại hoặc đổi địa chỉ không nhận thêm. Một địa chỉ đã xác minh chỉ liên kết một user tại một thời điểm; lưu dấu vết thưởng để việc chuyển kết nối không tạo thưởng lặp cùng danh tính giữa các tài khoản. Điều này không chứng minh một người chỉ có một tài khoản; cần giám sát lạm dụng.
- Địa chỉ Ethereum đi kèm OCID không tự chứng minh người dùng đã hoàn thành challenge của nhiệm vụ ví Ethereum; không tự thưởng hai lần từ cùng callback OCID. Ví liên kết không tự công khai lên hồ sơ.

Tham khảo: [Supabase Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [Supabase Web3 Auth](https://supabase.com/docs/guides/auth/auth-web3), [Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361). `signInWithWeb3` của Supabase là luồng **đăng nhập**, có thể tạo/chuyển session sang user ví; tài liệu không bảo đảm nó liên kết ví vào user Google/email đang đăng nhập. Vì vậy Corelia dùng challenge một lần và xác minh chữ ký ở Edge Function để liên kết nhiều ví với cùng user. OAuth Google/GitHub dùng `linkIdentity`. Cần bật manual linking trong cấu hình Supabase Auth trước khi dùng OAuth linking ở môi trường deploy.

## 11. Trạng thái bản triển khai local

- Mở rộng `user_point_ledger` và chỉ cộng XP qua transaction nghiệp vụ; khóa thưởng cố định ngăn cộng lại. Like project tối đa 5 lượt được thưởng/ngày UTC. Bảng tổng/lịch công khai chỉ trả dữ liệu khi hồ sơ công khai; lịch sử và phân rã theo ngày chỉ chủ tài khoản đọc.
- Hồ sơ và menu tài khoản hiển thị XP; lịch ô vuông 12 tháng desktop/3 tháng mobile và biểu đồ tuần. Bài học/quiz có mức thưởng dự kiến và trạng thái đã nhận. Toast `+XP` chỉ xuất hiện khi xác nhận khoản thưởng mới cho bài học/quiz, like, nộp project hackathon đầu tiên, OAuth GitHub, OCID và ví đầu tiên của từng hệ; lần thử lại không tạo thông báo mới.
- Liên kết Google/GitHub qua Supabase Auth identity linking. OCID được xác minh bằng ID token ở Edge trước khi ghi hồ sơ/thưởng; browser không được tự ghi trường OCID. Ethereum/Solana dùng challenge 5 phút, chữ ký ví và lưu nhiều địa chỉ; thêm ví sau cùng hệ không cộng XP. Chưa hỗ trợ đăng nhập bằng ví, chuyển tài sản, chọn ví credential chính hoặc đổi vật phẩm.
- OCID đã lưu trước bản triển khai nhưng chưa có điểm lịch sử cần kết nối lại bằng luồng có ID token để nhận XP; không thưởng hồi tố chỉ dựa trên trường hồ sơ do browser từng ghi.
- Trước triển khai từ local lên staging/production: đặt `OCID_CLIENT_ID` và `OCID_SANDBOX` đúng với cấu hình frontend, bật manual OAuth identity linking trong Supabase Auth, xác nhận CORS origin, chạy migration và kiểm tra thực tế với ví/OAuth trên staging. Migration được kiểm tra trên Supabase local; production chưa được thay đổi.

## 12. XP Rank và bảng xếp hạng — triển khai local 2026-09-23

Phần mở rộng này thay thế giới hạn “chưa có level/ranking” của MVP ở trên, không thay đổi cách thưởng XP.

- Cấp bậc dùng tổng XP hợp lệ: Khởi đầu 0, Đồng 250, Bạc 1.000, Vàng 2.500, Bạch kim 10.000, Kim cương 25.000. Cấu hình duy nhất ở `src/lib/xpRanks.ts`; không lưu rank riêng trong database. Thu hồi điểm có thể giảm hạng.
- Badge xuất hiện trong hồ sơ, menu tài khoản và Suggested People. Khối hoạt động XP có tiến độ và bảng các mốc. Không thêm phần thưởng, quyền lợi hay thông báo lên hạng.
- Bảng xếp hạng nằm trong tab BXH XP tại `/feed?tab=leaderboard`, dùng cùng trang Feed đã yêu cầu đăng nhập; không có mục điều hướng hoặc trang BXH riêng. Có tuần UTC từ thứ Hai và toàn thời gian. Top 100 chia 20 hàng/trang; vị trí bản thân được tính cả khi ngoài top 100. Đồng điểm dùng thứ hạng thi đấu `1, 2, 2, 4`, ID chỉ ổn định thứ tự hàng.
- Chỉ hồ sơ công khai có vai trò student/instructor và XP trong kỳ dương tham gia. Tài khoản riêng tư/admin/support vẫn xem cấp bậc cá nhân và lý do không được xếp hạng.
- `xp_leaderboard_v1` là public invoker wrapper gọi helper private, chỉ trả danh tính công khai và tổng điểm. Ledger giữ nguyên quyền riêng tư. Khoản thu hồi quy về `occurred_at` của khoản gốc; điểm lịch sử thiếu timestamp và khoản thu hồi tương ứng chỉ tính vào tổng, không tính tuần hiện tại.
- Query nằm trong nhóm `xp`, tách theo viewer/kỳ/tuần, cache 60 giây; refresh khi vào trang, đổi kỳ, focus, nhận XP hoặc đổi quyền công khai hồ sơ. Rollover thứ Hai UTC đưa BXH tuần về trang đầu.
- Kiểm thử SQL: `scripts/db/tests/xp-leaderboard.integration.sql`, được nối vào local migration gate. Không chỉnh frozen baseline. Release staging chạy backend trước frontend theo quy trình hiện có.
- Đã xử lý blocker PostgreSQL của stack QA: checkout tạm thiếu file ignored `supabase/.temp/postgres-version`, nên dùng image mặc định cũ của CLI và crash ở permission-denial probe `learning_reset_lesson`. Ghim `17.6.1.156` giống CI giúp toàn bộ `db:verify:local` qua, gồm Learning authorization/concurrency và PostgREST smoke; không sửa hoặc bỏ qua test.
