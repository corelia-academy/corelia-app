# Corelia Learning System

## 1. Mục tiêu

Corelia cải thiện trải nghiệm học hiện tại bằng phản hồi tương tác vừa đủ, không xây một Cloud IDE hay một learning platform mới song song với hệ thống đang chạy.

Luồng cốt lõi:

```text
Khám phá khóa học
→ Học nội dung
→ Kiểm tra kiến thức
→ Thực hành
→ Theo dõi tiến độ
→ Nộp bài cuối khóa nếu có
→ Hoàn thành
→ Nhận credential nếu khóa học bật credential
```

Tiêu chí thành công của lần tối ưu:

- Learner có một workspace nhất quán cho mọi lesson.
- Admin tiếp tục dùng course editor hiện hữu, không phải học một studio mới.
- Lesson tương tác dùng chung progress, locale và credential flow hiện tại.
- Completion có quy tắc rõ theo lesson type.
- Không thêm hạ tầng chưa phục vụ một nhu cầu học tập đã xác định.

UI implementation specs:

- [Learner UI](./learner-ui.md)
- [Admin authoring UI](./admin-ui.md)

## 2. Baseline hiện tại

Repo đã có các khối cần giữ:

- `courses`, `course_sections`, `course_lessons` với nội dung mở rộng trong `data JSONB`.
- `enrollments` và `lesson_progress` theo `user × course × lesson`.
- Lesson format `video | article | quiz | practice`, có fallback cho lesson cũ chưa lưu format.
- Learner routes `/learn/:courseId` và `/learn/:courseId/lesson/:lessonId`.
- Article, YouTube video, lesson quiz và open-ended practice.
- Section quiz, bài tập và thực hành. Toàn bộ learner-facing AI đã được loại bỏ theo Epic #332.
- Repo còn các field và flow lịch sử cho course trả phí.
- Nội dung `vi/en` qua các bảng locale riêng, không tách progress theo locale.
- Final assignment, manual review, completion sync và credential issuance.
- Course editor, instructor/co-instructor ownership lịch sử, preview-free lesson và publish flag.

Hệ thống mới phải mở rộng các khối này. Không tạo lại `modules`, `lessons`, `course_enrollments` hoặc một course builder thứ hai. Ownership và payment trong baseline không phải target: mọi course thuộc nền tảng, admin quản trị content và mọi course đều miễn phí.

## 3. Phạm vi sản phẩm tối ưu

### Lesson types

Target union:

```ts
type LessonFormat =
  | "video"
  | "article"
  | "quiz"
  | "practice"
  | "code_exercise";
```

Ý nghĩa:

| Format | Mục đích | Completion |
|---|---|---|
| `article` | Nội dung đọc, ví dụ, tài nguyên | Learner xác nhận hoàn thành |
| `video` | Video và nội dung bổ trợ | Learner xác nhận hoàn thành; watch tracking chỉ là telemetry |
| `quiz` | Kiểm tra kiến thức có đáp án | Đạt ngưỡng pass |
| `practice` | Hướng dẫn thực hành, checklist hoặc bài nộp mở | Xác nhận hoàn thành hoặc review nếu được cấu hình |
| `code_exercise` | Bài tập code có phản hồi tự động | Tất cả required tests pass |

Không thêm các lesson type sau:

- `code_fill` và `code_edit`: dùng `code_exercise.mode`.
- `guided_project`: dùng `practice` với các bước/checklist.
- `browser_code`: chưa có use case trong pilot; không xây iframe runtime.
- `chain_verify`: không cần cho mục tiêu học tập hoặc credential hiện tại.

### Những gì không xây

```text
Cloud terminal hoặc remote filesystem
Compiler/Cargo/Anchor service
Docker/VM/Solana validator
Arbitrary remote code execution
Blockchain verification engine
Generic verification DSL
Generic AST DSL
Multi-language parser framework
Course-versioning subsystem
Một Instructor Studio mới song song
Mobile IDE
Analytics warehouse riêng
Course marketplace, checkout và paywall
Instructor/co-instructor permission matrix
Learner AI tutor, chat sidebar và explain-selection UI
```

## 4. Course và curriculum model

Giữ hierarchy hiện tại:

```text
Course
└── Section
    └── Lesson
```

Không đổi tên `section` thành `module` ở database. UI có thể dịch thành “Chương” hoặc “Module” theo locale mà không thay schema.

### Platform ownership và instructor attribution

