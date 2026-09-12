# Bằng chứng rà soát tổng thể — 12/09/2026

Trạng thái nghiệm thu duy nhất ở [acceptance-status.md](../../acceptance-status.md). Tài liệu này là sổ phát hiện/bằng chứng, không phải bảng nghiệm thu thứ hai. Snapshot đầu đợt: [baseline.json](baseline.json). Danh sách ban đầu đã chốt trước khi sửa sản phẩm; các khoảng trống bằng chứng E-01–E-05 là phần bắt buộc của nghiệm thu, không phải Pass. Các SQL probe ghi dữ liệu đều rollback.

## Phạm vi đã đọc/kiểm tra trong lượt đầu

| Nhóm | Entry points đã đối chiếu | Bằng chứng và giới hạn |
|---|---|---|
| Hợp đồng/kiến trúc | lessonFormat, courses row/locale adapters, learning types/validation, LessonRenderer, Practice/Quiz/Code renderer và builder | NormalizedLesson mới là type alias; raw master và question copy còn đi qua cast. Phải kiểm tra cùng fixture qua editor/learner trước khi đóng lỗi |
| Quyền/publication | RLS live; app/cdn buckets; final Storage policies; learning SQL fixtures; Edge completion/blast/invite/reminder authorization | app bucket private, cdn public; learner UPDATE course trả 0 row. Ma trận REST/RPC/Edge/Storage mọi actor chưa đầy đủ, không coi source review là pass |
| Giao dịch/history | Live private quiz/final functions; progress invalidations; final helpers/UI retry; concurrency harness | Existing locks/idempotency và 13 ca race là bằng chứng baseline. Final payload sai kiểu được chấp nhận trong transaction rollback |
| Authoring/learner | Route instructor thật trên local; Overview/Curriculum/Add lesson; LessonEditor recovery/duplicate; Learn/final submission orchestration | Route cũ giữ nguyên, picker có 5 loại. AX cho thấy icon buttons không tên. Browser matrix đầy đủ còn phải chạy |
| Recovery/privacy | Practice/code draft keys/flush/preview, code telemetry, final artifact rendering, raw locale/master handling | Code event chỉ gửi boolean ở call site; chưa có network capture đầy đủ. Native dialog timeout ở lượt trước là thiếu bằng chứng công cụ |
| Migration/compatibility/pilot | verify-upgrade-local, legacy fixture, compatibility SQL, impact adapter, canonical enforcement đầu chuỗi, release runbook và pilot baseline evidence | Harness chưa có maintenance gate, restore/failure drill. Không có artifact mới chạy trên baseline chưa có RPC. Hash history chưa bao gồm question rows |

## Phát hiện đã xác nhận

### AUD-01 — P1 — Validation không chặn master text sai kiểu

- Yêu cầu: malformed legacy không crash; published content hợp lệ; raw recovery không tự xóa dữ liệu.
- Tái hiện: `initial-probes.sql` → `master_text_type` trả `{}` với title số, description boolean. `lessonRowToLesson` cast thay vì kiểm tra runtime; `validateLesson` gọi `.trim()`; renderer gọi validator trước format normalization.
- Mong đợi: lỗi field có cấu trúc; learner fallback an toàn; editor giữ raw tới khi người dùng xác nhận Save sau unpublish.
- Thực tế: server coi hợp lệ; client có đường TypeError. Code locale master và question_copy cần cùng cuộc rà soát kiểu, không chỉ title.
- Nguyên nhân/phạm vi: boundary JSONB→TypeScript thiếu runtime validation; root và locale; editor/renderer/catalog fallback.
- Hướng sửa: chia kiểm tra shape và readiness; normalize cho đọc nhưng giữ raw cho recovery; server guard cho mọi đường ghi. Không tự backfill/xóa malformed.
- Xác nhận sau sửa: fixture malformed qua direct save/publish, learner và editor, hidden locale, unpublish/recover/cancel/save/reload.

### AUD-02 — P1 — Quy tắc practice/quiz giữa client và server lệch nhau

