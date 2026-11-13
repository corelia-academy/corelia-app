// Script đọc trạng thái khóa học dở dang và in bước tiếp theo cho từng lesson.
// Chạy: node course-status.mjs <thư-mục-khóa> [--json]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const isJson = process.argv.includes("--json");
const dir = path.resolve(args[0] ?? ".");

if (!fs.existsSync(dir)) {
  console.error(`Không tìm thấy thư mục: ${dir}`);
  process.exit(1);
}

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};

const currPath = path.join(dir, "curriculum.json");
const briefPath = path.join(dir, "brief.json");

if (!fs.existsSync(currPath)) {
  const next = fs.existsSync(briefPath) ? "nghiên cứu hoặc lập curriculum (bước 2 / bước 3)" : "tạo brief (bước 1)";
  const res = {
    course_dir: dir,
    status: fs.existsSync(briefPath) ? "chưa_có_curriculum" : "chưa_có_brief",
    next_step: next,
    lessons: [],
  };
  if (isJson) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log(`Khóa tại ${dir}: ${res.status}`);
    console.log(`Bước tiếp theo: ${next}`);
  }
  process.exit(0);
}

const curriculum = readJson(currPath);
if (!curriculum || !Array.isArray(curriculum.modules)) {
  console.error("curriculum.json không hợp lệ hoặc thiếu modules");
  process.exit(1);
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
        if (entry.step === 6 && entry.event === "end" && entry.lesson_id && entry.lesson_id !== "-") {
          cyclesMap.set(entry.lesson_id, (cyclesMap.get(entry.lesson_id) ?? 0) + 1);
        }
      } catch {}
    }
  } catch {}
}

// 2. Chạy lesson-lint và review-lint để lấy danh sách lỗi theo lesson
function collectLintProblems(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  const map = new Map();
  try {
    execFileSync(process.execPath, [scriptPath, dir], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  } catch (err) {
    const stdout = (err.stdout ?? "").toString();
    const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (match) {
        const id = match[1];
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(match[2]);
      }
    }
  }
  return map;
}

const lessonLintProblems = collectLintProblems("lesson-lint.mjs");
const reviewLintProblems = collectLintProblems("review-lint.mjs");

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
      const needsRun = /```/.test(md) || rec?.code || rec?.practice;

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

if (isJson) {
  console.log(JSON.stringify({ course_dir: dir, summary, lessons: allLessons }, null, 2));
} else {
  console.log(`=== Trạng thái khóa học: ${path.basename(dir)} ===`);
  console.log(`Tổng số bài: ${summary.total} | Đạt: ${summary.đạt} | Cần sửa: ${summary.cần_sửa} (Quá trần: ${summary.quá_trần}) | Chờ review: ${summary.chờ_review} | Chờ kiểm chứng: ${summary.chờ_kiểm_chứng} | Chưa viết: ${summary.chưa_viết}`);
  console.log(`Review cấp khóa (bước 7): ${summary.course_review}\n`);

  console.log("| Bài   | Trạng thái      | Vòng | Bước tiếp theo |");
  console.log("|:------|:----------------|:----:|:---------------|");
  for (const l of allLessons) {
    const cappedLabel = l.capped ? " [QUÁ TRẦN]" : "";
    console.log(`| ${l.lesson_id.padEnd(5)} | ${(l.status + cappedLabel).padEnd(15)} | ${String(l.cycles).padStart(4)} | ${l.next_step} |`);
  }
}
