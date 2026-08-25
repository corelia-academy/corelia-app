# Admin Learning Authoring UI

Tài liệu này định nghĩa UI để admin quản lý toàn bộ course content. Instructor chỉ là attribution list; không có instructor/co-instructor workspace hoặc permission controls.

## 1. Routes và authorization

Target routes:

```text
/admin/learning/courses
/admin/learning/courses/new
/admin/learning/courses/:courseId
/admin/learning/courses/:courseId/preview/:lessonId?
```

- Tất cả route dùng admin guard trước khi fetch editable data.
- Có thể tái sử dụng `InstructorCourseEdit` trong migration đầu nhưng component/route mới phải đặt dưới admin ownership.
- Non-admin nhận `403`/redirect; việc profile nằm trong course instructor list không thay đổi kết quả.

## 2. Course list

Desktop:

```text
Learning / Courses                                      [Create course]

[Search...] [Status: All ▼] [Language ▼]

Course                         Status      Lessons   Updated       Actions
Solana Fundamentals            Published   14        Today         Edit ⋯
Rust Basics                    Draft       8         Yesterday     Edit ⋯
```

Mobile dùng stacked cards, không ép table ngang.

Actions:

- Edit.
- Preview nếu có lesson publishable.
- Publish/Unpublish theo validation.
- Archive; delete chỉ dành cho course draft chưa có learner data và cần confirm rõ.

Không có owner filter, instructor permission, revenue, price hoặc payment columns.

States:

- Loading: table/card skeleton.
- Empty: `No courses yet` + Create course.
- No search result: Clear filters.
- Load error: inline retry, không thay bằng empty state.

## 3. Course editor shell

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Courses  Course title             Draft/Published  Preview  Save/Publish│
├──────────────────┬───────────────────────────────────────────────────────┤
│ Overview         │ Active editor panel                                   │
│ Curriculum       │                                                       │
│ Instructors      │                                                       │
│ Final assignment │                                                       │
│ Localization     │                                                       │
│ Settings         │                                                       │
└──────────────────┴───────────────────────────────────────────────────────┘
```

- Sidebar 220–280px desktop; top tabs/dropdown mobile.
- Header sticky; panel scroll độc lập.
- Một primary action: `Save changes` khi dirty hoặc `Publish` khi clean và draft.
- Autosave không bắt buộc. Target ban đầu dùng explicit Save để giảm race condition trong editor hiện hữu.
- Dirty navigation hiển thị confirm dialog.
- Save error giữ toàn bộ form state.

## 4. Overview

Fields:

```text
Title *
Slug *
Short description
Description
Thumbnail
Level
Learning outcomes
Skills
Supported content locales
Primary content locale
Credential enabled
```

Không hiển thị:

```text
Owner type
Price / promotion / certificate fee
Revenue share
Access model
Preview-free lesson settings
Contract or payout fields
```

Validation gần field; publish validation summary chỉ gom lỗi còn lại, không lặp error copy khác.

## 5. Instructor attribution list

Panel:

```text
Instructors
People shown publicly on the course page. This does not grant edit access.

┌ ⋮⋮  Avatar  Alice Nguyen    Lead Instructor       Remove ┐
└ ⋮⋮  Avatar  Bob Tran        Guest Instructor      Remove ┘

[Add instructor]
```

Add flow mở searchable dialog:

```text
Search people...
○ Avatar  Name · Organization
○ Avatar  Name · Organization

Role label (optional)
[Add]
```

Rules:

- Select profile hiện hữu; không tạo account trong dialog.
- Không cho thêm trùng `profile_id`.
- Drag hoặc Move up/down để reorder, luôn có keyboard alternative.
- Role label là localized display text nếu product cần dịch; không phải system role.
- Remove chỉ bỏ attribution khỏi course, không xóa profile.
- Không có permission checkbox, invite, ownership transfer hoặc publish rights.

## 6. Curriculum editor

Desktop dùng outline cards hiện hữu, tối ưu actions:

```text
Curriculum                                             [Add section]

┌ Section 1: Foundations                         Edit  ⋯ ┐
│ ⋮⋮ Article icon  What is Solana?       Ready       Edit │
│ ⋮⋮ Video icon   Accounts              Draft       Edit │
│ ⋮⋮ Quiz icon    Knowledge check       5 questions Edit │
│ ⋮⋮ Code icon    Mutable variables     Fill        Edit │
│                                             [Add lesson]│
└─────────────────────────────────────────────────────────┘
```

- Reorder section/lesson bằng drag; buttons Move up/down vẫn tồn tại cho keyboard/mobile.
- Row action chính là Edit; overflow chứa Duplicate và Delete.
- Không hiển thị duration nếu `0`.
- Không hiển thị preview-free/paywall badges.
- Health badge: `Ready`, `Draft`, `Issue`; click `Issue` mở lesson editor và focus field đầu tiên lỗi.
- Add lesson mở type picker, sau đó editor; không tạo row rỗng trước khi admin Save.

Type picker:

```text
Learn
[Video]    YouTube lesson
[Article]  Markdown lesson