- Yêu cầu: publish parity, checklist/step gating theo ID, config malformed bị chặn khi Save.
- Tái hiện: duplicate checklist ID trả `{}` ở server nhưng client trả invalid_checklist; threshold 0.005 bị server chặn, client chấp nhận. Guided steps dùng checked[id] nhưng client không kiểm tra ID trùng.
- Mong đợi: một ID duy nhất mỗi item/step; hai phía cùng range và shape; lỗi chỉ rõ item/field.
- Nguyên nhân/phạm vi: shape guard chỉ kiểm tra array ngoài; validator độc lập thiếu shared fixture. Tác động checklist/guided builder, learner, published API mutation và readiness.
- Hướng sửa: contract fixtures kiểm tra parity ở cả SQL/TS; kiểm tra nested types, ID uniqueness, revision, artifact mapping và publish location.
- Xác nhận: malformed nested fields, trùng ID, optional mapping, threshold biên; Save draft hợp lệ nhưng incomplete vẫn được phép.

### AUD-03 — P1 — Trusted final submit nhận payload sai cấu trúc

- Yêu cầu: trusted transaction validation; learner/reviewer không crash; artifact contract.
- Tái hiện: local pilot RPC nhận `p_files=[{"bad":"file"}]`, `github_url="https:///"`, `notes={"bad":"note"}` và trả `pending`; transaction rollback. Xem initial-probes.txt.
- Mong đợi: reject toàn bộ, không submission/completion/event; URL hợp lệ và artifact/file là string đúng contract.
- Thực tế: outer array/object được kiểm tra, required artifact dùng `->>` và regex nên nhận object stringified/URL không có host.
- Nguyên nhân/phạm vi: validation nông; rowToSubmission cast; SubmissionReviewContent giả định fileUrls string[]. Cần audit tất cả artifact keys, null/size và file rendering.
- Hướng sửa: forward migration kiểm tra payload đầy đủ, defensive read lịch sử; không sửa/xóa submission cũ.
- Xác nhận: REST RPC malformed + null + retry giữ request; SQL count trước/sau và UI legacy fallback.

### AUD-04 — P1 — updateCourse có zero-row success

- Yêu cầu: lỗi mutation giữ form, không báo thành công giả, mọi consumer cùng nguyên nhân.
- Tái hiện: authenticated learner UPDATE public course trả 0 row không lỗi (initial-probes.txt). `updateCourse` SELECT được public row rồi UPDATE chỉ xét error, không `.select().single()`.
- Mong đợi: không có row được ghi phải reject; UI giữ draft.
- Nguyên nhân/phạm vi: helper coi no-error là đã ghi; mọi caller updateCourse gồm settings/localization/publish. Section/lesson helpers đã sửa tương tự nhưng course còn sót.
- Hướng sửa: xác nhận persisted row; rà các mutation trả void và RPC tương tự, clear field gửi undefined, stale permission.
- Xác nhận: revoked permission giữa fetch/save, course biến mất, clear optional fields, UI failure giữ draft và route.

### AUD-05 — P1 — Compatibility/cutover chưa được triển khai

- Yêu cầu: phương án release local có cơ chế chặn phiên client cũ và failure rehearsal thực tế.
- Tái hiện: harness chỉ start baseline→apply all→compare→stop; tìm maintenance/cutover trong scripts/learning và runtime không có Learning gate. Enforcement bắt đầu trong chuỗi immutable, RPC mới vắng trên baseline.
- Mong đợi: hoặc artifact/điểm dừng hai bước có chứng cứ, hoặc maintenance cutover có backup/restore, deny operations trước apply và giữ deny khi gate fail.
- Nguyên nhân/phạm vi: trước đây runbook ghi blocker; quyết định mới của người dùng cho phép cutover. Tác động reads/authoring/questions/progress/quiz/final/completion/Edge/Storage, kể cả client đã mở.
- Hướng sửa: diễn tập cutover isolated với gate độc lập chuỗi canonical; không sửa migration cũ/frozen/approved set, không khôi phục quyền legacy. Kiểm chứng fail giữa chuỗi, fail smoke, recovery trước resume và forward-fix sau resume.
- Xác nhận: manifest/checksum, backup restore hash, stale-client/direct API deny, mở lại chỉ sau smoke và invalid gate; ma trận compatibility theo backend state.

