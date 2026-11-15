import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { lintCurriculumData, lintCurriculum } from "../scripts/curriculum-lint.mjs";

function getBaseCurriculum() {
  return {
    modules: [
      {
        module_id: "M1",
        title: "Dự đoán Account bị Khóa",
        model_ref: "Mô hình Account Ownership và Mutability: chỉ một transaction ghi vào account tại một thời điểm",
        mental_model: "Mô hình Account Ownership và Mutability: chỉ một transaction ghi vào account tại một thời điểm",
        lessons: [
          {
            lesson_id: "L1-1",
            title: "Mô hình Account song song",
            type: "article",
            purpose: "explanation",
          },
          {
            lesson_id: "L1-2",
            title: "Kiểm tra quyền ghi",
            type: "code_exercise",
            purpose: "supported_practice",
            reinforces: "Củng cố mô hình ghi song song: chỉ định account readonly để tránh khóa giao dịch",
          },
        ],
      },
    ],
    no_video_reason: "Khóa học tập trung vào lập luận mô hình tư duy và code củng cố",
    unused_primary_videos: [],
  };
}

function getBaseBrief() {
  return {
    title_en: "Solana Mental Models",
    slug: "solana-mental-models",
    mental_models: [
      "Mô hình Account Ownership và Mutability: chỉ một transaction ghi vào account tại một thời điểm",
    ],
    reasoning_outcomes: [
      "Dự đoán đúng các giao dịch bị xung đột khóa account khi chạy song song",
    ],
    misconceptions: [
      "Nghĩ rằng mọi account đều có thể ghi đồng thời mà không bị khóa",
    ],
  };
}

test("A-08 / V-11: module thiếu model_ref khi brief.mental_models có giá trị -> lỗi", () => {
  const curr = getBaseCurriculum();
  delete curr.modules[0].model_ref;
  const brief = getBaseBrief();

  const problems = lintCurriculumData(curr, null, { brief });
  assert.ok(
    problems.some((p) => p.includes("M1: thiếu-model-ref: module thiếu trường model_ref")),
    "Phải bắt lỗi module thiếu model_ref: " + problems.join("; ")
  );
});

test("A-08 / V-11: module có model_ref viết sai chính tả / không khớp brief.mental_models -> lỗi", () => {
  const curr = getBaseCurriculum();
  curr.modules[0].model_ref = "Mô hình Account Ownership"; // thiếu phần sau
  const brief = getBaseBrief();

  const problems = lintCurriculumData(curr, null, { brief });
  assert.ok(
    problems.some((p) => p.includes('M1: model-ref-không-hợp-lệ: model_ref "Mô hình Account Ownership" không khớp mục nào trong brief.mental_models')),
    "Phải bắt lỗi module có model_ref không hợp lệ: " + problems.join("; ")
  );
});

test("A-08: module thiếu mental_model khi brief.mental_models có giá trị -> lỗi", () => {
  const curr = getBaseCurriculum();
  delete curr.modules[0].mental_model;
  const brief = getBaseBrief();

  const problems = lintCurriculumData(curr, null, { brief });
  assert.ok(
    problems.some((p) => p.includes("M1: thiếu-mental-model: module thiếu mental_model")),
    "Phải bắt lỗi module thiếu mental_model: " + problems.join("; ")
  );
});

test("A-08: code_exercise thiếu reinforces khi brief.mental_models có giá trị -> lỗi", () => {
  const curr = getBaseCurriculum();
  delete curr.modules[0].lessons[1].reinforces;
  const brief = getBaseBrief();

  const problems = lintCurriculumData(curr, null, { brief });
  assert.ok(
    problems.some((p) => p.includes("L1-2: thiếu-reinforces: bài code_exercise thiếu trường reinforces")),
    "Phải bắt lỗi bài code_exercise thiếu reinforces: " + problems.join("; ")
  );
});

test("A-08 / V-11: một mục trong brief.mental_models không có module nào trỏ tới qua model_ref -> lỗi", () => {
  const curr = getBaseCurriculum();
  const brief = getBaseBrief();
  brief.mental_models.push("Mô hình Rent Exemption: tài khoản duy trì số dư lamports tối thiểu để không bị purge");

  const problems = lintCurriculumData(curr, null, { brief });
  assert.ok(
    problems.some((p) =>
      p.includes('mô hình tư duy "Mô hình Rent Exemption: tài khoản duy trì số dư lamports tối thiểu để không bị purge" trong brief.mental_models không có module nào dạy')
    ),
    "Phải bắt lỗi mô hình chưa được dạy: " + problems.join("; ")
  );
});

test("A-08 / V-11: mental_model viết ngắn/câu con nhưng model_ref khớp chính xác -> pass (không dùng substring matching)", () => {
  const curr = getBaseCurriculum();
  // mental_model là câu con ngắn gọn
  curr.modules[0].mental_model = "Khóa ghi Account song song";
  const brief = getBaseBrief();

  const problems = lintCurriculumData(curr, null, { brief });
  assert.strictEqual(problems.length, 0, "mental_model câu con tự do phải pass khi model_ref khớp: " + problems.join("; "));
});

