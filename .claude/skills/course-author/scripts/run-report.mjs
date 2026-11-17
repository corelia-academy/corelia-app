// .claude/skills/course-author/scripts/run-report.mjs
// Sinh báo cáo tổng kết cuối phiên sản xuất khóa học và ghi vào .course-runs/<slug>/run-report.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeRunLog, renderCostSection } from "./cost-lib.mjs";

const JWT_KEY_PATTERN = /eyJ[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}/;
const SERVICE_KEY_WORDS = /service_role\s*key\s*[:=]\s*[^\s]+/i;

export function sanitizeReport(content) {
  if (typeof content !== "string") return "";
  if (JWT_KEY_PATTERN.test(content) || SERVICE_KEY_WORDS.test(content)) {
    throw new Error("Báo cáo vi phạm bảo mật: chứa chuỗi giống Supabase service key");
  }
  return content;
}

export function generateRunReport(courseDir, options = {}) {
  const dir = path.resolve(courseDir);
  const readJson = (rel) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, rel), "utf8"));
    } catch {
      return null;
    }
  };

  const handoff = readJson("handoff.json") || {};
  const brief = readJson("brief.json") || {};
  const curriculum = readJson("curriculum.json") || {};
  const research = readJson("research.json") || {};

  const slug = handoff.slug || brief.slug || path.basename(dir);
  const title = handoff.title || brief.title || slug;
  const pathSlug = handoff.path || "chưa_gắn_path";
  const rank = options.rank != null ? options.rank : 1;
  const gateResult = options.gateResult || "ĐẠT (Qua cả 6 Gate)";
  const coordinatorModel = options.coordinatorModel || handoff.coordinator_model || "Mặc định của session";
  const defaultChildModelNotice = Boolean(options.defaultChildModelNotice || handoff.default_child_model_notice);

  // 1. Danh sách module và bài
  const modulesList = [];
  const stuckLessons = [];
  const notRunSteps = [];

  for (const mod of (curriculum.modules || [])) {
    const modItem = {
      module_id: mod.module_id,
      title: mod.title,
      lessons: []
    };

    for (const les of (mod.lessons || [])) {
      const lesId = les.lesson_id;
      modItem.lessons.push({
        lesson_id: lesId,
        title: les.title,
        type: les.type || les.lesson_format || "article",
      });

      // Kiểm tra review xem có bị kẹt không
      const rev = readJson(path.join("reviews", `${lesId}.json`));
      if (rev && rev.verdict && rev.verdict !== "pass") {
        const reasons = (rev.issues || [])
          .filter((iss) => iss.severity === "blocking" || iss.type === "blocking")
          .map((iss) => iss.summary || iss.detail || iss.message || "Không đạt review");
        stuckLessons.push({
          lesson_id: lesId,
          title: les.title,
          reasons: reasons.length > 0 ? reasons : ["Review không đạt"]
        });
      }

      // Kiểm tra verification xem có bước not_run không
      const verPath = path.join(dir, "verification", `${lesId}.md`);
      if (fs.existsSync(verPath)) {
        try {
          const verText = fs.readFileSync(verPath, "utf8");
          const notRunMatches = verText.matchAll(/not_run\s*[:—\-]\s*([^\n\r]+)/gi);
          for (const m of notRunMatches) {
            notRunSteps.push({
              lesson_id: lesId,
              reason: m[1].trim()
            });
          }
        } catch {}
      }
    }
    modulesList.push(modItem);
  }

  // 2. Open questions
  const openQuestions = Array.isArray(research.open_questions)
    ? research.open_questions
    : [];

  // 3. Kết quả import
  const importResult = options.importResult || null;
  const skipImportReason = options.skipImportReason || null;

  // Xây dựng nội dung Markdown
  const lines = [
    `# Báo cáo Tổng kết Sản xuất Khóa học: ${title}`,
    "",
    "## 1. Thông tin Khóa học & Lộ trình",
    `- **Slug:** \`${slug}\``,
    `- **Khóa đã chọn & Rank:** Rank ${rank}`,
    `- **Lộ trình (Path):** \`${pathSlug}\``,
    `- **Kết quả Gate:** ${gateResult}`,
    `- **Model Coordinator:** \`${coordinatorModel}\``,
  ];

  if (defaultChildModelNotice) {
    lines.push("- **Ghi chú Model Child:** Nền tảng không hỗ trợ chỉ định model child; toàn bộ child chạy bằng model mặc định.");
  }

  lines.push("", "## 2. Danh sách Module & Bài học");

  if (modulesList.length === 0) {
    lines.push("_Chưa có danh sách module._");
  } else {
    for (const mod of modulesList) {
      lines.push(`### ${mod.module_id}: ${mod.title}`);
      for (const l of mod.lessons) {
        lines.push(`- **${l.lesson_id}**: ${l.title} _(${l.type})_`);
      }
      lines.push("");
    }
  }

  lines.push("## 3. Bài học bị kẹt (Stuck Lessons)");
  if (stuckLessons.length === 0) {
    lines.push("- Không có bài nào bị kẹt.");
  } else {
    for (const s of stuckLessons) {
      lines.push(`- **${s.lesson_id}** (${s.title}): ${s.reasons.join("; ")}`);
    }
  }
  lines.push("");

  lines.push("## 4. Các bước thực hành not_run");
  if (notRunSteps.length === 0) {
    lines.push("- Toàn bộ các bước thực hành đã được kiểm chứng hoặc không yêu cầu bước ngoại lệ.");
  } else {
    for (const nr of notRunSteps) {
      lines.push(`- **${nr.lesson_id}**: ${nr.reason}`);
    }
  }
  lines.push("");

  lines.push("## 5. Câu hỏi mở còn lại (open_questions)");
  if (openQuestions.length === 0) {
    lines.push("- Không còn open questions.");
  } else {
    for (const q of openQuestions) {
      lines.push(`- ${q}`);
    }
  }
  lines.push("");

  lines.push("## 6. Kết quả Nhập Dữ liệu Local DB");
  if (importResult) {
    lines.push(`- **Course ID:** \`${importResult.course_id}\``);
    lines.push(`- **Trạng thái xuất bản (published):** \`${importResult.published}\``);
    lines.push(`- **Số bài publish:** ${importResult.lessons_published}`);
    lines.push(`- **Số bài không publish (bị kẹt):** ${importResult.lessons_stuck || 0}`);
    lines.push(`- **Cờ is_updating:** \`${Boolean(importResult.is_updating)}\``);
  } else if (skipImportReason) {
    lines.push(`- **Chưa nhập vào DB:** ${skipImportReason}`);
    lines.push(`- **Lệnh nhập thủ công:**`);
    lines.push("  ```bash");
    lines.push(`  SERVICE_KEY=<local_service_role_key> deno run -A --no-config .claude/skills/course-author/scripts/import-local.ts "${dir}"`);
    lines.push("  ```");
  } else {
    lines.push("- Không thực hiện import.");
  }
  lines.push("");

  // 4. Mục tiêu học tập bị mất bài kiểm chứng do bài kẹt
  const allStuckIds = new Set([
    ...stuckLessons.map((s) => s.lesson_id),
    ...(options.stuckLessons || []),
    ...(importResult?.stuck_lessons || []),
  ]);

  const passedOutcomeIds = new Set(
    Array.isArray(options.unverifiedOutcomes)
      ? options.unverifiedOutcomes.map((u) => (typeof u === "string" ? u : u.outcome_id))
      : Array.isArray(importResult?.unverified_outcomes)
      ? importResult.unverified_outcomes.map((u) => (typeof u === "string" ? u : u.outcome_id))
      : []
  );

  const unverifiedOutcomes = [];
  if (Array.isArray(curriculum.outcomes)) {
    for (const out of curriculum.outcomes) {
      if (typeof out === "object" && out !== null) {
        const outId = out.outcome_id || "";
        const isStuckByCheck =
          Array.isArray(out.check_lesson_ids) &&
          out.check_lesson_ids.length > 0 &&
          out.check_lesson_ids.every((id) => allStuckIds.has(id));
        const isStuckByOption = passedOutcomeIds.has(outId);

        if (isStuckByCheck || isStuckByOption) {
          unverifiedOutcomes.push({
            outcome_id: outId,
            text: out.text || "",
            check_lesson_ids: out.check_lesson_ids || [],
          });
        }
      }
    }
  }

  lines.push("## 7. Mục tiêu học tập mất bài kiểm chứng (Unverified Outcomes)");
  if (unverifiedOutcomes.length === 0) {
    lines.push("- Không có mục tiêu học tập nào bị mất bài kiểm chứng.");
  } else {
    for (const u of unverifiedOutcomes) {
      const idStr = u.outcome_id ? `**${u.outcome_id}** ` : "";
      const textStr = u.text ? `(${u.text}): ` : ": ";
      const lessonsStr = (u.check_lesson_ids || []).join(", ");
      lines.push(`- ${idStr}${textStr}Toàn bộ bài kiểm chứng bị kẹt không publish (${lessonsStr}).`);
    }
  }
  lines.push("");

  lines.push("## 8. Chi phí đo được (child)");
  lines.push(...renderCostSection(summarizeRunLog(dir)));
  lines.push("");

  const content = sanitizeReport(lines.join("\n"));
  const reportPath = path.join(dir, "run-report.md");
  fs.writeFileSync(reportPath, content, "utf8");

  return { reportPath, content };
}

// CLI runner
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const { reportPath, content } = generateRunReport(targetDir);
  console.log(`[run-report] Đã ghi báo cáo vào ${reportPath}`);
  console.log("\n" + content);
}