### AUD-06 — P2 — Icon actions trong editor thiếu accessible name

- Yêu cầu: keyboard/accessibility VI/EN toàn hành trình.
- Tái hiện browser local owner: Overview learning outcomes/skills remove buttons không có tên AX; Curriculum section delete icon tương tự. Không bấm xóa.
- Mong đợi: tên hành động có ngữ cảnh và locale, focus/confirm rõ.
- Nguyên nhân/phạm vi: icon-only Buttons ở editor cũ; rà tất cả icon actions trong các dialog/editor liên quan.
- Hướng sửa: accessible labels dùng locale hiện hữu; không đổi luồng/routes.
- Xác nhận: AX VI/EN + keyboard + dialog focus/return, desktop/mobile.

### AUD-07 — P0 — File bài nộp chưa được bảo vệ khỏi ghi đè/xóa

- Yêu cầu: bảo toàn submission/history; quyền Storage phải phản ánh lifecycle bài nộp.
- Tái hiện Storage API local bằng learner: upload file thử→update cùng path→download trả nội dung đã thay→remove trả một object. Policies final update/delete chỉ xét owner hoặc submissions feature, không xét file đã được nộp. Probe dùng file thử riêng và đã cleanup; không sửa file học viên.
- Mong đợi: file đã dùng làm bằng chứng review không thể bị learner/reviewer ghi đè hoặc xóa qua đường client.
- Nguyên nhân/phạm vi: file storage mutable độc lập với append-only submission. Upload helper dùng upsert và timestamp, final row giữ signed URL một năm.
- Hướng sửa: object cuối khóa append-only với tên không va chạm; loại đường update/delete client có thể sửa history. Giữ khả năng đọc file legacy và rà expiry/signed URL khi review.
- Xác nhận: Storage API owner/learner/reviewer/khác user, overwrite/upsert/delete và retry; download file lịch sử vẫn đúng; scope chỉ final files.

### AUD-08 — P2 — Hàng chương ở mobile ép tiêu đề và controls

- Yêu cầu: mobile 390×844, nội dung và controls sử dụng được.
- Tái hiện local editor Curriculum, viewport 390×844: title “Từ hàm đến sản phẩm” bị ép thành cột khoảng một từ/dòng, mũi tên reorder chen vào cùng vùng. Document không overflow ngang nhưng hàng không phân bổ chỗ cho text/actions.
- Nguyên nhân/phạm vi: section header flex ngang không wrap, action group không tách hàng; titles VI/EN dài và section descriptions.
- Hướng sửa: header/actions xuống hàng ở narrow viewport, giữ keyboard/order hiện hữu.
- Xác nhận: screenshot/DOM bounds mobile/tablet/desktop, VI/EN, có/không description và controls keyboard.

## Thiếu bằng chứng cần khép trong cùng đợt

- E-01: ma trận role×feature×REST/RPC/Edge/Storage chưa đủ. Storage update/delete hiện cho chủ file và reviewer; Storage API đã xác nhận update/delete file thử; AUD-07 xử lý lifecycle history. SQL DELETE metadata bị `storage.protect_delete` chặn: **không** chứng minh Storage API đã bảo vệ history.
- E-02: browser matrix 1440×900, 768×1024, 390×844, VI/EN, light/dark, keyboard; hai session độc lập; lỗi mạng/expiry/storage/Monaco và network privacy. Các ca baseline không thay final snapshot.
- E-03: upgrade hash chưa bao gồm question rows; cần bổ sung bằng chứng stable question history, fresh install, seed hai lần/Cargo/workflow và final analytics.
- E-04: native confirm Cancel timeout và hai lần gọi sai signature CUA trong đợt này là lỗi công cụ/thao tác; không tính lỗi ứng dụng hoặc pass. Đã reset/read API và mở editor được.
- E-05: final diff review/secrets/untracked và toàn bộ gate chưa chạy trên snapshot cuối. Chưa có snapshot cuối khi chưa sửa.

