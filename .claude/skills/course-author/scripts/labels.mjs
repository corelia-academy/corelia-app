// .claude/skills/course-author/scripts/labels.mjs
// Sinh nhãn bài và phần từ curriculum.json.
// Chạy: node labels.mjs <thư-mục-khóa>
// Ghi: <thư-mục-khóa>/labels.json dạng { "lessons": { "<id>": "Part X, Bài N" }, "modules": { "<id>": "Part X" } }
import fs from "node:fs";
import path from "node:path";
import { computeLabels } from "./labels-lib.mjs";

export { computeLabels };

const dir = path.resolve(process.argv[2] ?? ".");
const currPath = path.join(dir, "curriculum.json");

if (!fs.existsSync(currPath)) {
  console.error(`Không tìm thấy curriculum.json tại ${currPath}`);
  process.exit(1);
}

const curriculum = JSON.parse(fs.readFileSync(currPath, "utf8"));
const labels = computeLabels(curriculum);

const outPath = path.join(dir, "labels.json");
fs.writeFileSync(outPath, JSON.stringify(labels, null, 2) + "\n", "utf8");
console.log(`Đã ghi labels.json (${Object.keys(labels.lessons).length} bài, ${Object.keys(labels.modules).length} module)`);
