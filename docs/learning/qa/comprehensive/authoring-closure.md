# Authoring closure — 2026-09-12

## Recovery và duration

Ghi chú cũ về `learning-qa-legacy-recovery` đã stale: đầu lượt kiểm tra DB chứa chuỗi rỗng, duration37, draft. Không dùng fixture đó để xác nhận raw preservation.

Tạo fixture riêng `learning-qa-modal-recovery` trong course QA `4c033dc2-f5ac-4842-b75b-5a39c2a1752e`, published=false, duration37, description JSON object `{"legacy_raw":"retain until explicit Save"}`. Chỉ việc chuẩn bị dữ liệu pre-validation legacy dùng transaction local `SET LOCAL session_replication_role=replica`; transaction kết thúc trước mọi thao tác UI. Không disable trigger toàn cục, không thay migration/quyền; mọi Save nghiệm thu dùng API chuẩn với enforcement hoạt động. Lần insert đầu dùng conflict key sai bị rollback, lần sau dùng PK(course_id,id).

- Mở Publication & preview: cảnh báo invalid copy, form không crash.
- Recover valid copy → modal Cancel: cảnh báo còn. Save bị chặn bằng structured issue. SQL read vẫn JSON object ban đầu.
- Recover valid copy → Confirm, nhập nội dung mới: SQL read vẫn JSON object, chứng minh Confirm chỉ sửa draft.
- Save: persisted markdown `Recovered article content; duration must remain 37 seconds.`, duration37, published=false. Không sửa history hoặc completion.

## Starter warning

Duplicate QA code edit thành draft `QA starter warning modal`; đổi required rule sang contains `0` để starter và reference đều pass. Publish Save mở modal `The starter already passes every required check. Publish anyway?`.

- Cancel: SQL count theo title =0; draft còn trong editor.
- Save→Confirm: lesson `53aa6454-4ecd-4864-a210-dc4a22774284` được lưu published=true, revision1. Course QA vẫn draft, không thay pilot.
- Monaco div không hỗ trợ locator.fill trên browser hiện tại: ghi nhận lỗi công cụ, không coi là app fail. Ca warning dùng rule editor hợp lệ để tái hiện starter pass, không dùng API sửa bài thay UI.

## Practice mode

AUD-23 đã tái hiện trước sửa: Submission chọn GitHub → Instruction ẩn field editor nhưng preview yêu cầu GitHub và disable Complete. Draft tái hiện chưa Save. Tests sau sửa4/4 pass; browser regression trên build mới pass: Cancel giữ Submission/GitHub checked; Confirm chuyển Instruction không còn GitHub input và Complete khả dụng.

- Unsaved preview bốn mode instruction/checklist/submission/guided, VI/EN: checklist chỉ mở CTA sau checkbox; submission/guided chỉ mở sau artifact hợp lệ; guided step copy VI/EN đúng. Đã bấm Complete trong preview, đóng draft bằng modal và không Save.
- Code edit unsaved title VI, localized EN, Check code fail và read-only solution đúng nội dung. Capture `preview-practice-code-closure.json`:9GET tới projects/hackathons/profiles/notifications,0write, không attempt/progress/submission/event.
- Fixture `learning-qa-legacy-practice-fields` được insert qua guards chuẩn, không bypass: instruction + GitHub requirement + legacy template. UI hiển thị warning/checkbox; bỏ chọn GitHub và Remove legacy template reference rồi Save. SQL config chỉ còn mode instruction, submission_fields[], revision2; không tự chuyển template thành project ID. Checkbox setChecked automation timeout vì fieldset biến mất sau click: DOM read sau đó và SQL persisted state xác nhận kết quả, không lấy timeout làm pass.
- Full878tests/129files pass; lint phát hiện test mutate biến trong render, đã sửa test callback và4targeted tests + lint + build pass. Không có schema thay đổi trong nhóm AUD-23.

## Directory retry và learner submission