Mọi course thuộc Corelia; course không thuộc một instructor account. Chỉ tài khoản có role `admin` được tạo, sửa, sắp xếp, publish hoặc archive course content.

Instructor là metadata hiển thị dưới dạng danh sách, không phải authorization principal:

```ts
interface CourseInstructorRef {
  profile_id: string;
  role_label?: string; // ví dụ: "Lead Instructor", chỉ để hiển thị
  order: number;
}

interface Course {
  // existing course fields
  instructors: CourseInstructorRef[];
}
```

- Admin chọn một hoặc nhiều profile đã tồn tại và sắp xếp thứ tự hiển thị.
- Tên, avatar, headline và organization được resolve từ profile; không sao chép permission vào course.
- Instructor không tự động có quyền sửa course vì xuất hiện trong danh sách.
- Admin editor có một mục `Instructors` dạng danh sách với thao tác Add, Remove và Reorder; không có checkbox permission.
- Course detail hiển thị danh sách theo `order`. Nếu danh sách trống, hiển thị Corelia là đơn vị phát hành thay vì tạo instructor giả.
- Bỏ target `owner_type`, revenue share, co-instructor invites và per-course permission matrix khỏi learning system.
- `courses.instructor_id` hiện đang bắt buộc ở database chỉ được giữ như field legacy trong giai đoạn migration; authorization mới không dựa vào field này. Migration xóa/nullable field chỉ thực hiện sau khi mọi query và RLS đã chuyển sang admin-only.

`CourseLesson` tiếp tục giữ các field phổ biến hiện có. Thêm config theo format trong `course_lessons.data`:

```ts
interface CourseLesson {
  id: string;
  section_id: string;
  title: string;
  lesson_format: LessonFormat;
  short_description?: string;
  description_markdown?: string;
  resources?: LessonResource[];
  order: number;
  youtube_url?: string;
  youtube_start_seconds?: number;
  youtube_end_seconds?: number | null;

  quiz_config?: QuizConfig;
  practice_config?: PracticeConfig;
  code_exercise_config?: CodeExerciseConfig;
}

interface QuizConfig {
  passing_ratio: number; // 0..1, default 0.7 for legacy data
  allow_retry: boolean;  // default true
}

interface PracticeConfig {
  mode: "instruction" | "checklist" | "submission" | "guided_project";
  checklist_items?: Array<{ id: string; label: string }>;
  requires_review?: boolean; // default false

  // guided_project only
  project_steps?: GuidedProjectStep[];
  submission_fields?: Array<
    | "github_url"
    | "deployment_url"
    | "contract_address"
    | "transaction_url"
    | "demo_url"
    | "notes"
  >;
  related_hackathon_id?: string;
  related_project_template_id?: string;
}

interface GuidedProjectStep {
  id: string;
  title: string;
  instructions_markdown?: string;
  verification?: "self_check" | "artifact_required";
  order: number;
}
```

`practice_source_lesson_id` hiện hữu tiếp tục được giữ cho practice liên kết tới bài nội dung nguồn. `CodeExerciseConfig` được định nghĩa trong [Code Exercise](./code-exercise.md), không lặp lại một schema thứ hai tại đây.

Invariant:

- Chỉ config tương ứng với `lesson_format` được sử dụng.
- Content có thể dịch nằm trong locale record; rule, IDs và cấu hình máy đọc không nhân bản theo locale.
- Lesson ID ổn định khi đổi nội dung hoặc locale để không làm mất progress.
- Không yêu cầu admin nhập thời lượng ước tính mới.

### Xử lý duration hiện hữu

`duration_seconds` và `total_duration_seconds` hiện đang tồn tại và được UI sử dụng. Không xóa ngay trong lần thêm interactive learning.

- Ẩn trường nhập duration khỏi flow mới nếu không có giá trị sản phẩm rõ ràng.
- Với video, có thể tiếp tục lưu thời lượng clip lấy từ metadata.
- Với lesson khác, chấp nhận `0` trong giai đoạn tương thích.
- Việc xóa field là migration riêng sau khi không còn consumer.

### Video source

Phase hiện tại chỉ hỗ trợ YouTube URL, sử dụng parser và các field start/end seconds hiện hữu. Không xây upload, transcoding, storage, webhook hoặc private playback-token flow.

