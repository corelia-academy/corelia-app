---
name: course-author
description: Tạo một khóa học Corelia hoàn chỉnh (metadata, brief, research, curriculum, lesson, bài cuối khóa) bằng tiếng Việt, theo chuẩn learning-principles, ra file cục bộ sẵn để import lên Supabase staging. Dùng khi user yêu cầu tạo, soạn hoặc sinh khóa học mới cho Corelia.
---

# Course author

Bạn là coordinator. Bạn điều phối, kiểm output và quyết định bước tiếp theo; nội dung của từng bước do child (subagent) viết theo đúng file role.

Trước khi bắt đầu, đọc `references/principles.md` và `references/platform.md`. Hai file này là chuẩn chung; mọi role đều phải tuân theo.

## Đầu vào từ user

- Tên khóa và chủ đề
- Đối tượng, trình độ
- Phạm vi do người quản lý nêu (`scope_note`), nếu có
- Path/track trong catalog, nếu có

Nếu có file `.course-runs/<slug>/handoff.json`: lấy `slug` (chính là tên thư mục), tên khóa (`title`), chủ đề (`topic`), đối tượng (`audience`), trình độ (`level`), `scope_note`, `path`, `is_foundation`, `prerequisite_courses`, cùng các trường `promise`, `final_product`, `differentiation`, `corelia_hook` từ file này; không hỏi lại các trường đã có. `brief.slug` bắt buộc trùng với `handoff.slug`.

Khi không có `handoff.json`: thiếu tên khóa hoặc đối tượng thì hỏi user, không tự đoán.

## Thư mục làm việc

Mỗi khóa một thư mục `.course-runs/<slug>/` ở gốc repo. Không commit thư mục này.

```
handoff.json       (từ course-planner)
metadata.json      bước 1
brief.json         bước 1
research.json      bước 2
curriculum.json    bước 3
labels.json        (script labels.mjs sau bước 3)
frame.md           bước 3 (chỉ khóa có code)
reviews/curriculum.json
lessons/<lesson_id>.json
reviews/<lesson_id>.json
verification/<lesson_id>.md
final_assignment.json
run-log.jsonl      (script run-log.mjs ghi log các bước)
reviews/course.json bước 7
```

Mỗi file chỉ do một child ghi. Child đọc file của bước trước, không sửa file của bước khác.

## Các bước

| Bước | Role | Đầu vào | Đầu ra |
|---|---|---|---|
| 1 | `roles/01-brief.md` | đầu vào user, catalog hiện có | `metadata.json`, `brief.json` |
| 2 | `roles/02-research.md` | `brief.json` | `research.json` |
| 3 | `roles/03-curriculum.md` | `brief.json`, `research.json` | `curriculum.json`, `final_assignment.json` |
| 4 | `roles/04-curriculum-review.md` | các file bước 1–3 | `reviews/curriculum.json` |
| 5 | `roles/05-lesson/` (`common.md` + file loại bài) | output `lesson-context.mjs`, `frame.md` | `lessons/<id>.json`, `verification/<id>.md` |
| 6 | `roles/06-lesson-review/` (`common.md` + file loại bài) | lesson, output `lesson-context.mjs`, `verification/<id>.md` | `reviews/<id>.json` |
| 7 | `roles/07-course-review.md` | `brief.json`, `curriculum.json`, digest, `frame.md` | `reviews/course.json` |

Bước 5 và 6 chạy theo từng lesson. Các lesson không phụ thuộc nhau có thể chạy song song, mỗi lesson một child. Bài nối tiếp nội dung bài trước hoặc dùng lại khung code của bài trước phải chờ bài trước viết xong (để đọc `prev_lesson_path`).

## Gọi child

Mỗi child nhận:

1. Nội dung file role của bước đó. Riêng bước 5 và 6: child nhận `common.md` và đúng file của loại bài (`article.md`, `video.md`, `quiz.md`, `code.md`, `practice.md`). Nếu lesson loại video rơi về article (`video: null`), nhận file role của article.
2. Đường dẫn tới `references/principles.md` và `references/platform.md`. Riêng child viết và review article nhận thêm `references/platform-diagrams.md`.
3. Đường dẫn tuyệt đối tới các file đầu vào và file đầu ra nó được ghi.
4. Với bước 5 và 6: child nhận output của `node .claude/skills/course-author/scripts/lesson-context.mjs .course-runs/<slug> <lesson_id>` thay cho `curriculum.json` và `research.json` nguyên file. Không đưa mã nội bộ vào chữ người học.

Coordinator gọi `node .claude/skills/course-author/scripts/run-log.mjs .course-runs/<slug> <step> <lesson_id|-> <role> <model> start` trước khi gọi child, và gọi lại với `end [result]` (`ok`, `needs_fix` hoặc `rerun`) sau khi child kết thúc.

Child không gọi child khác, không sửa file ngoài file đầu ra của mình, không ghi lên DB.

Việc user gọi skill này là cho phép coordinator spawn child theo bảng Model trong phạm vi một khóa; không hỏi lại. Quyền này không mở rộng sang việc khác ngoài khóa đang làm.

## Khóa nền tảng và khóa kế thừa

Khóa basic đầu path (`brief.is_foundation`) và khóa dựng trên nó (`brief.prerequisite_courses`) theo `references/foundation.md`: tách nguyên lý khỏi công cụ, thuật ngữ chuẩn nhất quán, hợp đồng `provided_prerequisites.json` ở bước 3, khóa kế thừa đọc hợp đồng thay vì dạy lại. Khi có `handoff.json`, `is_foundation` và `prerequisite_courses` lấy từ handoff; khi không có handoff, hỏi user khi chưa rõ khóa có phải nền tảng không, vì nó đổi yêu cầu của cả path.

## Khung chuẩn cho khóa có code

Khóa có `brief.code_language`: bước 3 ghi thêm `frame.md` (xem `roles/03-curriculum.md`), bước 4 kiểm nó (tiêu chí `frame`). Mọi child viết lesson và review nhận đường dẫn `frame.md`. Lệch giữa bài và khung: child báo, coordinator sửa `frame.md` một lần rồi đồng bộ các bài bị ảnh hưởng.

Sau mỗi bài viết xong, coordinator chạy `node .claude/skills/course-author/scripts/lesson-lint.mjs .course-runs/<slug> <lesson_id>`: công cụ tự động kiểm tra chuỗi khung `frame.md` mà bài trích lại (giới hạn: chỉ bắt chuỗi lệch 1–2 ký tự; các chuỗi viết khác hẳn hoặc đổi vai trò do reviewer kiểm ở tiêu chí `frame_consistency`). Mọi chuỗi cùng vai trò nhưng khác chữ là không đạt.

## Chuẩn bị trước khi viết lesson

Ngay sau bước 1, trước bước 2, coordinator kiểm công cụ để chạy kiểm chứng cho `brief.code_language` và `brief.tools` (ví dụ `cargo --version` cho Rust, hoặc runtime có sẵn trong container mà máy đã có). Khi có `handoff.json`, nếu thiếu công cụ: TUYỆT ĐỐI không hỏi user, không pull, tải hay cài; ghi nhận `not_run` cho mọi bước kiểm chứng cần công cụ đó và đưa vào báo cáo cuối. Khi không có handoff: thiếu công cụ thì hỏi user đúng một lần, kèm các lựa chọn: dùng image/container chính thức (phải nêu tên image và dung lượng vì là tải file), user tự cài, hoặc ghi `not_run` cho mọi bước cần công cụ đó. Có công cụ thì ghi phiên bản đang dùng để các child chạy cùng một môi trường.

## Khi nào hỏi user

Chỉ hỏi khi contract không quyết định được. Các trường hợp dưới đây contract đã quyết định, không hỏi:

- Caption không xác định được đoạn video: theo `roles/05-lesson/video.md` (đổi ứng viên, hoặc article).
- Bài `fill` cần hơn 5 chỗ điền, hoặc logic không chấm được bằng so khớp chuỗi: theo mục "Chọn dạng `code_exercise`" trong `platform.md`.
- Outcome "tự viết trọn vẹn" chỉ kiểm được từng phần: theo mục phủ outcome trong `roles/03-curriculum.md`.

Khi có handoff: TUYỆT ĐỐI không hỏi user giữa chừng; các trường hợp thiếu công cụ được ghi `not_run`, lần chạy lại bị từ chối với đúng lý do cũ thì đánh dấu bài đó bị kẹt, tiếp tục các phần khác và đưa vào báo cáo cuối. (Lưu ý: Review không được coi `not_run` ở phần cốt lõi là `pass`; bài bị kẹt vì thế sẽ được nhập với `published = false`).

Khi KHÔNG có handoff: hỏi khi thiếu tên khóa hoặc đối tượng, thiếu công cụ kiểm chứng (mục trước), hoặc lần chạy lại bị từ chối với đúng lý do cũ (mục Kiểm output và chạy lại). Có handoff thì lấy các trường từ handoff, không hỏi lại.

## Model

Coordinator chạy bằng model của session: Sonnet 5.5, effort medium. Session đang dùng model khác thì báo user trước khi bắt đầu.

Khi gọi child, đặt `model` theo bảng:

| Child | Model |
|---|---|
| Bước 1: metadata, brief | `haiku` |
| Bước 2: research | `sonnet` |
| Bước 3: curriculum | `opus` |
| Bước 4: review curriculum | `opus` |
| Bước 5: viết lesson | `sonnet` |
| Bước 5: chạy kiểm chứng (`verification/<id>.md`) | `haiku` |
| Bước 6: review lesson | `sonnet` |
| Bước 7: review cấp khóa | `sonnet` |

Ở bước 5, child viết lesson soạn danh sách bước cần chạy. Một child `haiku` riêng chạy các bước đó và ghi `verification/<id>.md`. Child viết lesson đọc kết quả rồi sửa bài nếu output thật khác `expected`.

Child viết lesson chỉ nhận phần research thuộc `source_ids` của lesson và các `misconceptions`, `setup_steps`, `videos` của topic liên quan (kèm hồ sơ nội dung video và đoạn phát được chọn nếu là bài video), không nhận toàn bộ `research.json`.

## Kiểm output và chạy lại

Sau mỗi child, kiểm output theo phần **Output** trong file role: đủ trường bắt buộc, đúng kiểu, ID tham chiếu tồn tại, không vi phạm `platform.md`. Kết quả kiểm là: đạt, hoặc không đạt kèm lý do cụ thể (trường nào, sai gì).

Với curriculum, kiểm cấu trúc gồm: mỗi outcome nằm trong `check_lesson_ids` hoặc `final_assignment.outcome_ids`; mọi `final_assignment.outcome_ids` thuộc `outcomes`; mỗi bài `fill` có tối đa 5 chỗ điền trong mô tả. Coordinator chạy `node .claude/skills/course-author/scripts/curriculum-lint.mjs .course-runs/<slug>` để kiểm tra các ràng buộc tất định về bài video (ứng viên primary, trần mỗi module, đoạn phát ≤ 720s hoặc cả video ≤ 900s có bằng chứng, giải trình cho primary không dùng và cho khóa 0 video); còn dòng báo lỗi thì coi là không đạt. Coordinator sinh nhãn bằng `node .claude/skills/course-author/scripts/labels.mjs .course-runs/<slug>` sau bước 3 và sau mỗi lần curriculum đổi thứ tự.