- Project directory: inject503 vào /rest/v1/projects trong cửa sổ45s, quan sát alert Could not load data / Try again sau retries. Ngừng fault, click Try again: alert biến mất, form giữ nguyên. Cửa sổ12s đầu đã kết thúc trước request nên không dùng làm evidence.
- Course riêng `learning-qa-practice-modes`, instructor owner,2published practice instruction/submission, final GitHub+notes, has_certificate=false; seed qua guards chuẩn, không chạm pilot.
- Learner `6f04b322-d836-46d3-aaa3-ec9db97341e0`: Instruction Complete→50%; Submission thiếuartifact khóaCTA; điềnGitHub+notes→Complete→100%lesson và finalform được handoff; Nộp bài tạo1pending submission `c8afc749-c8d8-4d4f-b130-c46438a3c923`, completed_atNULL.
- Phiên instructor độc lập Approve: completed_at2026-09-12T07:35:37.60051Z, certificate_issued_atNULL, đúng1submissionapproved. Không gửi email hoặc credential thật.

## Quiz cache regression

AUD-24 được tái hiện khi kiểm tra T04: SQL Save đúng nhưng reopen ngay hydrate cache cũ. Chưa lấy UI cũ làm kết quả persisted state hoặc bấm Save bộ cũ.18targeted tests sau sửa pass.

## Regression cuối AUD-24

- Build mới mở đúng2câu từ server. Sửa câu đầu, Save rồi mở lại ngay: copy mới hiện đúng.
- Remove câu thứ2, Save published: SQL vẫn giữ ID `f884a824-656e-47b3-ac19-2fac54b72c24` với archived_at và optionIDs a/b/c/d; câu mới `0e3019c4-93d9-4b64-95cd-4523ce140ba3` active order0, optionIDs a/b. Không tạo attempt giả cho case này; attempt retention đã có SQL/concurrency fixture.
- Mở Questions thấy đúng1câu active; sửa copy→Save1questions→mở Publication & preview ngay: copy mới hiện đúng. Chuyển EN vẫn thấy `Which Cargo command creates a project?` gắn với đúng ID, đáp án/scoring không bị nhân bản.
- Full880tests/130files→lint→build terminal success sau diff product cuối. Logs `/tmp/corelia-authoring-closure-tests.log`, `-lint.log`, `-build.log`. Lint trước đó yêu cầu bỏ synchronous effect state update; đã sửa fresh-result latch, không disable lint rule.
-12file ngoài Learning đối chiếu baseline hash không đổi. `git diff --check` pass. Review toàn bộ implementation vẫn là gate riêng D01; không tuyên bố Local Done từ kết quả nhóm này.

## Curriculum và keyboard — snapshot cuối

- Reorder lesson bằng Enter, inject RPC503: thứ tự DOM không đổi; SQL order hash trước/sau lỗi =649b57afb51c576e3c883d615c56b34f; error hiển thị. Retry thành công đổi thứ tự, sau bản sửa AUD-25 error cũ biến mất. Đã di chuyển ngược để hoàn nguyên thứ tự tương đối.
- Tạo section QA move destination bằng UI; đổi Section của learning-qa-modal-recovery rồi Save. SQL xác nhận section mới, markdown và duration37 nguyên vẹn. Kéo thả chỉ hỗ trợ trong section theo UI hiện hữu; cross-section dùng field Section, không thêm drag feature mới.
- Section dialog: draft VI/EN giữ qua đổi locale; Cancel-close→modal Cancel giữ draft, Confirm mới bỏ. Question dialog Add question→Cancel-close→modal Cancel giữ editor, Confirm bỏ draft.
- Bản cuối section title/description có accessible names Title/Description. Escape từ title mở confirm; Escape tiếp hủy confirm, DOM value Keyboard draft retained còn nguyên. Việc click Cancel trong exit animation từng gặp2matches; scope đúng dialog rồi đóng thành công, không coi locator ambiguity là app fail.
- Full880tests/130files→lint→build terminal success sau AUD-25/26; browser failure→retry/errorclear và section named fields/Escape pass trên build đó. Không có product edit sau build.
