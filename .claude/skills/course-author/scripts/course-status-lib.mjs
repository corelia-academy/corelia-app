// .claude/skills/course-author/scripts/course-status-lib.mjs
// Module logic phân loại trạng thái bài học dùng chung cho course-status.mjs và import-local.ts.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const readJson = (p, isOptional = false) => {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    if (isOptional) return null;
    throw new Error(`File ${p} không hợp lệ (lỗi cú pháp JSON): ${err.message}`);
  }
};

function collectLintProblems(scriptName, dir, scriptsDir) {
  const scriptPath = path.join(scriptsDir, scriptName);
  const map = new Map();
  const isDeno = typeof Deno !== "undefined" || (process.execPath && process.execPath.toLowerCase().includes("deno"));
  const cmdArgs = isDeno ? ["run", "-A", "--no-config", scriptPath, dir] : [scriptPath, dir];
  try {
    execFileSync(process.execPath, cmdArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  } catch (err) {
    const stdout = (err.stdout ?? "").toString();
    const stderr = (err.stderr ?? "").toString();
    const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (match) {
        const id = match[1];
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(match[2]);
      }
    }
    // Nếu lint script thoát mã khác 0 mà không parse được bất kỳ dòng lỗi lint nào (<id>: ...)
    if (map.size === 0) {
      const errMsg = stderr.trim() || stdout.trim() || err.message;
      throw new Error(`Lint script ${scriptName} thất bại (mã thoát ${err.status ?? "khác 0"}): ${errMsg}`);
    }
  }
  return map;
}

