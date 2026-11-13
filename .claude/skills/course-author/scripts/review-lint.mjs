// Bộ lọc máy móc cho review. Chạy: node review-lint.mjs <thư-mục-khóa> [id ...]
// Không có id thì kiểm mọi review trong reviews/ (kể cả curriculum và course nếu có).
// Thoát mã 1 và in từng dòng "id: luật: chi tiết" khi có lỗi.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? ".");
const only = process.argv.slice(3);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const reviewsDir = path.join(dir, "reviews");
if (!fs.existsSync(reviewsDir)) {
  console.log(`reviews: thư-mục: không tìm thấy thư mục reviews tại ${reviewsDir}`);
  process.exit(1);
}

let ids = only.length
  ? only
  : fs
      .readdirSync(reviewsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));

// Sắp xếp ids: curriculum trước, course, rồi đến các lesson
ids.sort((a, b) => {
  if (a === "curriculum") return -1;
  if (b === "curriculum") return 1;
  if (a === "course") return -1;
  if (b === "course") return 1;
  return a.localeCompare(b, undefined, { numeric: true });
});

let curriculum = null;
const currPath = path.join(dir, "curriculum.json");
if (fs.existsSync(currPath)) {
  try {
    curriculum = readJson(currPath);
  } catch {}
}

const hasFrame = fs.existsSync(path.join(dir, "frame.md"));

const lessonTypeMap = new Map();
if (curriculum?.modules) {
  for (const m of curriculum.modules) {
    for (const l of m.lessons ?? []) {
      if (l.lesson_id) {
        let t = l.type;
        if (t === "code_exercise") t = "code";
        lessonTypeMap.set(l.lesson_id, t);
      }
    }
  }
}

function getLessonType(id) {
  if (id === "curriculum") return "curriculum";
  if (id === "course") return "course";
  if (lessonTypeMap.has(id)) return lessonTypeMap.get(id);
  const lf = path.join(dir, "lessons", `${id}.json`);
  if (fs.existsSync(lf)) {
    try {
      const rec = readJson(lf);
      if (rec.quiz) return "quiz";
      if (rec.code) return "code";
      if (rec.practice) return "practice";
      if (rec.video) return "video";
      if (rec.article) return "article";
    } catch {}
  }
  return "unknown";
}

const REQUIRED_CRITERIA_BY_TYPE = {
  curriculum: [
    "alignment",
    "outcome_coverage",
    "learning_flow",
    "practice_and_feedback",
    "review_and_application",
    "final_assignment",
    "sources_by_topic",
    "platform_formats",
  ],
  course: [
    "terminology_consistency",
    "cross_lesson_contradiction",
    "recall_validity",
    "no_duplicate_teaching",
    "concept_order",
  ],
  article: [
    "factual_accuracy",
    "tool_versions",
    "outcome_and_level",
    "lesson_flow",
    "learnability",
    "verification",
    "diagrams",
    "language",
    "tone_and_flow",
  ],
  video: [
    "factual_accuracy",
    "tool_versions",
    "outcome_and_level",
    "lesson_flow",
    "learnability",
    "verification",
    "language",
    "tone_and_flow",
  ],
  quiz: [
    "factual_accuracy",
    "tool_versions",
    "outcome_and_level",
    "lesson_flow",
    "answers",
    "verification",
    "language",
    "tone_and_flow",
  ],
  code: [
    "factual_accuracy",
    "tool_versions",
    "outcome_and_level",
    "lesson_flow",
    "answers",
    "verification",
    "language",
    "tone_and_flow",
  ],
  practice: [
    "factual_accuracy",
    "tool_versions",
    "outcome_and_level",
    "lesson_flow",
    "verification",
    "language",
    "tone_and_flow",
  ],
  unknown: [
    "factual_accuracy",
    "tool_versions",
    "outcome_and_level",
    "lesson_flow",
    "verification",
    "language",
    "tone_and_flow",
  ],
};

const FORBIDDEN_PASS_ISSUE_CRITERIA = new Set([
  "factual_accuracy",
  "answers",
  "frame_consistency",
  "verification",
  "outcome_and_level",
]);