Managed video hosting như Bunny Stream được hoãn đến khi có nhu cầu đo được, ví dụ nội dung độc quyền cần kiểm soát playback, YouTube không đáp ứng trải nghiệm, hoặc quy mô sử dụng chứng minh chi phí hosting hợp lý. Khi đó thiết kế provider abstraction và migration như một dự án riêng; không thêm `VideoSource` union để “chuẩn bị trước” trong phase này.

## 5. Learner experience

Wireframes, responsive behavior, renderer states và component mapping được khóa tại [Learner UI](./learner-ui.md). Phần dưới đây là architecture contract, không thay thế UI spec.

### Learning shell

Giữ route và layout hiện tại, refactor `LessonPlayerCard` thành renderer theo format:

```text
LearnLayout
├── LearnHeader
├── LessonCurriculum
├── LessonWorkspace
│   └── LessonRenderer
│       ├── ArticleLesson
│       ├── VideoLesson
│       ├── QuizLesson
│       ├── PracticeLesson
│       └── CodeExerciseLesson
└── LessonNavigation
```

`LessonRenderer` là switch duy nhất. Learner view và admin preview phải dùng cùng renderer và cùng normalized lesson model.

Desktop giữ curriculum dưới dạng panel có thể thu gọn. Mobile dùng drawer cho curriculum; article, video, quiz và practice là single-column. `code_exercise.edit` trên mobile chỉ bảo đảm xem nội dung và draft nhỏ; UI phải khuyến nghị desktop cho chỉnh sửa nghiêm túc. Không dành layout slot hoặc toggle cho learner AI.

### Navigation

- URL lesson là nguồn xác định lesson đang mở.
- Previous/Next dựa trên curriculum order đã normalize.
- Mọi lesson đã publish đều mở cho learner; không có nhánh navigation theo payment hoặc preview access.
- Không tự động đánh dấu complete khi chỉ điều hướng Next.
- Nếu lesson hiện tại bị unpublished hoặc không thuộc course, chuyển tới lesson khả dụng đầu tiên và hiển thị thông báo phù hợp.

### Lesson states

Mọi renderer dùng state vocabulary chung:

```text
loading
ready
checking / submitting
passed / completed
failed
system_error
unavailable
```

`system_error` không được biến thành learner failure hoặc tăng attempt count.

## 6. Completion và progress

Canonical course progress:

```text
số required lessons đã hoàn thành
─────────────────────────────────
tổng số required lessons đã publish
```

Trong giai đoạn đầu, mọi lesson hiện hữu được coi là required để tương thích. Chỉ thêm `is_required` khi có một course thật sự cần optional lesson.

Completion policy:

- Article/video: learner chủ động nhấn Complete; video watch seconds không chặn completion.
- Quiz: server xác định pass dựa trên saved questions và configured threshold; mặc định hiện hữu là 70%.
- Practice: learner tự hoàn thành nếu không yêu cầu review; bài cuối khóa tiếp tục dùng `final_assignment_submissions` và review flow hiện hữu.
- Code exercise: required tests pass; xem [Code Exercise](./code-exercise.md).
- Course: mọi required lesson hoàn thành và final assignment được approve nếu course có final assignment.

`lesson_progress.completed_at` là trạng thái hoàn thành canonical. Không thêm một progress table thứ hai. Quiz và reviewed practice dùng trusted completion; code exercise là self-practice nên client validation có thể gọi progress flow hiện hữu khi pass.

Course completion và credential là hai bước tách biệt:

```text
lesson completion
→ course completion eligibility
→ enrollment.completed_at
→ credential eligibility
→ issue/claim credential
```

Credential failure không được đảo ngược course completion.

## 7. Quiz, practice và code exercise

### Quiz

Tối ưu quiz hiện hữu trước khi thêm question engine tổng quát:

- MVP giữ single-choice vì schema và UI hiện tại đã hỗ trợ tốt.
- Passing score thuộc lesson config; mặc định 70% cho dữ liệu cũ.
- Retry tạo attempt mới hoặc attempt group mới, không ghi đè lịch sử cần cho review.
- Correct answer và scoring rule không dựa vào payload do client khai báo.
- Ordering, matching và arbitrary question types chỉ thêm khi có course cụ thể cần.

Section quiz được giữ để tương thích, nhưng course mới nên dùng quiz lesson nhằm có navigation, progress và authoring nhất quán. Không duy trì hai feature set khác nhau lâu dài.

### Practice

`practice` bao phủ bốn mức mà không tạo lesson type mới:

