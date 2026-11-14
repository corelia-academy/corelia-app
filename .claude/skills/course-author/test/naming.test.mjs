// .claude/skills/course-author/test/naming.test.mjs
// Test các ràng buộc tất định về quy tắc đặt tên module và lesson (N-01 đến N-05)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import {
  lintCurriculumData,
  MAX_MODULE_TITLE_CHARS,
  MAX_LESSON_TITLE_CHARS,
  LABEL_COLON_REGEX,
  loadForbiddenPrefixes,
} from "../scripts/curriculum-lint.mjs";

const rootDir = path.resolve(".");
const fixtureDir = path.join(rootDir, ".claude/skills/course-author/test/fixtures/naming-negative");

function loadFixtureCurriculum() {
  const filePath = path.join(fixtureDir, "curriculum.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("N-02: Fixture naming-negative phát hiện đúng các vi phạm cụ thể của khóa thật", () => {
  const curr = loadFixtureCurriculum();
  const problems = lintCurriculumData(curr, { videos: [] });

  // 1. Mọi module đều vượt MAX_MODULE_TITLE_CHARS = 50
  for (const modId of ["M1", "M2", "M3", "M4"]) {
    const hasModLen = problems.some(
      (p) => p.startsWith(`${modId}: độ-dài-tiêu-đề`) && p.includes("tối đa 50")
    );
    assert.ok(hasModLen, `Module ${modId} phải bị báo lỗi độ-dài-tiêu-đề (> 50)`);
  }

  // 2. L1-4 "Tình huống trắc nghiệm: ..."
  assert.ok(
    problems.some((p) => p.startsWith("L1-4: nhãn-hai-chấm")),
    "L1-4 phải có lỗi nhãn-hai-chấm"
  );
  assert.ok(
    problems.some((p) => p.startsWith("L1-4: tiền-tố-bị-cấm")),
    "L1-4 phải có lỗi tiền-tố-bị-cấm"
  );

  // 3. L2-4 "Trắc nghiệm đánh giá: ..."
  assert.ok(
    problems.some((p) => p.startsWith("L2-4: nhãn-hai-chấm")),
    "L2-4 phải có lỗi nhãn-hai-chấm"
  );
  assert.ok(
    problems.some((p) => p.startsWith("L2-4: tiền-tố-bị-cấm")),
    "L2-4 phải có lỗi tiền-tố-bị-cấm"
  );

  // 4. L4-3 "Tự kiểm tổng hợp: ..."
  assert.ok(
    problems.some((p) => p.startsWith("L4-3: nhãn-hai-chấm")),
    "L4-3 phải có lỗi nhãn-hai-chấm"
  );
  assert.ok(
    problems.some((p) => p.startsWith("L4-3: tiền-tố-bị-cấm")),
    "L4-3 phải có lỗi tiền-tố-bị-cấm"
  );

  // 5. L3-2 "Điền modifier onlyOwner..." (74-75 ký tự, vượt trần 60)
  assert.ok(
    problems.some((p) => p.startsWith("L3-2: độ-dài-tiêu-đề") && p.includes("tối đa 60")),
    "L3-2 phải có lỗi độ-dài-tiêu-đề (> 60)"
  );

  // 6. L3-1 "Bẫy Phishing SWC-115: Tại sao..." (nhãn rồi dấu hai chấm)
  assert.ok(
    problems.some((p) => p.startsWith("L3-1: nhãn-hai-chấm")),
    "L3-1 phải có lỗi nhãn-hai-chấm"
  );
});

test("N-03: loadForbiddenPrefixes đọc đúng formats từ src/locales/vi/courses.json và ném lỗi khi thiếu file", () => {
  const prefixes = loadForbiddenPrefixes();
  // Khóa thật từ courses.json
  assert.ok(prefixes.includes("Bài đọc"));
  assert.ok(prefixes.includes("Video"));
  assert.ok(prefixes.includes("Trắc nghiệm"));
  assert.ok(prefixes.includes("Thực hành"));
  assert.ok(prefixes.includes("Bài tập code"));
  // Cộng thêm theo đặc tả
  assert.ok(prefixes.includes("Quiz"));
  assert.ok(prefixes.includes("Bài kiểm tra"));
  assert.ok(prefixes.includes("Tự kiểm"));
  assert.ok(prefixes.includes("Tình huống"));

  // Không đọc được file phải ném lỗi rõ ràng, không dùng fallback ghi tay
  assert.throws(
    () => loadForbiddenPrefixes("path/khong/ton/tai.json"),
    /Không đọc được file locales/
  );
});