**Cổng trước reviewer (bước 5 → 6).** Lesson chỉ được chuyển cho reviewer khi: (1) `verification/<lesson_id>.md` có mục `## Tự review` đủ mọi tiêu chí của `roles/06-lesson-review/common.md` và file review loại bài (không có `ok` cho điều ghi `chưa kiểm`); (2) coordinator tự chạy `node .claude/skills/course-author/scripts/lesson-lint.mjs .course-runs/<slug> <lesson_id>` và kết quả là `ok`. Không đạt một trong hai thì gọi lại child bước 5 với đúng các dòng lỗi, chưa tốn lượt reviewer. Với khóa có bài `fill`, `lesson-lint` kiểm số ô điền, marker, và câu hứa app chạy test; thử mọi tổ hợp đáp án vẫn do child chạy bằng toolchain.

**Mọi `blocking` đều bắt buộc sửa.** Review trả `needs_fix` khi còn một `blocking` bất kể category (xem phân loại trong `roles/06-lesson-review/common.md`). `minor` còn lại không chặn và được liệt kê ở báo cáo cuối; không mở vòng sửa chỉ vì `minor`.

Sau mỗi review, coordinator chạy `node .claude/skills/course-author/scripts/review-lint.mjs .course-runs/<slug> <id>`; có dòng lỗi thì coi là `needs_fix` và gọi lại đúng child (reviewer nếu review thiếu, writer nếu còn issue phải sửa), kèm các dòng lỗi. Issue `blocking` của bước 7 quay lại child bước 5 của đúng bài được nêu, rồi review lại bài đó. `review-lint.mjs` kiểm cả `reviews/course.json`.

Lesson có sơ đồ: coordinator chạy thêm `deno run -A --no-config scripts/studio/diagram-lint.ts lessons/<lesson_id>.json`; còn dòng báo lỗi thì kết quả là không đạt, kèm đúng các dòng đó.

- **Đạt:** sang bước sau.
- **Không đạt, hoặc review trả `needs_fix`:** gọi lại child của bước đó, đưa kèm lý do không đạt (hoặc các issue blocking của review) và output cũ. Child sửa đúng các điểm được nêu, giữ nguyên phần đã đạt.
- **Xử lý khi lần chạy lại bị từ chối với đúng lý do cũ:** Khi có handoff, coordinator không dừng hỏi user mà đánh dấu bài học/phần đó bị kẹt, tiếp tục các bài khác của khóa và đưa vào báo cáo cuối. Khi KHÔNG có handoff, dừng và báo user vì lỗi nằm ở hợp đồng (file role, platform hoặc đầu vào); báo lý do, bước và file liên quan để user sửa hợp đồng.

## Chạy tiếp và trần số vòng viết-review

Khi bắt đầu một khóa học hoặc tiếp tục sau khi bị gián đoạn:
1. Chạy `node .claude/skills/course-author/scripts/course-status.mjs .course-runs/<slug>`.
2. Tiếp tục từ bước tiếp theo được script báo cho các bài chưa hoàn thành (`chưa_viết`, `chờ_kiểm_chứng`, `chờ_review`, `cần_sửa`), không làm lại các bước đã `đạt`.
3. Trần vòng lặp: Mỗi bài học tối đa 3 vòng viết–review (bước 5 → bước 6). Nếu sau 3 vòng bài vẫn ở trạng thái `cần_sửa`, dừng xử lý bài đó, tiếp tục các bài khác của khóa, và lập danh sách các bài bị kẹt để báo user ở báo cáo cuối cùng.

Research thiếu nguồn cho một chủ đề cốt lõi (curriculum hoặc review chỉ ra) thì quay lại bước 2 với danh sách mục cần bổ sung; áp dụng cùng quy tắc dừng.
Khi lesson hoặc lesson review chỉ ra kiến thức nền hay hướng dẫn cốt lõi chưa đủ bằng chứng, quay lại bước 2 bổ sung nguồn và phạm vi áp dụng; sau đó chuyển research cập nhật cho người viết lesson và review lại. Không coi `unverified` ở phần cốt lõi là `pass`; giữ nguyên các issue blocking khác khi chạy lại.

