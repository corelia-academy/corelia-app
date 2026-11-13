// Trích xuất tóm lược nội dung toàn khóa học (course digest) phục vụ review cấp khóa.
// Chạy: node course-digest.mjs <thư-mục-khóa>
// In JSON gồm: nhãn, tiêu đề, summary, các tiêu đề ##, prompt và đáp án đúng của từng câu quiz, tên file và chữ ký trong bài code.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? ".");
const currPath = path.join(dir, "curriculum.json");

if (!fs.existsSync(currPath)) {
  console.error(`Không tìm thấy curriculum.json tại ${currPath}`);
  process.exit(1);
}

const curriculum = JSON.parse(fs.readFileSync(currPath, "utf8"));
const labelsPath = path.join(dir, "labels.json");
const labels = fs.existsSync(labelsPath) ? JSON.parse(fs.readFileSync(labelsPath, "utf8")) : null;

const lessonsList = [];
for (const m of curriculum.modules ?? []) {
  for (const l of m.lessons ?? []) {
    if (l.lesson_id) lessonsList.push(l);
  }
}

const missingLessons = [];
for (const l of lessonsList) {
  const lf = path.join(dir, "lessons", `${l.lesson_id}.json`);
  if (!fs.existsSync(lf)) {
    missingLessons.push(l.lesson_id);
  }
}

if (missingLessons.length > 0) {
  console.error(`Curriculum có lesson chưa viết: ${missingLessons.join(", ")}`);
  process.exit(1);
}

function extractSignatures(source) {
  if (!source || typeof source !== "string") return [];
  const lines = source.split("\n");
  const sigs = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Bắt chữ ký hàm / phương thức / struct / trait / interface
    if (/^(?:pub\s+)?(?:async\s+)?(?:fn|def|function)\s+\w+/i.test(trimmed)) {
      sigs.push(trimmed.replace(/\s*\{.*$/, "").trim());
    } else if (/^(?:pub\s+)?(?:struct|enum|trait|interface|type|class)\s+\w+/i.test(trimmed)) {
      sigs.push(trimmed.replace(/\s*\{.*$/, "").trim());
    }
  }
  return sigs;
}

const digest = lessonsList.map((l) => {
  const lf = path.join(dir, "lessons", `${l.lesson_id}.json`);
  const rec = JSON.parse(fs.readFileSync(lf, "utf8"));

  const md =
    rec.article?.description_markdown ??
    rec.video?.description_markdown ??
    rec.practice?.instructions_markdown ??
    "";
  const headers = [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());

  let quizInfo = null;
  if (rec.quiz?.questions) {
    quizInfo = rec.quiz.questions.map((q, idx) => ({
      index: idx + 1,
      prompt: q.prompt ?? "",
      correct_answer: q.options?.[q.correct_index]?.text ?? "",
    }));
  }

  let codeInfo = null;
  if (rec.code) {
    const src = rec.code.reference_solution || rec.code.starter_source || "";
    codeInfo = {
      file_path: rec.code.file_path ?? "",
      signatures: extractSignatures(src),
    };
  }

  return {
    lesson_id: l.lesson_id,
    label: labels?.lessons?.[l.lesson_id] ?? "",
    title: rec.title ?? l.title ?? "",
    summary: rec.summary ?? "",
    headers,
    ...(quizInfo ? { quiz: quizInfo } : {}),
    ...(codeInfo ? { code: codeInfo } : {}),
  };
});

console.log(JSON.stringify(digest, null, 2));
