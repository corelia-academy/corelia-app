// .claude/skills/course-author/scripts/course-status.mjs
// Script đọc trạng thái khóa học dở dang và in bước tiếp theo cho từng lesson.
// Chạy: node course-status.mjs <thư-mục-khóa> [--json]
import path from "node:path";
import { getCourseStatus, getStuckLessons } from "./course-status-lib.mjs";

export { getCourseStatus, getStuckLessons };

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const isJson = process.argv.includes("--json");
const dir = path.resolve(args[0] ?? ".");

try {
  const result = getCourseStatus(dir);
  const { summary, lessons } = result;

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`=== Trạng thái khóa học: ${path.basename(dir)} ===`);
    console.log(
      `Tổng số bài: ${summary.total} | Đạt: ${summary.đạt} | Cần sửa: ${summary.cần_sửa} (Quá trần: ${summary.quá_trần}) | Chờ review: ${summary.chờ_review} | Chờ kiểm chứng: ${summary.chờ_kiểm_chứng} | Chưa viết: ${summary.chưa_viết}`
    );
    console.log(`Review cấp khóa (bước 7): ${summary.course_review}\n`);

    console.log("| Bài   | Trạng thái      | Vòng | Bước tiếp theo |");
    console.log("|:------|:----------------|:----:|:---------------|");
    for (const l of lessons) {
      const cappedLabel = l.capped ? " [QUÁ TRẦN]" : "";
      console.log(
        `| ${l.lesson_id.padEnd(5)} | ${(l.status + cappedLabel).padEnd(15)} | ${String(l.cycles).padStart(4)} | ${l.next_step} |`
      );
    }
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
