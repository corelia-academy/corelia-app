# Learning local QA — đang triển khai

Chưa đạt Local Done. Tài liệu này ghi evidence có phạm vi cụ thể, không thay thế checklist nghiệm thu toàn hệ thống.

## Evidence ngày 11/09/2026

| Gate | Kết quả và phạm vi |
| --- | --- |
| `pnpm vitest run src/lib/learning.test.ts` | 7 tests pass: completion tải lại, không đọc dữ liệu learner trong preview, roster cancellation và lỗi quyền. Quiz UI recovery và draft persistence nằm trong full suite. |
| `pnpm vitest run src/features/learning/QuizLesson.test.tsx` | 7 tests pass ở đợt retry hardening: cố định payload sau lỗi mạng, chặn gọi submit trùng, retry sau fail tạo request mới, scope theo course và các ca preview/completion recovery. |
| `pnpm test` | 93 files, 675 tests pass sau khi sửa quiz recovery, draft persistence, course roster, nháp corrupt/cross-course, final review, duplicate lesson và authoring validation. Không chứng minh toàn bộ authorization matrix. |
| `pnpm exec tsc -b` | Pass với các contract preview locale và báo cáo mới. |
| `pnpm lint` | Pass. |
| `pnpm build` | Pass; Monaco vẫn tạo chunk lớn và có cảnh báo kích thước bundle. |
| `pnpm db:verify:local` | Pass toàn bộ isolated integration gates; chuỗi migration mới được apply từ đầu. |
| `pnpm db:verify` | Fail ở CASE P0b: frozen baseline + approved pending set chưa gồm các migration mới. Không sửa baseline để bỏ qua gate. |
| `git diff --check` | Pass tại đợt kiểm tra này. |

SQL `scripts/db/tests/learning-system.integration.sql` có các assertion: learner không tự complete quiz; fail không complete; request trùng không nhân attempt; final pending/rejected không complete; resubmit giữ lịch sử; instructor review bản mới nhất; stale approve bị chặn; approval lặp giữ timestamp; bài published invalid bị chặn; archive giữ attempts/completion. Báo cáo được thử với hai course cố ý dùng cùng lesson ID, và kiểm tra learner/instructor ngoài quyền không đọc được báo cáo.

Báo cáo UI được nối vào mục Học viên của editor instructor hiện hữu. Không có editor course admin thay thế. Component review/report song song không dùng đã được loại bỏ.

## Browser QA local ngày 11/09/2026

- Seed pilot hai lần thành công sau isolated reset; mỗi lần báo 2 sections/12 lessons.
- Tài khoản QA role `instructor`, là owner pilot, đăng nhập tại `localhost:5188` và mở `/instructor/courses/corelia-learning-pilot-rust-cli/edit` thành công. UI hiện đủ 12 bài và các mục vận hành cũ: thông tin, nội dung, final assignment, chứng nhận, OpenCampus, thông báo, học viên. Pilot tắt chứng nhận nên mục chứng nhận disabled theo cấu hình.
- Mục Học viên hiển thị report 12 lessons, phân biệt article/practice/code/quiz. Screenshot desktop được kiểm tra, bảng và metric cards nằm trong editor hiện hữu.
- Preview lesson 06: chọn English trong khi giao diện vẫn tiếng Việt; heading, questions, options và explanations chuyển sang English. Chấm 3/3 hiển thị 100%/Đạt.
- Read-only SQL sau preview đếm 0 attempts, 0 lesson progress, 0 final submissions, 0 learning events cho pilot. Kiểm thử component riêng xác nhận preview không gọi callbacks ghi dữ liệu.
- Các kiểm tra preview ở trên không thay thế QA learner hoặc mobile/keyboard.

## Pilot learner → instructor review ngày 11/09/2026

Thực hiện trên browser local với tài khoản `student` riêng và instructor owner, không dùng admin để học hoặc review.

- Article complete lưu progress rồi navigate; checklist chưa đủ bước giữ CTA disabled.
- Phát hiện reload nhanh làm mất nháp do debounce 350 ms. Practice và code hiện flush draft trên `pagehide` và unmount. Test hồi quy kiểm tra pagehide, unmount/remount, câu trả lời code mới nhất và preview không ghi. Browser đã xác nhận checklist giữ đủ ba bước sau reload nhanh.
- Hai code fill: đáp án sai giữ progress; đáp án đúng tăng progress. Hai code edit nhập qua Monaco và pass, đưa learner tới 9/12 sau bài validation.
- Quiz nền tảng: fail 0/3 giữ 5/12; reload giữ kết quả fail; retry pass 3/3 tăng lên 6/12. Quiz ứng dụng pass 3/3.
- Rust/Cargo local chạy được; reference CLI pass 6 unit tests. Chuỗi process riêng `add 'Học Rust'` → `list` → `done 1` → `list` giữ dữ liệu và đổi trạng thái `[ ]` sang `[x]`.
- Guided project hoàn thành; artifact bắt buộc ở bài 12 chuyển sang final form. Đủ 12/12 rồi submit hiển thị pending. Read-only SQL xác nhận `completed_at` vẫn NULL.
- Instructor đọc được nội dung và artifacts trong mục Bài tập cuối khoá của editor cũ, bấm Duyệt. SQL xác nhận submission approved và course completed; `certificate_issued_at` vẫn NULL vì pilot tắt credential.
- Phát hiện toast lỗi sau approve do editor gọi cấp chứng nhận lần thứ hai. Đã bỏ lần gọi trùng: service review chịu trách nhiệm sync credential riêng; lỗi credential không phủ nhận review đã commit. Cần nghiệm thu lại browser review sau bản sửa này.
- Footer bài cuối đổi nhãn sang “Đến bài nộp cuối khóa” khi course có final assignment, tránh gợi ý course đã hoàn tất trước review.

GitHub URL trong bài nộp là fixture `example/corelia-learning-local-qa`, có notes nêu rõ không phải repository learner thật. Project được kiểm tra từ thư mục reference local; không publish repo, gửi email hoặc phát credential thật. QA này chứng minh luồng dữ liệu, không phải đánh giá năng lực hoặc phản hồi learner thật.

Lỗi tên learner trong bảng review đã được sửa bằng RPC roster theo course. Browser instructor hiển thị `Learning QA learner · 100% bài học`; không mở RLS toàn bộ profiles. SQL tests xác nhận: owner/students đọc danh tính và email của participant; reviewer chỉ đọc người có bài nộp và email NULL; content-only, learner và instructor ngoài course không đọc roster. Reviewer truy cập được course draft nhưng không đọc draft lesson hoặc sửa root course.

Kiểm thử roster cũng phát hiện trigger publication chặn cập nhật follower counter khi curriculum đã archive hết. Trigger course hiện chỉ kiểm tra INSERT hoặc UPDATE thay đổi data/published/archived_at; cập nhật counters không chạy publish validation. Integration test có enrollment tạo follower để bảo vệ trường hợp này.

## Archive và danh sách course

- Editor cũ có archive/restore course và lesson; restore luôn đặt published=false. Các mutation yêu cầu database trả lại row đã update, tránh hiển thị thành công khi RLS khiến update không tác động row nào.
- Danh sách `/instructor/courses` thêm search tên/slug, lọc Published/Draft/Archived và badge archived. Thống kê draft/published không cộng archived.
- Guard xóa chặn records archived và course có attempts; truy vấn lịch sử lesson/section/question được scope theo course ID.
- SQL integration pass: archive ẩn course với anon, giữ completion; restore giữ attempts và chưa public; draft chưa có learning data ở khóa khác xóa được dù trùng lesson/section ID; archived draft phải restore trước hard-delete.
- Các controls mới chưa qua browser QA. Kiểm thử database không thay thế QA xác nhận dialog, lỗi mutation và cache refresh trên UI.

## Các phần còn cần nghiệm thu

Code revision: migration `20260911123245_learning_code_revision.sql` áp dụng canonical revision cho direct INSERT/UPDATE và RPC. Isolated gate pass: initial revision=1, hints/blank feedback/test description giữ revision, accepted answers/test value tăng revision, spoof revision bị ghi đè và RPC lưu config không đổi không tăng thêm. Legacy archive và 5 kịch bản concurrency hiện có vẫn pass trong cùng gate. Chưa browser QA save–reload draft sau thay đổi config/copy.

Final concurrency: ba kết nối learner cạnh tranh submit; replay cùng UUID dùng payload khác không tạo row mới, UUID khác bị `SUBMISSION_ALREADY_EXISTS`. Harness xác nhận chờ khóa thật, chỉ 1 row với nội dung ban đầu, trạng thái pending và course completion NULL dù lessons đã đủ. Hai kết nối instructor approve đồng thời giữ cùng reviewed_at và hoàn thành course sau khi đủ điều kiện. Các ca này chạy trong harness local, không gọi credential Edge hoặc gửi email. Chưa có ca cạnh tranh reject/resubmit/stale review.

Quiz concurrency: harness local thêm learner riêng và quiz published có `allow_retry=false`. Hai kết nối authenticated dùng cùng request UUID; kết nối thứ hai gửi đáp án khác, chờ advisory lock thật, rồi nhận lại kết quả pass/completed của payload đầu tiên. SQL xác nhận đúng 1 attempt, 1 group, 1 completed progress. Fixture và dữ liệu học tập tổng hợp được dọn theo course ID ngẫu nhiên. Đây là replay cùng request; chưa bao phủ hai request khác nhau hoặc concurrent question edit/quiz grading.

Locale/publication concurrency: `scripts/db/tests/learning-concurrency.mjs` mở hai kết nối PostgreSQL với role authenticated của instructor owner. Harness quan sát `pg_blocking_pids` để xác nhận chờ khóa thật trước khi commit kết nối giữ khóa. Cả hai thứ tự pass: publish trước → locale invalid chờ rồi rollback; locale invalid trước → publish chờ rồi rollback. Kiểm tra trạng thái cuối xác nhận không lưu resource invalid vào bài published. Test dùng IDs ngẫu nhiên, chỉ Docker local, cleanup theo lesson → course → auth user; đã nối vào `db:verify:local`. Phạm vi này chưa bao gồm concurrent quiz/final submit hoặc mọi isolation level.

Publication scope: migration `20260911122247_learning_publication_scope_lock.sql` kiểm tra cả scope OLD/NEW khi chuyển question/locale. SQL integration pass với direct UPDATE chuyển câu hỏi duy nhất khỏi quiz published: mutation bị từ chối, row còn ở quiz gốc. Parent lock lấy theo course/lesson order và được áp dụng thêm cho locale mutations. Isolated full migration apply pass. Hai phiên đồng thời locale edit/publish đã được kiểm tra riêng trong harness concurrency nêu ở trên.

Legacy retirement: migration `20260911122011_learning_legacy_archive.sql` cho phép metadata-only unpublish/archive/restore-to-draft khi giữ nguyên JSON cũ. Isolated integration pass với fixture code config rỗng và resource shape null: giữ nguyên nội dung qua archive/restore; publish lại bị chặn; sửa nhưng vẫn malformed bị chặn; article đã sửa hợp lệ publish được. Fixture tái dựng dữ liệu pre-enforcement bằng replica mode chỉ trong setup của test transaction, sau đó phục hồi triggers trước toàn bộ assertion. Không có thay đổi quyền hoặc vô hiệu hóa guard trong migration. Browser QA nội dung legacy lỗi còn chưa thực hiện.

Code draft parsing: 26 targeted tests pass (13 drafts + 13 draft persistence). Bộ đọc từ chối fill answers kiểu string/array hoặc value không phải string, trả về đúng schema theo mode và bỏ field dư. Round-trip source 64 KiB pass với ASCII, Unicode và JSON escape; quá giới hạn UTF-8 bị chặn cả read/save. Storage bị chặn không làm crash bài tập. Chưa browser QA các trường hợp localStorage bị chỉnh/hỏng; full suite ở bảng đã được chạy lại sau thay đổi parser này.

Final submission retry: form giữ snapshot content/artifacts/request ID/file URLs khi gọi submit; response lỗi khóa nội dung và cho retry đúng payload. Upload thành công được cache trong phiên form theo File để không upload lại khi file sau lỗi hoặc submit lỗi. Ref chặn double-click trước render; event chuyển artifact không thay đổi payload đang gửi/chờ kết quả. Component tests 5 ca pass, gồm lỗi upload thứ hai, lỗi submit sau upload, giữ payload, đổi scope và completion form. Chưa kiểm thử mất mạng thực tế, reload khi đang upload hoặc URL upload hết hạn.

Practice revision: migration `20260911121236_learning_practice_revision.sql` tính revision trong trigger cho INSERT/UPDATE data. Isolated integration pass cho new=1, RPC chỉnh label/title + bản dịch giữ revision, direct thêm checklist item tăng revision, spoof revision bị ghi đè, đổi mode tăng revision, đổi guided title/instructions giữ revision và đổi submission fields tăng revision. Bản pilot được seed lại sau isolated reset. Browser save–reload nháp khi instructor sửa copy vẫn cần nghiệm thu; enforcement revision code qua direct update có bộ SQL assertion riêng ở đợt code revision.