```ts
type PracticeMode =
  | "instruction"
  | "checklist"
  | "submission"
  | "guided_project";
```

- `instruction`: bài hướng dẫn mở; learner tự xác nhận hoàn thành.
- `checklist`: các bước nhỏ lưu trong một lesson, không tạo progress row cho từng bước.
- `submission`: learner gửi text/link/file; chỉ dùng khi cần feedback hoặc review thật.
- `guided_project`: hướng dẫn learner dùng toolchain thật như Cargo, Anchor hoặc Foundry, hoàn thành các bước và nộp artifact của project.

Một guided project có thể là một lesson cho project ngắn hoặc một section gồm nhiều lesson `practice` cho project dài. Mode này không nhúng compiler, terminal hoặc deploy runtime vào browser.

Artifact được cấu hình bằng các field có kiểu rõ như GitHub URL, deployment URL, contract/program address, transaction URL, demo URL và notes. Learner draft được lưu trong submission flow hiện hữu nếu tương thích; nếu chưa có storage phù hợp, guided project chỉ được publish với `requires_review = false` và lưu artifact ở course final assignment. Không tạo một bảng submission tổng quát trước khi pilot chứng minh cần review ở cấp lesson.

Completion:

- Không review: tất cả required steps được check và mọi required artifact hợp lệ; sau đó learner tự hoàn thành lesson.
- Có review: submission phải được admin approve trước khi lesson complete.
- Project là đầu ra cuối khóa: tiếp tục dùng course final assignment hiện hữu; guided project lessons đóng vai trò hướng dẫn, không tạo bản submission thứ hai.

### Code exercise

Một lesson type với `fill | edit`, single-file Rust và client-side text validation trong MVP. Chi tiết data model, draft, accessibility và publish validation nằm tại [Code Exercise](./code-exercise.md).

## 8. Admin authoring

Wireframes, form behavior, YouTube video flow và component mapping được khóa tại [Admin Authoring UI](./admin-ui.md).

Tái sử dụng course editor hiện hữu nhưng route và authorization target là admin-only. Không tạo một Instructor Studio hoặc co-instructor workflow mới.

Lesson editor có shell chung:

```text
Identity: title, section, order
Content: fields theo lesson format
Completion: policy suy ra theo format, chỉ hiện option có ý nghĩa
Preview: dùng LessonRenderer chung
Validation: lỗi chặn publish
```

Builder cần có trong target:

- Article/video tiếp tục dùng editor hiện hữu.
- Quiz dùng question editor hiện hữu, bổ sung passing score.
- Practice thêm mode, steps và artifact fields cho checklist, submission và guided project.
- Code exercise dùng một `CodeExerciseBuilder`, không tách Fill/Edit builder.

Không xây block editor tổng quát trong giai đoạn này. Markdown editor, video fields và các form chuyên biệt hiện có đủ cho pilot.

### Publish validation

Admin chỉ có thể publish course khi:

- Guided project có ít nhất một step; mọi step có stable ID, title và verification mode.
- Mỗi step `artifact_required` ánh xạ tới ít nhất một required submission field.
- `requires_review = true` chỉ hợp lệ khi review surface và storage tương ứng đã sẵn sàng.
- Related hackathon/project template, nếu có, phải tồn tại và được learner truy cập.

- Có title, section và ít nhất một lesson publishable.
- Mỗi lesson có content tối thiểu đúng theo format.
- Quiz có câu hỏi hợp lệ và đáp án đúng.
- Code exercise có reference solution pass required tests.
- Final assignment có instruction nếu được bật.
- Mọi video lesson có YouTube URL hợp lệ.

Không triển khai course versioning ở MVP. Editing published course tiếp tục cập nhật course hiện tại; UI cảnh báo admin rằng thay đổi/xóa lesson có thể ảnh hưởng learner. Khi nhu cầu cohort/version thực sự xuất hiện, thiết kế versioning như một dự án migration độc lập.

## 9. Data ownership và API boundary

Giữ Supabase là persistence và authorization layer:

| Data | Canonical owner |
|---|---|
| Course/section/lesson content | `courses`, `course_sections`, `course_lessons` |
| Localized content | locale tables hiện hữu |
| Access | published course state; enrollment chỉ theo dõi learner-course relation |
| Completion | `lesson_progress` và `enrollments.completed_at` |
| Quiz questions/attempts | quiz tables hiện hữu |
| Final assignment | `final_assignment_submissions` |
| Code draft | namespaced `localStorage` ở browser |