Assess
[Quiz]     Single-choice knowledge check

Practice
[Practice] Instructions, checklist, submission or guided project
[Code]     Fill or edit source code
```

## 7. Shared lesson editor

Desktop: dialog/drawer `max-w-5xl` hoặc full editor route nếu code exercise cần diện tích. Mobile: full-screen sheet.

Common header:

```text
Edit lesson · Video                            Preview   Cancel   Save lesson
```

Common fields:

- Title, short description.
- Section và position.
- Format badge (format conversion không silently discard data).
- Resources.
- Locale selector cho translatable content.
- Status/readiness summary.

Format conversion:

- Article ↔ Video chỉ sau confirm nếu field nguồn sẽ bị bỏ khỏi active config.
- Quiz/Practice/Code không convert trực tiếp sang nhau trong MVP; admin tạo lesson mới để tránh orphan attempts/config.
- Delete lesson confirm hiển thị số progress/attempt rows nếu có; implementation không hard-delete khi policy dữ liệu yêu cầu archive.

## 8. Video lesson editor

Fields:

```text
YouTube URL *
Start time (optional)
End time (optional)
[Preview]
```

- Debounced URL validation.
- Accept watch, short, live, embed and youtu.be forms supported by parser hiện hữu.
- End must be greater than start.
- Failed embed preview does not discard entered URL.
- Không hiển thị source selector hoặc upload CTA trong phase này.

Shared video fields: Markdown notes/description, resources, primary video language và subtitle metadata hiện hữu nếu còn được dùng.

Managed video hosting được hoãn. Không thêm UI placeholder “Coming soon”, Bunny config hoặc provider abstraction cho đến khi product mở phase hosting riêng.

## 9. Article lesson editor

```text
Title
Short description
Markdown editor                         Preview
[ source                              ] [ rendered ]
Resources
```

- Desktop split source/preview; mobile tabs `Write | Preview`.
- Reuse Markdown renderer learner để preview.
- No generic block editor in target.
- Images dùng upload flow hiện hữu nếu có; pasted external image URL phải qua normal URL validation.

## 10. Quiz lesson editor

```text
Passing score [70%]
Allow retry [on]

Question 1                                      ⋮ Duplicate Delete
Question
[.............................................]
○ Option A
● Option B  (correct)
○ Option C
Explanation
[.............................................]

[Add question]
```

- MVP single-choice; không hiển thị dropdown question type chưa hỗ trợ.
- Ít nhất hai options, đúng một correct option.
- Passing score 1–100%; default 70.
- Reorder questions bằng drag + keyboard buttons.
- `Preview quiz` dùng `QuizLesson` với writes disabled.

## 11. Practice lesson editor

Mode selector:

```text
● Instruction
○ Checklist
○ Submission
```

Instruction: Markdown + resources.

Checklist:

```text
Instructions
Checklist items
⋮⋮ [Install the CLI]           Delete
⋮⋮ [Create a project]          Delete
[Add item]
```

- Stable item IDs; reorder không thay ID.
- Ít nhất một item để publish.

Submission:

```text
Instructions
Accepted input: [Text] [URL] [File]
Requires admin review [on/off]
```

- Chỉ bật input type đã có storage/validation implementation.
- Nếu `requires_review`, admin cần review surface trước khi course dùng format này trong production.
- Course final assignment vẫn cấu hình ở panel riêng, không nhân bản tự động thành practice lesson.

Guided project:

```text
Project instructions
Steps
  ⋮⋮ [Set up Cargo and dependencies]  Self-check
  ⋮⋮ [Run tests locally]               Self-check
  ⋮⋮ [Push source to GitHub]           Artifact required
  ⋮⋮ [Deploy to devnet]                Artifact required
  [Add step]

Required artifacts
[✓] GitHub URL       [ ] Demo URL
[✓] Contract/program address
[ ] Deployment URL   [ ] Transaction URL   [ ] Notes

