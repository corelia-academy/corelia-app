# Learning — trạng thái nghiệm thu local

Cập nhật 12/09/2026. Đây là bảng nghiệm thu duy nhất; các file trong `qa/comprehensive` chỉ lưu bằng chứng. **Chưa Local Done.** Baseline 816 tests không thay thế các gate bên dưới.

Phạm vi giữ nguyên: `/instructor/courses`, `/new`, `/:id/edit`; owner/co-instructor theo feature và staff hiện hữu; một Add lesson cho năm format; mọi course miễn phí; giữ history. Đang khép Local Done; người dùng đã yêu cầu staging → main và QA issues sau khi hoàn tất. Chưa commit/push/deploy; không phát credential thật trong QA.

## Bốn mốc

| Mốc | Trạng thái | Bằng chứng / điều kiện còn thiếu |
|---|---|---|
| Rà soát tổng | Pass | Sáu nhóm đã rà trước sửa; [baseline](qa/comprehensive/baseline.json), [initial probes](qa/comprehensive/initial-probes.txt), [findings](qa/comprehensive/findings.md). Các regression sau đó giữ trong cùng AUD-01–26. |
| Sửa theo nhóm | Fail — chưa đóng nghiệm thu mọi phát hiện | Candidate có sửa AUD-01–26; SQL/API và targeted tests xác nhận. Recovery modal, toàn bộ matrix browser và rà diff cuối chưa đủ bằng chứng để đóng cả nhóm. |
| Nghiệm thu tổng | Blocked một phần | Gate tự động pass; xác nhận Learning đã chuyển sang modal theo yêu cầu người dùng. Các ca browser còn thiếu bằng chứng ghi riêng dưới đây. |
| Bàn giao Local Done | Fail | Chỉ chốt khi mọi dòng bắt buộc pass, các ca còn thiếu hoàn tất và diff review đóng. |

`Fail — thiếu bằng chứng` nghĩa là yêu cầu nghiệm thu chưa đạt, không khẳng định ứng dụng có lỗi. `Blocked` chỉ dùng khi có lỗi môi trường/công cụ và điều kiện khôi phục rõ ràng. Không dùng timeout automation làm bằng chứng pass.

## Contract, quyền và dữ liệu

| ID | Yêu cầu | Trạng thái | Bằng chứng / còn thiếu |
|---|---|---|---|
| C01 | Năm format, fallback legacy, locale, normalized renderer | Pass | Characterization + validator/shape/renderer tests; pilot đủ article/quiz/practice/code, video fixture riêng. |
| C02 | Duration giữ schema, bỏ nhập thủ công, giữ metadata video | Pass | Recovery fixture riêng: Cancel/Confirm chưa Save giữ raw JSON; Save mới đổi markdown, duration37 không đổi. [Authoring closure](qa/comprehensive/authoring-closure.md). |
| C03 | Publication draft/archive, locale/questions/resources không lộ | Pass | SQL integration và policy probes; browser draft redirect/denominator1/archive history đã chạy. REST bổ sung pass8actors×5publicationstates cho lesson/question/locale/resources và course/section locales; [Ma trận surface](qa/comprehensive/authorization-surfaces.md) liên kết RPC/Edge/Storage và lý do không áp dụng cho endpoint không tồn tại. |
| C04 | Owner/co-content/co-submissions/support/admin; attribution không cấp quyền | Pass | SQL policy + REST8actor + Edge8actor. Course metadata owner/support/admin; content co-instructor không tự có quyền review hoặc metadata. |
| C05 | Tạo course đúng role, RETURNING và zero-row mutation | Pass | AUD-04/15; REST minimal/representation, foreign owner denied, helper persisted-state tests. Instructor browser tạo/edit route cũ thành công. |
| C06 | File submission riêng tư, không overwrite/delete history | Pass | Storage8actor: read theo quyền, overwrite/upsert/delete denied, bytes không đổi; draft course upload denied. |
| C07 | Archive khi có learner data, delete draft trống có confirm | Pass ở SQL và browser đã chạy | Article archive/restore giữ progress/completion; hard-delete disabled; draft code delete Cancel/confirm. Archive/restore Cancel/Confirm đã chạy qua modal ứng dụng; các ca còn lại ở B02. |
| C08 | Backfill attribution đúng ID/thứ tự, không sao permissions | Pass | AUD-20 nối editor/save/public consumer; browser role label, thêm guest, reorder, Save/reload và course detail; SQL permissions không đổi, attribution-only denied. Tests giữ visibility co-instructor, missing-profile và retry. |
| C09 | Preview không ghi progress/attempt/submission/draft/analytics | Pass ở coverage đã chạy | Saved5formats + unsaved VI5formats trước; thêm code edit VI/EN và4practice modes VI/EN, bấm Complete/Check nhưng capture9GET/0writes. Component tests giữ draft isolation. [Capture](qa/comprehensive/preview-practice-code-closure.json). |