Không tạo bảng `submissions` tổng quát cho mọi activity. Quiz, code exercise và final assignment có lifecycle khác nhau; abstraction chung ở thời điểm này sẽ làm RLS và review phức tạp hơn.

Code exercise không có attempt/submission table trong MVP. Config, tests và reference solution là public lesson data; source/draft chỉ lưu local. Đây là practice feedback, không phải secure assessment.

## 10. Free access, authorization và security

Trong target hiện tại, tất cả course đều miễn phí. Learner không đi qua checkout, purchase entitlement, certificate fee hoặc lesson preview paywall.

- Course đã publish có thể được xem và học miễn phí.
- Enrollment chỉ phục vụ progress, continue-learning và analytics; không phải entitlement thanh toán.
- Các field `access_model`, price, promo, payment access và `is_preview_free` được coi là legacy/deferred. Không xóa trong cùng migration nếu còn consumer, nhưng UI learning mới không dựa vào chúng.
- Thiết kế course trả phí và payment sẽ là dự án riêng sau này; không chuẩn bị abstraction hoặc nhánh UI giả trong learning MVP.

RLS/application rules:

- Anonymous chỉ đọc course/lesson đã publish và metadata public.
- Learner đã đăng nhập có thể học toàn bộ lesson đã publish và lưu progress.
- Learner chỉ đọc progress, attempts và submissions của chính mình.
- Chỉ `admin` được tạo/sửa/publish/archive course, section, lesson, quiz question và test config.
- Instructor attribution không cấp quyền authoring hoặc learner-data access.
- Learner không thể sửa question answer, tests hoặc completion rule.
- Quiz và reviewed-submission completion được ghi qua trusted path; content/code self-practice dùng progress flow hiện hữu.

Không chạy learner Rust trên server hoặc main app context. Code exercise MVP chỉ text-validate trong browser. AST/runtime execution không thuộc target hiện tại.

## 11. Localization

Progress gắn với stable lesson ID, không gắn locale. Đổi `vi ↔ en` không tạo lesson hoặc progress mới.

Phân loại field:

- Dịch: title, description, instructions, hints, feedback, test display messages.
- Không dịch: IDs, mode, language, source path, parser preset, completion rule, accepted source tokens trừ khi bài học chủ đích yêu cầu text tự nhiên.

Nếu locale thiếu content, dùng fallback policy hiện hữu. Admin preview phải cho chọn locale nhưng vẫn render cùng lesson renderer.

## 12. Analytics tối thiểu

Không xây analytics engine mới trong MVP. Dùng dữ liệu transactional và một event set nhỏ:

```text
course_started
lesson_started
lesson_completed
quiz_submitted
code_exercise_checked
practice_submitted
course_completed
```

Các metric cần cho pilot:

- Tỷ lệ bắt đầu và hoàn thành course.
- Drop-off theo lesson.
- Quiz pass rate.
- Code-exercise completion; check/pass events chỉ đo nếu event sink hiện hữu hỗ trợ mà không cần subsystem mới.
- Final-assignment submission/approval rate nếu course có bài cuối.

Không cần per-test dashboard, funnel builder, time-to-deploy hoặc blockchain verification metrics.

## 13. Delivery plan

### Phase 0 — Chuẩn hóa hiện trạng

- Tách `LessonRenderer` khỏi `LessonPlayerCard` nhưng giữ nguyên hành vi.
- Gom completion action theo lesson format.
- Viết characterization tests cho article, video, quiz, practice, access và progress.
- Ghi nhận consumer của duration trước khi ẩn field khỏi authoring.
- Chuyển course mutation authorization sang admin-only; danh sách instructor chỉ còn metadata hiển thị.
- Ẩn checkout/paywall/price khỏi learning flow nhưng bảo toàn dữ liệu legacy trong migration đầu.
- Normalize mọi course hiện tại về hành vi `free`; `is_preview_free` không còn ảnh hưởng learner access.
- Chuyển route tạo/sửa course sang admin guard; ngừng dùng instructor/co-instructor ownership để authorize.
- Backfill `courses.data.instructors` từ instructor attribution hiện hữu khi profile còn hợp lệ; không copy permission.
- Giữ các bảng invite/permission cũ bất hoạt trong lần đầu, rồi xóa ở migration cleanup riêng sau khi xác nhận không còn consumer.
- Không tạo compatibility placeholder cho learner AI trong learning routes.

