# Browser regression evidence

Đây là bằng chứng ca chạy, trạng thái nghiệm thu nằm duy nhất ở `../../acceptance-status.md`. Các ca chạy trước build chứa AUD-12/13 không được dùng để khép final snapshot.

Artifact local port 5190, proxy 54521 → disposable Supabase 54321. Instructor dùng origin localhost, learner dùng 127.0.0.1; không sign-out để đổi vai. Build QA tường minh bằng `build-qa-local.mjs`, không kế thừa endpoint/CAPTCHA/maintenance production. Proxy chỉ lưu method/path/status/field names.

- Desktop 1440×900 VI/dark: anonymous đọc article, Login CTA → login → trở lại đúng lesson-01; learner 0/12.
- Article completion: tiêm HTTP503 cho POST lesson_progress; giữ lesson-01 và thông báo lỗi, không tăng progress. Retry thành công mới sang lesson-02, 1/12.
- Checklist: chọn 2/3, reload giữ hai mục và CTA disabled; chọn mục còn lại rồi Complete sang bài 3. Không có progress riêng từng step.
- Fill: bài04 `let` fail và giữ 3/12; `mut` pass →4/12, Next mở bài05 input riêng trống; `u64` pass →5/12.
- Quiz06: chọn đủ đáp án, tiêm RPC503; radio giữ giá trị và khóa, Try again gửi cùng lần nộp; pass3/3 →6/12, chưa điều hướng tới khi Next. Event capture chỉ p_course/p_lesson/p_event/p_passed.
- Edit08: Monaco lazy-load thành editor, nhập lời giải bằng UI; Ctrl+Enter pass →8/12. AX click editor ban đầu không focus nên Select All chọn trang; dùng click vùng editor có screenshot xác nhận rồi paste. Đây là thao tác công cụ, không đánh dấu lỗi app.
- Tablet768×1024 EN/light: code09 có layout Code/Test results và guidance desktop. Một lần fail chunk kích hoạt stale-chunk reload hiện hữu; tiêm hai lần liên tiếp mới kiểm tra được textarea fallback. Source65537 bytes bị từ chối, alert64KiB, source cũ55 ký tự giữ nguyên; nhập solution hợp lệ rồi Check qua textarea →Completed.
- Quiz10 EN: lượt0/3 không complete; Try again xóa lựa chọn, lượt3/3 pass. SQL giữ3 attempt groups tổng: quiz06 một, quiz10 hai.
- Mobile390×844 EN/light: guided11 đủ4steps mới Complete; guided12 đủsteps + GitHub nhưng thiếu notes vẫn disabled; điền notes rồi Complete/handoff cập nhật đúng final fields. Không tạo project tự động; các link /projects/new và /account/profile là action chủ động.
- Final submit: tiêmRPC503 giữ và khóa payload, Try again nhận pending. SQL12 lessons completed nhưng enrollment.completed_at=NULL, submission pending. Instructor session độc lập thấy100% bài học và1rowpending, reject với feedback →“Cần chỉnh sửa”.

Setup failures (không phải app failure hoặc pass): build trước khi proxy start làm sitemap ECONNREFUSED; inherited maintenance/CAPTCHA khiến artifact QA chưa dùng được; proxy header CORS trùng đã sửa; tab debugger unattached được phục hồi bằng tab mới cùng browser. Không tương tác CAPTCHA, không sửa bảo vệ production.

## Artifact sau AUD-11–14

- Build QA terminal pass, full 121 files/849 tests, lint pass. Cutover cuối ghi hash mọi file `dist/client` tại `cutover-final/cutover.json`.
- Instructor Refresh nhận bài nộp mới từ phiên learner riêng, giữ draft title và review comment chưa lưu. HTTP503 review giữ pending/comment; retry approve thành công. SQL giữ rejected+approved, completion true và certificate_issued_at false.
- Course detail mobile EN/light hiện 12 lessons, mỗi section 6 và thumbnail fallback tiếng Anh; progress100% khớp completion.
- Learner mới `6f822eb5-6f7c-448b-9eed-f8eada274742` chạy lại toàn pilot bằng UI trên artifact cuối: anonymous/login-return → article01 → checklist02 → article03 → fill04/05 → quiz06 → article07 → edit08/09 (Monaco) → quiz10 → guided11/12 → handoff và submit. Không dùng API để ghi progress/answers.
- SQL trước review: 12 completed lesson rows nhưng enrollment.completed_at NULL. Instructor reject; learner tự nhận “Cần chỉnh sửa” qua polling, giữ payload và nộp revision2. Refresh instructor thấy lịch sử hai lần, approve bản mới nhất.