test("N-03: Kiểm tra mẫu nhãn rồi dấu hai chấm ở đầu tên (^[^:]{1,40}:\\s)", () => {
  // Test từ chối
  for (const badTitle of [
    "Trắc nghiệm đánh giá: So sánh CEI",
    "Bẫy Phishing SWC-115: Tại sao tx.origin lừa được",
    "Tình huống: tx.origin",
    "Lý thuyết cốt lõi: Khái niệm EVM",
  ]) {
    assert.ok(LABEL_COLON_REGEX.test(badTitle), `Mẫu "${badTitle}" phải khớp LABEL_COLON_REGEX`);
  }

  // Test chấp nhận
  for (const goodTitle of [
    "Vá lỗ hổng rút tiền bằng thứ tự kiểm–cập nhật–gọi",
    "Dùng ReentrancyGuard chặn gọi lại chéo hàm",
    "Storage, Calldata & Memory",
  ]) {
    assert.ok(!LABEL_COLON_REGEX.test(goodTitle), `Tiêu đề chuẩn "${goodTitle}" không được khớp LABEL_COLON_REGEX`);
  }
});

test("N-03: Tiền tố bị cấm khớp ở đầu tên không cần dấu hai chấm theo sau", () => {
  const curr = loadFixtureCurriculum();

  // Test từ chối: không cần dấu hai chấm vẫn bị bắt
  const rejectedTitles = [
    "Quiz tổng hợp",
    "Trắc nghiệm đánh giá: So sánh CEI",
    "Tình huống: tx.origin",
    "Bài kiểm tra cuối module",
    "Tự kiểm kiến thức an toàn",
    "Video hướng dẫn cấu hình",
  ];

  for (const bad of rejectedTitles) {
    curr.modules[0].lessons[0].title = bad;
    const problems = lintCurriculumData(curr, { videos: [] });
    const hasForbidden = problems.some(
      (p) => p.includes("L1-1") && p.includes("tiền-tố-bị-cấm")
    );
    assert.ok(hasForbidden, `Tiêu đề "${bad}" phải bị báo lỗi tiền-tố-bị-cấm`);
  }

  // Test chấp nhận
  const acceptedTitles = [
    "Vá lỗ hổng rút tiền bằng thứ tự kiểm–cập nhật–gọi",
    "Dùng ReentrancyGuard chặn gọi lại chéo hàm",
    "Storage, Calldata & Memory",
  ];
  for (const good of acceptedTitles) {
    curr.modules[0].lessons[0].title = good;
    const problems = lintCurriculumData(curr, { videos: [] });
    const hasForbidden = problems.some(
      (p) => p.includes("L1-1") && p.includes("tiền-tố-bị-cấm")
    );
    assert.ok(!hasForbidden, `Tiêu đề chuẩn "${good}" không được bị báo lỗi tiền-tố-bị-cấm`);
  }
});

test("N-04: Trần độ dài module (50) và lesson (60)", () => {
  assert.strictEqual(MAX_MODULE_TITLE_CHARS, 50, "MAX_MODULE_TITLE_CHARS phải là 50");
  assert.strictEqual(MAX_LESSON_TITLE_CHARS, 60, "MAX_LESSON_TITLE_CHARS phải là 60");

  const curr = loadFixtureCurriculum();
  curr.modules[0].title = "A".repeat(51);
  curr.modules[0].lessons[0].title = "B".repeat(61);

  const problems = lintCurriculumData(curr, { videos: [] });
  assert.ok(problems.some((p) => p.includes("M1") && p.includes("độ-dài-tiêu-đề") && p.includes("tối đa 50")));
  assert.ok(problems.some((p) => p.includes("L1-1") && p.includes("độ-dài-tiêu-đề") && p.includes("tối đa 60")));
});