export function getCourseStatus(courseDir, options = {}) {
  const dir = path.resolve(courseDir ?? ".");
  const scriptsDir = options.scriptsDir ?? __dirname;

  if (!fs.existsSync(dir)) {
    throw new Error(`Không tìm thấy thư mục: ${dir}`);
  }

  const currPath = path.join(dir, "curriculum.json");
  const briefPath = path.join(dir, "brief.json");

  if (!fs.existsSync(currPath)) {
    const next = fs.existsSync(briefPath) ? "nghiên cứu hoặc lập curriculum (bước 2 / bước 3)" : "tạo brief (bước 1)";
    return {
      course_dir: dir,
      status: fs.existsSync(briefPath) ? "chưa_có_curriculum" : "chưa_có_brief",
      next_step: next,
      summary: {
        total: 0,
        chưa_viết: 0,
        chờ_kiểm_chứng: 0,
        chờ_review: 0,
        cần_sửa: 0,
        đạt: 0,
        quá_trần: 0,
        course_review: "chưa_chạy",
      },
      lessons: [],
    };
  }

  const curriculum = readJson(currPath);
  if (!curriculum || !Array.isArray(curriculum.modules)) {
    throw new Error("curriculum.json không hợp lệ hoặc thiếu modules");
  }

  // 1. Đọc review cycles từ run-log.jsonl nếu có
  const cyclesMap = new Map();
  const runLogPath = path.join(dir, "run-log.jsonl");
  if (fs.existsSync(runLogPath)) {
    try {
      const lines = fs.readFileSync(runLogPath, "utf8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (
            entry.step === 6 &&
            (entry.action === "end" || entry.event === "end") &&
            entry.result !== "rerun" &&
            entry.lesson_id &&
            entry.lesson_id !== "-"
          ) {
            cyclesMap.set(entry.lesson_id, (cyclesMap.get(entry.lesson_id) ?? 0) + 1);
          }
        } catch {}
      }
    } catch {}
  }

  // 2. Chạy lesson-lint và review-lint để lấy danh sách lỗi theo lesson
  const lessonLintProblems = collectLintProblems("lesson-lint.mjs", dir, scriptsDir);
  const reviewLintProblems = collectLintProblems("review-lint.mjs", dir, scriptsDir);

  // 3. Phân loại trạng thái từng lesson
  const allLessons = [];
  for (const m of curriculum.modules) {
    for (const l of m.lessons ?? []) {
      if (!l.lesson_id) continue;
      const id = l.lesson_id;
      const lessonFile = path.join(dir, "lessons", `${id}.json`);
      const reviewFile = path.join(dir, "reviews", `${id}.json`);
      const verificationFile = path.join(dir, "verification", `${id}.md`);

      const hasLesson = fs.existsSync(lessonFile);
      const hasReview = fs.existsSync(reviewFile);
      const hasVerification = fs.existsSync(verificationFile);

      let status = "chưa_viết";
      let nextStep = "Viết bài học (bước 5)";
      let cycles = cyclesMap.get(id) ?? (hasReview ? 1 : 0);
      let capped = false;

      if (!hasLesson) {
        status = "chưa_viết";
        nextStep = "Viết bài học (bước 5)";
      } else {
        const rec = readJson(lessonFile);
        const md = rec?.article?.description_markdown ?? "";
        const hasVerificationPlan = Array.isArray(rec?.verification_plan) && rec.verification_plan.length > 0;
        const needsRun = /```/.test(md) || rec?.code || rec?.practice || hasVerificationPlan;

        if (needsRun && !hasVerification) {
          status = "chờ_kiểm_chứng";
          nextStep = "Chạy kiểm chứng và ghi verification (bước 5b)";
        } else if (!hasReview) {
          const lProblems = lessonLintProblems.get(id) ?? [];
          if (lProblems.length > 0) {
            status = "cần_sửa";
            nextStep = "Sửa lỗi bài học theo lesson-lint (bước 5)";
          } else {
            status = "chờ_review";
            nextStep = "Review bài học (bước 6)";
          }
        } else {
          const rev = readJson(reviewFile);
          const lProblems = lessonLintProblems.get(id) ?? [];
          const rProblems = reviewLintProblems.get(id) ?? [];
          const isPass = rev?.verdict === "pass" && lProblems.length === 0 && rProblems.length === 0;

          if (isPass) {
            status = "đạt";
            nextStep = "Hoàn thành";
          } else {
            status = "cần_sửa";
            if (cycles >= 3) {
              capped = true;
              nextStep = "Dừng bài này (quá trần 3 vòng viết–review); tiếp tục bài khác và báo user ở cuối";
            } else {
              nextStep = "Sửa lỗi bài học theo review / lint (bước 5)";
            }
          }
        }
      }

      allLessons.push({
        lesson_id: id,
        title: l.title,
        type: l.type,
        status,
        cycles,
        capped,
        next_step: nextStep,
        lesson_problems: lessonLintProblems.get(id) ?? [],
        review_problems: reviewLintProblems.get(id) ?? [],
      });
    }
  }

  // 4. Kiểm tra cấp khóa (bước 7)
  const courseReviewFile = path.join(dir, "reviews", "course.json");
  let courseReviewStatus = "chưa_chạy";
  if (fs.existsSync(courseReviewFile)) {
    const cr = readJson(courseReviewFile);
    courseReviewStatus = cr?.verdict === "pass" ? "đạt" : "cần_sửa";
  }

  const summary = {
    total: allLessons.length,
    chưa_viết: allLessons.filter((l) => l.status === "chưa_viết").length,
    chờ_kiểm_chứng: allLessons.filter((l) => l.status === "chờ_kiểm_chứng").length,
    chờ_review: allLessons.filter((l) => l.status === "chờ_review").length,
    cần_sửa: allLessons.filter((l) => l.status === "cần_sửa").length,
    đạt: allLessons.filter((l) => l.status === "đạt").length,
    quá_trần: allLessons.filter((l) => l.capped).length,
    course_review: courseReviewStatus,
  };

  return {
    course_dir: dir,
    status: summary.quá_trần > 0 ? "có_bài_quá_trần" : summary.cần_sửa > 0 ? "cần_sửa" : "đạt",
    next_step: summary.cần_sửa > 0 ? "Sửa bài học" : "Hoàn thành",
    summary,
    lessons: allLessons,
  };
}

export function getStuckLessons(courseDir, options = {}) {
  const dir = path.resolve(courseDir ?? ".");
  const currPath = path.join(dir, "curriculum.json");
  if (!fs.existsSync(currPath)) {
    throw new Error(`Thư mục ${dir} không có curriculum.json hợp lệ`);
  }
  const result = getCourseStatus(courseDir, options);
  return (result.lessons || [])
    .filter((l) => l.status !== "đạt")
    .map((l) => l.lesson_id);
}