Danh sách ban đầu chốt gồm AUD-01–AUD-08 và E-01–E-05 sau lượt rà đủ sáu nhóm (source, live SQL, Storage API, browser và harness/evidence). Chưa có lỗi nào được đóng. Thứ tự sửa: AUD-01/02/03/07 → AUD-04/05 → recovery consumers → AUD-06/08 và tài liệu; mọi phát hiện regression được bổ sung cùng sổ này. Việc rà soát ban đầu xong không đồng nghĩa ma trận nghiệm thu đã chạy xong.


### AUD-09 — P1 — Upload tài sản khóa học xóa file đang dùng trước khi Save thành công

Phát hiện khi rà regression nhóm AUD-07 trên các caller dùng chung Storage helper. `uploadToPath`/`uploadToCdn` xóa previousPath trước upload; upload hoặc updateCourse thất bại có thể để record cũ trỏ tới file đã xóa. Tác động thumbnail, sponsor/partner logos và course credential templates/badges. Mong đợi giữ file đang được record/historical credential tham chiếu khi thao tác thất bại. Sửa cùng nhóm IO: path mới độc lập và giữ previous object cho tài sản Learning; không thay hành vi upload các workspace khác. Xác nhận bằng upload failure và hai upload cùng thời điểm; DB mutation lỗi vẫn giữ form/record cũ. Không tự cleanup file cũ còn có thể được tham chiếu.

### AUD-10 — P0 — DELETE kế thừa điều kiện đọc public từ ALL policy

- Phát hiện trong regression ma trận quyền, mở lại cùng nhóm authorization.
- Tái hiện trước sửa: authenticated learner DELETE `course_lesson_locales` của pilot published trả 12 rows; `SET CONSTRAINTS ALL IMMEDIATE` vẫn thành công. Toàn bộ probe rollback, không mất locale pilot.
- Nguyên nhân: migration foundation tách ALL policy và dùng `qual` đọc (course published OR content manager) cho DELETE/UPDATE USING. UPDATE có WITH CHECK nên ít lộ hơn; DELETE không có WITH CHECK. Cùng nguyên nhân ở course/section/lesson locale, sections và lessons.
- Sửa: forward migration `20260911185926_learning_mutation_policy_scope.sql` đổi USING và WITH CHECK đúng content feature trên cả năm bảng, giữ owner/co-instructor/staff hiện hữu. Không sửa migration foundation đã apply.
- Xác nhận: `learning-policy-scope.integration.sql` thực hiện UPDATE/DELETE thật dưới 8 actor, rollback mỗi probe; `learning-policy-postgrest.integration.mjs` chạy REST read/update/delete cho cùng 8 actor, kiểm tra row count và nội dung vẫn tồn tại. Cả hai pass sau sửa. Bản fresh-install/cutover trước migration này cần chạy lại.

## Bằng chứng nhóm sửa đang chốt

- AUD-01/02: thêm runtime copy/question/config checks, recovery có xác nhận, safe read mọi consumer đã tìm thấy. 203 targeted tests pass; fuzz JSON legacy bắt được video segment coercion và đã có regression. SQL nested payload/question/resource checks pass. Video live/embed/music/scheme-less được server nhận cùng các dạng player hỗ trợ; ID dài và URL credential bị chặn.
- AUD-03/07/09: trusted final payload validation và defensive history reader; Storage final append-only, unique paths; tài sản khóa học giữ previous object khi upload/Save lỗi. `storage-boundary.json` ghi API upload/replace/delete/read; targeted helpers pass.
- AUD-04: updateCourse yêu cầu persisted row, optional clear gửi giá trị rỗng, has_sections chỉ ghi khi Save, stale locale load được bỏ qua. Helper/editor tests pass; browser failure matrix chưa đầy đủ.
- AUD-05: `cutover-final/` đã pass trước AUD-10, có restore/failure drills và hash question history, fixture mẫu số 5→4. Chạy lại sau policy migration; không dùng lượt này xác nhận snapshot mới.
- AUD-06/08: browser mobile 390×844 dark VI thấy title chương “Từ hàm đến sản phẩm” trên hàng riêng, controls không chen title; Add picker đủ 5 loại, section delete có tên AX. Đây là kiểm tra nhóm sửa, không thay final browser matrix.
- `pnpm db:verify` 155 tests pass; fresh-install/SQL/concurrency/Jobs REST gate pass trước AUD-10. Cargo 6 tests và seed hai lần pass; full suite/lint/browser cuối còn phải chạy theo snapshot mới.