test("N-01: Lint từ chối module title có tiền tố đánh số (Module 1, Chương 2, 1.)", () => {
  for (const prefix of ["Module 1: ", "Chương 2 - ", "Phần 3: ", "1. "]) {
    const curr = loadFixtureCurriculum();
    curr.modules[0].title = prefix + "Khái niệm Reentrancy";
    const problems = lintCurriculumData(curr, { videos: [] });
    const p = problems.find((x) => x.includes("M1") && x.includes("đánh-số-tiêu-đề"));
    assert.ok(p, `Tiền tố "${prefix}" phải bị báo lỗi đánh-số-tiêu-đề`);
  }
});

test("N-01: Lint từ chối lesson title có tiền tố đánh số (Bài 1, Lesson 2, L1-1, 1.1)", () => {
  for (const prefix of ["Bài 1: ", "Lesson 2 - ", "L1-1: ", "1.1. "]) {
    const curr = loadFixtureCurriculum();
    curr.modules[0].lessons[0].title = prefix + "Cơ chế EVM và bẫy Reentrancy";
    const problems = lintCurriculumData(curr, { videos: [] });
    const p = problems.find((x) => x.includes("L1-1") && x.includes("đánh-số-tiêu-đề"));
    assert.ok(p, `Tiền tố "${prefix}" phải bị báo lỗi đánh-số-tiêu-đề`);
  }
});

test("N-01: Lint từ chối lesson title có mẫu nhãn trong ngoặc vuông ([Video], [Lý thuyết])", () => {
  for (const tag of ["[Video] ", "[Lý thuyết]: ", "[Thực hành] "]) {
    const curr = loadFixtureCurriculum();
    curr.modules[0].lessons[0].title = tag + "Luồng trao quyền EVM và cơ chế tấn công";
    const problems = lintCurriculumData(curr, { videos: [] });
    const p = problems.find((x) => x.includes("L1-1") && x.includes("nhãn-tiêu-đề"));
    assert.ok(p, `Mẫu nhãn "${tag}" phải bị báo lỗi nhãn-tiêu-đề`);
  }
});

test("N-01: Lint từ chối hai module trùng tên trong khóa", () => {
  const curr = loadFixtureCurriculum();
  curr.modules[1].title = curr.modules[0].title;
  const problems = lintCurriculumData(curr, { videos: [] });
  const p = problems.find((x) => x.includes("M2") && x.includes("trùng-tiêu-đề"));
  assert.ok(p, "Phải báo lỗi trùng tiêu đề module");
});

test("N-01: Lint từ chối hai lesson trùng tên trong khóa", () => {
  const curr = loadFixtureCurriculum();
  curr.modules[0].lessons[1].title = curr.modules[0].lessons[0].title;
  const problems = lintCurriculumData(curr, { videos: [] });
  const p = problems.find((x) => x.includes("L1-2") && x.includes("trùng-tiêu-đề"));
  assert.ok(p, "Phải báo lỗi trùng tiêu đề lesson");
});

test("N-01: lesson-lint báo lỗi khi tên lesson trong file lesson không khớp curriculum", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-lint-naming-"));
  try {
    const lessonsDir = path.join(tmpDir, "lessons");
    fs.mkdirSync(lessonsDir, { recursive: true });

    const curriculum = {
      modules: [
        {
          module_id: "M1",
          title: "Module thử nghiệm",
          lessons: [
            { lesson_id: "L1-1", title: "Tiêu đề chuẩn trong curriculum", type: "article", target_minutes: 5 },
          ],
        },
      ],
    };
    fs.writeFileSync(path.join(tmpDir, "curriculum.json"), JSON.stringify(curriculum, null, 2));

    const lessonContent = {
      lesson_id: "L1-1",
      title: "Tiêu đề bị sửa khác curriculum",
      article: { description_markdown: "Nội dung bài học hợp lệ." },
    };
    fs.writeFileSync(path.join(lessonsDir, "L1-1.json"), JSON.stringify(lessonContent, null, 2));

    const scriptPath = path.join(rootDir, ".claude/skills/course-author/scripts/lesson-lint.mjs");
    try {
      execSync(`node ${scriptPath} ${tmpDir} L1-1`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
      assert.fail("lesson-lint phải thoát lỗi khi tiêu đề không khớp");
    } catch (err) {
      const output = err.stdout?.toString() ?? "";
      assert.ok(
        output.includes("khớp-tiêu-đề"),
        "Phải báo lỗi khớp-tiêu-đề trong output: " + output
      );
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
