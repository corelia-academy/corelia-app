import fs from "node:fs";
import path from "node:path";
import { findExecutable, runCmd } from "./exec.ts";
import type { ContextMode, CourseStepKind, PromptBundle } from "./types.ts";

function readOptional(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function roleDocName(lessonType: string): string {
  switch (lessonType) {
    case "code_exercise":
    case "code":
      return "code.md";
    case "quiz":
      return "quiz.md";
    case "practice":
      return "practice.md";
    case "video":
      return "video.md";
    default:
      return "article.md";
  }
}

export function parseCourseStepKind(raw: string): CourseStepKind {
  switch (raw.trim().toLowerCase()) {
    case "1":
    case "brief":
      return "brief";
    case "2":
    case "research":
      return "research";
    case "3":
    case "curriculum":
      return "curriculum";
    case "4":
    case "curriculum-review":
      return "curriculum-review";
    case "7":
    case "course-review":
      return "course-review";
    default:
      throw new Error(
        `Step '${raw}' không hợp lệ. Dùng: brief (1), research (2), curriculum (3), curriculum-review (4), course-review (7)`,
      );
  }
}

export function stepNumber(step: CourseStepKind): number {
  switch (step) {
    case "brief":
      return 1;
    case "research":
      return 2;
    case "curriculum":
      return 3;
    case "curriculum-review":
      return 4;
    case "course-review":
      return 7;
  }
}

export function buildCourseStepBundle(
  repoRoot: string,
  slug: string,
  step: CourseStepKind,
): PromptBundle {
  const courseDir = path.join(repoRoot, ".course-runs", slug);
  const skillDir = path.join(repoRoot, ".claude", "skills", "course-author");

  const principles = readOptional(path.join(skillDir, "references", "principles.md"));
  const platform = readOptional(path.join(skillDir, "references", "platform.md"));

  const parts: string[] = [];
  if (step === "brief") {
    const role = readOptional(path.join(skillDir, "roles", "01-brief.md"));
    const handoff = readOptional(path.join(courseDir, "handoff.json"));
    parts.push(
      'Bạn là child Bước 1 (Metadata & Brief). Trả về DUY NHẤT một JSON object có đúng 2 key cấp 1: `{"metadata": {...}, "brief": {...}}` khớp theo role dưới đây (không ghi file trực tiếp).\n\n',
      role,
      "\n\n# Chuẩn nguyên tắc & nền tảng\n",
      principles,
      "\n",
      platform,
    );
    if (handoff.trim()) {
      parts.push("\n\n# handoff.json\n```json\n", handoff.trim(), "\n```\n");
    }
  } else if (step === "research") {
    const role = readOptional(path.join(skillDir, "roles", "02-research.md"));
    const brief = readOptional(path.join(courseDir, "brief.json"));
    if (!brief.trim()) throw new Error("Chưa có brief.json — cần chạy Bước 1 trước");
    parts.push(
      "Bạn là child Bước 2 (Research). Trả về DUY NHẤT JSON của `research.json` (không ghi file trực tiếp).\n\n",
      role,
      "\n\n# Chuẩn nguyên tắc & nền tảng\n",
      principles,
      "\n",
      platform,
      "\n\n# brief.json\n```json\n",
      brief.trim(),
      "\n```\n",
    );
  } else if (step === "curriculum") {
    const role = readOptional(path.join(skillDir, "roles", "03-curriculum.md"));
    const brief = readOptional(path.join(courseDir, "brief.json"));
    const research = readOptional(path.join(courseDir, "research.json"));
    const handoff = readOptional(path.join(courseDir, "handoff.json"));
    if (!brief.trim() || !research.trim()) {
      throw new Error("Cần có brief.json và research.json trước khi chạy Bước 3 (Curriculum)");
    }
    parts.push(
      'Bạn là child Bước 3 (Curriculum). Trả về DUY NHẤT một JSON object có các key: `{"curriculum": {...}, "final_assignment": {...}, "frame_md": "...", "provided_prerequisites": [...]}` (`frame_md` và `provided_prerequisites` có thể null nếu không dùng; không ghi file trực tiếp).\n\n',
      role,
      "\n\n# Chuẩn nguyên tắc & nền tảng\n",
      principles,
      "\n",
      platform,
    );
    if (handoff.trim()) {
      parts.push("\n\n# handoff.json\n```json\n", handoff.trim(), "\n```\n");
    }
    parts.push(
      "\n\n# brief.json\n```json\n",
      brief.trim(),
      "\n```\n\n# research.json\n```json\n",
      research.trim(),
      "\n```\n",
    );
  } else if (step === "curriculum-review") {
    const role = readOptional(path.join(skillDir, "roles", "04-curriculum-review.md"));
    const brief = readOptional(path.join(courseDir, "brief.json"));
    const research = readOptional(path.join(courseDir, "research.json"));
    const curriculum = readOptional(path.join(courseDir, "curriculum.json"));
    const finalAssignment = readOptional(path.join(courseDir, "final_assignment.json"));
    const frameMd = readOptional(path.join(courseDir, "frame.md"));
    if (!curriculum.trim()) {
      throw new Error("Chưa có curriculum.json — cần chạy Bước 3 trước");
    }
    parts.push(
      "Bạn là child Bước 4 (Curriculum Review). Trả về DUY NHẤT JSON của `reviews/curriculum.json` (không ghi file trực tiếp).\n\n",
      role,
      "\n\n# Chuẩn nguyên tắc & nền tảng\n",
      principles,
      "\n",
      platform,
    );
    if (brief.trim()) {
      parts.push("\n\n# brief.json\n```json\n", brief.trim(), "\n```\n");
    }
    if (research.trim()) {
      parts.push("\n\n# research.json\n```json\n", research.trim(), "\n```\n");
    }
    if (frameMd.trim()) {
      parts.push("\n\n# frame.md\n", frameMd);
    }
    parts.push("\n\n# curriculum.json\n```json\n", curriculum.trim(), "\n```\n");
    if (finalAssignment.trim()) {
      parts.push("\n\n# final_assignment.json\n```json\n", finalAssignment.trim(), "\n```\n");
    }
  } else {
    const role = readOptional(path.join(skillDir, "roles", "07-course-review.md"));
    const brief = readOptional(path.join(courseDir, "brief.json"));
    const curriculum = readOptional(path.join(courseDir, "curriculum.json"));
    const finalAssignment = readOptional(path.join(courseDir, "final_assignment.json"));
    if (!curriculum.trim()) {
      throw new Error("Chưa có curriculum.json — không thể chạy Bước 7 (Course Review)");
    }

    let digest = "";
    const digestScript = path.join(skillDir, "scripts", "course-digest.mjs");
    if (fs.existsSync(digestScript)) {
      const node = findExecutable(["node.exe", "node.cmd", "node"]);
      if (node) {
        const out = runCmd(node, [digestScript, courseDir], repoRoot, undefined, 25_000);
        if (out.exitOk) digest = out.stdout;
      }
    }

    parts.push(
      "Bạn là child Bước 7 (Course Review). Trả về DUY NHẤT JSON của `reviews/course.json` (không ghi file trực tiếp).\n\n",
      role,
      "\n\n# Chuẩn nguyên tắc & nền tảng\n",
      principles,
      "\n",
      platform,
    );
    if (brief.trim()) {
      parts.push("\n\n# brief.json\n```json\n", brief.trim(), "\n```\n");
    }
    parts.push("\n\n# curriculum.json\n```json\n", curriculum.trim(), "\n```\n");
    if (finalAssignment.trim()) {
      parts.push("\n\n# final_assignment.json\n```json\n", finalAssignment.trim(), "\n```\n");
    }
    if (digest.trim()) {
      parts.push("\n\n# Course Digest\n", digest);
    }
  }

  const prompt = parts.join("");
  const cacheDir = path.join(courseDir, ".cm-cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const bundlePath = path.join(cacheDir, `step-${step}.md`);
  fs.writeFileSync(bundlePath, prompt, "utf8");

  return {
    slug,
    lesson_id: "-",
    lesson_type: "course",
    mode: step,
    bundle_path: bundlePath,
    chars: prompt.length,
    prompt,
  };
}

export function buildPromptBundle(
  repoRoot: string,
  slug: string,
  lessonId: string,
  mode: ContextMode,
  extraErrors: readonly string[] = [],
): PromptBundle {
  const courseDir = path.join(repoRoot, ".course-runs", slug);
  const skillDir = path.join(repoRoot, ".claude", "skills", "course-author");
  const contextScript = path.join(skillDir, "scripts", "lesson-context.mjs");
  const node = findExecutable(["node.exe", "node.cmd", "node"]);
  if (!node) {
    throw new Error("Không tìm thấy `node` trong PATH để chạy lesson-context.mjs.");
  }

  const ctxOut = runCmd(node, [contextScript, courseDir, lessonId], repoRoot, undefined, 25_000);
  if (!ctxOut.exitOk) {
    throw new Error(
      `lesson-context.mjs lỗi: ${(ctxOut.stderr || ctxOut.stdout).trim()}`,
    );
  }

  let lessonType = "article";
  try {
    const parsed = JSON.parse(ctxOut.stdout) as { lesson?: { type?: string } };
    if (parsed.lesson?.type) lessonType = parsed.lesson.type;
  } catch {
    // fallback default
  }

  const roleFile = roleDocName(lessonType);
  const principles = readOptional(path.join(skillDir, "references", "principles.md"));
  const platform = readOptional(path.join(skillDir, "references", "platform.md"));
  const frameMd = readOptional(path.join(courseDir, "frame.md"));

  const parts: string[] = [];
  if (mode === "write") {
    const common = readOptional(path.join(skillDir, "roles", "05-lesson", "common.md"));
    const specific = readOptional(path.join(skillDir, "roles", "05-lesson", roleFile));
    parts.push(
      "Bạn là child viết MỘT lesson Corelia. Toàn bộ ngữ cảnh đã được bơm sẵn bên dưới để hạn chế tool call dư thừa; CHỈ trả về JSON hợp lệ theo schema Output của lesson (không bọc giải thích thừa).\n\n",
      "# Role chung\n",
      common,
      "\n\n# Role theo loại bài\n",
      specific,
      "\n\n# Chuẩn nguyên tắc & nền tảng\n",
      principles,
      "\n",
      platform,
    );
    if (lessonType === "article" || lessonType === "video") {
      const diagrams = readOptional(path.join(skillDir, "references", "platform-diagrams.md"));
      if (diagrams) parts.push("\n\n# Quy tắc sơ đồ\n", diagrams);
    }
    if (frameMd) parts.push("\n\n# Khung chuẩn frame.md\n", frameMd);
    parts.push("\n\n# Lesson Context JSON\n```json\n", ctxOut.stdout.trim(), "\n```\n");
  } else if (mode === "review") {
    const common = readOptional(path.join(skillDir, "roles", "06-lesson-review", "common.md"));
    const specific = readOptional(path.join(skillDir, "roles", "06-lesson-review", roleFile));
    const lessonJson = readOptional(path.join(courseDir, "lessons", `${lessonId}.json`));
    const verificationMd = readOptional(path.join(courseDir, "verification", `${lessonId}.md`));
    const prevReview = readOptional(path.join(courseDir, "reviews", `${lessonId}.json`));

    parts.push(
      "Bạn là child REVIEW MỘT lesson Corelia. Toàn bộ ngữ cảnh và bài học đã được bơm sẵn bên dưới; KHÔNG cần đọc lại từng file rời. Trả về đúng JSON schema `reviews/<lesson_id>.json`.\n\n",
      "# Role review chung\n",
      common,
      "\n\n# Role review loại bài\n",
      specific,
      "\n\n# Chuẩn nguyên tắc & nền tảng\n",
      principles,
      "\n",
      platform,
    );
    if (frameMd) parts.push("\n\n# Khung chuẩn frame.md\n", frameMd);
    parts.push(
      "\n\n# Lesson Context JSON\n```json\n",
      ctxOut.stdout.trim(),
      "\n```\n\n# Nội dung bài học hiện tại\n```json\n",
      lessonJson.trim(),
      "\n```\n\n# Verification hiện tại\n",
      verificationMd,
    );
    if (prevReview.trim()) {
      parts.push("\n\n# Review vòng trước (`previous_review`)\n```json\n", prevReview.trim(), "\n```\n");
    }
  } else {
    const lessonJson = readOptional(path.join(courseDir, "lessons", `${lessonId}.json`));
    const verificationMd = readOptional(path.join(courseDir, "verification", `${lessonId}.md`));
    const prevReview = readOptional(path.join(courseDir, "reviews", `${lessonId}.json`));

    parts.push(
      "Bạn đang chạy **PATCH MODE** để sửa lỗi có chủ đích cho MỘT lesson Corelia mà KHÔNG viết lại toàn bộ file. Hãy trả về một **JSON Merge Patch** (chỉ chứa đúng các field bị thay đổi để merge đè vào `lessons/<id>.json`; trường không đổi thì bỏ qua).\nLưu ý hội tụ: kiểm tra lại riêng toàn bộ câu và đoạn vừa thêm hoặc viết lại — bảo đảm không đưa vào thuật ngữ, cú pháp, ký hiệu mới chưa giải thích tại lần xuất hiện đầu và mọi phát biểu mới đều có nguồn trong Lesson Context JSON hoặc kết quả chạy thật.\n\n",
    );
    if (extraErrors.length > 0) {
      parts.push("# Lỗi máy móc cần sửa ngay\n");
      for (const e of extraErrors) parts.push(`- ${e}\n`);
      parts.push("\n");
    }
    if (prevReview.trim()) {
      parts.push("# Review blocking/issues cần sửa\n```json\n", prevReview.trim(), "\n```\n\n");
    }
    parts.push("# Verification hiện tại\n", verificationMd);
    if (frameMd) parts.push("\n\n# Khung chuẩn frame.md\n", frameMd);
    parts.push(
      "\n\n# Lesson Context JSON\n```json\n",
      ctxOut.stdout.trim(),
      "\n```\n\n# Lesson JSON hiện tại\n```json\n",
      lessonJson.trim(),
      "\n```\n",
    );
  }

  const prompt = parts.join("");
  const cacheDir = path.join(courseDir, ".cm-cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const bundlePath = path.join(cacheDir, `${lessonId}.${mode}.md`);
  fs.writeFileSync(bundlePath, prompt, "utf8");

  return {
    slug,
    lesson_id: lessonId,
    lesson_type: lessonType,
    mode,
    bundle_path: bundlePath,
    chars: prompt.length,
    prompt,
  };
}
