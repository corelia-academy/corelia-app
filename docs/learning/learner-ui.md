# Learner UI Implementation Spec

Tài liệu này định nghĩa UI target cho `/learn/:courseId` và `/learn/:courseId/lesson/:lessonId`. Product rules và data ownership nằm tại [Learning System](./learning-system.md).

## 1. Design constraints

- Tuân thủ [Corelia Design System](../DESIGN.md); không tạo palette, radius hoặc typography riêng.
- Một viewport chỉ có một primary CTA.
- Mọi course đã publish đều miễn phí; không hiển thị lock, price, purchase hoặc preview badge.
- Desktop ưu tiên học tập tập trung; mobile ưu tiên article/video/quiz/practice, không cố biến code editor thành IDE đầy đủ.
- Không có AI assistant, chat panel hoặc explain-selection action trong learning shell.

## 2. Routes và selection

```text
/learn/:courseId
→ redirect/replace tới next incomplete lesson
→ nếu đã complete: lesson đầu tiên hoặc completion summary

/learn/:courseId/lesson/:lessonId
→ render lesson nếu thuộc course và đã publish
→ nếu invalid/unpublished: replace tới first available lesson + toast
```

URL là canonical selection. Không giữ một `selectedLessonId` độc lập có thể lệch URL.

## 3. Desktop shell

Áp dụng từ `xl` (`1280px`) trở lên:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Courses   Course title · Section title       7/18 complete   Help/Profile│ 56
├──────────────────────┬─────────────────────────────────────────────────────┤
│ CURRICULUM           │ LESSON WORKSPACE                                    │
│ 260–360px            │ min 560px                                           │
│                      │                                                     │
│ Section 1            │ Lesson header                                       │
│ ✓ Article            │ Lesson renderer                                     │
│ → Quiz               │                                                     │
│ ○ Practice           │                                                     │
│                      │                                                     │
├──────────────────────┴─────────────────────────────────────────────────────┤
│ Previous          Lesson 5 of 18               Complete / Check / Submit   │ 64
└────────────────────────────────────────────────────────────────────────────┘
```

- Root dùng `h-dvh overflow-hidden`.
- Header và footer không scroll.
- Curriculum và lesson workspace tự scroll độc lập.
- Curriculum dùng resizable panel hiện hữu; min/max ở trên là behavior guideline, không hardcode pixel lẻ ngoài component constraints.
- Khi curriculum đóng, lesson workspace chiếm toàn bộ phần còn lại; không để cột trống.
- Footer sticky thuộc lesson workspace, không phủ curriculum.

## 4. Tablet và mobile shell

### Tablet `md–lg`

```text
┌──────────────────────────────────────────────┐
│ ☰  Course title                              │
├──────────────────────────────────────────────┤
│ Lesson workspace                             │
│                                              │
├──────────────────────────────────────────────┤
│ Previous                  Primary action     │
└──────────────────────────────────────────────┘
```

- Curriculum mở bằng left `Sheet`.

### Mobile `< md`

```text
┌──────────────────────────────┐
│ ←  Lesson title          ☰  │ 56
│ ███████░░  7/18             │
├──────────────────────────────┤
│ Lesson renderer              │
│ single scroll                │
│                              │
├──────────────────────────────┤
│ Previous      Primary action │ sticky, safe-area
└──────────────────────────────┘
```

- Touch target tối thiểu 44×44px.
- Footer dùng `padding-bottom: env(safe-area-inset-bottom)`.
- Lesson title một dòng, ellipsis; course title nằm trong curriculum sheet.
- Code edit dùng tabs `Task | Code | Tests`; hiển thị notice “Recommended on desktop”.

## 5. Header

Desktop:

- Back link về `/courses`.
- Course title, separator, current section title.
- Progress text `completed/total` và progress bar nhỏ.
- Curriculum toggle khi panel collapsed.
- Help và avatar/profile.

Mobile:

- Back về course detail.
- Lesson title.
- Curriculum icon button có `aria-label` và active state.
- Progress nằm ở dòng thứ hai.

Không hiển thị XP, leaderboard, token balance, payment status hoặc instructor controls.

## 6. Curriculum panel

Header:

```text
Course content                         39%
████████░░░░
7 of 18 lessons complete
```

Section:

```text
▾ SECTION 2 · RUST BASICS                  2/5
  ✓ Variables                              Article
  → Mutable variables                      Code
  ○ Structs                                Code
  ○ Ownership                              Quiz