### AUD-11 — P0 — Edge completion dùng quyền co-instructor chung thay feature

- Tái hiện bằng tài khoản Auth local thật: co-instructor chỉ có content gọi `courses.syncCompletion` cho learner khác đi tới kiểm tra enrollment (400 no_enrollment) thay vì bị chặn quyền. Helper `canManageCourse` chỉ xét sự tồn tại key co-instructor; với enrollment có dữ liệu, endpoint có thể trả counts/status và kích hoạt sync/milestone ngoài feature được giao.
- Mong đợi: owner/staff, learner tự đồng bộ, hoặc co-instructor có students/submissions rõ ràng mới được đồng bộ cho learner khác. Attribution và content-only không cấp quyền này.
- Sửa trong cùng nhóm authorization: optional requiredFeatures cho helper hiện hữu; chỉ completion caller dùng students/submissions. Các workspace/caller không thuộc Learning giữ hành vi hiện hữu.
- Xác nhận: test helper role/feature/false/string/attribution và `learning-edge.integration.mjs` dùng Auth API tạo user/session thật, không gửi email, course fixture không có enrollment/credential. Các thử nghiệm dùng JWT tổng hợp/SQL auth fixture trước đó là lỗi fixture Auth, không tính thành pass hoặc lỗi sản phẩm.

### AUD-12 — P1 — Course detail bỏ quiz/practice/code khỏi curriculum

Browser candidate: learner đã 8/12 (67%) nhưng course detail hiển thị “3 bài học”, hai chương chỉ có article. `CourseDetail` lọc `!isActivityLesson` khi nhóm lesson, header dùng `contentCount`; `CourseCurriculum` tiếp tục loại activity khi đếm section. Đây là consumer cũ chưa dùng curriculum đầy đủ, ảnh hưởng khám phá/nội dung course và tính nhất quán mẫu số.

Sửa cùng nhóm canonical curriculum: lọc publication bằng helper hiện hữu, nhóm tất cả năm format, đếm chính danh sách published/unarchived. Rà toàn src không còn caller loại activity khỏi curriculum; helper split counts vẫn giữ cho compatibility, không đổi semantics độc lập của nó. Browser course detail phải hiện 12 bài, mỗi chương 6, cùng progress 8/12; draft/archive vẫn bị loại. Các gate frontend của snapshot trước sửa cần chạy lại.

### AUD-13 — P2 — Course image fallback thiếu locale EN

Browser course detail EN trên pilot không có thumbnail vẫn hiện “Chưa có hình ảnh khoá học”. `CourseHero` dùng key `detail.courseDetail.thumbnailFallback` chưa có ở cả hai locale nên rơi vào default VI. Bổ sung key VI/EN trong namespace hiện hữu, không đổi layout hoặc luồng ảnh. Xác nhận lại course detail EN sau build candidate mới.

### AUD-14 — P2 — Bảng review không có đường refresh khi learner nộp lại

Hai phiên origin độc lập: learner nộp lại sau rejected, instructor vẫn thấy một row cũ; bấm lại panel assignments không fetch. Workspace kế thừa `refetchOnWindowFocus:false` global và không có nút refresh bảng bài nộp. Thêm refetchOnWindowFocus cho workspace/report Learning và Refresh ngay header submissions (report đã có Refresh). Không đổi default QueryClient toàn ứng dụng. Form/locale drafts dùng hydrate guard hiện hữu, refresh không được ghi đè draft; kiểm tra trong regression cuối. Server stale-review guard vẫn là lớp quyết định, không dựa vào UI cache để cấp quyền.

### AUD-15 — P0/P1 — Course INSERT policy và RETURNING không khớp quyền authoring