## Giao dịch và completion

| ID | Yêu cầu | Trạng thái | Bằng chứng / còn thiếu |
|---|---|---|---|
| T01 | Canonical denominator published, không archived; historical completion giữ | Pass | SQL readiness/history; helper consumers catalog/detail/Learn/roster/reminder; browser course có1published5draft. |
| T02 | Quiz server scoring, threshold/retry, direct completion denied | Pass | SQL + QuizLesson/helper tests; browser quiz fail/retry/pass; cùng request idempotent. |
| T03 | Concurrency request khác retry=false, question edit/submit hai thứ tự | Pass | 13 concurrency scenarios quan sát lock và kiểm tra counts; validation fail không có attempt/progress dở. |
| T04 | Stable question/option IDs, archive câu có attempts, locale không đổi scoring | Pass | SQL/history tests + browser published add/edit/reorder/localize/archive. AUD-24 cache sửa và regression2editor Save→reopen ngay pass; archived row/optionIDs còn nguyên, EN gắn đúngID. [Closure](qa/comprehensive/authoring-closure.md). |
| T05 | Final append history, latest deterministic, pending/rejected chặn completion | Pass | SQL/concurrency; bốn learner QA giữ rejected+approved. Candidate mới có12progress nhưng completed_at NULL khi pending. |
| T06 | Stale review/idempotency; credential failure không đảo completion | Pass | Trusted transaction/concurrency/helper tests; Edge scope; không phát credential thật trong pilot. |
| T07 | Course metadata+locale Save atomic, lỗi giữ draft, clear optional fields | Pass | AUD-19 migration20260911215843; actual anon +7actor SQL/REST; late validation rollback; browser unpublish invalid course thành công. |
| T08 | Cache progress/review/report giữa hai phiên | Pass ở các flow đã chạy | Learner polling nhận rejected; instructor Refresh thấy resubmit; approve→learner banner; report4learners khớp. AUD-22 sửa cache scope khi request cũ resolve sau đổi course/user/locale; còn browser pending-switch ở R04. |
| T09 | Credential history/readiness trên mọi consumer | Pass ở SQL/tests; Fail — thiếu browser repair list | Completion/certificate candidates tests, historical fixture. Không gọi flow phát credential thật để thay cho QA. |

## Authoring, learner và recovery

