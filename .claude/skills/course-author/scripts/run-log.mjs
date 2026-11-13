// Ghi log lần chạy child agent vào run-log.jsonl.
// Chạy: node run-log.mjs <thư-mục-khóa> <step> <lesson_id|-> <role> <model> <start|end> [result]
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? ".");
const step = process.argv[3] ?? "-";
const lessonIdArg = process.argv[4] ?? "-";
const role = process.argv[5] ?? "-";
const model = process.argv[6] ?? "-";
const action = process.argv[7] ?? "start"; // start | end
const result = process.argv[8] ?? null;

const logFile = path.join(dir, "run-log.jsonl");

const entry = {
  timestamp: new Date().toISOString(),
  step: isNaN(Number(step)) ? step : Number(step),
  lesson_id: lessonIdArg === "-" ? null : lessonIdArg,
  role,
  model,
  action,
  result: result ?? null,
};

fs.appendFileSync(logFile, JSON.stringify(entry) + "\n", "utf8");
