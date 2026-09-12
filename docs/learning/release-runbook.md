# Learning release runbook

Phạm vi công việc hiện tại là local. Tài liệu này chuẩn bị cho một đợt release được yêu cầu riêng; không phải evidence đã rollout.

## Hợp đồng cần giữ

- Giữ `/instructor/courses`, `/instructor/courses/new`, `/instructor/courses/:id/edit` và quyền instructor/owner/co-instructor theo feature. Preview là route bổ sung. Không chuyển quản trị course sang admin-only.
- Giữ completion, credential, attempts và submission lịch sử. Không dùng rollback để xóa lịch sử hoặc khôi phục đường ghi quiz completion trực tiếp.
- Practice/code chỉ bật khi renderer, authoring và validator phía server cùng sẵn sàng.
- Pilot local không gửi email và không phát credential thật; số liệu QA không phải phản hồi learner thực tế.

## Trước khi tạo release candidate

1. Hoàn thành checklist QA của learning, gồm full journey bằng tài khoản learner và instructor local. Lưu evidence cùng commit ứng viên sau khi có yêu cầu remote delivery.
2. Chạy `pnpm db:verify` và giải quyết migration governance theo [quy trình baseline](../db-baseline/README.md). Không tự thêm migration vào frozen approved set để làm check xanh. Local development gate đã pass; production verifier vẫn từ chối migration ngoài approved set, không tự duyệt Learning.
3. Dùng maintenance cutover cho chuỗi hiện tại: enforcement nằm trong các migration immutable và artifact mới không chạy trên baseline. Không có điểm dừng hai bước được chứng minh; không sửa lịch sử để tạo điểm dừng giả. Diễn tập local được mô tả bên dưới. Khi chuẩn bị remote release, phải triển khai cơ chế chặn ingress tương đương trên hạ tầng đích; dừng container local không phải một cơ chế maintenance đã triển khai trên managed Supabase.
4. Chạy báo cáo ảnh hưởng trên snapshot local, rồi read-only trên dữ liệu thật trong đợt rollout được ủy quyền. Kiểm tra lesson sắp thay đổi visibility, bài invalid, instructor attribution, permissions, mẫu số progress và course readiness. Công cụ `scripts/learning/impact-local.mjs` hiện chỉ phục vụ local; không mặc định dùng credential remote.
5. Kiểm kê invalid content trước rollout; giữ maintenance sau apply cho tới khi xử lý đủ và smoke pass. Không tự xóa content/progress; đưa bài invalid về draft để instructor sửa, giữ dữ liệu thô và lịch sử.

## Thứ tự rollout sau khi đủ điều kiện

Theo [quy trình release của repository](../RELEASE_PROCESS.md): work branch → staging → PR staging–main → production dispatch. Các workflow là nguồn thực thi; frontend Cloudflare có pipeline riêng.

1. Diễn tập toàn bộ cutover trên staging: đóng ingress API trước apply, bao gồm phiên client đang mở. Banner hoặc chỉ khóa frontend không đủ.
2. Backup và kiểm chứng restore trước khi apply; ghi manifest canonical và artifact. Apply nguyên chuỗi trong maintenance, đối chiếu impact/history, xử lý danh sách invalid, triển khai API/client tương thích rồi smoke nội bộ.
3. Khi lỗi giữa chuỗi hoặc smoke thất bại, giữ ingress đóng. Chỉ restore về snapshot trước rollout khi chưa mở lại/chưa có dữ liệu mới; sau đó apply lại canonical hoặc forward fix đã kiểm thử. Không nới quyền ghi legacy.
4. Chỉ mở lại khi database, API, artifact và smoke đều pass. Chứng minh một thao tác authenticated thành công sau mở lại; từ thời điểm có dữ liệu mới không restore backup cũ.
5. Theo flow work branch → staging → PR staging–main; chỉ merge khi mọi gate staging/PR bắt buộc pass. Production là dispatch được ủy quyền từ main, không tự chạy sau merge.
6. Frontend Cloudflare dùng pipeline riêng: chuẩn bị artifact trong maintenance, giữ URL/run evidence và kiểm tra bản đang phục vụ trước mở lại. Build thành công không chứng minh đã publish.

## Theo dõi sau rollout