```

Rules:

- Section expanded by default nếu chứa current lesson; các section khác giữ trạng thái local trong session.
- Lesson row có icon format, title, optional duration nếu > 0, completion icon và active left border.
- Không có locked state vì course miễn phí.
- Click row điều hướng URL; trên mobile đóng sheet sau navigation.
- Current lesson dùng `border-l-brand-accent bg-primary-muted` theo design system.
- Empty state có CTA quay về course detail; loading dùng skeleton cùng chiều cao row.

## 7. Lesson workspace chung

Lesson header:

```text
[Format badge] [Completed]
Lesson title
Short description
```

- Max content width `max-w-4xl` cho article/quiz/practice; video có thể `max-w-5xl`; code exercise dùng toàn width.
- Workspace padding `px-4 sm:px-6`, vertical gap theo design system.
- Resources luôn nằm sau renderer, trong một card chung.
- Completion feedback xuất hiện ngay trên footer, không thay toàn bộ lesson bằng success screen.

Renderer contract:

```ts
interface LessonRendererProps {
  courseId: string;
  lesson: NormalizedLesson;
  progress: LessonProgressState;
  mode: "learner" | "preview";
  onCompletionChanged(): void;
}
```

Preview mode không ghi progress, attempts hoặc drafts của learner và có banner `ADMIN PREVIEW`.

## 8. Article lesson

```text
┌──────────────────────────────────────────────┐
│ Markdown content                             │
│ headings, paragraphs, lists, code, images    │
│                                              │
└──────────────────────────────────────────────┘
┌ Resources ──────────────────────────────────┐
│ ↗ Documentation title                       │
└──────────────────────────────────────────────┘
```

- Dùng `Markdown` và `SelectableLessonContent` hiện hữu.
- Body `text-[15px] leading-[1.7]`, card `rounded-2xl`.
- Primary footer action: `Complete & Continue`; nếu complete: `Next lesson`.
- Không auto-complete theo scroll depth.

## 9. Video lesson

```text
┌──────────────────────────────────────────────┐
│ 16:9 YouTube iframe                          │
│                                              │
└──────────────────────────────────────────────┘
┌ Notes / description ────────────────────────┐
│ Markdown                                     │
└──────────────────────────────────────────────┘
```

- YouTube dùng URL normalized hiện hữu và optional start/end.
- Player error hiển thị retry và fallback message, không đánh dấu lesson failed.
- Primary footer action: `Complete & Continue`; watch time chỉ telemetry.
- Không autoplay audio trên mobile. Desktop chỉ giữ autoplay nếu product chủ động bật; mặc định target là không autoplay.

## 10. Quiz lesson

MVP single-choice, một câu mỗi card hoặc danh sách ngắn trong cùng card. Giữ danh sách hiện tại cho quiz ≤ 10 câu; không làm pagination engine trong MVP.

Before submit:

```text
Quiz · 5 questions

1. Question text
○ Option A
● Option B
○ Option C

                         Check answers
```

After submit:

```text
4/5 · 80% · Passed
✓ Correct option
✕ Selected wrong option
Explanation...

Retry                         Continue
```

- Disable primary action đến khi tất cả câu đã trả lời.
- `submitting` khóa options và hiện spinner trong button.
- Pass gọi trusted completion flow; fail không complete lesson.
- Retry reset selection nhưng giữ attempt history server-side.
- Error khi save giữ selection để learner thử lại.
- Chỉ một primary CTA: trước result là `Check answers`; sau pass là `Continue`; sau fail là `Try again`.

## 11. Practice lesson

### Instruction

- Render Markdown và resources.
- Footer `Complete & Continue`.

### Checklist

```text
Project step
Instructions...

□ Install the tool
□ Create the project
□ Run the first command

3 of 3 complete                       Complete step
```

- Checklist state lưu draft local/server tùy implementation phase; không tạo `lesson_progress` cho từng item.
- Primary completion chỉ enabled khi mọi item checked.

### Submission

```text
Submission
[ Text / URL textarea                     ]
[ Attach file ]

                                  Submit for review