Resource publication SQL: isolated apply + integration pass. Direct UPDATE tài nguyên gốc thiếu tên, UPDATE locale thiếu URL, publish draft có tài nguyên thiếu và publish draft có locale invalid đã lưu trước đều bị chặn; sửa locale hợp lệ rồi publish thành công. Full suite 660 tests pass. Local reset xóa tài khoản/bài nộp/draft QA của đợt trước; seed pilot được chạy lại riêng. Concurrent locale edit/publish đã có harness riêng; mọi trường hợp URL đặc biệt chưa được kiểm thử.

Resource authoring: thêm nút bỏ từng tài nguyên, kiểm tra tên/URL theo trạng thái publish, gắn locale vào issue và focus đúng trường của bản dịch. Targeted tests (LessonEditor + resourceValidation) có 9 tests pass; ca EN lỗi URL → focus EN → bỏ tài nguyên → Save xác nhận resources gốc không đổi. Migration `20260911120958_learning_resource_publication.sql` đã bổ sung enforcement tên/URL không rỗng khi published cho master và mọi locale đã lưu. Chưa browser QA controls mới, không coi client validation là bằng chứng chống bypass.

Quiz retry hardening: lần submit giữ snapshot đáp án theo request ID. Khi mất response, controls khóa và CTA Thử lại dùng cùng snapshot; chỉ retry một kết quả fail đã nhận mới mở đáp án và tạo request mới. Ref chặn hai lần gọi action trước React render tiếp theo. Quiz remount theo course ID để tránh giữ state giữa các course có lesson ID legacy trùng. Component tests có thử đổi lựa chọn sau lỗi, gọi action hai lần, retry fail và chuyển course. Chưa browser QA mất mạng thật; full suite đã chạy lại sau thay đổi này.

Validation authoring: danh sách lỗi client có bản dịch vi/en và hành động focus trường. Component test xác nhận từ preview English quay về master editor, focus title/content và không gọi save khi invalid. Quiz validation kiểm tra không có câu hỏi, text rỗng, lựa chọn rỗng và correct index ngoài phạm vi; các lỗi gắn control ID. Code/practice hiện focus nhóm config, chưa sâu tới từng marker/test/step. Chưa browser QA luồng focus và chưa thay thế server-side validation còn thiếu được liệt kê dưới đây.

Duplicate lesson: browser owner đã nhân bản quiz 06 trong dialog cũ; trước Save database vẫn có 12 lessons, sau Save có draft mới với 3 questions và 2 locales. Saved preview tải lại được nội dung tiếng Việt; chọn English hiển thị đúng tiêu đề, cả ba câu hỏi và lựa chọn tiếng Anh của bản sao. SQL join xác nhận cả 3 bản dịch English dùng đúng question IDs mới. Unit tests bảo vệ ID mới, mapping locale, scoring, duration, machine config và không mutate bản gốc. Ở đợt duplicate QA, database local có thêm một draft QA ngoài 12 bài pilot; fixture nguồn pilot vẫn giữ đúng 12 bài. Chưa browser QA duplicate cho cả năm format hoặc copy bài có attempts thật.

Đợt final review: form nộp bài remount theo course/profile, test xác nhận không mang nội dung/artifact sang scope khác và bỏ qua event cũ. Lỗi submit giữ nội dung và request ID cho retry. Editor instructor giữ bảng review hiện hữu, thêm disclosure xem đầy đủ nội dung, links file an toàn, nhận xét đã lưu và textarea nhập feedback trước approve/reject. Browser local owner đã mở bài fixture ba dòng, nhập nhận xét, bấm từ chối; UI chuyển “Cần chỉnh sửa” và SQL xác nhận nguyên văn nhận xét. Đây là fixture tạo qua learner RPC với 0 lesson completion, không phải lượt học pilot mới; file download và mobile chưa được browser QA ở đợt này.

Đợt hardening nháp local: practice bỏ qua JSON hỏng, null/array và artifact sai kiểu; chỉ khôi phục checkbox boolean và artifact string được hỗ trợ. Final assignment dùng cùng bộ lọc cho localStorage và event chuyển artifact. Test mô phỏng SecurityError/QuotaExceededError xác nhận bài học vẫn thao tác được và báo không lưu được nháp. Practice/code remount theo course ID, tránh mang state sang course khác dùng cùng lesson ID legacy. Targeted suite có 21 tests pass; chưa thay thế browser QA cho tình huống storage bị chặn.

- Browser QA lại editor instructor hiện hữu sau khi tích hợp: save/reload, preview vi/en, quyền co-instructor theo feature, mobile/keyboard, dirty navigation và lỗi mutation.
- Nghiệm thu lại review sau sửa lỗi toast; resubmit/rejected trên browser; fixture video riêng; credential delivery lỗi và retry. Happy path 12 lessons → submit → instructor approve đã có evidence nêu trên.
- Authorization matrix đầy đủ ở RLS/RPC/Edge/Storage và concurrent quiz/final submit. SQL đã pass một tập ca, chưa phủ toàn bộ matrix yêu cầu.
- Publish validation đầy đủ cho mọi mutation liên quan, resources/locales, guided artifact mapping, revision và compatibility dữ liệu legacy.
- Browser QA archive/delete, lỗi publish focus đúng field và tất cả consumer completion/progress.
- Báo cáo migration tái lập đầy đủ, release split additive/enforcement, hướng dẫn authoring/review và rà soát toàn bộ diff.

Các mục này giữ nguyên phạm vi kế hoạch đã chốt, với điều chỉnh mới nhất: instructor vẫn quản lý course và route edit cũ được giữ.

### Bỏ nhập thời lượng thủ công và hoàn tất kiểm tra retry scope

- Editor instructor hiện hữu đã bỏ ô nhập duration trong cả thêm và sửa lesson. Bài mới không phải video có duration mặc định 0; sửa bài không ghi đè duration lịch sử. Metadata YouTube và thời lượng đoạn start/end vẫn giữ nguyên luồng hiện hữu.
- Targeted tests `lessonFormat.test.ts` và `LessonEditor.test.tsx`: 2 files / 6 tests pass. `pnpm lint`, `pnpm build` và `git diff --check` pass. Chưa nghiệm thu browser riêng cho thay đổi bỏ ô duration.
- Migration `20260911123514_learning_quiz_retry_scope.sql`: kiểm tra `allow_retry=false` theo user/course/lesson. SQL fixture xác nhận cùng learner làm được hai quiz trùng lesson ID ở hai course, nhưng không retry trong cùng course.
- `pnpm db:verify:local` sau migration này pass toàn bộ integration gates, gồm concurrency và Jobs PostgREST smoke. `pnpm db:verify` vẫn fail CASE P0b do danh sách migration release đã phê duyệt chưa chứa migrations mới; không chỉnh danh sách để bỏ qua gate.
- Đã seed lại pilot local sau database reset: 2 sections / 12 lessons, không gửi email hoặc cấp credential.

### Xóa section nguyên tử và cascade khóa nháp

- `learning_delete_section` chạy với `SECURITY INVOKER`, kiểm tra quyền content hiện hữu, khóa section và xóa lessons + section trong một transaction. Client không còn gửi danh sách lesson có thể đã stale hoặc thực hiện hai request xóa riêng.
- Migration `20260911124254_learning_atomic_section_delete.sql` cho phép section cascade khi parent course đã được xóa trong cùng transaction. Course/lesson guards tiếp tục chặn published, archived và learner history.
- SQL integration xác nhận owner instructor có quyền, owner khác bị từ chối, published/archived lesson làm rollback cả section, missing section trả lỗi, scope trùng ID không ảnh hưởng course khác, draft course có section + lesson xóa hoàn chỉnh.
- `pnpm db:verify:local`: toàn bộ gates pass. `pnpm test`: 93 files / 675 tests pass. Lint, build, diff check pass; build còn warning Monaco chunk lớn đã ghi nhận. Static `pnpm db:verify` vẫn fail riêng CASE P0b (release migration approved set).
- Browser QA cho confirm/error của thao tác xóa section mới và concurrency giữa thêm lesson/xóa section còn cần nghiệm thu; SQL test tuần tự không thay thế hai mục này.

### Concurrency bổ sung: section và review bản nộp cũ

- Harness `scripts/db/tests/learning-concurrency.mjs` hiện pass 8 kịch bản trên các session Postgres riêng. Mỗi cạnh tranh đều xác nhận lock wait bằng `pg_blocking_pids`, không chỉ dựa vào delay.
- Insert lesson published trước: xóa section chờ insert commit, rồi bị chặn bởi `ARCHIVE_LESSON_REQUIRED`; cả section và lesson còn nguyên.
- Xóa section trước: insert lesson chờ delete commit, rồi lỗi foreign key; không có orphan lesson.
- Review rejected trước: request nộp lại chờ review commit rồi tạo bản pending mới. Trong lúc bản mới chưa commit, approve bản cũ phải chờ và sau đó lỗi `STALE_SUBMISSION`.
- Kiểm tra chính xác hai bản nộp được giữ, comment rejected cũ không đổi, bản mới nhất là revised pending và course chưa complete. Hai approve đồng thời sau đó chỉ approve bản mới, giữ cùng reviewed_at và complete course đủ điều kiện.
- Chạy trực tiếp harness trên disposable local: 8/8 pass; targeted ESLint và `git diff --check` pass. Không đổi schema/frontend trong lượt này; không cần reset pilot hay chạy lại build. Browser QA vẫn chưa được thay thế bởi các kiểm tra SQL này.

### Đồng bộ fallback format và trạng thái publication

- Migration `20260911124739_learning_report_legacy_formats.sql` sửa format của báo cáo: explicit format ưu tiên; legacy có video là video, có markdown/summary là article, còn trống là video, đúng baseline client. SQL integration kiểm tra sáu fixture, gồm whitespace và video kèm markdown.
- `isLessonPublishedForLearners` ưu tiên `published=true` sau khi loại archived/explicit draft. Practice published dùng config không còn bị suy đoán là draft chỉ vì thiếu markdown legacy. Fallback nội dung vẫn áp dụng khi không có trạng thái publication.
- Targeted format tests: 6 pass. Full tests: 93 files / 677 tests pass. Lint, build và diff check pass. `pnpm db:verify:local` pass, gồm 8 concurrency scenarios; `pnpm db:verify` còn riêng CASE P0b như đã ghi nhận. Pilot đã seed lại sau reset.

### Xác nhận dòng đã xóa qua PostgREST

- `deleteLesson` và `deleteCourse` yêu cầu trả đúng một ID sau DELETE (`select('id').single()`). Không còn xem DELETE bị RLS lọc hết hoặc ID đã mất là thành công để rồi bỏ dòng khỏi UI/chuyển trang.
- Test client: 6 tests trong `courses.test.ts` pass, gồm lỗi không có dòng, successful delete và scope course/lesson. Lint, build, diff check pass.
- Smoke trực tiếp PostgREST local với hai tài khoản Auth tạm: instructor owner và student khác. Student DELETE course/lesson nhận PGRST116, owner vẫn đọc được lesson; owner DELETE nhận đúng ID; DELETE lại course đã mất nhận PGRST116. Các fixture và tài khoản tạm đã cleanup. Đây là API QA, chưa phải browser QA.

### Curriculum readiness trong editor instructor

- RPC `learning_curriculum_readiness` chỉ cho người có quyền content, kiểm tra mọi lesson chưa archive bằng `learning_lesson_errors`, gồm cả draft. Trả ID và mã lỗi, không trả answers/source hay ghi learning state.
- Editor cũ thêm badge Sẵn sàng/Cần sửa bên cạnh trạng thái Draft/Archived hiện hữu. Badge lỗi mở lesson editor, tooltip liệt kê lỗi; request lỗi có retry. Query key chứa course/user và nằm dưới khóa `courses` để được invalidate sau mutation editor hiện hữu.
- SQL integration chứng minh valid draft ready, quiz draft không có câu hỏi bị báo lỗi, archive bị loại và learner không đọc được readiness. Component test bao phủ loading/ready/issues/click/retry và cached ready không che trạng thái lỗi.
- Full tests 94 files / 681 tests pass; lint, build, diff check pass. `pnpm db:verify:local` pass toàn bộ (8 concurrency scenarios). Static verify vẫn riêng CASE P0b. Pilot đã được seed lại sau reset.
- Chưa browser QA cho badge mới; bấm lỗi hiện mở editor nhưng chưa focus trực tiếp field từ server report. Course-wide Fix first issue vẫn cần hoàn thiện.

### Mở hướng dẫn từ readiness

- Badge Cần sửa truyền mã lỗi server vào editor; curriculum thêm nút Sửa lỗi đầu tiên theo thứ tự readiness server trả về. Editor tính các lỗi field/locale từ dữ liệu đang mở và hiển thị ngay, không yêu cầu Save/Publish trước.
- Test mới mở draft thiếu title từ readiness, bấm sửa lỗi focus title, không gọi save và checkbox publish vẫn false. Full tests: 94 files / 682 tests pass.
- Bundle editor chuyển về query prefix `courses` để mutation từ panel cũ cũng invalidate lesson/locale/section dùng cho hướng dẫn, tránh mở thông tin stale. Không đổi route hay mô hình quyền.
- Còn hạn chế: server-only errors chưa có field/locale cụ thể từ RPC; hiển thị mã dịch nhưng chưa focus chính xác mọi loại lỗi. Browser QA cho luồng mới vẫn cần thực hiện.
- Lint và build sau thay đổi cache pass; diff check pass. Không đổi schema trong lượt này nên không reset database/pilot.