- Viewport hiệu chỉnh theo DOM: origin127.0.0.1 có zoom110%, override845×1126 cho client768×1024 và1584×990 cho1440×900. Không coi các screenshot trước hiệu chỉnh là đúng kích thước CSS. Tablet Sheet chọn bài bằng Tab/Enter; desktop curriculum/collapse và footer quan sát thực tế.
- Reset confirm: CDP click timeout; native Chrome chọn đúng tab QA → Cancel → input mut giữ nguyên. Mode switch cũng cần native select/confirm; CDP timeout gây trạng thái automation stale, không tính lỗi app. Native đổi sang edit cho đúng editor/rule mặc định, reference pass và Save.
- Authoring course QA riêng tạo bằng UI sau AUD-15, ID4c033dc2-f5ac-4842-b75b-5a39c2a1752e. Tạo section và năm format qua một Add picker; article VI/EN publish cùng stable lesson ID; code fill duplicate thành draft rồi đổi edit mode và save. Keyboard reorder code fill lên trước practice, reload giữ thứ tự.
- Preview cả năm format: article EN đúng copy; video không autoplay, Play có nội dung và Retry; quiz1/1pass; code pass/reload input trống và không có draft status; practice Complete không ghi progress. [Network capture](preview-network.json) không có Learning writes; RPC trending header chỉ đọc.
- Proxy QA thiếu Access-Control-Allow-Credentials làm completion fetch bị CORS chặn trước POST. Đã sửa proxy, retry sync thành công; không sửa auth/CORS của ứng dụng production.

## Final artifact continuation — authoring/history/reference

- Native Back/Forward: course draft and question dialog guard tested against real browser history. Continue editing preserves text; explicit discard leaves editor. Same-path section panel history retains dialog draft. Section VI/EN draft switch/save/reopen and native Cancel retain unsaved text. Native confirm can leave CUA extension dialog state stale; fresh tab recovers. These tool timeouts are not product failures.
- Authoring QA course `4c033dc2-f5ac-4842-b75b-5a39c2a1752e`: one published article plus five drafts. Direct draft video URL redirects to article; curriculum denominator 1. Completing article persisted enrollment completion and one progress row. Archive keeps both historical records; hard-delete disabled. Restore returns draft and publish requires validation. Empty code-edit draft delete Cancel retained row, confirm deleted it.
- Pilot report with independent instructor session: enrolled/start/complete/submitted/approved = 2 each (distinct learners); both roster rows 100% approved. Quiz06 2/2 pass; quiz10 2/3 pass. Matches attempts/submission history, not row count of submissions.
- Learning guided practice links opened `/projects/new` with empty title/description and no GitHub artifact copied; Create disabled. `/account/profile` opened existing profile form without mutation. No project or profile was submitted by this browser test.
- Local disposable project `eeee9999-1111-4000-8000-000000000001` and hackathon `learning-qa-reference-hackathon` created as QA fixtures. Existing directory selectors loaded both. Practice saved/published with both IDs; learner links used existing slug routes. After project became private and hackathon draft, learner reload showed two unavailable messages and no links. Published lesson Save then rejected both references and preserved draft. Missing hackathon issue copy recorded as AUD-17; not counted as a passing localization check.
- Actual CodeExerciseLesson consumer tests additionally cover localStorage read/write errors and machine revision isolation. Full suite after these test-only additions: 121 files / 851 tests, lint/typecheck pass. Subsequent AUD-17 copy change requires frontend gate renewal.

## Candidate sau AUD-18/AUD-19