Related hackathon (optional)
Project template (optional)
Requires admin review [off]
```

- Steps có stable ID, reorder và validation giống checklist; mỗi step chọn `self_check` hoặc `artifact_required`.
- Không có terminal, compiler, wallet signing hoặc deploy action trong editor/preview.
- Admin phải cung cấp command và expected outcome trong instructions khi yêu cầu Cargo, Anchor, Foundry hoặc chain CLI.
- Nếu project là final assignment, editor chỉ cấu hình steps hướng dẫn và liên kết tới final assignment; không bật một submission thứ hai.
- Không cho publish `requires_review = true` trước khi review surface và storage tương ứng đã tồn tại.

## 12. Code exercise editor

Dùng một builder theo [Code Exercise](./code-exercise.md).

Desktop:

```text
┌ Configuration 28% ┬ Starter code 47% ┬ Tests 25% ┐
│ Mode Fill/Edit    │ lib.rs            │ Text tests │
│ Instructions      │ Monaco            │ Add preset │
│ Hints             │                   │             │
└───────────────────┴───────────────────┴─────────────┘
Reference solution [tab]
```

- Fill: admin selects source range, action `Make blank`, then configures accepted answers.
- Edit: entire starter file editable; no file tree in MVP.
- MVP tests chỉ có source-equals, contains và not-contains; không có regex hoặc AST UI.
- `Validate solution` runs all required tests.
- Save draft may succeed while solution fails, nhưng publish readiness là `Issue` đến khi solution pass.

## 13. Final assignment

Giữ course-level panel hiện hữu:

```text
Enable final assignment [on]
Title
Description
Instructions
Accepted submission fields
Requires approval before course completion [on]
```

- Không có certificate fee.
- Review queue là admin-only.
- Disable final assignment không xóa submissions cũ; confirm ảnh hưởng completion policy.

## 14. Preview

Preview route dùng cùng `LessonRenderer` và normalized model với learner.

```text
ADMIN PREVIEW · Progress and attempts are not saved
[Locale ▼] [Desktop | Mobile]                         Exit preview
```

- Desktop/Mobile switch thay content width; không mô phỏng browser/device đầy đủ.
- Preview draft lesson trực tiếp từ saved draft data. Unsaved form preview có thể render local form model nhưng phải ghi rõ `Unsaved preview`.
- Preview không mount bất kỳ Cora/AI assistant component nào.

## 15. Publish flow

Click Publish mở validation dialog:

```text
Course validation
✓ Overview complete
✓ 3 instructors configured
✓ 14 lessons ready
✕ Video "Accounts" is still processing
✕ Code exercise "Structs" reference solution fails

[Cancel]                                  [Fix first issue]
```

- Nếu có blocking issue, không có Publish action.
- `Fix first issue` mở đúng panel/lesson/field.
- Instructor list có thể rỗng, nên không phải blocking issue; dialog khi đó hiển thị Corelia attribution.
- Publish success cập nhật header state và toast; không navigate khỏi editor.
- Unpublish cần confirm nhưng không xóa progress.

## 16. Responsive và accessibility

- Admin authoring tối ưu desktop; mobile hỗ trợ quick text edits/reorder nhưng code exercise có desktop recommendation.
- Drag/drop luôn có Move up/down alternative.
- Dialog focus trap, return focus về trigger khi đóng.
- Upload progress có text percentage, không chỉ progress bar.
- Validation summary link/focus tới field lỗi.
- Icon buttons có `aria-label`; destructive actions không dùng màu làm tín hiệu duy nhất.
- Editor keyboard shortcuts không chặn browser shortcuts ngoài vùng editor.

## 17. Component implementation map

Reuse/refactor:

```text
InstructorCourseEdit.tsx
→ tách orchestration và panels; mount dưới admin route trong migration

LessonFormatSelector.tsx
→ thêm code_exercise; remove paid-preview behavior từ consumer

CourseInstructorSection/public components
→ render instructors[] list
```

Target components:

```text
AdminCourseList
AdminCourseEditor
CourseOverviewPanel
CourseInstructorListEditor
CurriculumEditor
LessonEditorShell
VideoLessonEditor
ArticleLessonEditor
QuizLessonEditor
PracticeLessonEditor
CodeExerciseBuilder
CoursePublishDialog
AdminLessonPreview
```

Không tạo một form monolith mới. Mỗi panel nhận typed draft và callback save; course editor orchestration quản lý dirty state/navigation.

## 18. Admin UI acceptance criteria

- Chỉ admin mở được mọi authoring route và mutation.
- Course list/editor không hiển thị owner, co-instructor permissions, pricing hoặc payment fields.
- Instructor list hỗ trợ add/remove/reorder và không thay authorization.
- Video lesson dùng YouTube URL, optional start/end seconds và shared learner preview.
- Course không publish khi YouTube URL hoặc lesson config invalid.
- Curriculum add/edit/reorder hoạt động bằng pointer và keyboard.
- Mọi lesson preview dùng renderer learner và không ghi learner state.
- Unsaved changes, save failure và destructive actions không làm mất content âm thầm.