### Browser QA readiness trên route instructor cũ

- Chrome local `localhost:5188`, tài khoản `learning-qa-instructor@corelia.local` role instructor/owner. Đi từ `/instructor/courses` qua nút Chỉnh sửa vào đúng `/:id/edit`; panel thông tin, curriculum, final assignment, chứng nhận, OpenCampus, thông báo, học viên vẫn hiện. Không dùng admin editor.
- Pilot 12 bài đều hiện Sẵn sàng. Thêm một fixture draft tạm thiếu title, duration 37 giây: hiện Cần sửa (1) và nút Sửa lỗi đầu tiên.
- Mở từ badge, lỗi title hiện ngay. Bấm Sửa lỗi đầu tiên trong dialog: AX xác nhận focus tại `learning-title`. Điền title và Save bằng UI: dialog đóng, badge tự chuyển Sẵn sàng và nút lỗi ở curriculum biến mất mà không reload thủ công.
- SQL đối chiếu sau save: title mới, `published=false`, duration vẫn 37. Không có ô duration thủ công trong dialog. Screenshot desktop dark xác nhận draft/ready badges hiển thị cạnh nhau.
- QA phát hiện badge cũ dùng nhãn Đang cập nhật; đã chuyển riêng curriculum instructor sang key `learning.draft` (Bản nháp). Không sửa text learner khác. Sau HMR screenshot xác nhận Bản nháp.
- Fixture tạm đã xóa bằng SQL local và pilot trở về 12 bài. Không coi cleanup này là browser QA thao tác delete. Mobile/light, error retry và focus locale/server-only vẫn cần nghiệm thu riêng.

### Authoring miễn phí và icon format

- Bỏ state/snapshot `isPreviewFree` không còn consumer trong instructor authoring. Field `is_preview_free` legacy vẫn giữ trong schema; luồng thêm bài tiếp tục dùng giá trị false hiện hữu.
- Curriculum instructor thêm nhánh icon Code2 cho code exercise, tránh dùng icon PlayCircle của video. Browser screenshot desktop dark trên route edit hiện hữu xác nhận hai bài code fill có icon code, pilot vẫn 12 bài.
- Lint, build và diff check pass. Đây là cleanup state bất hoạt và sửa icon; không đổi quyền/publication hay cần migration.

### Video playback error qua YouTube API

- Thay xử lý chỉ dựa trên DOM iframe error bằng YouTube IFrame API `onError`. API loader dùng chung giữa preview/learner, timeout 20 giây, cho phép retry sau lỗi tải; player timeout 25 giây và cleanup khi unmount/retry.
- Tạo iframe với `enablejsapi=1`, origin hiện tại, `autoplay=0`, `playsinline=1`; giữ start/end từ helper hiện hữu. Không thêm dependency hoặc gửi source/answers/progress từ player.
- Sáu targeted tests pass: segment/no-autoplay, player error + recreate, API failure + retry, late API sau unmount, shared script/previous callback, script error/timeout recovery. Test transport mock không thay thế browser playback thật.
- Đối chiếu API với tài liệu chính thức: https://developers.google.com/youtube/iframe_api_reference. Browser QA cho fixture YouTube, lỗi embedding thật và mobile vẫn chưa hoàn tất.
- Full suite sau sửa test transport: 96 files / 701 tests pass. Lint, build và diff check pass. Không đổi database trong lượt này.

### Browser QA YouTube IFrame API thật

- Chrome local, route instructor preview của fixture draft tạm `qa-youtube-fixture`. Video `M7lc1UVf-VE` tải thành công, ban đầu hiện Play video; không autoplay. AX URL xác nhận start=5, end=15, enablejsapi=1, autoplay=0, playsinline=1 và origin local.
- Bấm Play: AX có Pause video và thời gian elapsed 7 giây. Kiểm tra sau 9 giây thấy Replay Video (đoạn đã kết thúc). YouTube hiển thị tổng thời lượng gốc khi ended; bằng chứng này không đo chính xác frame cuối tại giây 15.
- Retry đổi widget2 thành widget4 và trở về Play video, giữ start/end/no-autoplay. Preview hẹp mở được; đây là width simulation trên desktop, chưa phải thiết bị mobile thật.
- Đổi fixture sang ID không tồn tại `00000000000`: player YouTube Video unavailable và ứng dụng Không phát được video cùng xuất hiện. Retry tạo widget mới và hiện lỗi lại, chứng minh callback lỗi player hoạt động ngoài unit test.
- Bấm Complete trong preview lỗi rồi kiểm tra SQL theo course/lesson: progress=0, attempts=0, events=0. Fixture đã cleanup; pilot trở lại 12 bài. Không ghi nhận đây là learner completion QA.
- Chưa nghiệm thu lỗi embedding bị owner cấm, ad-block/script network timeout bằng browser, hoặc hành vi trên thiết bị mobile/light theme. Không đổi source trong lượt QA này nên không lặp build/full tests.

### Workspace isolation và completion điều hướng muộn

- Workspace key gồm course/lesson/mode/user/locale; không giữ error/busy/action của course trước khi lesson ID trùng. Complete dùng in-flight ref để chặn click lặp trước React render.
- Sau khi callback completion hoàn tất, workspace kiểm tra còn mounted trước khi điều hướng. Kết quả request cũ vẫn có thể lưu hợp lệ ở server nhưng không thay đổi navigation của màn hình mới.
- Tests mô phỏng deferred completion: double click chỉ một call, chuyển course trước resolve không navigate, lỗi giữ nguyên bài và đổi course xóa lỗi, active completion chỉ navigate sau callback resolve. Callback là boundary bao gồm save/cache refresh; không thay thế test cache trong hook.
- Targeted cuối cùng 3 tests pass. Full suite trước khi thêm test chiều success: 97 files / 703 tests pass; test success mới pass trong targeted cuối. Lint/build/diff check pass. Chưa browser QA tình huống request bị chậm và user đổi course; không đổi schema.

### Impact report v2

- `impact-local.mjs` xuất JSON thuần, sort course/lesson/enrollment ổn định, chạy trong `REPEATABLE READ READ ONLY`; thêm readiness theo enrollment từ canonical certificate-readiness function, final required/status, percent, completion sync pending và historical completion preserved.
- `node scripts/learning/impact-local.integration.mjs` pass: fixture completion cũ, thêm required lesson, draft excluded, final pending → required 2, done 1, percent 50, eligible false, preserved true. `completed_at` trước/sau report không đổi; fixture cleanup.
- Chạy snapshot trước/sau integration rồi `cmp` pass (snapshot local còn lại không đổi). JSON parse và pilot required=12 pass; targeted ESLint/diff check pass.
- Không có migration/frontend đổi trong lượt này. Report vẫn chỉ chạy local và cần schema mới; chưa phải công cụ chạy trên production baseline trước additive migration. Không khẳng định đây là báo cáo trước/sau dữ liệu thật.

### So sánh impact snapshots

- `compare-impact.mjs` so sánh snapshot v2 theo composite IDs, xuất changes từng nhóm + history_changes. Reject version không hỗ trợ, thiếu ID hoặc ID trùng; không nhầm lesson cùng ID ở hai course.
- Bốn Node tests pass: row/key/issue ordering, course-scoped identity, denominator/eligibility, lịch sử được giữ so với changed/removed timestamps, added rows và ambiguous input.
- CLI chạy trên hai snapshot local thực đã lưu: JSON parse được, tất cả summary counts=0, history_changes rỗng. Targeted ESLint và diff check pass.
- Test nằm ngoài glob Vitest của repo, chạy bằng `node --test scripts/learning/compare-impact.test.mjs`; không đổi cấu hình global để mở rộng test runner. Không có migration/frontend thay đổi trong lượt này.

### Code check qua phím tắt và trạng thái đang lưu

- Input fill chặn propagation của Enter đã xử lý, tránh Ctrl+Enter kích hoạt cả input và container. In-flight ref chặn gọi check lại trước khi React render trạng thái busy.
- Khi completion đang pending, input fill disabled, code editor readOnly và reset disabled; không thay đáp án/reset dưới kết quả check đang lưu. Khi hoàn tất lại cho chỉnh sửa.
- Targeted code-check + draft persistence: 15 tests pass. Test thất bại qua Ctrl+Enter chỉ ghi một event checked=false và không completion; test passing check deferred chỉ một completion/event, giữ đáp án và khóa/mở lại input/reset đúng trạng thái.
- Không đổi schema, không gửi source/answers tới backend. Browser QA phím tắt và pending network cho thay đổi này vẫn cần thực hiện.
- Full suite: 98 files / 706 tests pass. Lint/build/diff check pass; Monaco chunk warning hiện hữu còn giữ nguyên.

### Retry completion code sau khi validator pass

- Code exercise giữ trạng thái completion pending riêng với kết quả validator. Lỗi lưu cho CTA Thử lưu tiến độ lại; retry cùng đáp án không chấm/ghi thêm telemetry check.
- Sửa fill/edit/reset xóa trạng thái pending và lỗi cũ, buộc chạy validator lại. Input/source vẫn local, không gửi lên backend.
- Targeted 3 code exercise tests pass; test mới chứng minh hai completion attempts chỉ một check event, sửa đáp án sai chuyển CTA về check và không gọi completion thêm. Full suite: 98 files / 707 tests pass. Browser network-failure QA vẫn chưa thực hiện.
- Lint, build và diff check pass; không đổi database trong lượt này.

### Xác nhận route instructor và diagnostics legacy

- Mở trực tiếp `https://app.corelia.academy/instructor/courses` bằng browser: danh sách khóa học và nút Chỉnh sửa hiện hữu. Chỉ đọc UI production, không lưu thay đổi.
- Review diff router: giữ nguyên danh sách, tạo và `courses/:id/edit` trong instructor workspace; chỉ thêm route preview. Wrapper Learning vẫn render `InstructorCourseEdit`; owner và co-instructor tiếp tục dùng quyền chức năng hiện hữu.
- Migration `20260911132358_learning_legacy_validation_diagnostics.sql` trả `invalid_config` khi validator gặp JSON array malformed, giúp readiness vẫn báo cả bài lỗi và bài hợp lệ. Publication tiếp tục bị shape guard chặn bằng `INVALID_PRACTICE_CONFIG`.
- Lần kiểm thử đầu thất bại do assertion mong sai mã lỗi publication; sửa assertion đúng contract, không nới validator. Chạy lại `pnpm db:verify:local` pass toàn bộ SQL, 8 tình huống concurrency và Jobs PostgREST smoke.
- `pnpm db:verify` vẫn chưa pass CASE P0b vì danh sách migration phát hành được duyệt chưa bao gồm migration local mới; không sửa baseline/allowlist để bỏ qua gate. Toàn hệ thống chưa đạt Local Done.

### Mở và sửa practice config legacy malformed

- Kiểm tra cấu trúc practice trước khi render builder/locale fields; config sai array, item, type hoặc artifact field trả `invalid_config` thay vì gây lỗi `.map`/`.trim`. Draft cấu trúc đúng nhưng còn trống vẫn được chỉnh sửa.
- Locale adapter giữ nguyên config lỗi, chỉ dịch metadata của lesson. Không tự normalize hoặc xóa dữ liệu cũ khi mở editor.
- Editor chặn preview/save config lỗi và cung cấp đặt lại có xác nhận. Cancel giữ nguyên; xác nhận chỉ thay state local, chuyển published=false. Explicit Save mới ghi cấu hình instruction trống; title, markdown, duration và locale copy được giữ.
- Targeted 19 tests pass, gồm malformed cases và thao tác cancel/reset/save/đổi locale. Full suite: 99 files / 717 tests pass; lint pass. Chưa thực hiện browser QA cho recovery này. Code config và resource legacy malformed cần tiếp tục audit riêng.
- Build và diff check pass; cảnh báo bundle Monaco lớn vẫn còn.

### Mở và sửa code exercise config legacy malformed

- Thêm structural guard cho file, blanks, answers, tests, hints và copy fields trước khi builder đọc chúng. Config thiếu hoặc malformed hiển thị recovery thay vì crash; preview và save bị chặn. Dữ liệu không tự thay đổi khi mở bài hoặc đổi locale.
- Reset cần xác nhận, chỉ cập nhật state draft bằng bài fill mẫu. Hủy giữ nguyên; Save mới ghi. Giữ title/markdown/duration/locales. Fix-first focus nút recovery; ngôn ngữ phụ có đường về cấu hình gốc.
- Tách structural guard khỏi validation nội dung: source/tests chưa đầy đủ vẫn mở để sửa; reference solution chưa pass vẫn lưu draft được nếu config hợp lệ, publish vẫn bị chặn.
- 35 targeted tests pass; full suite 100 files / 731 tests pass; lint/build/diff check pass. SQL learning integration chạy local trong transaction rollback pass, gồm recovery qua `learning_save_lesson`, giữ metadata, published=false và revision tăng từ legacy mặc định lên 2.
- Không có migration mới trong thay đổi này. Browser recovery code/practice và legacy resources/copy malformed vẫn cần kiểm tra tiếp; không suy rộng thành Local Done.

### Đồng bộ tiến độ Roadmap với Learning

