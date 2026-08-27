# Code Exercise Implementation Plan

Tài liệu này mở rộng [Learning System](./learning-system.md), [Learner UI](./learner-ui.md) và [Admin UI](./admin-ui.md).

## 1. Product decision

`code_exercise` là công cụ self-practice có phản hồi nhanh. Nó không phải secure assessment, anti-cheat system hoặc bằng chứng rằng learner tự viết code.

Hệ quả:

- Config, tests và reference solution có thể nằm trong lesson data mà client đọc được.
- Validation chạy trong browser.
- Learner kỹ thuật có thể xem đáp án hoặc tự đánh dấu progress; đây không phải threat cần giải quyết trong phase này.
- Không xây backend validator, private test storage hoặc server-side parser.
- Completion/credential chỉ có nghĩa learner đã hoàn thành flow, không phải verified coding skill.

`fill` và `edit` là hai mode của một lesson type:

```ts
type LessonFormat = "video" | "article" | "quiz" | "practice" | "code_exercise";
type CodeExerciseMode = "fill" | "edit";
```

## 2. MVP scope

Include:

- Rust only.
- Một file duy nhất.
- `fill` cho 1–5 blank single-line.
- `edit` cho chỉnh sửa toàn bộ starter source.
- Client-side text validation.
- Reference solution và hints.
- Draft local theo user/lesson/config revision.
- Completion qua `lesson_progress` hiện hữu.
- Một learner renderer và một admin builder.

Defer:

- Tree-sitter và AST validation.
- Rust compilation hoặc Cargo/Anchor execution.
- Runtime tests và arbitrary JavaScript.
- Multi-file exercises.
- Backend validation và anti-cheat.
- Attempts/submissions table.
- Attempt analytics hoặc admin review.
- General rule DSL và custom plugins.

## 3. Storage model

Không cần database migration cho config vì `course_lessons.data` hiện là JSONB. Thêm `code_exercise_config` vào lesson data và TypeScript model.

```ts
interface CodeExerciseFile {
  path: string;            // MVP default: "lib.rs"
  starter_source: string;
}

interface CodeExerciseBlank {
  id: string;
  accepted_answers: string[];
  case_sensitive?: boolean;  // default true
  trim_whitespace?: boolean; // default true
  feedback?: string;
}

type CodeExerciseTest =
  | {
      id: string;
      type: "source_equals";
      description: string;
      accepted_sources: string[];
      required: boolean;
      failure_message?: string;
      hint?: string;
    }
  | {
      id: string;
      type: "contains" | "not_contains";
      description: string;
      value: string;
      required: boolean;
      failure_message?: string;
      hint?: string;
    };

interface BaseCodeExerciseConfig {
  schema_version: 1;
  revision: number;
  mode: CodeExerciseMode;
  language: "rust";
  file: CodeExerciseFile;
  reference_solution: string;
  hints?: string[];
}

interface FillCodeExerciseConfig extends BaseCodeExerciseConfig {
  mode: "fill";
  blanks: CodeExerciseBlank[];
  tests?: CodeExerciseTest[];
}

interface EditCodeExerciseConfig extends BaseCodeExerciseConfig {
  mode: "edit";
  blanks?: never;
  tests: CodeExerciseTest[];
}

type CodeExerciseConfig = FillCodeExerciseConfig | EditCodeExerciseConfig;
```

`CourseLesson`:

```ts
interface CourseLesson {
  // existing fields
  lesson_format?: LessonFormat;
  code_exercise_config?: CodeExerciseConfig;
}

interface CodeExerciseLocaleContent {
  instructions?: string;
  hints?: string[];
  blank_feedback?: Record<string, string>; // keyed by blank ID
  test_copy?: Record<
    string,
    { description?: string; failure_message?: string; hint?: string }
  >; // keyed by test ID
}
```

Default display copy nằm trong primary lesson/config. Locale record chỉ override copy theo stable blank/test IDs; evaluator luôn dùng machine config chung nên đổi locale không thay kết quả validation.

Rules:

- `code_exercise_config` chỉ active khi `lesson_format === "code_exercise"`.
- `revision` tăng mỗi lần admin thay starter source, blanks, tests hoặc reference solution.
- Instruction, title và display feedback có locale override; source code, accepted answers, test values và stable IDs không nhân bản theo locale.
- Giới hạn starter source, reference solution và learner draft ở 64 KiB mỗi field.

## 4. Fill representation

Starter source dùng marker giới hạn:

```rust
fn main() {
    let {{blank:mutable}} counter = 0;
    counter += 1;
}
```

Grammar duy nhất:

```text
{{blank:<id>}}
id = [a-z][a-z0-9_]{0,31}
```

Không hỗ trợ expression, condition, nesting hoặc arbitrary template syntax.

Parser trả về ordered segments:

```ts
type FillSegment =
  | { type: "source"; value: string }
  | { type: "blank"; id: string };
```

Publish validation từ chối:

- Marker malformed hoặc duplicate ID.
- Marker không có blank config hoặc config không có marker.
- Không có blank hoặc có hơn năm blank.
- Accepted answer rỗng hoặc chứa newline.
- Reference solution còn marker chưa resolve.

Learner answers được reconstruct vào source chỉ để hiển thị kết quả và chạy optional text tests. Blank pass/fail trước hết dựa trên `accepted_answers`.

## 5. Validation engine

Pure client module:

```ts
interface CodeExerciseResult {
  passed: boolean;
  results: Array<{
    test_id: string;
    passed: boolean;
    description: string;
    message?: string;
    hint?: string;
  }>;
}

function evaluateCodeExercise(
  config: CodeExerciseConfig,
  input: { answers?: Record<string, string>; source?: string },
): CodeExerciseResult;
```

Normalization cho `source_equals`:

```text
CRLF → LF
remove trailing whitespace per line
remove leading/trailing blank lines
ignore final newline
```

Không collapse whitespace trong dòng, không xóa comments và không format Rust. `contains` và `not_contains` kiểm tra source sau line-ending normalization.

Limitations hiển thị rõ trong admin UI:

- Text rules có thể match comments.
- `source_equals` chỉ phù hợp bài có đáp án hẹp.
- Contains rules có thể bỏ sót implementation tương đương.
- Khi các giới hạn này cản trở course pilot, cân nhắc AST phase; không xây AST trước.

## 6. Editor choice

Repo chưa có code editor dependency. Với `edit`, thêm:

```text
monaco-editor
@monaco-editor/react
```

Constraints:

- Lazy-load chỉ khi mở code exercise learner/admin.
- Chỉ dùng Rust language support cần thiết.
- Monaco không mount trong `fill` mode.
- Có loading skeleton và plain textarea fallback nếu Monaco chunk không load.
- Kiểm tra production chunk size; không import Monaco từ global learning shell.

Nếu bundle integration gây blocker, ship textarea fallback cho pilot trước; data model và engine không đổi.

## 7. Learner flow

```text
Load lesson
→ validate/normalize config
→ restore matching local draft
→ learner fills/edits
→ debounce-save draft
→ Check code / Run tests
→ evaluate in browser
→ show per-test feedback
→ if passed: call existing setLessonProgress
→ refresh progress
→ enable Continue
```

Draft key:

```text
corelia:code-exercise:<userId>:<courseId>:<lessonId>:<revision>
```

```ts
type CodeExerciseDraft =
  | { mode: "fill"; answers: Record<string, string>; updated_at: string }
  | { mode: "edit"; source: string; updated_at: string };
```

Use debounced `localStorage`. Single-file draft ≤ 64 KiB không cần IndexedDB abstraction.

Behavior:

- Revision khác không restore draft cũ.
- Reset confirm nếu draft khác starter state.
- `system_error` không gọi progress mutation.
- Completion upsert phải idempotent.
- Không gửi source hoặc answers lên Supabase.
- `Show solution` hiển thị read-only để không ghi đè draft.

## 8. Admin builder

Admin builder chỉnh public config trong lesson JSONB.

Shared fields:

- Mode, language fixed Rust, file name.
- Starter source, instructions/requirements, hints.
- Reference solution.

Fill mode:

- Admin gõ marker hoặc chọn source range rồi `Make blank`.
- Builder parse markers và render blank-config list.
- Mỗi blank có accepted answers, matching options và feedback.

Edit mode:

- Starter source editor.
- Test list: `source_equals`, `contains`, `not_contains`.
- Add/reorder/delete test.
- Không có AST preset trong MVP.

Actions:

```text
Run starter
Validate solution
Preview
Save lesson
```

Publish readiness:

- Config passes schema và marker validation.
- Starter source và reference solution non-empty.
- Reference solution pass mọi required test.
- Edit có ít nhất một required test.
- Fill có valid blanks; tests optional.

`Run starter` pass toàn bộ là warning, không phải blocker; admin phải confirm trước publish.

## 9. Existing-system integration

Required changes:

1. Extend `LessonFormat` và `CourseLesson` types.
2. Update `getLessonFormat`, publishability, activity classification và counts.
3. Add code icon/label vào curriculum và admin type selector.
4. Add `CodeExerciseLesson` vào shared `LessonRenderer`.
5. Add `CodeExerciseBuilder` vào admin lesson editor.
6. Reuse `setLessonProgress` và course-completion sync sau pass.
7. Add `code_exercise` UI strings vào `vi/en` course namespaces và locale overrides cho author content.

Compatibility:

- Existing lessons không có `lesson_format` giữ fallback hiện tại.
- Không cần data backfill hoặc Supabase migration cho config/attempts.
- Xóa config khỏi lesson đã complete không revoke historical progress.

Target module layout:

```text
src/features/code-exercise/
├── types.ts                 # public config, draft and result types
├── config.ts                # defaults + runtime validation
├── markers.ts               # fill parser + reconstruction
├── evaluate.ts              # pure text runners
├── drafts.ts                # namespaced localStorage adapter
├── CodeExerciseLesson.tsx
├── CodeExerciseFill.tsx
├── CodeExerciseEdit.tsx
├── CodeExerciseResults.tsx
└── admin/
    └── CodeExerciseBuilder.tsx
```

Pure modules không import React, Supabase hoặc Monaco. `CodeExerciseLesson` sở hữu learner state; builder sở hữu author draft; cả hai gọi cùng `config/markers/evaluate` modules. Không đặt engine logic trở lại `Learn.tsx` hoặc `InstructorCourseEdit.tsx`.

## 10. Implementation phases

### CE-1 — Types and pure engine

- Add config/result types và runtime config validator.
- Implement marker parser, source reconstruction và normalization.
- Implement fill matching và three text runners.
- Unit-test pure functions trước UI.

Exit gate:

```text
valid/invalid config fixtures pass
marker edge cases pass
normalization behavior locked
reference-solution evaluation deterministic
```

### CE-2 — Learner renderer

- Register format trong helpers và renderer.
- Build fill UI không dùng Monaco.
- Add lazy Monaco edit UI và textarea fallback.
- Add result panel, hints, reset/show-solution và local drafts.
- On pass, reuse current progress/navigation.

Exit gate:

```text
fill/edit complete end-to-end from fixtures
same-revision draft restores
new revision ignores stale draft
failed/system-error never completes lesson
responsive UI matches learner spec
```

### CE-3 — Admin builder

- Add Code vào type selector.
- Implement fill/edit forms dùng chung runtime validator và engine.
- Implement reference-solution validation và learner preview.
- Persist qua existing course lesson JSONB update path.

Exit gate:

```text
malformed config cannot save
failing reference solution cannot publish
save/reload preserves shape
preview and learner return identical result
non-admin mutation remains denied
```

### CE-4 — Integration and pilot

- Add pilot content: 2 fill + 2 edit exercises.
- Run build, design check, unit/integration tests và responsive QA.
- Chỉ emit `code_exercise_checked` nếu app đã có event sink phù hợp; không tạo analytics subsystem.
- Collect false-pass/false-fail và authoring friction trước khi quyết định AST.

Exit gate:

```text
no regression to article/video/quiz/practice
production bundle lazy-loads Monaco
course progress/completion correct
admin authors without raw JSON
text-rule limitations acceptable for pilot
```

## 11. Test matrix

Pure engine:

- Marker start/end, adjacent, duplicate và malformed.
- Empty, Unicode và whitespace-sensitive answers.
- CRLF/LF, trailing spaces, final newline normalization.
- Runner pass/fail và required/optional behavior.
- Reconstruction preserves surrounding source.

Learner:

- Initial, checking, failed, passed, system-error.
- Keyboard blanks và `Cmd/Ctrl+Enter` edit.
- Reset/show-solution behavior.
- Draft isolation theo user/course/lesson/revision.
- Pass writes canonical progress và enables Continue.
- Preview không ghi draft/progress.

Admin:

- Mode fields và safe mode switching.
- Validation focus đúng field.
- Reference solution pass required tests.
- JSONB save/reload round trip.
- Locale switch không đổi source/tests.

Regression:

- Existing format resolution và curriculum counts/icons.
- Next-lesson/course-completion calculation.
- Mobile shell không có learner AI hoặc paid-access branches.

## 12. Acceptance criteria

- Code exercise chạy self-practice hoàn toàn trong browser.
- Không thêm backend function, attempt table hoặc private test store.
- Một public config dùng cho learner, preview và authoring validation.
- Fill/edit share một lesson type, result model và completion flow.
- Admin không chỉnh raw JSON; reference solution phải pass trước publish.
- Docs/UI không claim secure assessment hoặc verified skill.
- Monaco lazy-load và có fallback.
- Existing learning formats, progress và completion không regression.

## 13. Future trigger for AST

Tree-sitter/AST không phải scheduled phase. Chỉ xem xét khi pilot có lặp lại các trường hợp:

- Nhiều Rust implementation hợp lệ không thể biểu diễn hợp lý bằng accepted sources.
- Text rules tạo false positive đáng kể từ comments.
- Authors thường xuyên phải liệt kê quá nhiều accepted sources hoặc contains rules.
- Learner feedback cần syntax location mà text rules không cung cấp.

Nếu được trigger, chỉ thiết kế Rust presets cần cho các exercise thật. Không bắt đầu bằng generic AST DSL hoặc multi-language adapters.

## 14. Research basis

- [Using Adaptive Parsons Problems to Scaffold Write-Code Problems (ACM ICER 2022)](https://doi.org/10.1145/3501385.3543977) supports constrained scaffolds trước khi learner viết code rộng hơn.
- [Tree-sitter introduction](https://tree-sitter.github.io/tree-sitter/index.html) được giữ làm future reference, không phải MVP dependency.