| ID | Yêu cầu | Trạng thái | Bằng chứng / còn thiếu |
|---|---|---|---|
| A01 | Route editor cũ, một Add lesson→type, năm format | Pass | Browser instructor tạo QA course/section, đủ năm format; code fill duplicate→edit. Không có route admin thay editor. |
| A02 | Create/edit/save/reload/localize/publish từng format VI/EN | Pass ở coverage đã chạy | Năm format Save/publish/localize trước; bổ sung4practice modes VI/EN preview, instruction/submission learner→review→completion, code edit previewVI/EN, quizpublished add/edit/archive/reorder/localize và cache2editor. [Closure](qa/comprehensive/authoring-closure.md). |
| A03 | Explicit Save, lỗi giữ form; dirty page/dialog/Back/Forward/locale | Pass ở tests và phần browser đã chạy; Chưa đủ regression modal cuối | Native Back/Forward/Cancel đã chạy ở candidate trước; section VI/EN/Cancel/Confirm/Escape giữ draft đã chạy lại; question close modal giữ editor; validation giữ form. Back/Forward regression cuối còn thiếu. B02 phải khép trên snapshot cuối. |
| A04 | Reorder chuột/bàn phím, duplicate/archive/delete | Pass ở coverage đã chạy | Mouse drag/SQL/reload trước; final keyboard503 rollback UI/DB, retrysuccess/errorclear, cross-section bằng fieldSection giữ content/duration; duplicate/archive/delete/modal có evidence. [Closure](qa/comprehensive/authoring-closure.md). |
| A05 | Publish issue panel/lesson/locale/field; Fix first | Pass cho lesson paths đã kiểm tra; Fail — thiếu course/direct-table coverage | Structured issue + code-only badge đều giữ vị trí. Browser EN hackathon select và code reference textarea đúng. Course Save/direct-table candidate issue đầy đủ chưa được nghiệm thu hết. |
| A06 | Published mutation validate server; draft structural save/reference publish gates | Pass ở SQL/tests | Deferred validation/resource/locale/question/course mapping; reference required tests và starter-warning tests. Modal warning Cancel/accept nằm B02. |
| L01 | URL source, previous/next, unavailable URL, empty course | Pass ở tests và phần browser; Fail — thiếu empty/course-switch cuối | Login-return/direct draft redirect/Back-Forward đã chạy, progress success trước navigate; empty-state có code/tests nhưng thiếu browser cuối. |
| L02 | Một primary CTA, lỗi mutation không navigate/mất bài | Pass | Actual consumer tests + proxy503 article/quiz/final/review; retry giữ payload/request identity. |
| L03 | Anonymous đọc published, action login-return | Pass | Article→login→lesson đúng. Quiz anonymous đọc được câu hỏi, CTA login→đăng nhập local→đúng lesson06 đã xác nhận trên artifact AUD-22. Practice02 và code04 login-return đã pass; final submit anonymous disabled, dùng CTA login chung rồi khôi phục panel đúng user. |
| L04 | YouTube no-autoplay/start/end/error/retry | Pass ở module và fixture đã chạy; Fail — thiếu browser edge matrix | IFrame API6tests, fixture play/error/retry; owner-disabled/adblock/segment timing và mobile cuối chưa đủ bằng chứng. |
| R01 | Malformed legacy không crash; recovery giữ raw đến Save, confirm loại data | Pass | Actual editor tests + browser/SQL đối chiếu qua Cancel, Save invalid bị chặn, Confirm chỉ sửa draft và Save thành công. Ghi chú fixture cũ stale đã được thay bằng ca tái lập rõ ràng. [Evidence](qa/comprehensive/authoring-closure.md). |
| R02 | Practice instruction/checklist/submission/guided; artifact→final mapping | Pass | AUD-23 Cancel/Confirm/legacy Save pass;4modes VI/EN preview pass; learner instruction/submission→artifact handoff→single finalpending→reviewapprove→completion, certificateNULL. Checklist/guided pilot giữ evidence riêng. [Closure](qa/comprehensive/authoring-closure.md). |
| R03 | Project/hackathon public selector, hide/delete fallback, legacy template không đổi ID | Pass | Public/hide/unavailable flows trước + project503→Try again→recovery giữ form; template-removal Save config revision2, không tự chuyểnID. [Closure](qa/comprehensive/authoring-closure.md). |
| R04 | Network slow/fail, session expiry, user/course/locale switch pending | Fail — thiếu bằng chứng | Proxy503 các mutation chính và draft tests đã có; AUD-22 actual-hook tests tái hiện và sửa submission cache trộn user/course; route workspace đổi course và question Save đổi locale đều pass. Actual Learn component còn tái hiện banner completion của A trên B; đã sửa scope và chặn credential follow-up sau unmount, tests stay/switch pass. Chưa đủ browser session-expiry/pending-switch. |
| R05 | Code fill/edit, markers/rules64KiB, reference/starter, hints/results/reset | Pass engine/consumer; Fail — thiếu browser cuối | Fill/edit pilot pass, tablet Monaco fallback64KiB từng chạy. Artifact AUD-22: Monaco JS503→textarea; source>64KiB bị từ chối giữ source trước; code08/09 fail/pass→completion. Reset modal VI đã pass Cancel/Confirm; warning và toàn keyboard/mobile cuối chưa khép. |
| R06 | Draft user/course/lesson/revision, storage read/write/quota/corrupt | Pass ở actual consumer tests | CodeExerciseLesson/draftPersistence/revision tests; checklist reload browser. Không đổi revision vì copy. |
| R07 | Source/answers/artifact không đi analytics; project/profile do learner chủ động | Pass ở tests/capture | Learner6 capture21events chỉ metadata; unsaved practice/code preview thêm9GET/0writes. Project create form trống, profile không tự mutate. [Capture](qa/comprehensive/preview-practice-code-closure.json). |

