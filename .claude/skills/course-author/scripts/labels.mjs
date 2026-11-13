// Sinh nhãn bài và phần từ curriculum.json.
// Chạy: node labels.mjs <thư-mục-khóa>
// Ghi: <thư-mục-khóa>/labels.json dạng { "lessons": { "<id>": "Part X, Bài N" }, "modules": { "<id>": "Part X" } }
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? ".");
const currPath = path.join(dir, "curriculum.json");

if (!fs.existsSync(currPath)) {
  console.error(`Không tìm thấy curriculum.json tại ${currPath}`);
  process.exit(1);
}

const curriculum = JSON.parse(fs.readFileSync(currPath, "utf8"));
const modules = curriculum.modules ?? [];

const labels = {
  lessons: {},
  modules: {},
};

modules.forEach((mod, modIdx) => {
  const partLetter = String.fromCharCode(65 + modIdx); // A, B, C...
  const partLabel = `Part ${partLetter}`;
  if (mod.module_id) {
    labels.modules[mod.module_id] = partLabel;
  }
  const lessons = mod.lessons ?? [];
  lessons.forEach((les, lesIdx) => {
    const lessonNum = lesIdx + 1;
    const lessonLabel = `${partLabel}, Bài ${lessonNum}`;
    if (les.lesson_id) {
      labels.lessons[les.lesson_id] = lessonLabel;
    }
  });
});

const outPath = path.join(dir, "labels.json");
fs.writeFileSync(outPath, JSON.stringify(labels, null, 2) + "\n", "utf8");
console.log(`Đã ghi labels.json (${Object.keys(labels.lessons).length} bài, ${Object.keys(labels.modules).length} module)`);