- Save course unpublish trên course có published legacy invalid đã thành công qua `learning_save_course_info`; SQL xác nhận published=false. Course locale và metadata được kiểm tra rollback bằng SQL khi validation fail sau write, không chỉ fail trước write.
- Readiness badge chỉ có issue codes từng mất vị trí cho directory validation. Adapter giữ server-only issues; browser EN badge practice tự focus `learning-practice-related_hackathon_id`. Cả hai reference có English copy; gỡ/save ghi config chỉ còn mode/revision. Code publish với reference sai giữ draft; Fix first focus `learning-code-reference` textarea.
- Raw recovery fixture vẫn giữ object description_markdown và duration37 trong database. Learner không crash. Browser mở xác nhận đúng nội dung “thay đổi chỉ ghi khi Save”; native Cancel/OK hiện bị CUA `cgWindowNotFound` và CDP timeout. Không đánh dấu ca confirm/recovery cuối là Pass. Unit test actual editor kiểm tra Cancel, confirmed recovery không ghi trước Save, giữ duration/nội dung hợp lệ.
- Image local 17.6.1.111 crash ở anonymous RPC denied EXECUTE, khớp upstream #2112. Đổi riêng image local sang17.6.1.156, không đổi ACL/RLS/extension guards; direct anon/authenticated SQL và REST8actor pass. Fresh install rồi restore dữ liệu QA giữ hash: `final-qa-restore.json`.
- Learner candidate `ac710096-0b47-44d6-a5a6-6c1bdca6f40a` chạy bằng UI trên bundle cuối: anonymous article → login-return → article/checklist →fill04/05 →quiz06 →article07 →Monaco08/09 →quiz10 →guided11/12 →artifact handoff →submit. Desktop đo DOM1440×900, tablet768×1024, mobile390×844; VI/light. SQL trước review:12 progress completed_at, submission pending, enrollment.completed_at=NULL.

- Candidate learner nhận “Cần chỉnh sửa” tự qua polling, giữ payload, nộp revision2. Instructor Refresh nhận đúng revision; approve. SQL: history=[rejected,approved], progress=12, completed=true, certificate_issued_at=false. Learner hiển thị banner completion. Report instructor có4 learners 100% approved; quiz10 pass4/5=80%, code08/09 start4/complete4.
- Sau hành trình này phát hiện một dòng final-assignment UI viết cứng tiếng Việt; đã sửa key VI/EN. Hành trình trên là evidence của bundle trước thay đổi copy cuối; không gán nó thành full journey của bundle mới.

- Artifact cuối sau copy: authoring EN code fill/video/quiz/practice Save→reload→curriculum EN hiển thị đúng cả5titles (article EN có sẵn). Video locale lưu start2/end10; quiz English question/option copy giữ stable IDs; practice config không chứa reference đã gỡ.
- Preview cuối đủ5formats: articleEN, codefillmut→pass→reloadblank, quizEN1/1pass và explanation, practiceComplete noop, videoENno-autoplay/Reload. Counts trước/sau events138/attempts27/progress49/submissions8 không đổi; `preview-final-network.json` chỉ lưu path/method/status/key names. Đây là saved preview; unsaved-preview draft isolation vẫn có component evidence, chưa đủ mọi browser case.

- Final artifact visual matrix bổ sung: EN/dark code09 mobile390×844, guided11 tablet768×1024/desktop1440×900; VI/dark fill04 cả3viewport; EN/light quiz06 cả3viewport. Screenshot và DOM kiểm tra không tràn ngang, footer hiển thị, curriculum desktop/Sheet tablet-mobile. Mở Sheet, chọn lesson và đóng bằng Enter; URL chuyển đúnglesson11. VI/light chạy trong full pilot cuối.

- Full pilot sau mọi diff cuối: learner `ec999a47-120e-416d-89d8-52fb5b6f84fc`, UI đủ12lessons (article/checklist/fill/quiz/edit/guided), handoff GitHub+notes, pending12/12 nhưng completed_atNULL, reject→polling→resubmit→Refresh instructor→approve. SQL history[rejected,approved], completed=true, credential=false; learner banner completion xuất hiện. Report instructor5enrolled/start/complete/submitted/approved, quiz06=5/5, code rows5start5complete, matches DB.

## 12/09 — Attribution và unsaved preview bổ sung