- Roadmap trước đây đếm mọi progress completed, kể cả bài draft/archived/đã bỏ khỏi curriculum, và dùng 100% lesson để suy ra course completion. Đã chuyển sang cùng helper đếm lesson published và trạng thái `enrollments.completed_at`.
- Course có 100% lesson nhưng final pending/rejected vẫn còn trong luồng tiếp tục học. Course đã hoàn thành lịch sử tiếp tục được nhận diện completed dù curriculum mới làm tỷ lệ lesson hiện tại thấp hơn 100%.
- Snapshot nhận thêm course IDs cần lấy curriculum, để khóa vừa enroll chưa có progress vẫn có tổng lesson đúng. Giữ batch query và RLS hiện hữu.
- Targeted 9 tests pass; regression bao gồm progress trùng/removed/draft/archived, final pending, completion lịch sử và course chưa có progress. Full suite: 101 files / 733 tests pass; lint pass.
- Audit còn lại: invalidation cache giữa các trang sau completion/review, credential readiness UI, profile và reminders. Chưa coi việc sửa Roadmap là hoàn tất toàn bộ consumer audit.
- Build và diff check pass; cảnh báo chunk lớn hiện hữu vẫn còn. Không thay migration trong lượt này.

### Cache tiến độ sau Complete

- `Learn` chờ invalidation enrollment của course hiện tại và các consumer catalog-progress, spotlight, career progress, achievements vault của đúng user sau mutation thành công. Cache lesson vừa cập nhật được giữ; public catalog, anonymous và user khác không bị invalidation.
- Targeted 4 tests pass, gồm kiểm tra QueryClient thật với nhiều locale/user và các regression footer chờ completion trước navigation. Full suite: 102 files / 734 tests pass; lint pass.
- Còn phải nối invalidation tương ứng cho sync completion/credential và review final assignment. Phát hiện `CourseHero.canClaimCertificate` vẫn dùng progressPercent>=100, cần chuyển sang eligibility đầy đủ để final pending/rejected không hiện CTA nhận credential. Đây là phát hiện chưa sửa trong lượt cache này.
- Build và diff check pass; cảnh báo bundle lớn hiện hữu vẫn còn. Không đổi database.

### Điều kiện nhận credential ở course detail

- `CourseHero` dùng `enrollment.completed_at` thay vì phần trăm lesson để hiện nút nhận credential. Final pending/rejected chưa có completion không có CTA; completion lịch sử vẫn có CTA kể cả curriculum hiện tại thay đổi. Credential đã cấp tiếp tục hiện badge.
- Claim handler kiểm tra lại điều kiện, dùng in-flight ref chặn double-click và invalidation cache learner/vault khi cấp thành công. Lỗi cấp giữ completion, cho retry.
- 5 targeted UI tests pass (anonymous/incomplete/issued, historical claim, double-click, vault refresh và failure/retry); test dùng mock issuance, không phát credential thật. Lần chạy đầu lỗi fixture i18n thiếu `t` và type của deferred result; đã sửa test fixture/type.
- Còn audit eligibility của achievements sync candidates và cache sau automatic completion/credential/review. Chưa có browser QA cho CTA này.
- Full suite chạy lại pass 103 files / 739 tests; lint, build và diff check pass. Cảnh báo chunk lớn hiện hữu còn giữ nguyên. Không đổi schema.

### Credential repair candidates trong Achievements

- Danh sách repair giữ khóa có completion lịch sử dù progress/curriculum hiện tại không còn đủ. Khóa đã cấp credential không được đề nghị cấp lại.
- Với legacy progress-only chưa có completion, yêu cầu số completed lesson ID đúng bằng tổng lesson published, loại draft/archived và progress ngoài curriculum. Không dùng phần trăm làm tròn: 200/201 bài không đủ điều kiện dù hiển thị có thể là 100%.
- Nếu course có final assignment, đọc bản nộp mới nhất bằng helper hiện hữu và chỉ đưa vào danh sách khi approved. Pending/rejected/missing không đủ điều kiện; lỗi đọc không được xem là approved. Completion lịch sử không bị xét lại final mới.
- 2 targeted tests pass, bao phủ 9 trạng thái course và lỗi đọc submission. Dashboard chỉ đọc dữ liệu; issuance vẫn kiểm tra quyền/eligibility tại server khi learner chủ động đồng bộ. Không cấp credential thật trong kiểm thử.
- Full suite: 104 files / 741 tests pass; lint/build/diff check pass. Cảnh báo chunk lớn hiện hữu còn. Chưa browser QA repair list; cache automatic sync/review và các consumer còn lại vẫn cần hoàn thiện. Không đổi migration.

### Cache sau automatic completion/credential sync

- Hai luồng sync ở Learn và CourseDetail invalidation cache learner khi server đã xác nhận completion, kể cả khi credential check/issuance thất bại sau đó. Không invalidation như thành công khi completion pending/failed.
- Chuyển phase sang certificate trước `invokeCheckCourseCredential`; lỗi ở bước này hiển thị là lỗi credential, không gán nhầm completion sync error. Completion đã xác nhận được giữ.
- Targeted 7 tests pass. QueryObserver test mới xác nhận invalidation chờ active refetch, lỗi đọc dashboard không làm reject thao tác completion, giữ dữ liệu cache trước đó và đánh dấu stale.
- Review final assignment và browser verification của các luồng sync còn cần audit riêng. Không sửa database trong lượt này.
- Full suite: 104 files / 742 tests pass; lint/build/diff check pass. Cảnh báo chunk lớn hiện hữu còn giữ nguyên.

### Review dùng dữ liệu server và giữ bản nộp mới nhất

- Service review trả submission đã commit từ RPC, gồm comment/reviewed_at/artifacts. Editor cập nhật row bằng kết quả đó thay vì tự dựng trạng thái từ request cũ.
- Khi cập nhật danh sách mới nhất theo learner, thay row cùng ID rồi áp dụng thứ tự submitted_at/ID hiện hữu; kết quả review của lần nộp cũ không đè lần nộp mới hơn đã có trong cache.
- In-flight ref chặn gửi review lặp trước khi React render; trong lúc gửi khóa các control review. Comment local vẫn giữ nếu RPC thất bại.
- Targeted 4 service tests pass, gồm latest submission ordering, server metadata, STALE_SUBMISSION và credential sync lỗi sau khi approval đã commit. Kiểm thử không cấp credential thật.
- Audit query key: instructor workspace và course learning report đều dưới `courses`; mutation thành công đã invalidation cả hai qua wrapper hiện hữu. Learner đang mở trang cần kiểm tra thêm refresh/focus sau review và browser reject/resubmit/stale review.
- Full suite: 104 files / 744 tests pass; lint/build/diff check pass. Cảnh báo chunk lớn hiện hữu còn. Không có migration mới trong lượt này.

### Learner nhận kết quả review khi đang mở bài

- Query submission tự refetch mỗi 15 giây chỉ khi dữ liệu hiện tại pending; không refetch interval trong background. Approved/rejected dừng polling; lỗi đọc giữ pending và thử lại ở interval kế tiếp.
- Hook learner invalidation completion/dashboard khi nhận approved. Editor gặp STALE_SUBMISSION refetch workspace để hiện bản nộp mới nhất, giữ thông báo lỗi và comment local.
- QueryObserver dùng fake timers với cấu hình query thật: pending → lỗi đọc → approved/rejected, dừng polling sau kết quả và giữ đúng user/course. Targeted course query suite 5 tests pass.
- Chưa browser QA hai phiên instructor/learner cho polling; trạng thái loading/error lần đọc submission đầu tiên còn cần audit để không hiển thị như chưa từng nộp. Không có migration mới.
- Full suite: 104 files / 746 tests pass; lint/build/diff check pass. Cảnh báo chunk lớn hiện hữu còn.

### Lỗi đọc trạng thái bài nộp không mở form nộp mới

- Hook submission cung cấp loading/error/ready tách khỏi data=null. Khi đang đọc hoặc đọc lỗi, panel không mở form nộp; hiển thị loading hoặc lỗi và nút retry. Nếu có cache pending/rejected/approved vẫn hiển thị trạng thái đã biết.
- Nội dung form lưu trong state không bị xóa khi tạm ẩn do lỗi đọc. Handler kiểm tra lại read state và status trước khi gửi, không chỉ dựa vào việc ẩn nút.
- Anonymous không chạy query nên không bị loading vô hạn; tiếp tục thấy yêu cầu đăng nhập và submit bị khóa như trước. Bỏ cast `as never` khi truyền submission vào panel.
- Targeted panel suite 6 tests pass, gồm loading → error/retry → ready, giữ draft qua lỗi đọc, và pending cache không mở form khi read lỗi. Browser QA thực tế còn cần thực hiện.
- Full suite: 104 files / 747 tests pass; lint/build/diff check pass. Cảnh báo chunk lớn hiện hữu còn. Không đổi database.

### Mapping practice → field bắt buộc của final assignment

- Migration `20260911140639_learning_practice_final_mapping.sql` và forward fix `20260911141007_learning_practice_mapping_operator_fix.sql` bổ sung validator dùng chung cho readiness/publish. Submission/guided project cần final assignment; mọi submission_fields của practice phải là subset của final_assignment_fields cấp course.
- Lesson mutation khóa parent course; sửa final settings cũng validate mọi practice lesson published, kể cả course đang draft. Không thể bỏ field/final title bằng direct API rồi giữ lesson published invalid. Draft lesson vẫn lưu để authoring tiếp.
- Client LessonEditor nhận final settings từ course bundle và hiển thị issue gắn practice_config trước publish. Sửa field cấp course tiếp tục dùng panel final assignment cũ; không thêm raw JSON authoring.
- Lần integration đầu phát hiện precedence JSONB containment gây lỗi SQL. Đã thêm forward fix với operand có ngoặc; migration đã apply không bị sửa. Lần reset/apply/integration tiếp theo pass toàn bộ, gồm **10 concurrency scenarios**. Hai ca mới chứng minh cả publish trước/settings sau và settings trước/publish sau đều khóa và rollback bên không hợp lệ.
- Targeted 10 tests pass; full suite **105 files / 751 tests pass**; lint/build/diff check pass. `pnpm db:verify` vẫn fail duy nhất CASE P0b frozen approved migration set, không sửa baseline/allowlist.
- Seed pilot hai lần sau reset không nhân bản: impact report có đúng 12 lessons, không publication issues. Impact integration pass, completion lịch sử không đổi. Không gửi email hoặc cấp credential thật.
- Browser QA sửa mapping/publish/course settings vẫn chưa thực hiện. Liên kết project/hackathon và server issue panel/field mapping đầy đủ vẫn là các hạng mục riêng chưa hoàn tất.


### Browser instructor: practice/final mapping và lỗi lưu (11/09, 21:22 local)

- Tài khoản instructor local, route `/instructor/courses/corelia-learning-pilot-rust-cli/edit`, editor/panel hiện hữu. Fixture draft `qa-practice-final-mapping` yêu cầu Demo URL nhưng final chỉ yêu cầu GitHub URL/notes: readiness báo lỗi, publish bị chặn, database vẫn draft.
- Chọn Demo URL ở panel Bài tập cuối khoá và lưu; publish fixture thành công. Bỏ Demo URL rồi lưu bị server từ chối; database vẫn có Demo URL. Form giữ trạng thái chưa lưu để người soạn chỉnh tiếp.
- Phát hiện UI hiện nguyên `LESSON_NOT_PUBLISHABLE` từ deferred trigger. Đã dùng chung formatter ở course save và lesson save: dịch validation codes, kèm tên lesson nếu response có lesson ID; lỗi không liên quan giữ nguyên. Browser chạy lại xác nhận thông báo tiếng Việt có tên `QA practice final mapping`, Demo vẫn unchecked trong form sau lỗi.
- Cleanup fixture bằng SQL local với triggers hoạt động (không phải nghiệm thu UI delete); khôi phục final fields GitHub URL/notes. Impact report xác nhận 12 bài pilot và không publication issues: `/tmp/corelia-learning-publish-error-impact.json`.
- Targeted 9 tests pass (formatter + LessonEditor); lint/build/diff check pass. Build còn cảnh báo chunk Monaco lớn hiện hữu. Các ca guided step cụ thể, mobile và mapping/focus server issue đầy đủ vẫn chưa nghiệm thu. Không đổi schema, không deploy.


### Reminder availability và profile audit (11/09, 21:30 local)