### Phase 1 — Learning shell và completion

- Dùng renderer registry/switch duy nhất cho learner và preview.
- Chuẩn hóa loading/error/completed states và navigation.
- Đưa quiz completion về trusted server decision.
- Giữ certificate sync sau course completion, không trộn vào lesson renderer.
- Giữ YouTube fields và parser hiện hữu; không thêm provider abstraction.

### Phase 2 — Practice cleanup

- Bổ sung `PracticeMode` cho instruction, checklist, submission và guided project.
- Thêm guided-project steps, typed artifact fields và liên kết hackathon/project template.
- Dùng final assignment hiện hữu cho project cuối khóa có review.
- Hướng course mới từ section quiz sang quiz lesson; chưa xóa dữ liệu cũ.

### Phase 3 — Code exercise pilot

- Thêm `code_exercise` vào `LessonFormat` và publishability/count helpers.
- Thêm `CodeExerciseLesson`, một builder và local draft storage.
- Chỉ hỗ trợ single-file Rust, fill/edit và client-side text rules.
- Reuse progress completion hiện hữu; không thêm attempts/RLS/backend validator.

### Phase 4 — Đánh giá pilot

- Chạy một course, 1–2 sections, 10–15 lessons.
- Đánh giá completion, quiz pass rate, code-exercise completion và drop-off.
- Chỉ mở rộng validator, multi-file hoặc question type khi dữ liệu pilot chỉ ra nhu cầu.

Không có phase blockchain verification, browser runtime hoặc course versioning trong kế hoạch này.

## 14. Test và acceptance criteria

### Compatibility

- Course hiện hữu không có `lesson_format` vẫn resolve giống trước.
- Video/article/quiz/practice hiện hữu render và complete không regression.
- Progress và credential đã cấp không bị thay đổi khi deploy schema/config mới.
- Locale switch giữ nguyên lesson và completion.
- Legacy ownership/payment fields còn dữ liệu nhưng không cấp quyền hoặc tạo paywall trong target flow.

### Learner

- Direct URL, Previous/Next và curriculum chọn cùng một canonical lesson.
- Learner truy cập được toàn bộ lesson đã publish mà không cần purchase entitlement.
- Mỗi format chỉ complete theo policy của chính nó.
- Retry quiz/code không nhân đôi completion hoặc làm giảm course completion đã đạt.
- System error không bị tính là failed attempt.
- Mobile article/video/quiz/practice hoạt động; code edit đưa ra desktop guidance phù hợp.

### Admin authoring

- Không thể publish lesson thiếu content/config bắt buộc.
- Preview dùng đúng renderer learner và không ghi progress.
- Đổi locale không nhân bản machine config.
- Code exercise reference solution phải pass trước publish.
- YouTube URL và optional start/end seconds render đúng.
- Thêm instructor vào danh sách chỉ thay attribution, không cấp quyền sửa course.

### Authorization

- Learner không thể complete quiz bằng cách gửi `passed: true` trực tiếp; code exercise không đặt mục tiêu anti-cheat.
- Attempt/submission của learner khác không đọc được.
- Non-admin, kể cả profile xuất hiện trong danh sách instructor, không sửa được course content.
- Course/lesson chưa publish không bị lộ cho anonymous learner.

## 15. Quyết định đã khóa

1. Mở rộng schema và UI hiện hữu; không rewrite course engine.
2. Giữ `Course → Section → Lesson` và stable lesson IDs.
3. Target có năm lesson format: video, article, quiz, practice, code exercise.
4. Fill/Edit là mode của code exercise.
5. Guided project là practice, không phải lesson engine riêng.
6. Không có on-chain verification trong learning MVP.
7. Không có browser-code runtime, Cloud IDE hoặc compiler service.
8. Không có course versioning trong cùng dự án.
9. Không xóa duration field trong migration interactive-learning.
10. Learner và admin preview dùng chung renderer.
11. Course completion tách khỏi credential issuance.
12. Chỉ mở rộng sau khi pilot tạo ra nhu cầu đo được.
13. Mọi course thuộc nền tảng; chỉ admin sửa content.
14. Instructor là danh sách attribution, không phải permission model.
15. Video lesson chỉ dùng YouTube URL trong phase hiện tại; managed hosting để sau.
16. Mọi course hiện tại đều miễn phí; payment và paid access để sau.