## Migration, pilot và gates

| ID | Yêu cầu / gate | Trạng thái | Bằng chứng / còn thiếu |
|---|---|---|---|
| M01 | Baseline branch/HEAD/hash tracked+untracked, ngoài Learning | Pass | [Baseline](qa/comprehensive/baseline.json);12 file ngoài Learning đối chiếu hash không đổi. |
| M02 | Fresh canonical install + SQL/concurrency | Pass | `pnpm db:verify:local` terminal success,223 migrations đến20260911215843, actual reserved-role denial trên image17.6.1.156. |
| M03 | Legacy upgrade/impact/history/permission/invalid report | Pass | [Verification](qa/comprehensive/cutover-final/verification.json), [comparison](qa/comprehensive/cutover-final/comparison.json); history hash không đổi, denominator5→4 trước remediation. |
| M04 | Local guard khác exact approved production set | Pass | `pnpm db:verify`:155 tests; checksum/order/duplicate và production rejection. Không sửa frozen baseline/approved set. |
| M05 | Client/API old/new; lựa chọn rollout thực tế | Pass cho local cutover | Baseline thiếu RPC mới; old final writes denied rõ; quiz bridge; atomic Save probe. Không tuyên bố rollout hai bước khả thi. [Runbook](release-runbook.md). |
| M06 | Chặn phiên đã mở, backup/restore, lỗi giữa chain/smoke giữ maintenance | Pass | [Cutover](qa/comprehensive/cutover-final/cutover.json): Kong ingress REST/RPC/Edge/Storage đóng, restore hash đúng, apply/smoke/invalid failure drills, sau write mới cấm restore. |
| M07 | Khôi phục dữ liệu QA sau fresh gate | Pass | [Restore](qa/comprehensive/final-qa-restore.json); public/auth/storage data giữ nguyên, Learning history/content hash khớp. |
| P01 | Pilot idempotent2sections12lessonsVI/EN/stableIDs | Pass | [Pilot](qa/comprehensive/pilot-final.json): seed2x hash bằng nhau,24locales6questions. |
| P02 | Reference Cargo/CLI persistence, rubric/GitHub+notes | Pass | Cargo6tests, add/list/done/restart workflow. Placeholder QA repository, không giả làm learner thật. |
| P03 | Full pilot journey sau diff cuối | Pass ở artifact trước; cần smoke artifact mới | [Context closure](qa/comprehensive/context-closure-results.json): learner6 chạy UI đủ12lessons→submit→reject→resubmit→approve trên artifact sau AUD-22. Trước approve12progress/completed_atNULL; sau approve2submissionrows/12progress/completed_at có giá trị, certificate NULL. Review503 giữ feedback rồi retry thành công. |
| P04 | Analytics course/lesson/drop-off/quiz/code/final | Pass | Report sau AUD-22:6learners100%approved, quiz06=6/6, quiz10=6/7attemptgroups, code rows6start6complete; history submission không bị đếm thành số learner. |
| G01 | Full tests→lint→build | Pass | AUD-23–26:880tests/130files→lint→build terminal success trên product snapshot cuối; browser quiz2editor, reordererror/retry và sectionkeyboard regression pass. [Kết quả/hash](qa/comprehensive/authoring-closure-results.json). |
| B01 | Browser desktop1440×900/tablet768×1024/mobile390×844, VI/EN/light/dark/keyboard | Pass visual workspace đại diện | [Browser evidence](qa/comprehensive/browser-regression.md):3viewport×VI/EN×light/dark; code/quiz/guided, Sheet keyboard, no horizontal overflow. Không thay các functional cases còn mở ở A/L/R hoặc modal B02. |
| B02 | Modal ứng dụng cho recovery/reset/dirty/warning/archive/delete | Pass một phần — còn thiếu bằng chứng | Theo yêu cầu người dùng, thay native confirm bằng Dialog chung. Browser EN dirty lesson Cancel giữ title, Confirm đóng draft; archive/restore Cancel/Confirm pass; VI code reset Cancel giữ mut, Confirm xóa đáp án. Hook tests chặn window.confirm, unmount hủy pending. Recovery Cancel/Confirm/Save và starter-warning Cancel/Confirm đã pass browser+SQL; practice-mode modal, sectionVI/EN/Escape, questionclose đã pass; Back/Forward/mobile còn cần khép. [Bằng chứng](qa/comprehensive/modal-confirmations.md). |
| D01 | Review toàn diff/untracked/secrets/artifact | Fail — review chưa đóng | Đã rà các boundary/renderer/helper/editor chính; git diff --check pass,12outsidehashunchanged,274files không có private-key/service-role-token patterns ở context-closure-snapshot.json. Chưa xác nhận review toàn diff xong. |
| D02 | Docs authoring/review/migration/runbook thống nhất code | Fail — chờ kiểm tra cuối | Quyền/route/payment đã sửa, runbook thêm atomic Save và patched image. Các trạng thái lịch sử không được hiểu là Local Done. |
| X01 | Staging → main và QA issues | Chưa bắt đầu — phụ thuộc Local Done và remote cutover | Người dùng đã yêu cầu staging → main sau khi xong. Gate release chưa bắt đầu: cutover local không chứng minh managed-remote ingress hay backup Storage; phải xác minh trước push staging tự deploy. Chưa commit/push/deploy. |

## Công việc còn lại đã gom theo nguyên nhân

1. Khép các ca dirty navigation/keyboard/mobile còn thiếu B02/A03; recovery và starter warning đã pass.
2. Hoàn tất coverage còn thiếu A05/T09/L01/L04/R04/R05 và browser matrix cuối. Không mở tính năng mới.
3. Chạy smoke/pilot trên snapshot cuối sau AUD-23/24; giữ các hành trình trước làm bằng chứng lịch sử. Unsaved practice/code modes C09 đã khép.
4. Đóng D01/D02 và cập nhật snapshot/gate evidence. Chỉ chạy lại gate bị thay đổi làm mất hiệu lực; không chạy lại full suite sau mỗi ca UI.

Các gate tự động pass không làm các dòng thiếu bằng chứng phía trên thành Pass. Không bàn giao trạng thái Local Done khi B02 còn blocked hoặc yêu cầu bắt buộc khác chưa khép.