## Kiểm chứng bước thực hành

Mỗi lesson có ví dụ chạy được hoặc practice phải có `verification/<id>.md`. Mặc định AI tự chạy:

- Bước dùng lệnh (cài đặt, chạy, build, test): chạy bằng shell trong một thư mục tạm riêng của lesson, ghi lệnh và output thật.
- Bước cần giao diện (trình duyệt, IDE, ví): dùng computer use, ghi lại thao tác và kết quả quan sát được.
- Không dùng ví, private key, tài khoản hay tiền thật. Bước cần những thứ đó ghi `not_run` kèm lý do.

Nếu user chọn tự chạy, child chỉ chuẩn bị danh sách bước cần chạy; user điền kết quả vào cùng file.

Kết quả thật khác với kết quả mong đợi trong bài thì lesson không đạt, child sửa bài theo kết quả thật.

## Hoàn thành

Trước khi báo xong: chạy `node .claude/skills/course-author/scripts/lesson-lint.mjs .course-runs/<slug>` và `node .claude/skills/course-author/scripts/review-lint.mjs .course-runs/<slug>` trên toàn khóa, và `deno run -A --no-config scripts/studio/diagram-lint.ts lessons/<lesson_id>.json` cho mọi bài có sơ đồ.

Điều kiện hoàn thành:
- **Khi KHÔNG có handoff:** Khóa xong khi mọi file ở trên đạt, mọi kiểm tra máy móc không còn dòng lỗi và mọi review là `pass`. Còn dòng lỗi thì khóa chưa xong. Không tự import mà chờ lệnh từ user.
- **Khi CÓ handoff:** Khóa đủ điều kiện nhập khi mọi dòng lỗi của `lesson-lint`, `review-lint`, `diagram-lint` chỉ thuộc các bài bị kẹt (các bài quá trần 3 vòng viết–review chưa đạt) và mọi bài khác đều ở trạng thái `đạt` (review `pass`). Nếu còn dòng lỗi ở bài không kẹt thì chưa nhập.

Báo user:

- Danh sách module, lesson và loại bài
- Các bước thực hành `not_run` và lý do
- Các `open_questions` còn lại trong research

Khi có handoff và khóa đủ điều kiện nhập ở trên, coordinator tự động thực hiện nhập vào Supabase local stack:
- Lấy `SERVICE_KEY` tự động từ lệnh `supabase status` của stack local (chỉ nhắm `127.0.0.1:54321`, không đọc từ file `.env`, tuyệt đối không in key ra log hay báo cáo).
- Nếu stack local không chạy hoặc không lấy được key: không tự ý khởi động stack; DỪNG, báo cáo ghi rõ lệnh nhập thủ công để Human chạy.
- Chạy script import: `deno run -A --no-config .claude/skills/course-author/scripts/import-local.ts .course-runs/<slug>`.
  - Script tự động xác định các bài bị kẹt bằng logic chung với `course-status.mjs` (mọi bài không ở trạng thái `đạt`); các bài đó được nhập với `published = false`.
  - Nếu có ít nhất một bài bị kẹt, khóa được gán `data.is_updating = true`.
  - Nếu mọi bài đều bị kẹt, khóa được lưu với `courses.published = false`.
  - Không có bài nào bị kẹt: khóa và toàn bộ bài học được publish bình thường.
  - Script mặc định dừng nếu khóa đã tồn tại trong DB local.
- Đối với khóa có `kind: complete_existing`: không nhập DB, báo cáo nêu rõ lý do (pipeline chỉ tạo khóa mới; import dừng khi khóa tồn tại).
- Cuối cùng, coordinator xuất file báo cáo tổng kết `.course-runs/<slug>/run-report.md` và in cùng nội dung ra màn hình. Khi KHÔNG có handoff, không tự import mà chờ lệnh từ user.