- Theo course: enrolled/start/complete, final submit/approve; theo lesson: start/complete, chưa hoàn thành sau khi bắt đầu, quiz pass rate và code completion.
- Đối chiếu mẫu số progress chỉ gồm lesson published và chưa archive. Completion lịch sử giữ nguyên dù curriculum thay đổi.
- Theo dõi lỗi RPC quiz submit, final submit/review, progress write, completion sync và credential delivery. Credential lỗi cần retry riêng, không đảo completion đã commit.
- Events learning phải private, không chứa source code, câu trả lời quiz hoặc artifact nộp bài. Số liệu start chỉ có từ lúc bật telemetry cho learner đăng nhập; không diễn giải thiếu event lịch sử thành learner chưa bắt đầu.
- Learner thật tự nguyện dùng pilot và cung cấp phản hồi sau local delivery; không thay thế bước này bằng tài khoản QA.

## Xử lý lỗi và rollback

Dừng bước rollout tiếp theo khi gate fail; đọc lỗi tại bước thất bại và giữ evidence. Application rollback chỉ dùng artifact tương thích với enforcement hiện hành. Database sửa bằng forward migration sau khi kiểm tra trạng thái thật; không drop lịch sử, không thu hồi credential tự động, không nới lại quyền ghi cũ. Nếu chưa có artifact tương thích, xử lý bằng forward fix thay vì rollback mù.

## Báo cáo snapshot local

Sau khi apply migrations trên disposable local, chạy:

```sh
node scripts/learning/impact-local.mjs > /tmp/learning-impact.json
node scripts/learning/impact-local.integration.mjs
```

Report v2 dùng transaction repeatable-read/read-only, xuất JSON thuần có thứ tự ổn định. Ngoài visibility/invalid content/attribution, report có số lesson bị loại, credential lịch sử và readiness từng enrollment: mẫu số canonical, số bài complete required, percent, final status mới nhất, eligibility hiện tại, completion lịch sử cần giữ và completion sync còn thiếu.

Adapter tự nhận diện cột publication: schema cũ xuất `local_pre_migration_snapshot`, schema mới xuất `local_post_migration_snapshot`. Ở schema cũ, `published=true` trên lesson thể hiện chính sách cũ không có trạng thái lesson riêng; `public_visible` kết hợp course publication. `validation_available=false` nghĩa là chưa có validator mới, không phải nội dung đã hợp lệ. Lưu snapshot trước/sau từ từng thời điểm có thật để đối chiếu; không dùng `all_lessons` như bằng chứng về mẫu số production trước đây. Report có user/profile IDs và permissions, nên lưu như tài liệu vận hành nội bộ, không đưa vào analytics public. Integration harness chỉ tạo fixture local tạm rồi cleanup; không tác động tài khoản remote.

Đối chiếu hai snapshot v2 đã lưu:

```sh
node scripts/learning/compare-impact.mjs /tmp/learning-before.json /tmp/learning-after.json > /tmp/learning-diff.json
node --test scripts/learning/compare-impact.test.mjs
```

`changes` liệt kê added/removed/changed theo course + lesson/user; thứ tự object/row và thứ tự mã validation không tạo chênh lệch giả. Thứ tự attribution vẫn được giữ để đối chiếu. `history_changes` đánh dấu completion/credential timestamp đã tồn tại nhưng bị đổi/xóa, gồm cả enrollment mất khỏi snapshot. Đây là mục cần điều tra trước rollout tiếp theo, không phải lệnh sửa hoặc thu hồi dữ liệu. CLI chỉ đọc hai file; không tự kết nối database. Exit 0 nghĩa là so sánh thành công, không có nghĩa là diff rỗng hoặc đủ điều kiện release.


### Kiểm chứng upgrade từ schema trước Learning

```sh
node scripts/learning/verify-upgrade-local.mjs /tmp/corelia-learning-upgrade-evidence
```

Harness tạo project Supabase biệt lập `corelia-learning-upgrade`, port 553xx, chỉ chạy database; không reset `corelia-app`. Nó copy nguyên migration trước `20260910040432`, khởi tạo baseline, nạp `legacy-fixture.sql`, xuất snapshot trước, copy/apply phần còn lại theo thứ tự canonical rồi xuất snapshot sau và comparison. Không sửa baseline hoặc migration đã apply. Stack biệt lập được stop `--no-backup` trong finally; output còn lại ở thư mục truyền vào. Nếu stack cùng tên đã tồn tại, harness từ chối để tránh ghi đè dữ liệu của lượt khác.