function hasValidNotRun(id) {
  const vFile = path.join(dir, "verification", `${id}.md`);
  if (!fs.existsSync(vFile)) return false;
  let content = "";
  try {
    content = fs.readFileSync(vFile, "utf8");
  } catch {
    return false;
  }
  const lines = content.split("\n");
  for (const line of lines) {
    if (!/not_run/i.test(line)) continue;
    if (/không có bước not_run/i.test(line)) continue;
    // Dòng not_run có lý do tách bạch: sau dấu hai chấm hoặc trong ngoặc
    if (/not_run\s*:\s*\S+/i.test(line)) return true;
    if (/not_run\s*\([^)]+\)/i.test(line)) return true;
    // Ô bảng riêng có ô mô tả kèm theo
    if (/\|/.test(line)) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      const notRunIdx = cells.findIndex((c) => /\bnot_run\b/i.test(c));
      if (notRunIdx !== -1) {
        const otherCells = cells.filter((_, i) => i !== notRunIdx);
        if (otherCells.some((c) => c.length > 3 && !/^(pass|fail|shell|gui|v\d+)$/i.test(c))) {
          return true;
        }
      }
    }
  }
  return false;
}

const problems = [];
const add = (id, rule, detail) => problems.push(`${id}: ${rule}: ${detail}`);

for (const id of ids) {
  const reviewFile = path.join(reviewsDir, `${id}.json`);
  if (!fs.existsSync(reviewFile)) {
    add(id, "thiếu-file", reviewFile);
    continue;
  }

  let rec = null;
  try {
    rec = readJson(reviewFile);
  } catch (err) {
    add(id, "json-hỏng", err.message);
    continue;
  }

  if (!rec || typeof rec !== "object") {
    add(id, "định-dạng", "nội dung review không phải object");
    continue;
  }

  const verdict = rec.verdict;
  const checks = rec.checks;
  const issues = rec.issues ?? [];

  if (verdict !== "pass" && verdict !== "needs_fix") {
    add(id, "verdict", `verdict không hợp lệ: "${verdict}" (chỉ chấp nhận "pass" hoặc "needs_fix")`);
  }

  if (!Array.isArray(checks)) {
    add(id, "checks", "thiếu trường checks hoặc checks không phải mảng");
    continue;
  }

  const type = getLessonType(id);
  const baseRequired = REQUIRED_CRITERIA_BY_TYPE[type] ?? REQUIRED_CRITERIA_BY_TYPE.unknown;
  const requiredCriteria = [...baseRequired];
  if (hasFrame && type !== "curriculum" && type !== "course") {
    if (!requiredCriteria.includes("frame_consistency")) {
      requiredCriteria.push("frame_consistency");
    }
  }

  const seenCriteria = new Set();
  for (const c of checks) {
    const crit = c.criterion;
    if (!crit) {
      add(id, "checks", "check thiếu trường criterion");
      continue;
    }
    if (seenCriteria.has(crit)) {
      add(id, "checks", `tiêu chí "${crit}" bị lặp`);
    }
    seenCriteria.add(crit);
  }

  for (const req of requiredCriteria) {
    if (!seenCriteria.has(req)) {
      add(id, "checks", `thiếu tiêu chí "${req}" cho loại bài ${type}`);
    }
  }

  if (verdict === "pass") {
    for (const c of checks) {
      if (c.result === "unverified") {
        if (c.criterion === "verification" && hasValidNotRun(id)) {
          // Ngoại lệ hợp lệ: verification có bước not_run kèm lý do tách bạch
          continue;
        }
        add(id, "unverified", `check "${c.criterion}" ghi unverified ở review pass`);
      }
    }

    for (const is of issues) {
      if (FORBIDDEN_PASS_ISSUE_CRITERIA.has(is.criterion)) {
        add(id, "issue-cốt-lõi", `verdict pass còn issue thuộc "${is.criterion}" (${is.severity ?? "minor"})`);
      }
      if (is.severity === "blocking") {
        const loc = Array.isArray(is.location) ? is.location.join(",") : is.location || "chưa rõ";
        add(id, "blocking", `verdict pass còn issue blocking ở ${loc}`);
      }
    }
  }

  for (let i = 0; i < issues.length; i++) {
    const is = issues[i];
    const idxStr = `issues[${i}]`;
    const hasValidLocation =
      (typeof is.location === "string" && is.location.trim().length > 0) ||
      (Array.isArray(is.location) &&
        is.location.length > 0 &&
        is.location.every((l) => typeof l === "string" && l.trim().length > 0));
    if (!hasValidLocation) {
      add(id, "issue", `${idxStr}: thiếu location`);
    }
    if (!is.problem || typeof is.problem !== "string" || !is.problem.trim()) {
      add(id, "issue", `${idxStr}: thiếu problem`);
    }
    if (!is.fix || typeof is.fix !== "string" || !is.fix.trim()) {
      add(id, "issue", `${idxStr}: thiếu fix`);
    }
  }
}

if (problems.length) {
  console.log(problems.join("\n"));
  process.exit(1);
}

console.log(`ok: ${ids.length} review`);