- Migration `20260911142402_learning_reminder_availability.sql` cập nhật private reminder RPC: chỉ chọn enrollment chưa completed của course published/nonarchived có ít nhất một lesson published/nonarchived. Lọc trước MAX(last_accessed_at), tránh activity của course không khả dụng hoãn reminder của course vẫn học được. Giữ cadence, opt-out, cycle suppression, service-only wrapper/ACL và lịch sử completion.
- Regression fixture tạo 6 course, enroll khi khả dụng rồi draft/archive course hoặc lesson; một course hoàn thành qua progress thật. Trước migration, assertion candidate/stage fail đúng lỗi; sau migration, candidate chỉ có course khả dụng ở ngày 4/stage 3, opt-out và log suppression pass. Không gọi mail handler.
- Lượt database đầu crash ở negative EXECUTE test: image `public.ecr.aws/supabase/postgres:17.6.1.111`, PostgreSQL 17.6 aarch64, signal 11. Câu SELECT riêng với role authenticated tái hiện. Triệu chứng khớp [supabase/postgres#2112](https://github.com/supabase/postgres/issues/2112). Không đổi quyền hoặc cấu hình database để né lỗi.
- Negative test kiểm tra `has_function_privilege` của anon/authenticated trên cả public/private RPC; sau đó role tạm kế thừa authenticated thực thi và nhận insufficient_privilege. Role được rollback cùng fixture. Direct reserved-role runtime test vẫn cần chạy lại trên image hết lỗi; không coi ACL + inherited-role test là bằng chứng direct reserved-role runtime đã pass.
- Audit profile: UserProfileCoursesSection chỉ hiện course do instructor dạy, không có denominator learner; getPublishedCoursesByInstructor đã lọc published/nonarchived. Skills dùng list_profile_course_skills dựa trên enrollment.completed_at, không tính lại lesson ratio; achievements self dùng hook chung đã có canonical readiness, public chỉ hiện credential theo visibility. Không đổi quyền public profile hoặc công khai progress.

- Gate recheck `/tmp/corelia-learning-reminder-local-recheck.log`: clean reset/migration apply, retained SQL, Learning SQL và 10 concurrency scenarios, Jobs PostgREST smoke đều pass. `pnpm db:verify` vẫn fail duy nhất CASE P0b frozen approved migration set (`/tmp/corelia-learning-reminder-verify.log`), không sửa baseline/allowlist. Không có TypeScript/UI thay đổi trong lượt reminder này.
- Full suite: **106 files / 754 tests pass** (`/tmp/corelia-learning-reminder-full.log`). Seed hai lần sau reset: 12 bài, không publication issues (`/tmp/corelia-learning-reminder-impact.json`); kiểm tra không còn role/fixture reminder. Diff check pass. Lint/build gần nhất pass ở lượt formatter trước; lượt này chỉ SQL và docs.


### Lesson dirty navigation qua router (11/09, 21:40 local)

- Thay BrowserRouter bằng createBrowserRouter/RouterProvider với một root splat chứa nguyên cây Routes hiện hữu. Giữ path/params/guards/lazy loading và auth bootstrap; CredentialRealtimeSync vẫn nằm trong router. Không thêm editor hoặc chuyển route instructor.
- useUnsavedLearning dùng useBlocker, trả trạng thái cho dialog có Tiếp tục chỉnh sửa / Bỏ thay đổi và rời trang. Chặn route/query khi lesson dirty; hash cùng trang không xóa lesson state nên được phép. beforeunload bảo vệ reload/đóng tab/full-document navigation; bỏ listener click để tránh hai confirm cho cùng navigation.
- Panel navigation của InstructorCourseEdit chuyển từ gán window.location.hash sang navigate và đồng bộ từ useLocation.hash. Việc này giữ history index mà router cần để chặn POP. Các confirm OpenCampus/certificate đang có vẫn giữ.
- Test dùng createMemoryRouter với cùng mô hình descendant Routes: params editor giữ nguyên; hủy Back giữ route; proceed đi đúng đích; chặn replace/push/Forward; hash không chặn; beforeunload chỉ dirty, hết dirty cho phép rời. Hai characterization tests App cập nhật theo RouterProvider và vẫn kiểm tra credential context/auth bootstrap.
- Browser local: đăng nhập instructor, danh sách → editor → curriculum → lesson, sửa title chưa lưu và hoàn nguyên/Hủy đều hoạt động. Chưa nghiệm thu native Back/Forward: AppleScript go back trên đúng tab local bị macOS từ chối quyền (-1743). Không thay phép thử router bằng tuyên bố native browser đã pass. Không lưu nội dung QA vào pilot.
- Full suite **107 files / 757 tests pass** (`/tmp/corelia-learning-navigation-full-recheck.log`); lint pass (`/tmp/corelia-learning-navigation-lint-recheck.log`). Dirty guard tổng thể của các form course cũ và native browser QA vẫn còn trong phạm vi chưa hoàn tất.
- Build recheck pass (`/tmp/corelia-learning-navigation-build-recheck.log`); chunk Monaco lớn vẫn có warning hiện hữu. Diff review: cây route giữ nguyên, thay container/context và hash navigation. Không đổi database trong lượt này.


### Hợp nhất nút thêm bài theo yêu cầu người dùng (11/09, 21:44 local)

- Bỏ CTA riêng Thêm bài học tương tác. Nút Thêm bài học hiện hữu mở selector 5 loại; thêm Code vào selector cũ, giữ nguyên luồng video/article/quiz/practice và các công cụ soạn đang có.
- Chọn code chuyển draft đang nhập sang builder: giữ section, title, mô tả/resources và thứ tự cuối section; chưa ghi database. Course không chia chương tiếp tục chuẩn bị default section qua helper cũ trước khi chọn loại. Builder bài mới có heading Thêm bài học.
- Browser instructor local: curriculum không còn CTA riêng; bấm Thêm bài học của chương thứ hai thấy đủ 5 loại; chọn Bài tập code mở builder với chương Từ hàm đến sản phẩm, trạng thái draft và fill config. Hủy không tạo lesson. Không sửa/publish pilot.
- Targeted LessonEditor/format: 12 tests pass; lint/build pass trước thay copy heading; không đổi schema hoặc route. Course-form dirty guard tổng thể là phần đang dở trước khi người dùng điều chỉnh CTA, chưa hoàn tất trong lượt này.


### Giữ draft nội dung course khi đổi VI/EN (11/09, 21:49 local)

- Phát hiện hydration theo selection chỉ giữ locale đang mở: chuyển VI → EN → VI lấy lại server copy, mất VI chưa lưu. Đổi sang useCourseContentDraft trong editor hiện hữu, lưu riêng draft theo account/course/locale trong bộ nhớ.
- Hydration chỉ khởi tạo selection chưa có draft; focus refetch hoặc callback tới muộn không ghi đè nội dung đang chỉnh. Cả thông tin chung và copy bài cuối khóa dùng chung draft locale. Không thêm localStorage hoặc thao tác ghi backend; nút Save hiện hữu giữ trách nhiệm lưu.
- Targeted 2 tests pass: giữ title/final instructions qua đổi locale, refetch không ghi đè, account/course isolation và response tới muộn. Browser instructor: nhập QA VI, chuyển EN nhập QA EN, quay VI thấy QA VI còn; quay EN thấy QA EN còn. Đã hoàn nguyên cả hai title, không bấm Save.
- Lint/build/diff review pass (`/tmp/corelia-learning-locale-draft-lint.log`, `/tmp/corelia-learning-locale-draft-build.log`); warning chunk Monaco hiện hữu còn. Course-form route guard tổng thể và các form metadata ngoài nội dung dịch vẫn chưa hoàn tất; draft này chỉ tồn tại trong phiên editor.
- Full suite: **108 files / 759 tests pass** (`/tmp/corelia-learning-locale-draft-full.log`). Không migration, không email/credential/deploy.


### Cảnh báo rời editor cho draft copy course/lesson (11/09, 21:54 local)

- Route wrapper giữ một useBlocker duy nhất, tổng hợp dirty từ course copy của mọi locale, lesson đang chỉnh và trạng thái OpenCampus/certificate setup đã có. LessonEditor báo dirty lên wrapper; không đăng ký blocker cạnh tranh với course.
- Course content draft lưu snapshot đã hydrate/lưu. Lưu locale nào chỉ acknowledge snapshot request của locale đó sau khi locale write thành công; draft ngôn ngữ khác hoặc edit mới trong lúc save vẫn dirty. Course mutation tiếp theo có thể thất bại riêng: không giả định toàn course save là atomic.
- 13 targeted tests pass gồm hidden-locale dirty, save resolve sau edit mới, locale/account/course isolation, router Back/Forward/push/replace, lesson validation. Browser instructor: đổi title VI, chuyển EN, bấm Danh sách khoá học → dialog chặn; Tiếp tục chỉnh sửa → quay VI vẫn còn draft; thử lại Bỏ thay đổi và rời trang → đúng danh sách. Không Save nội dung QA.
- Lint/build/diff check pass (`/tmp/corelia-learning-course-guard-lint.log`, `/tmp/corelia-learning-course-guard-build.log`). Các metadata ngoài copy (slug/level/fields/skills/sponsors/partners/co-instructors), dialog legacy và native Back/Forward vẫn cần bổ sung/QA; không coi dirty guard toàn editor đã hoàn tất.
- Full suite: **108 files / 761 tests pass** (`/tmp/corelia-learning-course-guard-full.log`). Không migration, không deploy.


### Draft cấu hình course và refetch (11/09, 21:58 local)

- Chuyển object form cấu hình sang useCourseSettingsDraft theo account/course: slug, level, published, final fields, video/certificate layout metadata và các flag trong form tham gia dirty guard hiện hữu.
- Hydration so sánh từng field với snapshot đã lưu: giữ field đang sửa, nhận giá trị server mới cho field chưa sửa. Hoàn nguyên về baseline tự hết dirty. Sau updateCourse thành công chỉ acknowledge snapshot đã submit; edit mới trong khi request chạy vẫn dirty. Không thay đổi persistence riêng của upload/template hay quyền instructor.
- Targeted 7 tests pass (settings/content draft): refetch giữ slug/artifacts và cập nhật thumbnail chưa sửa; save snapshot không xóa edit mới; input trước hydration và account/course isolation. Browser: sửa riêng slug → link danh sách bị chặn; chọn tiếp tục, hoàn nguyên slug → link danh sách đi ngay. Không Save QA, pilot giữ slug cũ.
- Build pass (`/tmp/corelia-learning-settings-draft-build.log`), diff check pass. Skills, sponsors/partners, co-instructor và thiết lập locale nằm ở state khác; dialog legacy cũng chưa có guard tổng thể. Các phần này vẫn phải hoàn tất trước Local Done.
- Full suite: **109 files / 764 tests pass** (`/tmp/corelia-learning-settings-draft-full.log`). Lint phát hiện callback certificate cần dependency setForm mới; đã bổ sung để tránh dùng setter của course cũ khi route đổi.
- Lint recheck sạch (`/tmp/corelia-learning-settings-draft-lint-clean.log`), diff check pass. Không migration hoặc deploy.


### Metadata và bản nháp tạo curriculum (11/09, 22:10 local)

- Skills, co-instructor IDs/permissions/visibility, locales và sponsor/partner dùng field adapter của settings draft: refetch giữ field đang sửa, save acknowledge snapshot để không xóa edit mới. Co-instructor chỉ acknowledge sau invite flow hiện hữu kết thúc; không gửi invite/email trong QA.
- Nội dung section mới và dialog Thêm bài học tham gia route guard; Hủy/close bài học có nội dung yêu cầu xác nhận, giữ form nếu không đồng ý. Không cho đóng trong khi tạo lesson/generate quiz.
- Browser local: nhập tên section → link danh sách bị chặn → tiếp tục chỉnh sửa → hoàn nguyên section. Thêm bài học có đủ 5 types; nhập title → Hủy hiện native confirm. CUA timeout khi native confirm mở, nên chưa xác nhận nhánh Cancel/OK của popup bằng browser; không ghi lesson hoặc section QA vào backend.
- Targeted hooks 8 tests pass; router guard 3 tests pass. Lint/build pass (`/tmp/corelia-learning-new-draft-lint.log`, `/tmp/corelia-learning-new-draft-build.log`), diff check pass. Các dialog sửa section/câu hỏi legacy và native Back/Forward chưa được coi hoàn tất.
- Full suite: **110 files / 765 tests pass** (`/tmp/corelia-learning-curriculum-draft-full.log`). Không migration, commit, push hoặc deploy.


### Bản nháp dialog sửa chương (11/09, 22:16 local)

- Thay map ref của section bằng session draft theo locale. Response tải bản dịch merge từng field còn nguyên baseline, không ghi đè field đã gõ; response từ dialog đã đóng/mở khác không được apply. Chuyển locale giữ draft và dirty của locale ẩn.
- Chỉ lưu locale đã thay đổi; acknowledge từng write thành công để retry sau lỗi một phần không ghi lại locale đã lưu. Không chép bản dịch section vào primary workspace cache. Save chờ locale load, có retry load; lỗi save hiển thị trong dialog, giữ draft; khóa form khi save và chặn đóng. Close có confirm nếu dirty; dirty tham gia route blocker chung.
- Full suite trước test bổ sung partial-save: **111 files / 767 tests pass** (`/tmp/corelia-learning-section-draft-full.log`). Browser QA dialog section, native confirmation Cancel/OK và native Back/Forward vẫn pending. Không ghi dữ liệu pilot hoặc gửi invite/email.
- Targeted section draft cuối: **3 tests pass**, gồm partial-save giữ locale chưa lưu (`/tmp/corelia-learning-section-draft-targeted-final.log`). Lint sạch (`/tmp/corelia-learning-section-draft-lint-final.log`), build cuối pass (`/tmp/corelia-learning-section-draft-build-final.log`), diff check pass; chunk-size warning hiện hữu còn. Không migration/commit/push/deploy.


### Quiz editor legacy giữ ID và bản nháp (11/09, 22:20 local)

- Phát hiện payload dialog làm rơi question ID nên adapter lesson từ chối mọi lần sửa quiz hiện hữu. Đã giữ ID xuyên hydrate/edit/save và tạo ID cho câu mới ngay khi nhập/generate. Không ép options về 4 lựa chọn hoặc đổi option IDs về a/b/c/d; correct_index giữ nguyên.
- Dialog báo dirty vào route guard; đóng/Hủy yêu cầu confirm khi có draft, khóa field trong lúc save/generate/loading, chặn thao tác save/generate cạnh tranh. Save thất bại giữ câu hỏi và báo lỗi theo toast hiện hữu.
- Targeted question payload 2 tests pass; full **112 files / 770 tests pass** (`/tmp/corelia-learning-question-draft-full.log`), lint/build pass (`/tmp/corelia-learning-question-draft-lint.log`, `/tmp/corelia-learning-question-draft-build.log`). Diff check pass. Browser QA nhánh dialog này vẫn pending.
- Quan trọng: setSectionQuestions cấp chương vẫn delete–insert; chưa đạt contract transaction/history toàn bộ question authoring. Đã ghi rõ trong acceptance matrix để tiếp tục triển khai. Không migration/commit/push/deploy trong lượt này.


### Transaction câu hỏi cấp chương (11/09, 22:26 local)

- Migration `20260911152152_learning_section_question_transaction.sql`: RPC private definer + public invoker theo pattern hiện hữu, search_path rỗng, chỉ authenticated được EXECUTE và phải có course content permission. Khóa section; validate toàn payload; upsert stable ID, archive câu bị bỏ; giới hạn course/section/lesson/locale kể cả conflict lúc insert. Không hard-delete question/attempt.
- setSectionQuestions gọi một RPC; getSectionQuestions lọc lesson_id NULL và archived_at NULL. Scope legacy theo locale giữ nguyên, không nhân bản scoring mới trong lượt này. Các add/update/delete helper đơn lẻ và quiz locale canonical vẫn cần đối chiếu toàn bộ consumer theo acceptance matrix.
- SQL asserts pass: update ID cũ, archive giữ attempt, locale EN không bị VI save xóa, malformed payload rollback nguyên bộ, từ chối lấy ID câu hỏi lesson, learner bị từ chối. Fixture attempt riêng được xóa sau assertion để không làm lệch aggregate tests hiện hữu; không xóa dữ liệu learner thật.
- `db:verify:local` **pass** từ clean reset đến SQL, 10 concurrency scenarios và PostgREST smoke (`/tmp/corelia-section-db-local.log`). Migration đã apply local, từ đây immutable. `db:verify` vẫn **fail CASE P0b** về frozen baseline/approved pending set (`/tmp/corelia-section-db-verify.log`), không sửa governance để che lỗi.
- Supabase security advisors mức error: **No issues found** (`/tmp/corelia-section-advisors.log`); không suy rộng sang warning/performance. Full 112 files/770 tests pass, helper RPC bổ sung 2 tests pass; lint/build pass (`/tmp/corelia-section-full.log`, `/tmp/corelia-section-helper-test.log`, `/tmp/corelia-section-lint.log`, `/tmp/corelia-section-build.log`). Diff check pass.
- Pilot seed hai lần vẫn 2 sections/12 lessons, không email/credential. Reset xóa QA auth account cũ; cần tạo lại trước browser QA tiếp theo. Không commit/push/deploy. Browser mới và governance gate chưa pass, chưa Local Done.


### Quiz locale trong editor hiện hữu (11/09, 22:30 local)

- Loại bỏ 3 helper add/update/delete question đơn lẻ không có consumer (đã search toàn repo), tránh giữ đường delete/partial overwrite bên cạnh transactional set.
- getLessonQuestions có locale giờ đọc cùng canonical rows rồi overlay question_copy theo question/option IDs; không lọc data.locale để lấy bộ câu khác. Thiếu copy dùng text gốc, scoring giữ nguyên. Learner getLearningQuiz vốn lấy canonical không locale nên không phát sinh read copy trùng.
- setLessonQuestions xác định primary locale của course. Khi dịch, kiểm tra IDs, option order/count và correct_index không đổi; gọi learning_save_lesson với p_questions=NULL và chỉ question_copy trong locale. Editor lesson ở locale phụ khóa thêm/xóa, generate và đáp án, vẫn cho sửa text/explanation. Đường tạo và sửa primary vẫn dùng transactional canonical write.
- 5 helper tests pass gồm RPC section, fallback copy, translation không ghi canonical rows và từ chối scoring thay đổi. Full **113 files / 775 tests pass** (`/tmp/corelia-quiz-locale-full.log`), lint/build pass (`/tmp/corelia-quiz-locale-lint.log`, `/tmp/corelia-quiz-locale-build.log`), diff check pass. Không schema change nên không reset database trong lượt này. Browser vi/en save/reload vẫn pending; legacy section-bank locale còn giữ compatibility hiện hữu. Không commit/push/deploy.


### Practice artifact handoff và preview isolation (11/09, 22:34 local)

- Phát hiện Complete practice ghi đè toàn local final-artifacts: bài thu notes làm mất GitHub URL từ bài trước sau reload. Đã merge draft course với chỉ các field cấu hình của bài đang complete; sự kiện live chỉ chứa patch đó để không replay giá trị cũ lên field khác đang chỉnh trong form cuối khóa.
- Storage lỗi không chặn handoff trong bộ nhớ; hiển thị draft unavailable riêng cho lưu artifact, không bị autosave checklist thành công che mất. Preview không đọc/ghi storage hoặc phát event handoff.
- Targeted practice/final 22 tests pass; full **113 files / 778 tests pass** (`/tmp/corelia-practice-handoff-full.log`). Sau đó bổ sung preview code fill pass không read/write draft, analytics hay completion: draftPersistence **17 tests pass** (`/tmp/corelia-practice-preview-final.log`). Không suy rộng bằng chứng component test thành browser QA toàn bộ formats.
- Lint/build pass (`/tmp/corelia-practice-handoff-lint.log`, `/tmp/corelia-practice-handoff-build.log`), diff check pass. Browser artifact handoff qua hai lessons và storage denial vẫn pending. Không migration, commit, push hoặc deploy.


### Practice liên kết hackathon hiện hữu (11/09, 22:39 local)

- PracticeBuilder có selector public catalog, chọn/bỏ related_hackathon_id; không yêu cầu raw JSON. Giữ option cho reference mất khả dụng để tác giả có thể bỏ; không cung cấp đối tượng thiếu slug làm lựa chọn mới.
- PracticeLesson đọc cùng catalog công khai (query helper hiện hữu), dùng locale preview/learner và link route /hackathons/:slug. Nếu đối tượng không còn truy cập được hoặc thiếu route, hiển thị unavailable và không xuất link. Không tự đăng ký, tạo project hoặc submission. Backend validation hackathon tồn tại/status công khai đã có từ migrations trước; không schema change trong lượt này.
- Targeted catalog/selector/link/persistence 23 tests pass. Full đầu phát hiện test-isolation: imports mới khởi tạo Supabase trong 2 test suites dùng mock cũ; đã mock riêng component catalog trong persistence/editor tests, component thực có tests riêng. Full sau sửa **114 files / 782 tests pass** (`/tmp/corelia-practice-hackathon-full-final.log`).
- Lint/build pass (`/tmp/corelia-practice-hackathon-lint-final.log`, `/tmp/corelia-practice-hackathon-build-final.log`). Route filter bổ sung có targeted/build riêng; browser selection/save/reload chưa QA. Liên kết project chưa triển khai, không coi toàn bộ requirement practice links hoàn tất. Không commit/push/deploy.
- Route filter cuối: 3 component tests pass (`/tmp/corelia-practice-hackathon-route-test.log`), build terminal exit 0 (`/tmp/corelia-practice-hackathon-route-build.log`), diff check pass.


### Resource legacy malformed recovery (11/09, 22:43 local)

- Resource validator nhận unknown, báo invalid_resources với field resources/locale thay vì gọi forEach/trim trên dữ liệu hỏng. Pure module resourceValidation dùng chung trong validator và workspace, không kéo database/i18n initialization vào nơi chỉ cần kiểm tra links.
- LessonEditor phát hiện list/item sai cấu trúc ở master/locale, có thao tác xác nhận bỏ các mục hỏng: giữ mục hợp lệ, nội dung khác và duration; chuyển lesson sang draft. Cancel không thay state hoặc ghi backend. Save bị chặn nếu chưa sửa shape; render resource list không còn crash.
- Renderer không tạo action học cho lesson có tài liệu không hợp lệ; workspace không xuất resource links sai cấu trúc/URL, tránh lỗi map và unsafe href trong preview/learner.
- Targeted 22 tests pass gồm legacy shapes, confirm/cancel, preserve valid resource/content/duration và workspace tests. Full **114 files / 788 tests pass** (`/tmp/corelia-resources-recovery-full.log`), lint pass (`/tmp/corelia-resources-recovery-lint.log`). Build theo log `/tmp/corelia-resources-recovery-build.log`; locale validation messages vi/en được bổ sung và JSON parse pass. Browser recovery và các copy legacy malformed ngoài resources vẫn pending. Không schema change/commit/push/deploy.
- Build terminal exit 0, Vite built 38.46s; chunk-size warning hiện hữu còn. Diff check pass.


### Browser learner: login return, checklist, history và code fill (11/09, 22:47 local)

- Chrome local /learn/corelia-learning-pilot-rust-cli/lesson/...-01 khi anonymous hiển thị article và curriculum 0/12. CTA Đăng nhập → /login; đăng nhập bằng account QA local → quay lại đúng lesson-01, CTA đổi thành Hoàn thành và tiếp tục. Không kiểm thử OAuth hoặc các format anonymous khác trong lượt này.
- Article Complete → lesson-02 và progress 1/12 (8%). Checklist ban đầu chặn CTA; chọn đủ 3 bước mở CTA; reload vẫn giữ cả ba checkbox, progress chưa đổi. Complete → lesson-03, progress 2/12 (17%). Đây là thao tác fixture QA, không phải bằng chứng learner thật đã chạy Cargo hoặc phản hồi pilot.
- Dùng browser Back thực qua CUA Tab.back → lesson-02 hiển thị Đã hoàn thành/Bài tiếp theo; Forward → lesson-03, progress giữ 2/12. Đây là evidence learner history; chưa chứng minh editor dirty native Back/Forward. API CUA hiện đã có back/forward, không dùng AppleScript.
- Từ curriculum mở lesson-04, nhập let → Chưa đạt, progress giữ 2/12; đổi mut → Đạt, progress 3/12 (25%), vẫn ở code để đọc results, footer đổi Bài tiếp theo.
- SQL read-only đối chiếu account learning-qa-learner@corelia.local: lesson_progress chỉ có 01/02/04 completed; enrollment.completed_at NULL. Hai activity_events code_exercise_checked đều visibility=private, payload đúng {passed:false}/{passed:true}, không source/answers. Không phát credential/email.
- Account QA được tạo lại qua local Admin API sau reset (email confirmed, không gửi email), không đổi auth credential hoặc quyền user thật. Tiến độ fixture 3/12 được giữ cho QA tiếp theo. Không sửa application code hoặc migrations, không cần lặp full suite; kết quả automated gần nhất vẫn 788 tests/lint/build pass. Browser full journey 12 bài, quiz/edit, final review, mobile/dark-light và failure cases còn pending. Không commit/push/deploy.


### Browser quiz retry và Monaco edit (11/09, 22:50 local)

- Với learner QA đang 3/12, mở lesson-06: CTA chặn khi chưa chọn đủ; nộp 3 đáp án sai → 0/3, feedback/explanation, đáp án khóa và nút Thử lại. Progress giữ 3/12. Retry xóa lựa chọn; chọn đúng rồi submit → 3/3, progress 4/12 (33%), footer Bài tiếp theo. Reload giữ kết quả và selections.
- SQL xác nhận 2 attempt_group_id khác nhau, mỗi group 3 rows, group_correct 0 và 3, group_total 3, passing_ratio 0.7. Reload không thêm group/rows. Không coi đây là evidence concurrent/deduplicate network resend hoặc retry=false.
- Lesson-08: Monaco lazy-load hiển thị thật. Starter trả 0 → fail, progress giữ 4/12. Sửa thành ids.iter().copied().max().unwrap_or(0) + 1 → pass, progress 5/12 (42%). AX editor click ban đầu không focus, đã dùng screenshot để click vùng code; typing multiline gây auto-indent/brace của editor, nên thay bằng paste plain text đầy đủ trước khi check. Không dùng DOM evaluate hoặc thay state ngoài UI.
- Reload giữ source đã sửa trong Monaco (screenshot thấy đúng ba dòng), lesson vẫn completed; result checks không persist nên hiển thị check prompt, footer Bài tiếp theo. SQL đối chiếu 5 completed lessons, course completed_at NULL. Riêng lesson-08 có 2 private events, payload chỉ passed false/true, không source/answers.
- Không sửa application code/migration; automated baseline gần nhất 788 tests/lint/build pass giữ nguyên. Fixture QA tiến độ 5/12 giữ lại để tiếp tục full journey. Browser mobile, fallback khi Monaco load fail, revision/64 KiB, final review và các ca network lỗi còn pending. Không commit/push/deploy.


### Browser guided project → final submission → 12/12 pending (11/09, 22:59 local)

- Learner QA local bắt đầu 5/12. Lesson-11: CTA bị chặn với 0–3/4 checklist, mở sau bước thứ tư; reload giữ 4 checkbox và progress vẫn 5/12. Complete cập nhật 6/12 trước khi chuyển lesson-12. Các checkbox là thao tác fixture QA, không chứng minh learner thật đã chạy CLI/tests.
- Lesson-12: đủ hai checkbox nhưng thiếu artifact vẫn chặn CTA; chỉ có GitHub URL vẫn chặn; thêm notes mở CTA. Complete tăng 7/12, giữ lesson cuối, footer chuyển Đến bài nộp cuối khóa. GitHub URL và notes tự điền đúng sang final form; reload giữ cả practice draft lẫn artifact trong final form. URL `https://github.com/corelia-learning-qa/rust-cli-fixture` là chuỗi fixture, không xác nhận repository tồn tại.
- Final form hiện còn bắt buộc textarea content ngoài GitHub/notes (nút Nộp bài disabled trước khi nhập); cần đối chiếu lại UX/contract với pilot chỉ yêu cầu GitHub URL và notes. Sau nhập content ghi rõ LOCAL QA và submit, UI hiện Đã nộp — Đang chờ giảng viên duyệt, ẩn form nộp lại. SQL read-only xác nhận đúng một submission `5857d9d9-7358-4926-88ff-56aaeec195d2`, pending, JSONB có notes/github_url. Không nộp file, không public project hay gửi email.
- Tiếp tục article-03/07, fill-05 (`u64`), edit-09 (reference expression qua Monaco paste), quiz-10 (3/3 pass) bằng UI. Progress lần lượt 8/12 → 9/12 → 10/12 → 11/12 → 12/12. Reload lesson-10 giữ score 3/3, selections khóa, curriculum 100%, final pending.
- SQL read-only cuối lượt xác nhận 12 lesson_progress có completed_at, đúng một pending submission và enrollments.completed_at NULL. Đây là evidence đầy đủ bài nhưng pending chưa hoàn thành course; chưa chứng minh reject/resubmit/approve hoặc credential error. Truy vấn đầu dùng nhầm cột completed đã lỗi và transaction read-only rollback; đã sửa dùng completed_at theo schema và chạy thành công.
- Giữ account/progress/submission fixture cho QA review tiếp theo. Không sửa application code hoặc migrations; automated baseline 114 files/788 tests, lint/build từ lượt resource recovery chưa thay đổi. Chưa hoàn thành toàn bộ acceptance matrix; không commit/push/deploy.


### Sửa UI nộp bằng artifact, không bắt nhập nội dung trùng lặp (11/09, 23:01 local)

- Browser QA trước đó phát hiện pilot có GitHub URL/notes đầy đủ nhưng UI vẫn bắt textarea. RPC hiện hữu đã nhận content rỗng khi có artifacts; không cần sửa schema hoặc migration. FinalAssignmentPanel nay cho content rỗng khi course có configured required fields và tất cả hợp lệ, đồng thời hiển thị label vi/en Nội dung bổ sung (tùy chọn). Khóa không có configured fields vẫn yêu cầu content, kể cả local draft còn artifact từ field đã bỏ.
- Thêm 4 component cases: đủ hai fields/content rỗng gửi được; thiếu notes chặn; URL sai chặn; course không fields không lấy stale artifact để bỏ qua content. Targeted 2 files/14 tests pass (`/tmp/corelia-artifact-only-targeted.log`).
- SQL integration đổi submission đầu thành artifact-only và assert content rỗng/status pending; toàn file pass trên stack local, ROLLBACK (`/tmp/corelia-artifact-only-sql.log`). Không reset DB, giữ learner QA 12/12 và pending submission để nghiệm thu review.
- Lint pass (`/tmp/corelia-artifact-only-lint.log`); full **114 files/792 tests** pass (`/tmp/corelia-artifact-only-full.log`), build exit 0 (`/tmp/corelia-artifact-only-build.log`, Vite 19.67s, chunk-size warning hiện hữu). Diff check pass. Browser resubmit với content rỗng sau rejected vẫn cần QA.


### Browser instructor review → artifact-only resubmit → completion (11/09, 23:07 local)

- Khôi phục account learning-qa-instructor@corelia.local qua local Admin API (email confirmed, không email), profile role instructor; gán instructor_id của riêng pilot local cho account này. Không thay user/quyền remote. Learner truy cập editor bị redirect /; instructor owner truy cập đúng /instructor/courses/corelia-learning-pilot-rust-cli/edit#assignments, thấy submission, artifact và 100% lesson progress.
- Instructor mở bài nộp đầu, thêm nhận xét LOCAL QA và yêu cầu chỉnh sửa. UI instructor hiện Cần chỉnh sửa; SQL xác nhận rejected và enrollment.completed_at NULL. Đăng xuất/đăng nhập learner qua UI, mở lại lesson-12: có nhận xét và form nộp lại. Đây là hai account dùng lần lượt, chưa chứng minh polling đồng thời hai phiên/background.
- Learner sửa notes thành revision 2, giữ GitHub URL và để content rỗng. Nộp thành công; SQL có hai rows: 5857d9d9-7358-4926-88ff-56aaeec195d2 rejected/content length 114 và 2fe266ab-9a85-459c-b67b-1f24f1778e72 pending/content length 0. UI không cho nộp lại khi pending. URL/review đều là fixture, không đánh giá repository hay feedback learner thật.
- Instructor vào editor lần hai thấy cả hai rows, chỉ bản pending mới có nút review. Mở detail thấy đúng notes revision 2 và content rỗng. Approve bản mới → UI Đã duyệt; SQL giữ rejected cũ, bản mới approved tại 2026-09-11 16:05:31.806132+00 và enrollment.completed_at 2026-09-11 16:05:31.807583+00. Đăng nhập lại learner/mở lesson-12 thấy banner Chúc mừng, bạn đã hoàn thành khoá học và trạng thái approved, không có form nộp. Chưa chứng minh stale review hai cửa sổ, approve request retry hay lỗi credential/network.
- Sửa copy vi/en có evidence từ browser: learner rejected chuyển thành Cần chỉnh sửa; thông báo approved learner và instructor không còn hứa cấp certificate bất kể cấu hình khóa. Browser learner sau hot reload xác nhận Bài nộp đã được duyệt. Chỉ sửa locale text, không đổi quyền/logic review/migration.
- Targeted 2 files/14 tests pass (/tmp/corelia-review-browser-targeted.log); JSON vi/en parse và diff check pass. Full suite/lint/build baseline trước copy: 114 files/792 tests pass. Không cần lặp toàn suite cho đổi text. Account learner đang đăng nhập; 12/12 và hai submission được giữ để QA tiếp. Không commit/push/deploy; không coi browser fixture này là phản hồi pilot thật hoặc Local Done toàn hệ thống.


### Locale legacy: text/video/practice copy sai kiểu (11/09, 23:10 local)

- applyCourseLessonLocaleContent trước đây gọi trim trên youtube_url theo TypeScript assertion dù JSONB runtime có thể là số/object, và đưa title/description/practice copy sai kiểu vào renderer. Thêm kiểm tra runtime: text/video URL không phải string fallback về master, locale segment không phải số hữu hạn fallback về master; practice label/title/instructions chỉ overlay string. Không mutate hoặc xóa locale thô, không đổi scoring/revision/permissions.
- Targeted courses.test.ts 14 tests pass (/tmp/corelia-locale-types-targeted.log): 4 malformed primitive/container cases, segment type fallback, practice malformed copy giữ canonical và valid copy vẫn translate. Fixture guided step có order hợp lệ để test thực sự đi qua nhánh normalization, không pass nhờ cấu trúc config bị từ chối.
- Đây là hardening bounded cho text/video/practice copy; chưa giải quyết code_exercise_locale, subtitle metadata sai kiểu, dữ liệu master malformed hoặc UI recovery cho toàn bộ locale thô. Browser malformed locale/recovery vẫn pending, không coi fallback là sửa dữ liệu invalid trước rollout. Full checks ghi tiếp sau đây.

- Full 114 files/798 tests và lint pass (/tmp/corelia-locale-types-full.log, /tmp/corelia-locale-types-lint.log). Build đầu phát hiện fixture thiếu required title; đã bổ sung title cho valid locale fixture, targeted rerun pass và build exit 0 (/tmp/corelia-locale-types-build.log, Vite 19.90s). Chunk-size warning hiện hữu còn; diff check pass. Không migration/commit/push/deploy.


### Khép chức năng project links và tách local/production guard (11/09, 23:28 local)

- PracticeConfig thêm related_project_id; PracticeProjectField dùng infinite public project directory và detail query hiện hữu, giữ selected ngoài trang đầu, tải thêm, loading/error/retry và remove unavailable. Link renderer kiểm tra visibility public/blocked trước khi xuất route /projects/:slug-or-id; locale preview được truyền vào query. Guided learner có liên kết tự tạo project và cập nhật profile, không prefill/copy artifact. Editor cho gỡ project_template legacy, không tự chuyển ID.
- Migration 20260911162146_learning_practice_project_link.sql đã apply local và immutable: mở rộng learning_lesson_errors với public/existing/not-blocked project check, giữ nguyên các validation/final mapping cũ. SQL integration pass, rollback: public được nhận, private/blocked/missing bị báo invalid_related_project. Fixture đã sửa source_type standalone theo contract hiện hữu và blocked phải private theo constraint; không bỏ constraint. Còn browser selector/save/reload/publish và isolated reset gate sau schema cuối.
- Component targeted 39 tests pass sau đổi project response sang wrapper {project,owner}; typecheck pass. Test bao phủ selected ngoài page đầu, đổi/gỡ ID, private/unlisted/blocked/deleted fallback và route/locale. Không sửa implementation projects ngoài Learning.
- CASE P0b nay kiểm tra approved chain là prefix local và suffix forward hợp lệ; baseline verifier vẫn kiểm checksum/version/name. Production verifier không đổi; test gọi nó với actual development chain và bắt buộc từ chối migrations chưa approved. pnpm db:verify **pass 155 guard tests** (/tmp/corelia-learning-close-db-verify.log); không sửa frozen baseline/approved production set. Full/lint được ghi khi hoàn tất.

- Full **115 files/805 tests**, lint và build exit 0 pass (/tmp/corelia-project-link-full.log, /tmp/corelia-project-link-lint.log, /tmp/corelia-project-link-build.log; Vite 19.50s). Security advisors mức error: No issues found (/tmp/corelia-project-link-advisors.log), không suy rộng sang warning/performance. Diff check pass. Chưa chạy isolated reset gate vì còn schema authoring cần khép trước snapshot cuối; không đánh dấu Local Done hay migration rollout đã nghiệm thu.


### Publish report với panel/locale/field location (11/09, 23:55 local)

- Migration 20260911165011_learning_publish_issue_locations.sql bổ sung private helpers và mở rộng learning_publish_report, giữ quyền content và các validation enforcement trước đó. Issue có panel, fieldPath cùng code/lessonId/locale/field cũ; root title/slug/final instructions được tách, lesson ordering ổn định, resource lỗi có index và locale riêng thay vì gộp về content. Migration đã apply local, immutable.
- Wrapper editor dùng report, có nút Sửa lỗi xuất bản đầu tiên và retry load. Lesson issue được truyền vào LessonEditor để mở locale/focus; course issue chuyển info/content/assignments qua navigation hiện hữu, giữ guard certificate/OCC, focus và hiển thị thông báo. Readiness draft hiện hữu vẫn hoạt động độc lập.
- Component tests 2 files/11 tests pass (/tmp/corelia-publish-location-tests.log), gồm initial structured issue → EN → resource-0-url focus, không save. SQL integration pass (/tmp/corelia-publish-location-sql.log): root title/info, final instructions/assignments, EN resource URL với fieldPath resources/0/url. Fixture report chạy trong savepoint rồi rollback để bỏ event deferred của nội dung chưa publish-ready; không disable guards. URL sai syntax bị guard chặn ngay nên fixture dùng URL rỗng hợp lệ ở mức draft.
- Chưa coi toàn bộ publish-location scope hoàn tất: cần browser course/lesson focus và error-save; question/option, code rule và practice-step location chi tiết; lỗi rollback của unsaved mutation chưa có structured detail xuyên suốt, report hiện phản ánh saved state. Không giả định report thay thế transaction validation. Còn legacy recovery và các gate cuối theo kế hoạch.

- Full 115 files/806 tests pass (/tmp/corelia-publish-location-full.log), db:verify pass, lint và build cuối exit 0 (/tmp/corelia-publish-location-lint.log, /tmp/corelia-publish-location-build-final.log). Build cuối chạy sau bổ sung thông báo course issue và đảm bảo click lại cùng issue vẫn focus. Security advisors mức error không có issue (/tmp/corelia-publish-location-advisors.log). Diff check pass. Chưa isolated reset/schema compatibility gate cuối; không commit/push/deploy.


### Candidate save issues trước rollback (12/09, 00:04 local)

- Migration 20260911170038_learning_save_issue_details.sql: shared private learning_lesson_issues dùng cùng learning_lesson_errors/resource rules cho saved report và candidate state trong learning_save_lesson. Sau upsert questions/locales, lesson published/nonarchived được validate trước return; invalid trả LESSON_NOT_PUBLISHABLE kèm DETAIL JSON issues rồi rollback RPC. Deferred guards vẫn giữ để bảo vệ direct table và thao tác khác; không nới policy. Migration đã apply local và immutable.
- saveLearningLesson giữ error.details; parser chỉ nhận issue contract đúng lesson, không render arbitrary Postgres details. LessonEditor giữ draft/form khi mutation lỗi và cung cấp Fix first để chuyển locale/focus từ candidate response; không fetch saved report để đoán lỗi của dữ liệu chưa lưu.
- Targeted 3 files/21 tests pass (/tmp/corelia-save-issues-tests.log): parse/malformed/foreign-lesson filtering, helper giữ details, UI giữ bản nháp và focus EN resource. SQL integration pass (/tmp/corelia-save-issues-sql.log): candidate published có URL trống EN trả exact resource location, persisted title vẫn Draft và không có locale EN mới sau rollback.
- 10 concurrency scenarios pass (/tmp/corelia-save-issues-concurrency.log), gồm replay, stale final review, approve idempotent và publication/final-field locking. Full 115 files/809 tests pass (/tmp/corelia-save-issues-full.log); db:verify và lint pass. Còn browser candidate error/retry và course/direct-table error payload; code/question/step focus chi tiết được đối chiếu trong nhóm authoring còn lại. Không reset pilot, commit/push/deploy hoặc đánh dấu Local Done.

- Build exit 0 (/tmp/corelia-save-issues-build.log); security advisors mức error không có issue (/tmp/corelia-save-issues-advisors.log). Diff check pass. Isolated reset/compatibility gate cuối vẫn chờ schema cuối, không dùng các kết quả này thay cho toàn bộ acceptance matrix.


## 12/09/2026 — Code locale/subtitle recovery và quiz races

- Code renderer chuẩn hóa hints/feedback/test copy trước render, không mutate dữ liệu thô. Editor phát hiện lỗi ở cả locale ẩn, chặn Save, chuyển/focus locale bị lỗi; recovery có confirm, giữ giá trị hợp lệ theo ID, unpublish và chỉ ghi khi Save. Subtitle recovery gửi giá trị hợp lệ tường minh vì RPC merge JSON không xóa field bị bỏ khỏi payload. Bỏ ID description trùng trong test-copy editor.
- Forward migration `20260911171251_learning_locale_copy_shape.sql`: structural guard áp dụng lesson/lesson locale, lỗi trả DETAIL chứa lesson/locale/field. Cho phép metadata-only retirement của lesson legacy; publish report và validator nhận diện copy invalid còn tồn tại. Không backfill/xóa dữ liệu lịch sử.
- SQL integration chứng minh malformed draft locale RPC rollback cả title lesson, direct malformed subtitle write bị chặn, các kiểu malformed và publish được kiểm tra.
- Concurrency thêm ba ca với hai session và quan sát pg_blocking_pids: khác request khi retry=false bị từ chối; question edit chờ grading rồi không đổi kết quả đã lưu; grading chờ edit rồi dùng answer key vừa commit. Tổng 13 ca pass.
- Evidence: `/tmp/corelia-copy-tests.log` (3 files/26 tests), `/tmp/corelia-copy-full.log` (116 files/812 tests), `/tmp/corelia-copy-sql.log` (pass/ROLLBACK), `/tmp/corelia-copy-concurrency.log` (13 pass), `/tmp/corelia-copy-db-verify.log` (155 pass), `/tmp/corelia-copy-advisors.log` (security error level: no issues). Lint/build logs: `/tmp/corelia-copy-lint.log`, `/tmp/corelia-copy-build.log`.
- Chưa nghiệm thu browser recovery; chưa chạy lại isolated reset gate trên migration mới. Premigration fixture/impact adapter, rollout hai bước, các dòng QA browser còn mở giữ nguyên trong acceptance-status. Chưa Local Done; không commit/push/deploy.

## 12/09/2026 — Upgrade từ schema trước Learning trên stack biệt lập

- `scripts/learning/verify-upgrade-local.mjs` dựng riêng project `corelia-learning-upgrade` (553xx), apply canonical migrations trước Learning, nạp `legacy-fixture.sql`, lấy snapshot/hash, rồi apply các migration còn lại. Không reset/tác động stack QA `corelia-app`; stack biệt lập đã stop `--no-backup`.
- Fixture thật trên schema cũ gồm article/video thiếu format, lesson trống trong course published, locale subtitle malformed, quiz attempt, final rejected rồi resubmitted, completion và credential lịch sử. Co-instructor có content=true, submissions/students=false; có profile trùng/không tồn tại để kiểm tra attribution.
- PASS: 215 migrations trong chuỗi; history/content hash không đổi; các cột attempt mới đều NULL (không đoán group); completion/credential timestamps giữ nguyên; permissions theo content/submissions/students không đổi; attribution owner/co đúng thứ tự và loại invalid/duplicate.
- PASS: anonymous RLS trước đọc 4 lessons, sau đọc 3; mẫu số 4→3. Empty lesson thành draft; locale malformed được giữ nguyên và liệt kê invalid. Fixture cố tình lỗi không phải pilot đã nghiệm thu.
- Snapshot tái lập được và comparison ở [qa/upgrade](./qa/upgrade/verification.json): `before.json`, `after.json`, `comparison.json`, `verification.json`. Chỉ chứa fixture local tổng hợp. Adapter đánh dấu `validation_available=false` trước migration để tránh hiểu nhầm issues rỗng là đã valid.
- Evidence `/tmp/corelia-upgrade-verification.log`: PASS và stop thành công; `/tmp/corelia-upgrade-unit.log`: 5 comparison tests pass; `/tmp/corelia-upgrade-impact-integration.log`: report hiện tại vẫn tính đúng và không ghi completion; `/tmp/corelia-upgrade-lint.log`: pass. Governance `/tmp/corelia-upgrade-db-verify.log`.
- Lượt đầu comparator phát hiện các cột attempt mới NULL, đã tách khỏi phép so sánh cột legacy và kiểm tra riêng tất cả cột mới NULL; không nới kiểm tra giá trị cũ. Fixture video đã sửa ID mẫu đủ 11 ký tự; lượt cuối chỉ còn lỗi nội dung cố tình tạo.
- Phần này khép fixture/adapter upgrade một chuỗi. Chưa thay thế rollout tương thích hai bước, `pnpm db:verify:local` cuối hay browser matrix; chưa Local Done.

## 12/09/2026 — Bridge quiz RPC cũ và compatibility probes

- Forward migration `20260911172940_learning_legacy_quiz_bridge.sql` giữ chữ ký/return array của `submit_quiz_attempts`; lesson batch dùng canonical transaction, section batch giữ `submit_quiz_attempt`. Không cấp lại quyền INSERT attempts hoặc quiz completion trực tiếp.
- Client cũ thiếu request ID: cùng user/course/lesson/answers replay cùng group; đổi answers chịu retry policy. Mixed course/lesson, duplicate question hoặc section trộn vào lesson bị từ chối. Không nhân bản attempts khi request lặp.
- `compatibility-local.sql` chạy trên schema baseline và sau toàn chuỗi 216 migrations: legacy lesson RPC trả đúng attempts; section RPC không đổi; schema mới có canonical group/completion, repeat idempotent; retry=false/mixed-course/duplicate không để attempts dở. Trước Learning đã revoke attempts INSERT (không ghi nhận nhầm đây là thay đổi mới); quiz progress trực tiếp bị enforcement mới chặn. Learner direct submission update không ghi row sau enforcement. Mọi probe rollback, history hash sau vẫn bằng trước.
- Evidence lưu [qa/compatibility/verification.json](./qa/compatibility/verification.json) và snapshots/comparison cùng thư mục. `/tmp/corelia-compatibility.log` PASS, stack biệt lập stop; `/tmp/corelia-bridge-sql.log` SQL integration pass; `/tmp/corelia-bridge-concurrency.log` 13 scenarios pass; `/tmp/corelia-bridge-db.log` 155 guard tests pass; `/tmp/corelia-bridge-advisors.log` no security errors; `/tmp/corelia-bridge-lint.log` pass.
- Không đổi frontend trong lượt này nên không chạy lại full frontend suite/build đã pass ở baseline. Chưa chạy lại `pnpm db:verify:local` cuối; không gọi đây là Local Done.
- Runbook có bảng client/RPC trước–sau. Bridge ở cuối chuỗi không giải quyết khoảng apply enforcement đầu chuỗi; client mới trên baseline và final/editor compatibility còn mở, không được dùng kết quả quiz để tuyên bố rollout hai bước hoàn tất. Không commit/push/deploy.

## 12/09/2026 — Final write contract, editor helper và browser Back/Forward

- Forward migration `20260911173523_learning_final_write_contract.sql` revoke INSERT/UPDATE/DELETE trực tiếp trên final_assignment_submissions từ anon/authenticated. Client review cũ không còn nhận zero-row success rồi báo duyệt giả; RPC trusted giữ quyền theo feature và transaction.
- Compatibility probe trên baseline và sau 217 migrations: learner/owner direct UPDATE trước còn thực thi, sau trả insufficient_privilege; owner `learning_final_review` approve và replay trả cùng kết quả. Mọi probe rollback, history hash giữ nguyên. Evidence [qa/final-write-contract/verification.json](./qa/final-write-contract/verification.json), `/tmp/corelia-final-contract-upgrade.log` PASS/stack stopped.
- `addLesson` ghi published/archive ở cột riêng, default draft và trả row persisted; `updateLesson` bỏ trạng thái khỏi data JSON, giữ duration và `.select("id").single()` để không báo Save thành công khi không có row được ghi. Ba regression tests mới.
- Browser local Chrome: learner bị redirect khỏi `/instructor/courses`; dashboard pilot vẫn 100%. Login instructor owner → danh sách → route `/instructor/courses/corelia-learning-pilot-rust-cli/edit` hoạt động. Đổi title chỉ trong form, native Back hiện guard; Cancel giữ title draft; Back → discard về danh sách; Forward mở lại title đã lưu, không giữ suffix QA. Không bấm Save hay thay content DB. Tab assignments vẫn đủ hai submission rows approved/rejected, learner 100%. Đây là native Back cancel/discard + Forward return, không phải dirty Forward hoặc section/question dialog QA.
- Targeted 2 files/21 tests; full suite 116 files/815 tests; SQL integration +13 concurrency; db:verify 155 guard tests; lint/build pass (existing chunk-size warning); security advisors no errors. Logs `/tmp/corelia-final-contract-{tests,full,sql,concurrency,db,lint,build,advisors}.log`.
- Rollout hai bước vẫn mở: client mới chưa chạy schema baseline, final/editor cũ chưa có bridge tương thích đầy đủ, khoảng apply enforcement trước bridge chưa được giải quyết. Gate isolated reset cuối, browser matrix còn thiếu và review toàn diff chưa đóng. Chưa Local Done; không commit/push/deploy.

## 12/09/2026 — Section/question dialog QA và xóa mô tả section

- Browser local Chrome trên route instructor editor cũ: mở section Nền tảng Rust, sửa draft title VI, đổi EN sửa riêng rồi quay lại VI vẫn thấy draft VI. Có native confirm khi bấm Hủy. Công cụ click native Cancel bị timeout `Emulation.setFocusEmulationEnabled`; dùng native Chrome để giải phóng dialog nhưng trạng thái cancel/discard không đủ chắc chắn. Không ghi nhận nhánh Cancel giữ draft là pass; không coi đây là bug ứng dụng đã tái hiện. Title VI/EN gốc vẫn được giữ, không Save bản sửa title QA.
- Question dialog của quiz-06: xóa nội dung câu đầu, Save hiện lỗi yêu cầu câu hỏi và ít nhất hai lựa chọn; dialog/form giữ nguyên, ba câu vẫn còn. Khôi phục text gốc rồi đóng, không lưu question và không thay lịch sử attempts. Không chạy Generate AI.
- Phát hiện từ code: `draft.description.trim() || undefined` khiến thao tác xóa mô tả section bị bỏ khỏi patch, giữ nội dung cũ. Sửa gửi chuỗi rỗng tường minh; `updateSection` xác nhận một row được update để không báo Save thành công giả khi row biến mất/mất quyền. Giữ các field khác và order.
- Browser sau sửa: thêm mô tả QA tạm vào section 1, Save, mở lại thấy nội dung đã lưu; xóa mô tả, Save, đọc database read-only xác nhận `data->>'description' = ''`. Đã dọn nội dung QA qua chính luồng Save; title và section 2 không đổi. Đây là kiểm tra save/reopen và clear persisted; chưa có browser giả lập network Save failure.
- Targeted courses/useSectionDrafts: 2 files/21 tests pass; full suite 116 files/816 tests; lint và build pass (existing chunk warning); diff --check pass. Logs `/tmp/corelia-section-clear-{tests,full,lint,build}.log`. Không thay schema, không chạy lại SQL suite ở lượt frontend này.
- Các mục chưa nghiệm thu vẫn theo acceptance-status: native confirm Cancel, navigation dialog/dirty Forward, responsive/network/privacy, rollout hai bước, isolated gate cuối và review toàn diff. Chưa Local Done; không commit/push/deploy.