- Browser instructor `/instructor/courses/new` tạo draft trả RLS violation, form được giữ. INSERT check cho owner hợp lệ nhưng SELECT policy tra lại course qua hàm STABLE không thấy row mới trong INSERT RETURNING.
- Probe transaction riêng: learner role student INSERT course của mình không RETURNING thành công (INSERT 0 1), sau đó ROLLBACK. Insert policy legacy chỉ so instructor_id=auth.uid(), không kiểm tra role. Đây là bypass tạo course trực tiếp dù UI không cấp quyền.
- Phạm vi: mọi consumer createCourse, REST return=minimal/representation; không đổi quyền owner/co-instructor của course hiện hữu.
- Sửa: forward migration kiểm tra instructor/staff khi INSERT và policy SELECT owner/staff trực tiếp trên row để RETURNING hoạt động; giữ public publication filter và co-instructor feature reads. REST matrix cần kiểm tra cả minimal và representation, instructor không được gán owner khác.

### AUD-16 — P2 — Copy tạo khóa học còn nhắc mô hình giá

- Browser route new hiển thị mẹo “Tên, slug, ảnh bìa và mô hình giá là 4 trường…” dù mọi course miễn phí và form không có giá.
- Sửa cùng nhóm localization/docs: bỏ copy pricing cũ trong VI/EN, đối chiếu docs authorization còn câu non-admin tuyệt đối với quyền instructor hiện hành.

### AUD-17 — P2 — Server publish issues còn hiện mã thô

- Tái hiện browser: publish practice có project/hackathon public, ẩn hai reference, sửa published lesson và Save. Transaction bị chặn đúng, draft được giữ, nhưng issue `invalid_related_hackathon` hiển thị nguyên mã.
- Rà cùng nguyên nhân trên mã validation từ function canonical: thiếu copy VI/EN cho related hackathon, artifact mapping, format, practice mode, questions và final assignment requirement. `artifact_required` là enum, không phải issue.
- Sửa namespace validation dùng chung bởi readiness badge, lesson issue list và course Save. Không đổi validator hoặc schema. Kiểm tra lại VI/EN trong browser và key coverage; chạy lại frontend gates vì locale nằm trong artifact.

### AUD-18 — P2 — Aggregate config issue focus sai control

- Browser published practice có reference ẩn: Fix first issue focus Mode thay vì Hackathon. Cùng cơ chế dùng aggregate config field ở practice/code nên lỗi source/reference/checklist cũng focus Mode.
- Sửa adapter field phía client từ mã issue và draft hiện tại, giữ contract aggregate server tương thích. Thêm ID vào control hiện hữu cho references, checklist/step/artifact, code starter/reference/file/blank/test. Không thay schema hay validator. Malformed config vẫn focus recovery container.
- Xác nhận bằng tests field resolution + DOM focus và browser reference/code, không chỉ kiểm tra map chuỗi.

- AUD-18 regression: khi mở issue từ course report, directory còn pending nên select disabled nhận focus không thành công. Giữ select hiện hữu có thể focus/gỡ reference trong lúc tải, đánh dấu aria-busy; không đổi ID/value khi request hoàn tất. Kiểm tra lại initial focus và explicit Fix first.
- AUD-18 regression tiếp: Base UI Popup initial focus ghi đè useEffect sau portal mount. Editor truyền initialFocus qua API Popup hiện hữu để report issue được focus sau mount; explicit Fix first vẫn dùng cùng resolver.

### AUD-19 — P1 — Course Save tách locale và metadata thành hai transactions

- Rà recovery với hai bài legacy invalid trong course published: Save unpublish gọi upsert locale trước; deferred validation chặn trước khi metadata published=false được ghi. Ngoài ra locale thành công nhưng metadata fail có thể lưu dở và markContentSaved quá sớm.
- Cùng consumer Save information/final assignment/certificate settings đều dùng saveCourseInfo. Thay cặp request bằng RPC SECURITY INVOKER, giữ RLS owner/staff, lock course và commit metadata+locale cùng transaction. Không đổi invite flow sau Save; không phát email trong QA.
- Forward migration `20260911215843`; không sửa migration đã apply. Kiểm tra permission matrix, invalid locale rollback cả metadata, unpublish course legacy invalid, field clearing và browser failed Save giữ draft. Các database/fresh-install/cutover/frontend gates phải chạy lại sau sửa này.

