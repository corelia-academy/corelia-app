# Corelia Feed — tài liệu triển khai

**Cập nhật: 2026-09-22.** Thay activity feed liệt kê hành vi bằng feed kiến thức, trao đổi và sản phẩm do cộng đồng chủ động xuất bản.

Đây là bản thiết kế mục tiêu, chưa triển khai code/schema hay xóa dữ liệu. Tài liệu này là nguồn duy nhất cho công việc thay thế feed; các chi tiết đánh dấu đề xuất cần được kiểm chứng khi triển khai.

## Mục lục

1. [Thiết kế sản phẩm](#product)
2. [Kiến trúc và contract triển khai](#architecture)
3. [Thay thế hệ thống cũ và nghiệm thu](#migration)
4. [Cơ sở nghiên cứu](#research)

## Phạm vi triển khai

- MVP: bài chia sẻ, showcase và thông báo; draft/publish/withdraw; chủ đề; feed/detail; lưu bài, bình luận, hide/mute/report và hàng đợi kiểm duyệt.
- Loại bỏ: phát tán tự động hành vi học/follow/đăng ký, badge hành vi chưa đọc, auto-follow ngầm và activity timeline trên profile.
- Bảo toàn: dữ liệu learning/reporting, notifications, project, credential, XP và quan hệ follow hiện có theo kế hoạch chuyển đổi.
- Sau MVP: Q&A có câu trả lời được chấp nhận, topic-follow đầy đủ và ranking nâng cao khi pilot chứng minh nhu cầu.
- Thực hiện theo thứ tự các giai đoạn trong [kế hoạch chuyển đổi](#migration); không phát triển tiếp roadmap activity feed cũ.


<a id="product"></a>

## 1. Thiết kế sản phẩm

### Mục tiêu

Người dùng mở feed để học một điều hữu ích, tìm lời giải, khám phá sản phẩm và gặp người cùng mối quan tâm. Mỗi mục cần có thông điệp tự thân; tác giả phải biết nội dung nào đang được công khai.

Không xuất bản tự động việc xem/học bài, enroll, đăng ký/nộp hackathon, follow, nhận hearts, nhận XP hay kết nối tài khoản. Không hiển thị “bạn bè vừa xem/thích” hoặc thời gian online. Chứng chỉ nằm trong hồ sơ; chia sẻ thành tựu lên feed là hành động viết bài chủ động.

### Các loại nội dung

| Loại | Nội dung cần có | Hành động chính |
|---|---|---|
| Chia sẻ kiến thức | Tiêu đề, nội dung có luận điểm, chủ đề; nguồn hoặc tài nguyên khi có | Đọc, lưu, trao đổi |
| Câu hỏi | Vấn đề, ngữ cảnh, đã thử gì, kết quả mong muốn; link/code tùy chọn | Trả lời, đánh dấu câu trả lời giải quyết vấn đề |
| Showcase / cập nhật dự án | Project công khai, thay đổi hoặc điều đã học, ảnh/demo/repo nếu có | Xem dự án, góp ý |
| Thông báo chính thức | Người xuất bản có quyền với course/hackathon, thông tin hữu ích, CTA, thời hạn nếu có | Xem khóa học/sự kiện |

Mọi loại dùng chung mô hình bài đăng, permalink, moderation và tương tác. Không mở bốn hệ thống nội dung độc lập. Phiên bản đầu triển khai chia sẻ/showcase/thông báo; Q&A hoàn chỉnh ở giai đoạn sau. Không thêm job feed, quảng cáo, repost và video upload vào đợt đầu.

### Trải nghiệm đọc

Hai tab chính:

- **Dành cho bạn:** dựa trên chủ đề người dùng chọn, ngôn ngữ và nội dung theo dõi; có lý do như “Thuộc chủ đề React bạn quan tâm”. Có thể thay đổi sở thích ngay tại feed.
- **Đang theo dõi:** bài đã xuất bản từ user/chủ đề/entity người dùng chủ động theo dõi, theo thời gian mới nhất. Không chèn gợi ý ngoài phạm vi; thiếu nội dung thì giải thích và dẫn sang khám phá.

Bộ lọc theo loại nội dung, chip chủ đề và lối vào “Đã lưu”. Giữ `/feed` để thay thế tại chỗ; nhãn giao diện đề xuất “Cộng đồng”. `/` tiếp tục làm trang học cá nhân; không đặt hai timeline cạnh tranh nhau.

Với user mới: cho chọn vài chủ đề hoặc bỏ qua. Khi bỏ qua, hiển thị bộ tuyển chọn theo ngôn ngữ, ghi rõ là nội dung biên tập. Không suy ra sở thích từ ví, khóa học đang học hoặc lịch sử truy cập. Khi thiếu bài, cho biết đã xem hết và gợi ý mở rộng chủ đề; không lặp lại bài để kéo dài trang.

### Card và trang chi tiết

Thứ tự thị giác: loại/chủ đề → tiêu đề/nội dung xem trước → ảnh hoặc object preview → tác giả/ngày → hành động. Tác giả vẫn có danh tính và link profile, nhưng avatar cùng động từ hành vi không chiếm phần chính của card.

Ví dụ cấu trúc, không phải UI đã xây:

```text
SHOWCASE · Frontend
Mình giảm thời gian tải trang dự án như thế nào?
Ba thay đổi, số liệu trước/sau và một điều chưa giải quyết…
[Ảnh demo]  [Dự án liên quan]
Linh · 2 giờ trước
[Hữu ích] [Thảo luận] [Lưu] [⋯]
Vì bạn quan tâm Frontend
```

Trang chi tiết có nội dung đầy đủ, tài nguyên liên quan, bình luận và bài khác cùng chủ đề. Số liệu phản ứng ở mức phụ; không đặt XP/rank cạnh mọi nội dung như thước đo chất lượng. Thông báo có nhận diện tác giả chính thức dựa trên quyền thật, không phải nhãn tự nhập.

Menu bài: ẩn bài, bớt chủ đề này, mute tác giả, report. Chặn tác giả phải có semantics được triển khai đầy đủ trước khi hiển thị; nếu chỉ ẩn khỏi feed thì gọi đúng là mute. Mobile một cột, desktop đọc theo cột nội dung chính; sidebar chỉ chứa chủ đề hoặc tuyển chọn hữu ích, không phải bảng hành vi trực tiếp.

### Xuất bản có chủ đích

1. Chọn loại bài và chủ đề; tạo draft chỉ mình thấy.
2. Soạn nội dung, gắn đối tượng mình có quyền tham chiếu; không tự lấy nhật ký học tập làm nội dung.
3. Xem trước audience và link liên quan. MVP chỉ có draft riêng tư và published công khai; không hứa chia sẻ nhóm kín.
4. Publish qua validation và kiểm soát spam. Giữ draft khi lỗi; retry không sinh bài trùng.
5. Cho sửa, rút bài và xóa theo quyền. Sửa không đẩy bài lên đầu như một bài mới.

Bài đăng gắn project/course/hackathon không cho tác giả thêm quyền chỉnh sửa đối tượng. Project riêng tư không được gắn vào bài công khai. Bài có liên kết bắt buộc đến object phải bị ẩn khỏi feed và permalink nếu object mất quyền công khai; không để snapshot cũ làm lộ title/ảnh. Người dùng có thể viết kiến thức chung độc lập, nhưng hệ thống không tự trích nội dung riêng tư vào bài đó.

### Theo dõi và thông báo

Follow có nghĩa muốn nhận nội dung được xuất bản từ nguồn đó. Enroll/register không tạo follow ngầm; sau thao tác có thể hỏi bằng lựa chọn tự nguyện. Theo dõi bài để nhận reply là preference riêng.

Bỏ badge đếm “hành vi chưa đọc” trên header. Khi đang đọc, có nút “Có bài mới”, không chèn bài làm nhảy vị trí cuộn. Reply/mention và tương tác cần phản hồi đi qua notification hiện hữu, có dedup và tuỳ chọn tắt; đọc feed không đánh dấu notification đã đọc.

### Chất lượng và moderation

MVP công khai bắt buộc có report, hide/mute, rate limit phía server, kiểm soát link/attachment, hàng đợi staff và lịch sử quyết định. Draft, bài chờ duyệt, bài bị ẩn không được đọc qua API public hoặc cache. Preview ảnh/link không được tải URL tùy ý từ backend nếu chưa có kiểm soát nguồn truy cập.

Pilot mở publish cho nhóm được chọn và nội dung chính thức; mở rộng khi có người phụ trách review. Không tự ẩn bài chỉ vì một tài khoản report; hạn chế quyền xuất bản tài khoản mới theo quota/chính sách có giải thích. Reaction của tác giả không tăng điểm bài; engagement không tạo XP tự động. Không dùng XP làm quyền moderation.

### Đo hiệu quả

Metric chính đề xuất: tỷ lệ người đọc thực hiện hành động có ích trong tuần — lưu bài, nhận được câu trả lời, hoặc mở object liên quan rồi tự chọn hành động tiếp theo. Ghi riêng từng loại để tránh “một click” được hiểu là đã học được kiến thức.

Đo bổ sung: tỷ lệ câu hỏi có lời giải, số tác giả có bài được lưu bởi người khác, tỷ lệ hide/report và thời gian xử lý report. Dùng thống kê tổng hợp có thời hạn lưu rõ ràng; không công khai ai đọc bài nào. Không tối ưu tổng thời gian cuộn hoặc số thao tác thụ động.

Chưa đặt mục tiêu tăng trưởng phần trăm khi chưa có baseline. Pilot cần chứng minh chất lượng nội dung và khả năng vận hành trước khi làm ranking phức tạp.

<a id="architecture"></a>

## 2. Kiến trúc và contract triển khai

### Tách ba trách nhiệm

- **Nội dung cộng đồng:** bài đăng do người có quyền chủ động xuất bản, gồm revision, moderation và tương tác.
- **Dữ liệu nghiệp vụ/analytics:** tiến độ học, enrollment, credential, XP, telemetry; dùng cho sản phẩm gốc và báo cáo, không đưa trực tiếp lên feed.
- **Notification:** reply/mention và việc cần xử lý; dùng hệ thống thông báo hiện có.

Feed là cách truy vấn và trình bày nội dung đã xuất bản. Không ánh xạ mọi domain event thành một bài đăng. Một lần publish tạo một item canonical; một bài khớp nhiều chủ đề chỉ hiện một lần.

### Mô hình dữ liệu dự kiến

Tên bảng dưới đây là tên làm việc; trước khi tạo phải đối chiếu primitives hiện có, không thêm bảng trùng chức năng.

| Khái niệm | Dữ liệu / ràng buộc |
|---|---|
| `community_posts` | Author, kind, title/body, language, trạng thái, published_at, revision; draft/pending/published/hidden/withdrawn; server kiểm tra transition |
| Quan hệ nguồn | Course/project/hackathon ID được validate đúng kiểu và quyền; FK có kiểu hoặc bảng liên kết riêng; không dùng ID đa hình không kiểm tra |
| Chủ đề | Taxonomy quản lý được, bản dịch VI/EN; post-topic và lựa chọn follow/hide của user |
| Bình luận | Post, author, parent tùy chọn, body, moderation; giới hạn độ sâu; accepted answer phải thuộc đúng câu hỏi |
| Reaction / bookmark | Unique `(user, post, kind)` hoặc `(user, post)`; bookmark chỉ user được đọc; counter không do client tự ghi |
| Preference / report | Mute, hide và report riêng tư; staff đọc report bằng quyền hiện có; audit quyết định |
| Snapshot feed | ID phiên, user, filter/preferences version, rank version, thời hạn và danh sách ID theo thứ tự khi cần |

Không chuyển learning events thành `community_posts`. Không dùng payload snapshot chứa dữ liệu riêng tư làm preview công khai. Nội dung, attachment và link phải được sanitize và kiểm tra quyền trên cả read lẫn write.

### Đọc và phân trang

`Đang theo dõi`: keyset `(published_at, id)` với sort tương ứng, không dùng cursor timestamp đơn. Mỗi request lọc trạng thái, quyền đọc, mute/hide và nguồn còn công khai.

`Dành cho bạn`: lấy tập ứng viên có giới hạn rồi xếp hạng; không chạy scoring toàn bộ bảng cho mỗi page. Pilot có thể dùng nguồn tuyển chọn và thứ tự ổn định; chưa cần ML, vector database hoặc queue riêng.

Khi ranking thay đổi theo tương tác: tạo snapshot thứ tự có TTL (đề xuất 30 phút), cursor gắn user/filter/rank version và vị trí. Chuyển tab, sửa sở thích hoặc bấm làm mới tạo snapshot mới. Snapshot chỉ giữ ID/thứ tự, không cấp quyền đọc: mỗi trang vẫn kiểm tra lại quyền và loại bài bị rút/ẩn ngay. Scan tiếp trong giới hạn để bù bài bị loại; không trả nội dung đã thu hồi chỉ để đủ số lượng. Hết TTL trả trạng thái cần làm mới, không ghép hai thứ tự khác nhau.

Các query frontend đi qua `src/lib` và TanStack Query theo user, tab, filter, language và snapshot; mutations invalidate feed/detail/saved/counters liên quan. Cache riêng tư phải được xóa khi đổi tài khoản.

### Ranking minh bạch và có thể kiểm chứng

Thứ tự xử lý:

1. Lọc eligibility/quyền, published, thời hạn thông báo và preference chặn/ẩn.
2. Lấy candidate từ chủ đề tự chọn, nguồn follow và nội dung biên tập có liên quan ngôn ngữ.
3. Chấm điểm bằng luật có version: độ khớp chủ đề, quan hệ follow, tính mới, chất lượng biên tập; tương tác hợp lệ chỉ là tín hiệu phụ được giới hạn.
4. Giới hạn lặp tác giả/đối tượng, đa dạng loại nội dung và dành chỗ cho tác giả mới khi đủ bài.
5. Trả reason code thực sự tham gia quyết định, ví dụ `followed_topic`; không bịa lý do từ lịch sử học.

Các giới hạn khởi đầu như tối đa 2 bài/tác giả trong 10 kết quả là cấu hình thử nghiệm, không cam kết chất lượng. Nếu không đủ nội dung thì trả ít bài; không nới quyền/mute. Không gán trọng số “tối ưu” khi chưa có dữ liệu. So sánh ranking với baseline mới nhất/tuyển chọn trong pilot trước khi thêm personalization hành vi.

### Ghi và realtime

Publish/edit/withdraw qua API/RPC có kiểm tra author/role/entity permission, idempotency key, quota và moderation. Chỉ staff có quyền đổi moderation state; author không tự bypass bằng update trực tiếp. Các thao tác tương tác áp dụng cùng read permission của bài, không chỉ kiểm tra đã login.

Realtime mới chỉ mang tín hiệu có nội dung được xuất bản/thu hồi trong phạm vi được phép. Client tải lại qua endpoint có authorization; không subscribe bảng telemetry rộng rồi lọc bằng JS. Bài bị thu hồi phải biến mất khỏi cache/detail và lượt đọc tiếp theo; không chờ user tự refresh để quyền mới có hiệu lực.

### Tiêu chí kỹ thuật trước rollout

- Kiểm tra quyền chéo user/staff, draft/public/hidden, source public→private trên endpoint, permalink, attachment và cache.
- Test publish retry, duplicate reaction, rút bài, sửa bài không bump, pagination timestamp bằng nhau và snapshot có bài bị thu hồi.
- Test đổi user, mute/hide, filter và realtime không làm đảo vị trí đọc.
- Test VI/EN, keyboard/mobile, loading/error/empty, editor giữ draft khi lỗi.
- Đo p95 đọc trang đầu với dữ liệu pilot và tập lớn giả lập; mục tiêu ban đầu đề xuất ≤500 ms phía API, chưa đo và không phải SLA hiện tại.
- Database checks và isolated local stack theo hướng dẫn repo; rollout backend/frontend tách biệt theo [release process](../RELEASE_PROCESS.md).

<a id="migration"></a>

## 3. Thay thế hệ thống cũ và nghiệm thu

### Những gì cần loại bỏ, thay thế hoặc giữ

| Thành phần hiện tại | Đích đến |
|---|---|
| Timeline `get_feed_v1` và `FeedPage` render động từ activity | Thay bằng bài đăng community tại cùng `/feed` |
| Auto-post enroll/complete/register/submit/follow/hearts/credential | Dừng tạo social events; không backfill thành bài đăng mới |
| Bundling hành vi, locale verb, unread sample 50/localStorage | Loại khỏi đường chạy feed mới; dọn khi không còn consumer |
| Subscription `activity_events` của trang và header | Thay bằng tín hiệu publish/withdraw; bỏ badge hành vi chưa đọc |
| `getActorActivity` trong public profile | Thay bằng bài do người dùng chủ động đăng; thành tựu vẫn thuộc section credential/project riêng |
| `follows`, nút follow, follower preview | Giữ ý định theo dõi, rà lại quyền/count/cache; không xoá quan hệ hàng loạt |
| Auto-follow enrollment/registration | Ngừng follow ngầm; thay bằng lựa chọn rõ ràng |
| `activity_events` dùng cho learning/reporting | Tạm giữ phần phụ thuộc nội bộ; không DROP toàn bảng khi tắt social feed |
| Notifications, project hearts/comments, progress, credentials, XP | Giữ chức năng nghiệp vụ; không xoá theo event feed |

#### Phụ thuộc đã thấy trong repo

- [Public profile queries](../../src/features/profiles/publicProfileQueries.ts) gọi `getActorActivity`; không xoá `src/lib/feed.ts` mà bỏ sót consumer này.
- [Learning reporting](../../supabase/migrations/20260911110235_learning_course_reporting.sql) ghi/đọc `learning.*` trong `activity_events`; cần inventory các hàm reporting mới hơn trước migration.
- [Auto-follow migration mới hơn](../../supabase/migrations/20260921145248_project_hackathon_staff_transfer.sql) định nghĩa lại auto-follow hackathon; không chỉ nhìn migration auto-follow đầu tiên.
- Worktree có XP và connected accounts đang phát triển song song. Trước triển khai phải rà phụ thuộc của bản code cuối, không gỡ các thay đổi đó trong công việc feed.

### Quy tắc dữ liệu cũ

Không biến các dòng “A làm B” thành community post. Không tự viết lại chúng thành bài bằng AI. Có thể mời tác giả xuất bản nội dung mới, có draft/preview/consent.

`follows` chưa có nguồn manual/auto đáng tin cậy theo baseline đã đọc. Không suy đoán mọi follow course đều do auto-follow rồi xóa. Khi chuyển đổi, giữ dữ liệu và cung cấp màn hình rà lại subscriptions với bỏ chọn rõ ràng; tắt auto-follow cho hành vi mới. Cần quyết định UX xác nhận nguồn cũ trước mở tab following chính thức.

Tách riêng inventory social history và telemetry. Việc xóa vật lý social rows chỉ thực hiện trong migration riêng sau khi xác định consumers, yêu cầu lưu trữ và bản sao cần giữ; không sửa lịch sử migrations đã áp dụng. Không đưa raw activity cũ ra API public mới. Bộ đếm nghiệp vụ phải đối soát trước/sau.

### Lộ trình thực hiện

#### 0. Chốt contract và baseline phụ thuộc

Inventory bảng, hàm, trigger, realtime publication, cron/job, quyền và consumer của activity/follow. Ghi rõ owner của learning reporting, notification và XP. Chốt loại bài MVP, quy trình moderation và nguồn nội dung pilot. Đầu ra: danh sách phụ thuộc cụ thể và acceptance cases; không coi audit source cũ là inventory DB live hoàn chỉnh.

#### 1. Xây nội dung và vận hành pilot

Bài chia sẻ/showcase/thông báo có draft/publish/withdraw, chủ đề, card/detail, lưu bài, bình luận cơ bản, report/hide/mute và moderator queue. Có tác giả/biên tập viên thật, không lấy lịch sử hành vi lấp chỗ trống. Chưa mở Q&A có accepted answer nếu chưa xây đúng vòng đời.

#### 2. Thay bề mặt đọc và ngừng phát tán hành vi

Chuyển `/feed`, header, profile activity sang nội dung mới trong cùng đợt tương thích. Tắt social-event producers theo inventory; giữ writer dùng cho reporting. Tắt auto-follow mới. Kiểm tra stale client/cached bundle còn gọi RPC cũ: trong cửa sổ chuyển đổi, endpoint cũ trả tập rỗng hợp lệ hoặc phản hồi yêu cầu nâng cấp có xử lý ở client, không tiếp tục phát tán hành vi.

Rollout bằng feature flag phía server cho nhóm pilot; rollback ưu tiên trang community tuyển chọn hoặc trạng thái tạm ngừng, không tự bật lại public activity stream trái quyết định sản phẩm. Backend additive trước, frontend sau; bằng chứng deployment riêng từng phần.

#### 3. Kiểm chứng và dọn code cũ

Khi pilot đạt tiêu chí, mở rộng quyền theo năng lực moderation. Xoá query/hook/bundling/types/locale chỉ phục vụ feed cũ sau khi không còn consumer; thu hồi RPC/quyền social không còn dùng. Dọn localStorage key cũ nếu cần. Chuyển QA activity cũ sang historical-only; không dùng nó làm release gate của feed mới.

#### 4. Phát triển chất lượng khám phá

Thêm Q&A có lời giải, topic-follow đầy đủ và ranking có snapshot khi quy mô nội dung cần. Chỉ thêm hệ thống gợi ý nâng cao khi dữ liệu pilot cho thấy lợi ích so với tuyển chọn/thứ tự mới nhất.

### Điều kiện nghiệm thu thay thế

- Enroll, học/xong bài, đăng ký/nộp hackathon, follow, nhận hearts/XP/credential không sinh mục public trên feed hoặc profile activity mới.
- Bài chỉ xuất hiện sau hành động publish rõ ràng của tác giả/đại diện có quyền; draft/retry không làm rò dữ liệu hoặc trùng bài.
- Follow cũ không bị mất hàng loạt; người dùng kiểm soát nguồn sẽ xuất hiện trong tab following.
- Learning reporting/progress, notification, credential, project và XP hoạt động đúng sau khi tắt social producers.
- Privacy withdrawal có hiệu lực ở feed, detail và cache; pagination không bỏ sót/trùng khi timestamp bằng nhau.
- Có nội dung hữu ích cho user mới, cách lưu/trao đổi, moderation đang được vận hành và bằng chứng QA UI/backend.
- Release đáp ứng [quy trình repo](../RELEASE_PROCESS.md); chỉ ghi “đã loại bỏ hệ thống cũ” khi code/schema cần thiết đã triển khai và kiểm tra xong.

<a id="research"></a>

## 4. Cơ sở nghiên cứu

### Chẩn đoán

Feed hiện lấy `activity_events`, lọc theo follow, rồi biến verb thành câu. Giá trị của một mục phụ thuộc vào việc người xem có quan tâm thao tác của actor hay không. Chủ bài không chủ động viết thông điệp, thiếu luận điểm, demo, câu hỏi và ngữ cảnh. Người đọc có rất ít việc để làm ngoài mở liên kết. Bundling chỉ giảm số dòng, không giải quyết vấn đề này.

Những ví dụ như “hoàn thành bài”, “đăng ký hackathon”, “follow một người”, “đạt mốc hearts” tạo cảm giác quan sát người khác. Đây là chẩn đoán sản phẩm từ cấu trúc hiện tại và phản hồi của người dùng, không phải kết quả khảo sát.

### Mô hình tham khảo

| Nguồn chính thức | Quan sát | Áp dụng đề xuất cho Corelia |
|---|---|---|
| [DEV: Customizing Your Feed](https://dev.to/help/customizing-your-feed) | Nội dung là bài viết; người đọc theo dõi user/tag, ẩn tag, chọn Relevant/Latest/Top, lưu bài | Chủ đề và quyền điều chỉnh sở thích là nền tảng; nội dung có thể đọc/lưu lại |
| [Bluesky: Algorithmic Choice](https://bsky.social/about/blog/7-27-2023-custom-feeds) | Người dùng có thể lựa chọn feed thay vì phụ thuộc duy nhất một cách xếp hạng | Luôn có lựa chọn thời gian rõ ràng; Corelia chưa cần marketplace thuật toán |
| [Discourse Solved](https://meta.discourse.org/t/discourse-solved/30155) | Người hỏi và staff có thể đánh dấu câu trả lời giải quyết vấn đề | Câu hỏi có vòng đời và kết quả, không biến mọi bình luận thành tương tác vô nghĩa |
| [Discourse: Understanding post flags](https://meta.discourse.org/t/understanding-post-flags-in-discourse/275) | Báo cáo nội dung gắn với quy trình kiểm duyệt; đánh giá flag có xét độ tin cậy | Có report, hàng đợi xử lý, lý do và khả năng xem xét lại ngay khi mở UGC |

Các quan sát trên chỉ mô tả pattern được công bố; không khẳng định thuật toán, hiệu quả hay quy mô của các nền tảng đó phù hợp trực tiếp với Corelia. Phần “áp dụng” là lựa chọn thiết kế của dự án.

### Ba hướng có thể chọn

| Hướng | Lợi ích | Chi phí / giới hạn | Kết luận |
|---|---|---|---|
| Cải tiến activity stream bằng ảnh và ranking | Ít thay đổi | Vẫn phát tán hành vi, thiếu nội dung độc lập | Loại bỏ |
| Trang khám phá chỉ do admin biên tập | Dễ kiểm soát chất lượng, khởi động nhanh | Phụ thuộc đội nội dung, ít trao đổi giữa thành viên | Dùng làm nguồn nội dung giai đoạn đầu |
| Cộng đồng học và xây sản phẩm, bài đăng có cấu trúc | Kiến thức, câu hỏi, demo tạo lý do đọc và quay lại | Cần tác giả, moderation và quy trình xuất bản | Hướng mục tiêu; mở dần theo chất lượng vận hành |

### Điều làm Corelia khác một mạng xã hội chung

Một bài có thể gắn với course/project/hackathon thật trong Corelia. Người xem có thể đọc cách giải quyết vấn đề, hỏi tác giả, xem demo hoặc bắt đầu khóa học liên quan. Feed dẫn đến các đối tượng này; không sao chép toàn bộ catalog hoặc thay trang học cá nhân.

Ví dụ: “Ba lỗi khi thiết kế quyền truy cập cho dự án đầu tiên” có nội dung, repo/demo và câu hỏi thảo luận; “Minh vừa hoàn thành lesson 7” không được xuất bản tự động. Sau một thành tựu, Corelia có thể mời người dùng **viết một bài chia sẻ**, nhưng chỉ tạo draft theo yêu cầu và luôn cần xem trước/xác nhận publish.

### Giả thuyết cần kiểm chứng

- Người đọc có thể tìm được ít nhất một nội dung hữu ích theo chủ đề đã chọn trong một phiên ngắn.
- Người tạo dự án muốn nhận góp ý cụ thể hơn là chỉ nhận hearts.
- Người hỏi sẵn sàng bổ sung ngữ cảnh nếu mẫu bài giúp nhận câu trả lời tốt hơn.
- Đội vận hành có đủ người biên tập và xử lý report để mở quyền đăng cho cộng đồng.

Pilot đề xuất: 8–12 người thuộc nhóm học viên, người làm dự án và instructor; chuẩn bị khoảng 20–30 bài thật trên 3 chủ đề có người duy trì. Đây là quy mô thử nghiệm dự kiến, chưa có người tham gia hay nội dung đã được tạo. Kiểm tra tác vụ đọc, lưu, hỏi, trả lời và đăng demo; ghi nhận lý do nội dung hữu ích hoặc bị bỏ qua trước khi tối ưu ranking.

## Phụ lục: đối chiếu legacy

Chỉ mở khi cần kiểm tra phụ thuộc hoặc hành vi cũ; không dùng làm đặc tả feed mới.

- [Baseline code cũ](archive/legacy-system.md)
- [Audit trước quyết định thay thế](archive/legacy-review-2026-09-22.md)
- [Checklist QA cũ](archive/legacy-qa.md)
- [Handoff issue #96](archive/README.md)

Quay lại [mục lục docs](../README.md).