- AUD-20: editor course QA hiện hữu có attribution; sửa owner role label, Save/reload giữ nguyên. Thêm learner làm Guest QA, Move up rồi Save; course detail hiển thị guest trước owner. SQL xác nhận co_instructors=[] và permissions={} không đổi. Artifact cuối đưa link learner về /@learning_qa_learner, owner dùng /instructors/:id; không gán role cho learner. Consumer tests bảo toàn hidden/new co-instructor visibility và không nhân đôi card.
- Unsaved preview VI: thay nội dung article hoặc title quiz/code-fill/instruction/video; banner Unsaved preview và nội dung mới hiển thị. Article/practice/video Complete, quiz cargo test→100%, code mut→Passed, video Reload. Trả field về giá trị cũ rồi Cancel, không bấm Save. Capture `unsaved-preview-network.json`:23 API requests,0 Learning writes; SQL không có marker UNSAVED trong course lessons. Không suy từ đây rằng code-edit/mọi practice mode/EN/native reset đã được nghiệm thu.
- Native browser: Chrome window hiện đã đọc được; recovery confirm mở và đọc được nguyên thông báo. Trước khi bấm Cancel, tool báo user changed app và cửa sổ đã chuyển khỏi QA. Chưa có kết quả Cancel/OK; không đánh dấu B02/R01 pass. Đã hỏi người dùng dành khoảng2phút để tab QA phía trước; chưa nhận trả lời.

### Closure bổ sung — code edit VI/EN, native tool

- QA lesson `learning-qa-code-edit`: UI validate reference, publish VI, Save; reload giữ published. Chuyển EN, Save title/instruction/hints/test copy/feedback trên lesson published; reload giữ copy.
- Unsaved EN title hiển thị trong preview; Check code trên starter trả Not passed và feedback EN; Show solution read-only. Thử fill Monaco qua automation timeout, không tính là ứng dụng lỗi hoặc case pass. Revert title về saved value rồi Cancel thành công.
- Recovery raw lesson trên tab mới: click mở native confirm, getJsDialog trả confirm; dismiss timeout10s/reset kernel. Không kết luận Cancel/OK pass; B02 vẫn blocked. Không Save raw recovery.

### Login-return matrix bổ sung

- Phiên127.0.0.1 đăng xuất learner5; quiz06 vẫn đọc được published questions, chỉ có primary Login, final submit disabled. Login bằng learner5 quay về đúng lesson06 và khôi phục lịch sử riêng.
- Lặp lại practice checklist02 và codefill04: anonymous đọc nội dung, Login CTA→đăng nhập→đúng lesson02/04. Checklist/code draft của user chỉ xuất hiện sau login; final submission approved chỉ xuất hiện sau login.
- Final assignment không có đường submit anonymous: nút disabled và hướng dẫn login; dùng chung CTA của workspace để quay lại lesson chứa final panel. Không upload file hoặc gọi final submit khi anonymous.
- Empty published course không thể seed qua contract hiện tại (COURSE_NOT_PUBLISHABLE). Fixture draft `learning-qa-empty-course` được route learner từ chối Course not found; không coi đây là bằng chứng empty curriculum hoặc nới validator để dựng case.

### Artifact sau AUD-22 — learner6, authoring và privacy

- Learner `6f04b322-d836-46d3-aaa3-ec9db97341e0` thực hiện12lessons bằng UI: article/checklist gates, fill mut/u64, quiz06pass, article07, code08/09, quiz10pass, guided11/12 và artifact→final mapping. Reference6Cargo tests và separate-process CLI persistence pass. Repository là placeholder QA, không kết quả learner thật.
- Code08: inject đúng JS chunk503 (lần prefix đầu chỉ trúng CSS, không tính fallback). Reload hiển thị textarea; nhập65537ASCII bị từ chối, source vẫn44ký tự. Starter fail không completion; source_equals cần đúng dòng như reference. Reference multiline pass; code09pass.
- 12/12progress nhưng completed_at NULL trước final approve. Submit→pending→reject; learner polling hiển thị Cần chỉnh sửa và feedback. Resubmit append row; reviewer Refresh hiển thị đúng2rows. Approve503 giữ pending+feedback; retry approve thành công; learner tự nhận completion banner. Certificate timestamp NULL.
- Analytics UI: enrolled/start/completed/submitted/approved đều6; quiz06=6/6; quiz10=6/7 gồm attempt fail lịch sử. Code rows6start/6complete, drop-off0.
- Network trong context-closure-results.json:21learning_event requests chỉ metadata/boolean. Không capture giá trị source/answers/artifacts hay token.
- Authoring QA: codefill/video/quiz published qua UI rồi reload; Add lesson có đúng5type. Tạo `QA article final VI` qua Text lesson, publish, Save EN trên lesson published; SQL xác nhận đủ5formats published trong course QA draft. Original archived article và legacy raw object giữ nguyên.
- Native restore confirm tiếp tục timeout; Chrome native AX lại cgWindowNotFound. Không tính restore/recovery Cancel/OK pass.