- AUD-18 closure evidence bổ sung: readiness badge chỉ truyền codes không tạo được issue server-only; đã giữ code thành issue có field config và dùng cùng initialFocus. Browser EN badge focus đúng hackathon; code reference fail →Fix first focus textarea. Targeted17 tests pass trước full858.
- AUD-19 closure evidence: SQL actual anon +7authenticated actors, REST8actors, invalid copy/late publication rollback, clear optional text và unpublish invalid course đều pass; browser unpublish thành công. Forward migration đã qua fresh canonical223 migrations và cutover compatibility probe.
- E-04 database crash đã giải quyết bằng image local17.6.1.156, không nới quyền. E-04 native Chrome recovery confirm vẫn chưa có bằng chứng cuối: cgWindowNotFound/CDP focus timeout.

- AUD-17 regression cùng nhóm copy: hướng dẫn final assignment trong editor viết cứng tiếng Việt và chỉ nói credential. Chuyển sang key VI/EN, mô tả đúng điều kiện hoàn thành course. Không đổi quyền hoặc hành vi completion. Các gate frontend/artifact được chạy lại; pilot trước thay đổi copy không được gọi là hành trình trên snapshot mới.

### AUD-20 — P2 — Attribution editor và public consumer chưa được nối

- Rà C08/D01: `InstructorAttributionEditor` không có consumer; course detail chỉ truyền `co_instructors` cho section cũ. Backfill `data.instructors` tồn tại nhưng không thể sửa role label/order trong editor hoặc xem trên trang public.
- Mong đợi: editor hiện hữu lưu attribution bằng Save atomic, bảo vệ dirty draft; course detail hiển thị đúng profile/order/role label. Attribution không thêm invite hoặc permission.
- Sửa cùng nguyên nhân ở editor draft/hydration/save và course-detail rendering. Legacy thiếu metadata dùng UI cũ; malformed metadata không bị tự ghi đè. Kiểm tra render/retry/missing-profile, save/reload và quyền độc lập. Chưa đóng cho tới khi browser và gates trên artifact mới pass.

### AUD-21 — P2 — Tài liệu còn hợp đồng cũ dù đã có scope override

- Rà D02 thấy `learning-system.md` vẫn ghi admin-only; `admin-ui.md` còn lesson-level review/project template và cấm permission controls; authoring guide vừa ghi project link chưa có vừa hướng dẫn dùng nó.
- Sửa các đoạn cụ thể theo implementation/phạm vi hiện hành, giữ phân biệt thiết kế mục tiêu với bằng chứng nghiệm thu. Không dùng đoạn scope override đầu file để che mâu thuẫn bên dưới.

### AUD-22 — P0 — Response submission chậm ghi vào cache của ngữ cảnh mới

- R04/D01: actual useLearnSubmission + TanStack Query, giữ promise submit ở pending, rerender sang course khác hoặc learner khác, rồi resolve response cũ. Cả2regression tests fail trước sửa: cache key mới chứa original-row/user/course cũ. Đây là cache client bị trộn, không phải RLS backend bị bypass.
- Nguyên nhân: onSuccess đóng trên submissionKey của render mới; TanStack cập nhật mutation options khi observer rerender. Sửa dùng identity từ row trusted response. Rà cùng nguyên nhân ở question Save, credential invalidation và editor khi đổi course/user; không chỉ sửa consumer đầu tiên.
- Evidence trước sửa: /tmp/corelia-submission-scope-before.log. Phải có tests sau sửa và kiểm tra các consumer liên quan trước đóng.

- AUD-22 cùng nguyên nhân: actual route test mở lessonA rồi navigate courseB tái hiện context b:a trước sửa. Scope workspace theo course/user để dialog/form/request cũ không chuyển sang course mới. Question Save giữ queryKey lúc bắt đầu request và không đóng dialog locale mới; test pending VI→EN pass. Credential invalidation giữ key lúc request bắt đầu; general invalidation toàn courses không ghi payload nên không có lỗi trộn key tương tự.
- AUD-17: question dialog còn hardcoded Câu N trong UI English; dùng key VI/EN riêng.

### E-05 — Môi trường — CI chưa pin image dùng trong local QA