```

- Chỉ hiển thị khi course thật sự cần review.
- States: draft, submitting, pending, approved, changes_requested.
- Approved mới complete nếu `requires_review = true`.
- Final project course-level tiếp tục dùng `FinalAssignmentPanel`, không render trùng trong lesson.

## 12. Code exercise lesson

Chi tiết validation/model tại [Code Exercise](./code-exercise.md). UI target:

### Fill

```text
┌ Task ────────────────────────────────────────┐
│ Complete the missing keyword...             │
├──────────────────────────────────────────────┤
│ fn main() {                                  │
│   let [____] counter = 0;                    │
│ }                                            │
├──────────────────────────────────────────────┤
│ Hint                           Check code    │
└──────────────────────────────────────────────┘
```

- Inline inputs follow source order and preserve monospace alignment.
- Enter ở blank cuối chạy check; Shift+Enter không có behavior đặc biệt.
- Error gắn với blank khi exact-answer fail; structural fail hiển thị trong Test Results.

### Edit desktop

```text
┌ Task 28% ───────┬ Editor 47% ─────────┬ Tests 25% ─────┐
│ Instructions    │ lib.rs              │ ○ Struct exists │
│ Requirements    │ source              │ ○ Field uses u64│
│ Hint            │                     │                 │
├─────────────────┴─────────────────────┴─────────────────┤
│ Reset                         Draft saved   Run tests   │
└─────────────────────────────────────────────────────────┘
```

- Panels resizable nhưng có sensible minimum; reset layout action trong overflow menu.
- MVP single file nên không có file tree; chỉ file name label.
- Tests giữ thứ tự authoring, required trước optional.
- Failed test mở detail message và hint.
- `Ctrl/Cmd+Enter` chạy tests; `Ctrl/Cmd+S` lưu draft local và không trigger browser save.
- Pass đổi primary action thành `Continue` nhưng vẫn cho xem code/tests.

## 13. Footer và navigation state machine

Footer luôn có:

```text
[Previous]      Lesson n of total      [Primary action]
```

Primary action:

| Format/state | Action |
|---|---|
| Article/video/practice instruction, incomplete | Complete & Continue |
| Quiz ready | Check answers |
| Quiz failed | Try again |
| Code ready/failed | Check code / Run tests |
| Checklist incomplete | Complete disabled |
| Submission draft | Submit for review |
| Guided project steps incomplete | Complete disabled |
| Guided project artifacts missing/invalid | Review required fields |
| Guided project ready, no review | Complete project |
| Guided project ready, review required | Submit project |
| Completed | Next lesson |
| Last lesson + course eligible | Finish course |

- Previous không thay completion.
- Next chỉ xuất hiện như primary sau khi current lesson complete, trừ content lessons nơi `Complete & Continue` thực hiện cả hai thao tác tuần tự.
- Mutation success cập nhật progress trước, sau đó navigate; mutation failure không navigate.
- Double click không tạo duplicate attempt/completion.

## 14. Loading, empty và error states

| Case | UI |
|---|---|
| Course loading | Shell skeleton: header, curriculum rows, content card |
| Lesson loading | Giữ shell, skeleton lesson workspace |
| Course not found/unpublished | Full-page error + Back to courses |
| Empty curriculum | Empty state + Back to course |
| Renderer config invalid | `Lesson unavailable` + report reference; không có Complete |
| Network progress error | Inline retry above footer; giữ learner work |
| YouTube playback error | Player-local retry; content còn lại vẫn đọc được |
| Attempt system error | Test/quiz panel error; không tính failed attempt |

## 15. Component implementation map

Reuse/refactor:

```text
src/pages/learn/Learn.tsx
→ orchestration only: load, route selection, access-free enrollment, completion sync

LearnLayout.tsx
→ h-dvh shell; không mount learner AI assistant hoặc explain-selection UI

LessonPlayerCard.tsx
→ split into LessonWorkspace + LessonRenderer + LessonFooter

LessonCurriculum.tsx
→ remove hasFullCourseAccess/lock/preview branches

LessonQuiz.tsx
→ retain UI, move scoring/completion trust to server

LessonPractice.tsx
→ add mode-specific body
```

New target components:

```text
LessonWorkspace
LessonRenderer
ArticleLesson
VideoLesson
PracticeLesson
CodeExerciseLesson
LessonFooter
LessonStatusNotice
MobileLearningHeader
```

Do not create a component per success/error state; use shared state primitives.

## 16. UI acceptance criteria

- Desktop renders curriculum và lesson workspace without page-level double scroll.
- Closing curriculum expands lesson workspace.
- Mobile curriculum sheet và mọi touch target đáp ứng 44px.
- Learning routes không mount, render hoặc dành layout space cho learner AI assistant.
- No paid/locked/preview UI remains in learning routes.
- All five lesson formats render through one `LessonRenderer`.
- Footer exposes exactly one primary CTA appropriate to lesson state.
- Preview uses the same renderer and cannot write progress/attempts.
- Existing article/video/quiz/practice remain visually functional during refactor.
- Light/dark modes use design tokens and meet visible focus requirements.