Fixture bao gồm format fallback article/video, lesson trống trong course published, locale subtitle sai kiểu, quiz có attempt cũ, rejected/resubmitted final, completion và credential lịch sử. Kiểm tra hash dữ liệu lịch sử/content trước–sau, các cột attempt mới vẫn NULL, attribution lọc profile invalid/trùng, quyền content/submissions/students theo profile và visibility anonymous qua RLS. Fixture mở rộng của đợt rà soát thêm quiz có option sai kiểu nhưng có ID ổn định; hash bao gồm cả question rows. Với fixture này mẫu số giảm 5→4; lesson trống không còn public; subtitle lỗi được giữ nguyên và report liệt kê để instructor sửa. Fixture cố tình invalid là bằng chứng phát hiện lỗi, không phải nội dung pilot đã nghiệm thu.

Đây là kiểm chứng upgrade một chuỗi migration. Thêm `--cutover` để thực thi phương án maintenance được chọn bên dưới.


### Ma trận compatibility đã kiểm thử local

Chạy lại `node scripts/learning/verify-upgrade-local.mjs /tmp/corelia-learning-compatibility-evidence`. Harness chạy `compatibility-local.sql` trên baseline và schema mới, rollback mọi probe rồi kiểm tra hash history không đổi.

| Consumer/đường ghi | Baseline trước Learning | Schema Learning + bridge |
|---|---|---|
| Client cũ: `submit_quiz_attempts` cho lesson | RPC cũ trả attempts, không có attempt group | Forward migration `20260911172940` chuyển batch sang `private.learning_quiz_submit`, vẫn trả attempts |
| Client cũ: section quiz batch | Bộ chấm section hiện hữu | Giữ bộ chấm và quyền hiện hữu, có regression probe |
| Client mới: `learning_quiz_submit` | RPC chưa tồn tại | Chấm/completion giao dịch, trả request group |
| Ghi attempts trực tiếp | Đã bị revoke INSERT từ baseline tháng 8 | Vẫn bị chặn; adapter không cấp lại quyền |
| Ghi quiz completion trực tiếp trước khi pass | Baseline còn chấp nhận | Bị `QUIZ_PASS_REQUIRED` chặn; canonical RPC chỉ complete sau pass |
| Sửa submission trực tiếp bằng learner | Baseline có đường update | Migration `20260911173523` revoke trực tiếp INSERT/UPDATE/DELETE, trả lỗi quyền thay vì zero-row success; phải chuyển sang final submit/review RPC mới |

Bridge lesson batch chỉ chấp nhận một course/lesson, đủ câu hỏi, không trùng ID hoặc trộn section. Retry đi qua policy canonical. Vì client cũ không có request ID, payload câu trả lời giống nhau được replay theo user/course/lesson; đổi câu trả lời tạo request khác. Client mới dùng request UUID tường minh. Đã kiểm tra mixed-course/duplicate/retry-disabled không ghi attempts dở.

**Giới hạn còn mở:** bridge ở cuối chuỗi không biến các migration enforcement đầu chuỗi thành additive. Chưa có bằng chứng deploy client mới trên schema baseline (RPC mới chưa tồn tại), final assignment/editor cũ chưa có adapter đầy đủ. Không được coi bridge quiz là đã khép rollout hai bước hoặc cho phép remote release. Không khôi phục quyền ghi cũ để che lỗi compatibility này.


Final review compatibility: client cũ dùng direct UPDATE và chỉ kiểm tra `error`, nên RLS zero-row từng có thể báo duyệt thành công giả. Forward migration `20260911173523` trả permission error cho đường này; owner/instructor gọi `learning_final_review` vẫn review/replay thành công trong probe biệt lập. Đây là lỗi rõ ràng để người dùng biết thao tác chưa thực hiện, không phải adapter cho phép client final cũ tiếp tục hoạt động.