- Workflow guardrails/staging/production chạy CLI2.98.1 với default image, trong khi negative authorization probes chỉ được xác minh trên17.6.1.156 sau crash reserved-role EXECUTE của image cũ.
- Ba workflow local verification đã ghi version17.6.1.156 trước start, cùng cơ chế CLI đã dùng trong local rehearsal. Không đổi image của remote database, quyền, tests hoặc approved production set.
- Local image đã qua223migrations/negative-role probes. CI terminal result vẫn phải được theo dõi khi release; thay YAML không được gọi là CI pass.

- AUD-22 mở rộng Learn: deferred completion courseA→navigateB tái hiện banner Completed trên B bằng actual Learn component test (log /tmp/corelia-learn-context-before.log). Workspace scoped course/user và active guard sau await ngăn state/credential follow-up khi đã rời context; cache invalidation vẫn dùng course/user cũ nếu server đã xác nhận completion. Kiểm tra cả stay và switch để bảo đảm completion bình thường vẫn tiếp tục.

### AUD-23 — P1 — Đổi practice mode giữ artifact gate nhưng ẩn field trong editor

- R02/A02, browser: QA practice → Submission → chọn GitHub URL → Instruction. Editor ẩn Required artifacts, nhưng unsaved preview vẫn hiển thị GitHub URL bắt buộc và chặn Complete. Không Save thay đổi tái hiện.
- Nguyên nhân: mode select chỉ sửa `mode`; builder chỉ hiển thị fields ở submission/guided trong khi renderer và server dùng `submission_fields` ở mọi mode để giữ compatibility.
- Sửa tại builder dùng chung: xác nhận bằng modal trước khi bỏ checklist/steps/artifacts không còn áp dụng; Cancel giữ nguyên config, Confirm chỉ sửa draft. Artifact còn áp dụng được giữ; project/hackathon/revision không bị xóa. Legacy instruction/checklist còn fields được hiện cảnh báo và checkbox để gỡ rõ ràng. Không thay contracts backend hoặc tự sửa nội dung đã lưu.
- Tests bốn ca: guided→instruction/checklist Cancel/Confirm, guided→submission giữ artifacts, legacy fields hiện và gỡ được. Browser regression sau build được ghi trong `authoring-closure.md`.

### AUD-24 — P1 — Quiz editor mở lại cache cũ ngay sau Save

- T04 browser: sửa câu `f884a824-656e-47b3-ac19-2fac54b72c24`, thêm `0e3019c4-93d9-4b64-95cd-4523ce140ba3`, reorder và dịch EN, Save published thành công. SQL có2câu đúng order/stable option IDs; mở lại Publication & preview ngay vẫn thấy1câu với copy cũ. Không Save bộ cũ.
- Nguyên nhân: raw question query nằm ngoài prefix courses được parent invalidate; QuestionGeneratorDialog chỉ cập nhật cache locale riêng. Editor hydrate useState từ cache ngay khi mount, nên background fetch không thay draft cũ.
- Sửa cùng nguyên nhân: cả hai mutation surface invalidate mọi question read model (editor, course bundle/readiness, quiz/preview); raw editor chờ fresh fetch khi mở, nhưng không remount/drop draft khi background refresh; lesson editor keyed theo lesson. Các response không ghi payload vào course/user/locale mới.
- Tests: actual editor stale cache với pending fresh request không hydrate old question; sau fresh load, background invalidate không mất unsaved author edit; helper invalidates các consumer; existing late Save locale/context tests vẫn pass.18targeted tests pass; full gates/browser regression được ghi riêng.

### AUD-25 — P2 — Reorder retry thành công vẫn giữ thông báo lỗi cũ

- A04: RPC batch_update_lesson_orders503 hoàn nguyên UI/DB đúng; retry Enter thành công đổi thứ tự nhưng generic Local QA injected failure còn trên trang. Hai consumer commitLessonOrder/commitSectionOrder không clear error khi bắt đầu thao tác tiếp theo.
- Sửa cả hai consumer clear error ở đầu request; không đổi rollback dữ liệu. Cần browser failure→retry trên build cuối.

### AUD-26 — P2 — Section title textbox thiếu accessible name

- A03/keyboard: snapshot section dialog có generic TitleVI và textbox không tên; label không nối input. Thêm aria-label dịch cho title và description để keyboard/assistive tooling định danh được đúng field. Không thay flow Save/localization.