test("A-08 / V-11: mental_model chứa đúng câu nhưng model_ref thiếu/sai -> fail (bỏ substring matching)", () => {
  const curr = getBaseCurriculum();
  curr.modules[0].mental_model = getBaseBrief().mental_models[0];
  delete curr.modules[0].model_ref; // Xóa model_ref
  const brief = getBaseBrief();

  const problems = lintCurriculumData(curr, null, { brief });
  assert.ok(
    problems.some((p) => p.includes("thiếu-model-ref")),
    "Dù mental_model chứa chuỗi thì vẫn phải bắt lỗi thiếu model_ref: " + problems.join("; ")
  );
});

test("A-08: khóa không có mental_models (hoặc brief không có mental_models) -> không áp rule mới", () => {
  const curr = getBaseCurriculum();
  delete curr.modules[0].model_ref;
  delete curr.modules[0].mental_model;
  delete curr.modules[0].lessons[1].reinforces;

  // 1. brief không có mental_models
  const briefWithoutMM = {
    title_en: "Legacy Course",
    slug: "legacy-course",
  };
  let problems = lintCurriculumData(curr, null, { brief: briefWithoutMM });
  assert.strictEqual(
    problems.some((p) => p.includes("thiếu-model-ref") || p.includes("thiếu-mental-model") || p.includes("thiếu-reinforces") || p.includes("mô-hình-chưa-dạy")),
    false,
    "Khóa cũ không có mental_models không được áp rule mới: " + problems.join("; ")
  );

  // 2. brief = null / undefined
  problems = lintCurriculumData(curr, null);
  assert.strictEqual(
    problems.some((p) => p.includes("thiếu-model-ref") || p.includes("thiếu-mental-model") || p.includes("thiếu-reinforces") || p.includes("mô-hình-chưa-dạy")),
    false,
    "Khóa không có brief không được áp rule mới"
  );

  // 3. mental_models là mảng rỗng
  problems = lintCurriculumData(curr, null, { brief: { mental_models: [] } });
  assert.strictEqual(
    problems.some((p) => p.includes("thiếu-model-ref") || p.includes("thiếu-mental-model") || p.includes("thiếu-reinforces") || p.includes("mô-hình-chưa-dạy")),
    false,
    "Khóa có mental_models rỗng không được áp rule mới"
  );
});

test("A-08 / V-10: frame.md vắng khi các bài code không dùng chung đoạn code -> không lỗi curriculum-lint", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "no-frame-test-"));
  try {
    const curr = getBaseCurriculum();
    const brief = getBaseBrief();
    brief.code_language = "rust";

    fs.writeFileSync(path.join(tmpDir, "curriculum.json"), JSON.stringify(curr, null, 2), "utf8");
    fs.writeFileSync(path.join(tmpDir, "brief.json"), JSON.stringify(brief, null, 2), "utf8");

    assert.strictEqual(fs.existsSync(path.join(tmpDir, "frame.md")), false, "frame.md phải vắng mặt");

    const problems = lintCurriculum(tmpDir);
    assert.strictEqual(
      problems.length,
      0,
      "Vắng frame.md không được báo lỗi: " + problems.join("; ")
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("A-08 / V-10: khóa có code_language nhưng không có frame.md -> lesson-lint không báo lỗi frame", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "no-frame-lesson-test-"));
  try {
    const brief = getBaseBrief();
    brief.code_language = "rust";
    fs.writeFileSync(path.join(tmpDir, "brief.json"), JSON.stringify(brief, null, 2), "utf8");

    fs.mkdirSync(path.join(tmpDir, "lessons"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "verification"), { recursive: true });

    const lessonData = {
      title: "Kiểm tra quyền ghi",
      summary: "Tóm tắt bài tập code không dùng frame",
      short_description: "Thực hành kiểm tra account readonly trong Rust",
      code: {
        language: "rust",
        mode: "edit",
        starter_source: "pub fn check() {}",
        solution_source: "pub fn check() {}",
        test_source: "assert!(true);",
        instructions: "Sửa mã nguồn theo yêu cầu",
      },
    };
    fs.writeFileSync(path.join(tmpDir, "lessons", "L1-2.json"), JSON.stringify(lessonData, null, 2), "utf8");
    fs.writeFileSync(path.join(tmpDir, "verification", "L1-2.md"), "Verification pass\n```\nok\n```", "utf8");

    assert.strictEqual(fs.existsSync(path.join(tmpDir, "frame.md")), false, "frame.md không tồn tại");

    const lessonLintPath = path.resolve(".claude/skills/course-author/scripts/lesson-lint.mjs");
    let err = null;
    let stdout = "";
    try {
      stdout = execSync(`node ${lessonLintPath} ${tmpDir} L1-2`, { encoding: "utf8" });
    } catch (e) {
      err = e;
    }

    assert.strictEqual(err, null, `lesson-lint không được văng lỗi khi thiếu frame.md: ${err?.stdout || err?.message}`);
    assert.ok(stdout.includes("ok: 1 lesson"), `lesson-lint phải báo ok: ${stdout}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("A-08 / V-11: curriculum hợp lệ đầy đủ model_ref, mental_model và reinforces -> pass", () => {
  const curr = getBaseCurriculum();
  const brief = getBaseBrief();

  const problems = lintCurriculumData(curr, null, { brief });
  assert.strictEqual(problems.length, 0, "Curriculum hợp lệ phải pass: " + problems.join("; "));
});