Helper authoring `addLesson`/`updateLesson` trong artifact mới dùng cột publication/archive riêng, giữ duration, trả state từ DB và yêu cầu một row được ghi. Chưa chứng minh artifact mới chạy trên schema baseline chưa có các cột đó; không đánh dấu compatibility hai bước hoàn tất.


### Diễn tập maintenance cutover local

```sh
pnpm build
LEARNING_QA_POSTGRES_VERSION=17.6.1.156 node scripts/learning/verify-upgrade-local.mjs /tmp/corelia-learning-cutover-evidence --cutover
```

Harness dùng riêng project `corelia-learning-upgrade`/ports 553xx và bật REST/Auth/Storage/gateway. Trình tự thực thi trong `scripts/learning/cutover-local.mjs`:

1. Dừng Kong để chặn toàn bộ HTTP ingress local, probe REST/RPC/Edge/Storage từ đường client đã mở. Cơ chế này chặn cả thao tác ngoài Learning trong stack diễn tập; không dùng stack QA chính.
2. Tạo pg_dump custom, file quyền 0600 trong thư mục tạm riêng; evidence chỉ ghi hash/bytes/path, không ghi JWT hoặc dump vào repository.
3. Apply nửa chuỗi canonical, tiêm lỗi giữa hai batch, kiểm tra gateway vẫn đóng. Restore database, xác nhận hash history/content bằng baseline rồi apply nguyên chuỗi.
4. Tiêm lỗi smoke và gate invalid content; cả hai giữ maintenance. Remediation fixture unpublish video locale malformed và quiz malformed, không sửa raw/history.
5. Smoke nội bộ qua Docker network: REST read và trusted RPC rollback; ghi hash artifact `dist/client`. Chỉ sau đó mở ingress, thực hiện quiz authenticated và xác nhận không được restore sau write mới.

`cutover.json` ghi từng sự kiện/failure drill; `before.json`, `after.json`, `comparison.json`, `verification.json` ghi impact/history. Bản dump nằm ngoài repo; stack disposable được xóa trong finally. Restore giữ ownership và extension-member wrappers của baseline, không vô hiệu hóa trigger/RLS.

Giới hạn bằng chứng: đây là backup/restore database, không phải diễn tập khôi phục toàn bộ blob Storage; fixture không chứa blob cần restore. Smoke artifact trong harness kiểm tra bundle và RPC, browser matrix là gate riêng. Cơ chế managed-remote ingress và backup Storage phải được xác minh trong đợt release được ủy quyền; không suy rằng thao tác Docker local đã triển khai được trên production.

### Image local và Save course sau AUD-19

Image `17.6.1.111` crash khi role `anon`/`authenticated` bị từ chối EXECUTE ([upstream #2112](https://github.com/supabase/postgres/issues/2112)). QA dùng image `17.6.1.156`, không thay ACL, RLS hoặc tắt extension để vượt gate. CLI hiện hữu đọc version từ file ignored `supabase/.temp/postgres-version`; backup local trước khi stop/start và đối chiếu hash sau restart. Harness upgrade nhận version qua biến tường minh phía trên. Negative tests phải chạy với role thật, không coi inherited-role probe là thay thế.

Migration `20260911215843` bổ sung `learning_save_course_info(text,jsonb,text,jsonb)`. Editor mới Save metadata + locale bằng một transaction, chỉ đánh dấu draft đã lưu sau RPC thành công. Owner/support/admin quản lý thông tin course; co-instructor theo feature vẫn dùng các thao tác được cấp riêng. Trên baseline RPC này chưa tồn tại; client mới không tương thích baseline. Client cũ vẫn có đường ghi bảng nhưng Save nhiều request không có bảo đảm atomic, nên không được mở lại trong cutover. Apply đủ canonical chain và artifact mới trước smoke/mở ingress. Probe compatibility kiểm tra RPC vắng ở baseline và unpublish atomic ở backend cuối, rollback toàn bộ dữ liệu probe.

CI parity: `db-guardrails.yml`, `deploy-staging.yml` và `deploy-prod.yml` pin17.6.1.156 trong bước khởi động **local disposable stack** bằng file `.temp/postgres-version`. Không thay phiên bản managed database hoặc approved migration set. Đối chiếu image trong log CI và yêu cầu negative reserved-role tests pass; không thay test bằng role khác nếu gặp lỗi image.
